import { Injectable } from '@angular/core';
import { catchError, concatMap, from, map, Observable, of, reduce, throwError } from 'rxjs';

import { storageGet } from '../utils/storage.util';

import { Ingredient } from '../models/ingredient.model';
import { EstimateMarginsResult, MenuItem } from '../models/menu-item.model';
import { ClaudeApiService } from './claude-api.service';
import { GeminiApiService } from './gemini-api.service';
import { IngredientPriceService } from './ingredient-price.service';

interface ClaudeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface ClaudeRecipeResponse {
  menu_item?: string;
  ingredients?: ClaudeIngredient[];
  unrecognised?: boolean;
}

const SYSTEM_PROMPT = `You are a professional food cost analyst specialising in Indonesian restaurant and café menus. When given a menu item name and its selling price, you return a JSON object describing the standard recipe ingredients needed to produce one standard serving of that dish.

Rules:
1. Return ONLY valid JSON. No explanation, no markdown, no preamble.
2. Use standard Indonesian or common culinary ingredient names in Bahasa Indonesia.
3. Quantities must be realistic for a single restaurant portion.
4. Unit must be one of: gram, ml, butir, lembar, siung, buah, sdm, sdt, porsi.
5. If the menu item is unrecognisable or too vague, return { "unrecognised": true }.

Output schema:
{
  "menu_item": "string",
  "ingredients": [
    { "name": "string", "quantity": number, "unit": "string" }
  ]
}`;

@Injectable({ providedIn: 'root' })
export class EnrichmentService {
  constructor(
    private readonly claudeApi: ClaudeApiService,
    private readonly geminiApi: GeminiApiService,
    private readonly ingredientPrice: IngredientPriceService
  ) {}

  private callAi(systemPrompt: string, userPrompt: string): Observable<string> {
    const provider = storageGet('md_ai_provider_v1') ?? 'claude';
    if (provider === 'gemini') {
      return this.geminiApi.call({ systemPrompt, userPrompt, temperature: 0.2 });
    }
    return this.claudeApi.call({ systemPrompt, userPrompt, temperature: 0.2 });
  }

  estimateItem(item: MenuItem): Observable<MenuItem> {
    const userPrompt = `Menu item: "${item.name}"\nSelling price: IDR ${item.selling_price_idr}\nReturn the standard ingredient breakdown for one serving of this dish.`;

    return this.callAi(SYSTEM_PROMPT, userPrompt).pipe(
      map((text) => this.parseAndEnrich(item, text)),
      catchError((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return of({ ...item, status: 'failed' as const, _error: errorMessage });
      })
    );
  }

  estimateMargins(items: MenuItem[]): Observable<EstimateMarginsResult> {
    const draftItems = items.filter((i) =>
      ['draft', 'pending', 'incomplete', 'failed', 'unrecognised'].includes(i.status)
    );

    if (!draftItems.length) {
      return of({
        estimated_count: 0,
        unrecognised_count: 0,
        incomplete_count: 0,
        items
      });
    }

    return from(draftItems).pipe(
      concatMap((item) => this.estimateItem(item)),
      reduce(
        (acc: MenuItem[], updated: MenuItem) => {
          return acc.map((i) => (i.name === updated.name ? updated : i));
        },
        [...items]
      ),
      map((finalItems) => {
        const estimated = finalItems.filter((i) => i.status === 'ready' || i.status === 'incomplete');
        return {
          estimated_count: estimated.length,
          unrecognised_count: finalItems.filter((i) => i.status === 'unrecognised').length,
          incomplete_count: finalItems.filter((i) => i.status === 'incomplete').length,
          items: finalItems
        };
      })
    );
  }

  retryLookup(item: MenuItem, alternativeName: string): Observable<MenuItem> {
    const userPrompt = `Menu item: "${alternativeName}"\nSelling price: IDR ${item.selling_price_idr}\nReturn the standard ingredient breakdown for one serving of this dish.`;

    return this.callAi(SYSTEM_PROMPT, userPrompt).pipe(
      map((text) => this.parseAndEnrich({ ...item, alternative_name: alternativeName }, text)),
      catchError((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return of({ ...item, status: 'failed' as const, _error: errorMessage });
      })
    );
  }

  private parseAndEnrich(item: MenuItem, responseText: string): MenuItem {
    let parsed: ClaudeRecipeResponse;
    try {
      // Strip markdown code fences if present
      const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned) as ClaudeRecipeResponse;
    } catch {
      return { ...item, status: 'failed' };
    }

    if (parsed.unrecognised) {
      return { ...item, status: 'unrecognised' };
    }

    if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
      return { ...item, status: 'failed' };
    }

    const ingredients: Ingredient[] = parsed.ingredients.map((ing) => {
      const unitPrice = this.ingredientPrice.lookup(ing.name, ing.unit);
      const totalCost = unitPrice !== null ? ing.quantity * unitPrice : null;
      return {
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit as Ingredient['unit'],
        unit_cost_idr: unitPrice,
        total_cost_idr: totalCost,
        cost_source: unitPrice !== null ? 'price_list' : 'unknown'
      };
    });

    const hasUnknown = ingredients.some((i) => i.cost_source === 'unknown');
    const estCost = ingredients.reduce((sum, i) => sum + (i.total_cost_idr ?? 0), 0);
    const grossMargin = item.selling_price_idr - estCost;
    const grossMarginPct =
      item.selling_price_idr > 0 ? (grossMargin / item.selling_price_idr) * 100 : 0;

    return {
      ...item,
      ingredients,
      est_cost_idr: estCost,
      gross_margin_idr: grossMargin,
      gross_margin_pct: grossMarginPct,
      status: hasUnknown ? 'incomplete' : 'ready'
    };
  }
}
