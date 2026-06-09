import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { MenuItem } from '../models/menu-item.model';
import {
  AiSuggestion,
  ItemClassification,
  ProfitabilityAnalysisResult,
  ProfitabilityItem,
  ProfitabilitySummary,
  SuggestionType
} from '../models/profitability.model';
import { ParsedSalesRow } from './excel-parser.service';
import { ClaudeApiService } from './claude-api.service';

const SYSTEM_PROMPT = `You are a restaurant business analyst specialising in Indonesian F&B profitability. You receive a menu with estimated gross margins and 30-day sales data, then return a structured profitability assessment and prioritised action plan.

Rules:
1. Return ONLY valid JSON. No explanation, no markdown, no preamble.
2. Base all conclusions strictly on the data provided. Do not invent figures.
3. Suggestions must be specific, actionable, and grounded in the data.
4. Classify each menu item as one of: star (high margin + high volume), workhorse (low margin + high volume), niche (high margin + low volume), or deadweight (low margin + low volume).
5. Limit suggestions to a maximum of 5, ordered by estimated impact.
6. suggestion_type must be one of: bundle, sunset, reprice, promote, ingredient_swap.

Output schema:
{
  "period_days": number,
  "total_revenue_idr": number,
  "total_cost_idr": number,
  "total_gross_profit_idr": number,
  "overall_margin_pct": number,
  "verdict": "profitable" | "break_even" | "loss",
  "verdict_summary": "string",
  "item_classifications": [
    { "menu_item": "string", "classification": "star|workhorse|niche|deadweight", "units_sold": number, "revenue_idr": number, "contribution_idr": number }
  ],
  "suggestions": [
    { "suggestion_type": "string", "title": "string", "description": "string", "items_involved": ["string"], "estimated_impact": "string" }
  ]
}`;

interface ClaudeAnalysisItem {
  menu_item: string;
  classification: ItemClassification;
}

interface ClaudeSuggestion {
  suggestion_type: SuggestionType;
  title: string;
  description: string;
  items_involved: string[];
  estimated_impact: string;
}

interface ClaudeAnalysisResponse {
  verdict_summary?: string;
  item_classifications?: ClaudeAnalysisItem[];
  items?: ClaudeAnalysisItem[];
  suggestions?: ClaudeSuggestion[];
}

interface MenuDataEntry {
  menu_item: string;
  selling_price_idr: number;
  est_cost_idr: number;
  gross_margin_pct: number;
  units_sold: number;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  constructor(private readonly claudeApi: ClaudeApiService) {}

  analyseSalesData(
    menuItems: MenuItem[],
    salesRows: ParsedSalesRow[],
    periodDays: number
  ): Observable<ProfitabilityAnalysisResult> {
    // Build per-item sales totals
    const unitsSoldMap = new Map<string, number>();
    for (const row of salesRows) {
      for (const [header, qty] of Object.entries(row.quantities)) {
        if (qty !== undefined && qty > 0) {
          unitsSoldMap.set(header, (unitsSoldMap.get(header) ?? 0) + qty);
        }
      }
    }

    // Build menu data entries for the prompt
    const menuData: MenuDataEntry[] = menuItems
      .filter((i) => i.status === 'ready' || i.status === 'incomplete')
      .map((item) => ({
        menu_item: item.name,
        selling_price_idr: item.selling_price_idr,
        est_cost_idr: item.est_cost_idr ?? 0,
        gross_margin_pct: item.gross_margin_pct ?? 0,
        units_sold: unitsSoldMap.get(item.name) ?? 0
      }));

    const userPrompt =
      `Analyse this restaurant's menu performance over ${periodDays} days.\n` +
      `Menu data: ${JSON.stringify(menuData)}\n` +
      `Each item has: menu_item, selling_price_idr, est_cost_idr, gross_margin_pct, units_sold.\n` +
      `Return the profitability assessment and suggestions JSON.`;

    return this.claudeApi.call({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.2, maxTokens: 4096 }).pipe(
      map((text) => this.parseAnalysisResponse(text, menuData))
    );
  }

  private parseAnalysisResponse(
    text: string,
    menuData: MenuDataEntry[]
  ): ProfitabilityAnalysisResult {
    let parsed: ClaudeAnalysisResponse;
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned) as ClaudeAnalysisResponse;
    } catch {
      throw new Error('Failed to parse analysis response from Claude. Please try again.');
    }

    // Build classification map from Claude's response
    const classificationSource = parsed.item_classifications ?? parsed.items ?? [];
    const classMap = new Map<string, ItemClassification>();
    for (const entry of classificationSource) {
      classMap.set(entry.menu_item.toLowerCase(), entry.classification);
    }

    // Build ProfitabilityItem array
    const items: ProfitabilityItem[] = menuData.map((d) => {
      const revenueIdr = d.units_sold * d.selling_price_idr;
      const estCostTotal = d.units_sold * d.est_cost_idr;
      const contributionIdr = revenueIdr - estCostTotal;
      const marginPct = revenueIdr > 0 ? (contributionIdr / revenueIdr) * 100 : 0;
      const classification = classMap.get(d.menu_item.toLowerCase()) ?? 'deadweight';

      return {
        menu_item: d.menu_item,
        units_sold: d.units_sold,
        revenue_idr: revenueIdr,
        est_cost_idr: estCostTotal,
        contribution_idr: contributionIdr,
        margin_pct: marginPct,
        classification
      };
    });

    // Calculate summary totals
    const totalRevenue = items.reduce((s, i) => s + i.revenue_idr, 0);
    const totalCost = items.reduce((s, i) => s + i.est_cost_idr, 0);
    const totalGrossProfit = totalRevenue - totalCost;
    const overallMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    const verdict =
      overallMarginPct > 2 ? 'profitable' : overallMarginPct < -2 ? 'loss' : 'break_even';

    const summary: ProfitabilitySummary = {
      total_revenue_idr: totalRevenue,
      total_cost_idr: totalCost,
      total_gross_profit_idr: totalGrossProfit,
      overall_margin_pct: overallMarginPct,
      verdict,
      verdict_summary: parsed.verdict_summary ?? ''
    };

    // Map suggestions
    const suggestions: AiSuggestion[] = (parsed.suggestions ?? []).map((s, idx) => ({
      id: idx + 1,
      suggestion_type: s.suggestion_type,
      title: s.title,
      description: s.description,
      items_involved: s.items_involved,
      estimated_impact: s.estimated_impact,
      review_status: 'new' as const
    }));

    return { summary, items, suggestions };
  }
}
