import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FlowStep {
  num: string;
  icon: string;       // "sparkles-glyph" renders ✦ symbol; anything else is an SVG name
  title: string;
  body: string;
  ai?: boolean;
}

interface ClassCard {
  key: string;
  label: string;
  line: string;
  glyph: string;
  body: string;
  color: string;
  bg: string;
}

interface PromptItem {
  num: string;        // ① ②
  title: string;
  description: string;
  code: string;
}

interface FaqItem {
  q: string;
  a: string;
}

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss'
})
export class HowItWorksComponent {
  readonly openFaq = signal(0);

  readonly steps: FlowStep[] = [
    {
      num: '01', icon: 'upload', title: 'You upload',
      body: 'Excel file with your menu items + selling price. Or type them in by hand. We accept Indonesian dish names as-is — Nasi Goreng Spesial, Es Cendol, Mie Ayam Ceker.'
    },
    {
      num: '02', icon: 'sparkles-glyph', title: 'AI enriches', ai: true,
      body: 'One API call per dish returns a structured ingredient list in Bahasa Indonesia. Each ingredient is priced against the IDR reference list. Gross margin is computed per item.'
    },
    {
      num: '03', icon: 'document-edit', title: 'You refine',
      body: 'Click any item to edit the recipe — quantities, unit costs, add or remove ingredients. Margin recalculates instantly.'
    },
    {
      num: '04', icon: 'data', title: 'You upload sales',
      body: 'One calendar month of POS data: dates as rows, menu items as columns, unit counts in cells. We match columns to your menu by name.'
    },
    {
      num: '05', icon: 'chart-bar-v', title: 'AI analyses', ai: true,
      body: 'A single second API call returns a profitability verdict, classifies every item as Star/Workhorse/Niche/Deadweight, and produces up to 5 ranked, store-specific suggestions.'
    }
  ];

  readonly classifications: ClassCard[] = [
    {
      key: 'star', label: 'Star', glyph: '★', line: 'High margin · High volume',
      color: 'var(--color-success-500, #16a953)', bg: 'var(--color-success-50, #e7f7ee)',
      body: 'Core profit drivers. Protect them — these are the dishes that fund the kitchen. Default suggestion: promote.'
    },
    {
      key: 'workhorse', label: 'Workhorse', glyph: '⚙', line: 'Low margin · High volume',
      color: 'var(--color-blue-600, #0f6cb6)', bg: 'var(--color-blue-50, #eaf5ff)',
      body: 'Volume anchors with thin margin. Worth reviewing portion sizes or repricing — these dishes already have product-market fit.'
    },
    {
      key: 'niche', label: 'Niche', glyph: '◆', line: 'High margin · Low volume',
      color: 'var(--color-warning-700, #b47410)', bg: 'var(--color-warning-50, #fff7e0)',
      body: 'Untapped profit. Customers don\'t know about them yet. Default suggestion: promote, or bundle with a star.'
    },
    {
      key: 'deadweight', label: 'Deadweight', glyph: '✕', line: 'Low margin · Low volume',
      color: 'var(--color-danger-700, #b30000)', bg: 'var(--color-danger-50, #ffe5e5)',
      body: 'Quiet drain — slow to sell and don\'t make money. Default suggestion: sunset or reprice.'
    }
  ];

  readonly prompts: PromptItem[] = [
    {
      num: '①',
      title: 'Recipe enrichment (per menu item)',
      description: 'Called once per menu item. Returns a list of ingredients with quantity + unit. Temperature 0.2 for determinism.',
      code: `SYSTEM
You are a professional food cost analyst specialising in
Indonesian restaurant and café menus. Given a menu item and
its selling price, return a JSON object describing the
standard recipe for one serving.

Rules:
  1. JSON only. No markdown. No preamble.
  2. Ingredient names in Bahasa Indonesia.
  3. Realistic quantities for a single restaurant portion.
  4. Unit ∈ { gram, ml, butir, lembar, siung, buah, sdm, sdt, porsi }.
  5. Unrecognised → return { "unrecognised": true }.

USER
Menu item: "{{MENU_NAME}}"
Selling price: IDR {{SELLING_PRICE}}`
    },
    {
      num: '②',
      title: 'Sales analysis (once per session)',
      description: 'Called once after a sales file is loaded. Returns verdict, per-item classifications, and up to 5 ranked suggestions.',
      code: `SYSTEM
You are a restaurant business analyst specialising in
Indonesian F&B profitability. Given a menu with estimated
gross margins and 30-day sales data, return a structured
profitability assessment and prioritised action plan.

Rules:
  1. JSON only. Base conclusions strictly on data provided.
  2. Classify each item: star | workhorse | niche | deadweight.
  3. Max 5 suggestions, ordered by estimated impact.
  4. suggestion_type ∈ { bundle, sunset, reprice, promote, ingredient_swap }.

USER
Analyse {{PERIOD_DAYS}} days. Menu data:
{{JSON_ARRAY_OF_ITEMS_WITH_MARGINS_AND_UNITS_SOLD}}`
    }
  ];

  readonly faqs: FaqItem[] = [
    {
      q: 'What happens if the AI doesn\'t recognise my dish?',
      a: 'The item is flagged \'Unrecognised\'. You can retry with an alternative common name (up to 3 times), or add ingredients manually. The rest of your menu still estimates normally — one unrecognised item doesn\'t block the others.'
    },
    {
      q: 'How accurate are the margins?',
      a: 'Our target is ±10% of actual margin for ≥70% of items. The biggest variance comes from portion size and ingredient quality — both are editable in the recipe panel, so you can dial estimates closer to your real operation.'
    },
    {
      q: 'Where does the sales data go?',
      a: 'Nowhere persistent. In the PoC, everything lives in browser memory only — no login, no save. Refresh the tab and you\'re back to a clean slate. Export to Excel before you close if you want a copy.'
    },
    {
      q: 'Can I use this for multiple outlets?',
      a: 'Not in this PoC — one menu list per session. Multi-store will come once we add accounts and persistence. For now, refresh between stores.'
    },
    {
      q: 'What if my POS exports in a different format?',
      a: 'Sales upload requires our template (Date column + menu name columns). Direct POS format mapping is out of scope for v1. Download the template from the Analysis page — it\'s pre-filled with your current menu names as headers.'
    }
  ];

  toggleFaq(index: number): void {
    this.openFaq.set(this.openFaq() === index ? -1 : index);
  }
}
