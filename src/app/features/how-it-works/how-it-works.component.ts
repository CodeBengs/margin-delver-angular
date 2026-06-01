import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FlowStep {
  num: string;
  icon: string;
  title: string;
  body: string;
  ai?: boolean;
}

interface ClassificationCard {
  key: string;
  label: string;
  line: string;
  glyph: string;
  body: string;
}

interface PromptBlock {
  num: string;
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
      num: '01',
      icon: 'upload',
      title: 'You upload',
      body: 'Excel file with your menu items and selling price. Or type them in by hand. We accept Indonesian dish names as-is: Nasi Goreng Spesial, Es Cendol, Mie Ayam Ceker.'
    },
    {
      num: '02',
      icon: 'star',
      title: 'Claude enriches',
      body: 'One API call per dish returns a structured ingredient list in Bahasa Indonesia. Each ingredient is priced against the IDR reference list. Gross margin is computed per item.',
      ai: true
    },
    {
      num: '03',
      icon: 'document-edit',
      title: 'You refine',
      body: 'Click any item to edit the recipe: quantities, unit costs, add or remove ingredients. Margin recalculates instantly.'
    },
    {
      num: '04',
      icon: 'data',
      title: 'You upload sales',
      body: 'One calendar month of POS data: dates as rows, menu items as columns, unit counts in cells. We match columns to your menu by name.'
    },
    {
      num: '05',
      icon: 'chart-bar-v',
      title: 'Claude analyses',
      body: 'A single second API call returns a profitability verdict, classifies every item as Star, Workhorse, Niche, or Deadweight, and produces ranked store-specific suggestions.',
      ai: true
    }
  ];

  readonly classifications: ClassificationCard[] = [
    {
      key: 'star',
      label: 'Star',
      line: 'High margin - high volume',
      glyph: 'S',
      body: 'Core profit drivers. Protect these dishes, keep them visible, and use them as anchors for bundles or campaigns.'
    },
    {
      key: 'workhorse',
      label: 'Workhorse',
      line: 'Low margin - high volume',
      glyph: 'W',
      body: 'Popular but thin. Review portion sizes, ingredient cost, or price because the demand already exists.'
    },
    {
      key: 'niche',
      label: 'Niche',
      line: 'High margin - low volume',
      glyph: 'N',
      body: 'Profitable but quiet. Promote, bundle, or rename so more customers notice these items.'
    },
    {
      key: 'deadweight',
      label: 'Deadweight',
      line: 'Low margin - low volume',
      glyph: 'D',
      body: 'Slow and low return. Consider repricing, simplifying ingredients, or removing it from the menu.'
    }
  ];

  readonly prompts: PromptBlock[] = [
    {
      num: '01',
      title: 'Recipe enrichment (per menu item)',
      description: 'Used after menu upload to estimate ingredients in a structured format.',
      code: `You are helping an Indonesian F&B owner estimate recipe cost.\nReturn strict JSON only.\n\nMenu item: {{MENU_NAME}}\nSelling price IDR: {{SELLING_PRICE}}\n\nReturn ingredient names in Bahasa Indonesia with quantity, unit, and confidence.\nIf the dish is unclear, set unrecognised to true.`
    },
    {
      num: '02',
      title: 'Sales analysis (once per session)',
      description: 'Used after sales upload to turn margin and volume data into owner-friendly actions.',
      code: `You are analysing menu profitability for a small Indonesian restaurant.\nUse the provided gross margin, units sold, and classification for each item.\n\nReturn strict JSON with:\n- verdict_summary\n- up to 5 suggestions\n- suggestion_type\n- title\n- description\n- items_involved\n- estimated_impact`
    }
  ];

  readonly faqs: FaqItem[] = [
    {
      q: "What happens if Claude doesn't recognise my dish?",
      a: 'The item is marked as unrecognised so the owner can retry with an alternative name or enter ingredients manually. The rest of the menu can still continue.'
    },
    {
      q: 'How accurate are the margins?',
      a: 'Margins are estimates based on the ingredient list and reference prices. The owner can adjust any quantity or unit cost, and the margin recalculates immediately.'
    },
    {
      q: 'Where does the sales data go?',
      a: 'For the PoC, uploaded spreadsheets are parsed for analysis and should not be stored unless the backend explicitly needs them. The UI is prepared for session-based data.'
    },
    {
      q: 'Can I use this for multiple outlets?',
      a: 'The current PoC is one workspace/session. Multi-outlet support is intentionally outside scope until the core margin workflow is validated.'
    },
    {
      q: 'What if my POS exports in a different format?',
      a: 'The first supported template is Date as the first column and menu items as the next columns. Other POS formats can be mapped later through import adapters.'
    }
  ];

  toggleFaq(index: number): void {
    this.openFaq.set(this.openFaq() === index ? -1 : index);
  }
}

