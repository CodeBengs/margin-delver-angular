import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as XLSX from 'xlsx';

import { getDemoSales, getDemoSuggestions } from '../../core/demo-data';
import { AiSuggestion, ItemClassification, ProfitabilityAnalysisResult, ProfitabilityItem } from '../../core/models/profitability.model';

interface StoredMenuItem {
  id: number;
  name: string;
  selling_price_idr: number;
  est_cost_idr: number | null;
  gross_margin_pct: number | null;
  status: string;
}

interface MatrixDot {
  name: string;
  left: number;
  top: number;
  color: string;
  classification: ItemClassification;
}

interface RevCostRow {
  name: string;
  revenue: number;
  cost: number;
  widthRevPct: number;
  widthCostPct: number;
}

const MENU_STORAGE_KEY = 'md_angular_menu_v1';
const TEMPLATE_FILENAME = 'MARGIN_DELVER_SALES_UPLOAD.xlsx';

const CLASS_COLOR: Record<ItemClassification, string> = {
  star:       'var(--color-success-500, #16a953)',
  workhorse:  'var(--color-blue-600, #0f6cb6)',
  niche:      'var(--color-warning-700, #b47410)',
  deadweight: 'var(--color-danger-700, #b30000)'
};
const CLASS_BG: Record<ItemClassification, string> = {
  star:       'var(--color-success-50, #e7f7ee)',
  workhorse:  'var(--color-blue-50, #eaf5ff)',
  niche:      'var(--color-warning-50, #fff7e0)',
  deadweight: 'var(--color-danger-50, #ffe5e5)'
};
const CLASS_GLYPH:  Record<ItemClassification, string> = { star: '★', workhorse: '⚙', niche: '◆', deadweight: '✕' };
const CLASS_LABEL:  Record<ItemClassification, string> = { star: 'Star', workhorse: 'Workhorse', niche: 'Niche', deadweight: 'Deadweight' };
const CLASS_LINE:   Record<ItemClassification, string> = {
  star: 'High margin · High volume', workhorse: 'Low margin · High volume',
  niche: 'High margin · Low volume', deadweight: 'Low margin · Low volume'
};

/* Matches design's SUGGESTION_META tones exactly */
const SUGGESTION_TONE: Record<string, string> = {
  bundle:          'blue',
  promote:         'green',
  ingredient_swap: 'orange',
  sunset:          'red',
  reprice:         'purple',
};
const SUGGESTION_LABEL: Record<string, string> = {
  bundle:          'Bundle',
  promote:         'Promote',
  ingredient_swap: 'Ingredient swap',
  sunset:          'Sunset',
  reprice:         'Reprice',
};

@Component({
  selector: 'app-sales-upload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sales-upload.component.html',
  styleUrl: './sales-upload.component.scss'
})
export class SalesUploadComponent implements OnInit, OnDestroy {
  private readonly demoListener = () => {
    this.menuItems.set(this.loadMenuItems());
  };
  readonly currentMonthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  readonly daysInCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  readonly previewDates = (() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return [1, 2, 3].map((d) => `${String(d).padStart(2, '0')}/${mm}/${yyyy}`);
  })();
  readonly message = signal('');
  readonly analyzing = signal(false);
  readonly dragOver = signal(false);
  readonly analysisResult = signal<ProfitabilityAnalysisResult | null>(null);
  readonly menuItems = signal<StoredMenuItem[]>(this.loadMenuItems());
  readonly expandedSugId = signal<number>(0);
  readonly dismissedIds = signal<number[]>([]);

  readonly readyItems = computed(() => this.menuItems().filter((i) => i.status === 'ready' && i.est_cost_idr !== null));
  readonly isLocked = computed(() => this.readyItems().length === 0);
  readonly hasSales = computed(() => this.analysisResult() !== null);

  readonly classificationCounts = computed(() => {
    const counts: Record<ItemClassification, number> = { star: 0, workhorse: 0, niche: 0, deadweight: 0 };
    for (const item of this.analysisResult()?.items ?? []) counts[item.classification] += 1;
    return counts;
  });

  readonly totalUnits = computed(() =>
    this.analysisResult()?.items.reduce((s, i) => s + i.units_sold, 0) ?? 0
  );

  readonly matrixDots = computed((): MatrixDot[] => {
    const items = this.analysisResult()?.items ?? [];
    if (!items.length) return [];
    const margins  = items.map((i) => i.margin_pct);
    const units    = items.map((i) => i.units_sold);
    const maxMargin = Math.max(60, ...margins);
    const minMargin = Math.min(0,  ...margins);
    const maxUnits  = Math.max(100, ...units);
    const range = maxMargin - minMargin || 1;
    return items.map((i) => ({
      name:           i.menu_item,
      left:           8 + (i.units_sold / maxUnits) * 84,
      top:            92 - ((i.margin_pct - minMargin) / range) * 84,
      color:          CLASS_COLOR[i.classification],
      classification: i.classification
    }));
  });

  readonly revcostRows = computed((): RevCostRow[] => {
    const items = this.analysisResult()?.items ?? [];
    if (!items.length) return [];
    const sorted  = [...items].sort((a, b) => b.contribution_idr - a.contribution_idr);
    const maxRev  = Math.max(1, ...sorted.map((r) => r.revenue_idr));
    return sorted.map((r) => ({
      name:          r.menu_item,
      revenue:       r.revenue_idr,
      cost:          r.est_cost_idr,
      widthRevPct:   (r.revenue_idr  / maxRev) * 100,
      widthCostPct:  (r.est_cost_idr / maxRev) * 100
    }));
  });

  readonly sortedItems = computed(() =>
    [...(this.analysisResult()?.items ?? [])].sort((a, b) => b.contribution_idr - a.contribution_idr)
  );

  readonly classifications: ItemClassification[] = ['star', 'workhorse', 'niche', 'deadweight'];

  ngOnInit(): void  { window.addEventListener('md:load-demo', this.demoListener); }
  ngOnDestroy(): void { window.removeEventListener('md:load-demo', this.demoListener); }

  classColor(c: ItemClassification): string  { return CLASS_COLOR[c]; }
  classBg(c: ItemClassification): string     { return CLASS_BG[c]; }
  classGlyph(c: ItemClassification): string  { return CLASS_GLYPH[c]; }
  classLabel(c: ItemClassification): string  { return CLASS_LABEL[c]; }
  classLine(c: ItemClassification): string   { return CLASS_LINE[c]; }
  sugTone(type: string): string              { return SUGGESTION_TONE[type]  ?? 'blue'; }
  sugLabel(type: string): string             { return SUGGESTION_LABEL[type] ?? type; }

  /** Maps an item name to the right icon, matching the design's icon fields */
  iconForName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('kopi') || n.includes('coffee')) return 'coffee';
    if (n.startsWith('es ') || n.includes('teh') || n.includes('jeruk')) return 'cup';
    if (n.includes('mie') || n.includes('soto') || n.includes('gado') || n.includes('bakso')) return 'bowl';
    return 'fastfood';
  }

  verdictHeadline(verdict: string): string {
    if (verdict === 'profitable') return 'Your warung made money this period.';
    if (verdict === 'break_even') return 'Roughly break even this period.';
    return 'You spent more than you brought in.';
  }

  refreshMenu(): void {
    this.menuItems.set(this.loadMenuItems());
  }

  runAnalysis(): void {
    if (this.isLocked() || this.analyzing()) return;
    this.analyzing.set(true);
    window.setTimeout(() => {
      const items = this.buildItems();
      const totalRevenue = items.reduce((s, i) => s + i.revenue_idr, 0);
      const totalCost    = items.reduce((s, i) => s + i.est_cost_idr, 0);
      const gross        = totalRevenue - totalCost;
      const margin       = totalRevenue ? (gross / totalRevenue) * 100 : 0;
      this.analysisResult.set({
        summary: {
          total_revenue_idr:      totalRevenue,
          total_cost_idr:         totalCost,
          total_gross_profit_idr: gross,
          overall_margin_pct:     margin,
          verdict:                margin > 2 ? 'profitable' : margin < -2 ? 'loss' : 'break_even',
          verdict_summary:        'Menu Anda menghasilkan gross margin sehat untuk periode sample ini.'
        },
        items,
        suggestions: this.buildSuggestions()
      });
      this.expandedSugId.set(0);
      this.dismissedIds.set([]);
      this.analyzing.set(false);
    }, 1200);
  }

  resetAnalysis(): void {
    this.analysisResult.set(null);
    this.dismissedIds.set([]);
  }

  toggleSuggestion(idx: number): void  { this.expandedSugId.set(this.expandedSugId() === idx ? -1 : idx); }
  dismissSuggestion(idx: number): void { this.dismissedIds.update((ids) => [...ids, idx]); this.expandedSugId.set(-1); }
  showDismissed(): void                { this.dismissedIds.set([]); }
  isDismissed(idx: number): boolean    { return this.dismissedIds().includes(idx); }
  isExpanded(idx: number): boolean     { return this.expandedSugId() === idx; }

  fmtIDR(value: number | null | undefined): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  trackByName(_: number, item: { menu_item: string }): string { return item.menu_item; }
  trackByIdx(idx: number): number { return idx; }

  /* Build per-item analysis rows.
     Uses DEMO_SALES keyed by item id for 30-day unit counts. */
  private buildItems(): ProfitabilityItem[] {
    const ready = this.readyItems();
    const raw = ready.map((item) => {
      const units    = getDemoSales()[item.id] ?? 0;
      const revenue  = units * item.selling_price_idr;
      const cost     = units * (item.est_cost_idr ?? 0);
      const margin   = revenue ? ((revenue - cost) / revenue) * 100 : 0;
      return {
        menu_item:       item.name,
        units_sold:      units,
        revenue_idr:     revenue,
        est_cost_idr:    cost,
        contribution_idr: revenue - cost,
        margin_pct:      margin,
        classification:  'star' as ItemClassification
      };
    });

    const medianMargin = this.median(raw.map((i) => i.margin_pct));
    const medianUnits  = this.median(raw.map((i) => i.units_sold));
    return raw.map((i) => ({ ...i, classification: this.classify(i.margin_pct, i.units_sold, medianMargin, medianUnits) }));
  }

  /* Use pre-baked suggestions from the design's SAMPLE_SUGGESTIONS */
  private buildSuggestions(): AiSuggestion[] {
    return getDemoSuggestions().map((s, i) => ({
      id:               i,
      suggestion_type:  s.suggestion_type as AiSuggestion['suggestion_type'],
      title:            s.title,
      description:      s.description,
      items_involved:   s.items_involved,
      estimated_impact: s.estimated_impact,
      review_status:    'new' as const
    }));
  }

  private classify(margin: number, units: number, medianMargin: number, medianUnits: number): ItemClassification {
    if (margin >= medianMargin && units >= medianUnits) return 'star';
    if (margin <  medianMargin && units >= medianUnits) return 'workhorse';
    if (margin >= medianMargin && units <  medianUnits) return 'niche';
    return 'deadweight';
  }

  private median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  downloadTemplate(): void {
    const items = this.menuItems();
    const headers = ['Date', ...items.map((i) => i.name)];

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const rows: (string | number)[][] = [headers];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
      rows.push([date, ...items.map(() => 0)]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, TEMPLATE_FILENAME);
  }

  private loadMenuItems(): StoredMenuItem[] {
    try { return JSON.parse(localStorage.getItem(MENU_STORAGE_KEY) ?? 'null') ?? []; } catch { return []; }
  }
}
