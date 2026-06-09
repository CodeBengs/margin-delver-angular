import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DEMO_SALES, DEMO_SUGGESTIONS } from '../../core/demo-data';
import { storageGet, storageRemove, storageSet } from '../../core/utils/storage.util';
import { MenuItem } from '../../core/models/menu-item.model';
import { AiSuggestion, ItemClassification, ProfitabilityAnalysisResult, ProfitabilityItem } from '../../core/models/profitability.model';
import { ExcelParserService, ParsedSalesResult, ParsedSalesRow, SalesErrorCategory } from '../../core/services/excel-parser.service';
import { ExportService } from '../../core/services/export.service';
import { SalesService } from '../../core/services/sales.service';
import { FileDropZoneComponent } from '../../shared/components/file-drop-zone/file-drop-zone.component';
import { ImportBlockedComponent, ImportBlockedCategory } from '../../shared/components/import-blocked/import-blocked.component';

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

const SALES_CATEGORY_LABELS: Record<SalesErrorCategory, string> = {
  column_not_in_menu: 'Column not in your menu',
  duplicate_date:     'Duplicate date row',
  invalid_unit_count: 'Invalid unit count',
  outside_period:     'Outside the 31-day period'
};
const SALES_CATEGORY_ORDER: SalesErrorCategory[] = ['column_not_in_menu', 'duplicate_date', 'invalid_unit_count', 'outside_period'];

@Component({
  selector: 'app-sales-upload',
  standalone: true,
  imports: [CommonModule, RouterLink, FileDropZoneComponent, ImportBlockedComponent],
  templateUrl: './sales-upload.component.html',
  styleUrl: './sales-upload.component.scss'
})
export class SalesUploadComponent implements OnInit, OnDestroy {
  constructor(
    private readonly excelParser: ExcelParserService,
    private readonly salesService: SalesService,
    private readonly exportService: ExportService
  ) {}

  private readonly demoListener = () => {
    this.menuItems.set(this.loadMenuItems());
  };

  readonly message = signal('');
  readonly analysisResult = signal<ProfitabilityAnalysisResult | null>(null);
  readonly menuItems = signal<StoredMenuItem[]>(this.loadMenuItems());
  readonly expandedSugId = signal<number>(0);
  readonly dismissedIds = signal<number[]>([]);

  // Upload state machine
  readonly uploadState = signal<'idle' | 'preview' | 'analyzing' | 'results'>('idle');
  readonly parsedSales = signal<ParsedSalesResult | null>(null);
  readonly uploadError = signal<string>('');
  readonly showAllRows = signal(false);
  readonly periodDays = signal(0);

  readonly readyItems = computed(() => this.menuItems().filter((i) => i.status === 'ready' && i.est_cost_idr !== null));
  readonly isLocked = computed(() => this.readyItems().length === 0);

  readonly excludedItemCount = computed(() =>
    this.menuItems().filter(i => i.status === 'incomplete').length
  );

  readonly allStar = computed(() => {
    const result = this.analysisResult();
    if (!result || !result.items.length) return false;
    return result.items.every(i => i.classification === 'star');
  });

  readonly canAnalyse = computed(() => {
    const s = this.parsedSales();
    return !!s && s.errors.length === 0 && s.matchedCount > 0;
  });

  readonly hasUploadErrors = computed(() => (this.parsedSales()?.errors.length ?? 0) > 0);

  readonly salesCategories = computed<ImportBlockedCategory[]>(() => {
    const s = this.parsedSales();
    if (!s) return [];
    const counts = new Map<SalesErrorCategory, number>();
    for (const err of s.errors) {
      counts.set(err.category, (counts.get(err.category) ?? 0) + 1);
    }
    return SALES_CATEGORY_ORDER
      .filter((cat) => (counts.get(cat) ?? 0) > 0)
      .map((cat) => ({ label: SALES_CATEGORY_LABELS[cat], count: counts.get(cat) ?? 0 }));
  });

  readonly salesRowsAffected = computed(() => {
    const s = this.parsedSales();
    if (!s) return 0;
    return s.rows.filter((r) => r.dateError || Object.keys(r.cellErrors).length > 0).length;
  });

  readonly salesHighlightedCount = computed(() => this.parsedSales()?.errors.length ?? 0);

  readonly previewRows = computed(() => {
    const s = this.parsedSales();
    if (!s) return [];
    return this.showAllRows() ? s.rows : s.rows.slice(0, 5);
  });

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

  hasCellError(row: ParsedSalesRow, colHeader: string): boolean {
    return !!row.cellErrors[colHeader];
  }

  rowHasErrors(row: ParsedSalesRow): boolean {
    return !row.dateValid || !!row.dateError || Object.keys(row.cellErrors).length > 0;
  }

  objKeys(o: Record<string, string>): string[] {
    return Object.keys(o);
  }

  /** Value to show in a unit cell: raw text when the cell is invalid, otherwise the parsed quantity.
   *  For unmatched columns (no quantity), falls back to the raw cell text. */
  salesCellDisplay(row: ParsedSalesRow, header: string): string {
    if (row.cellErrors[header]) {
      return row.rawCells[header] ?? '';
    }
    if (header in row.quantities) {
      return String(row.quantities[header] ?? 0);
    }
    return row.rawCells[header] ?? '';
  }

  salesCellError(row: ParsedSalesRow, header: string): string {
    return row.cellErrors[header] ?? '';
  }

  onReupload(): void {
    this.resetUpload();
  }

  refreshMenu(): void {
    this.menuItems.set(this.loadMenuItems());
  }

  async onSalesFileSelected(file: File): Promise<void> {
    this.uploadError.set('');
    try {
      const knownNames = this.readyItems().map(i => i.name);
      const result = await this.excelParser.parseSalesFile(file, knownNames);
      this.parsedSales.set(result);
      this.periodDays.set(result.rows.length);
      this.showAllRows.set(false);
      this.uploadState.set('preview');
    } catch {
      this.uploadState.set('idle');
      this.uploadError.set('Could not parse the file. Make sure it is a valid .xlsx or .xls file.');
    }
  }

  confirmAndAnalyse(): void {
    const sales = this.parsedSales();
    if (!sales || !this.canAnalyse()) return;

    // AC9.6: Guard for fewer than 3 ready menu items
    const menuItems = this.readyItems() as unknown as MenuItem[];
    if (menuItems.length < 3) {
      this.message.set('Add more menu items to receive personalised suggestions. At least 3 items are needed.');
      this.uploadState.set('preview');
      return;
    }

    // AC8.6: Guard for no sales recorded
    const totalUnitsCheck = sales.rows.reduce((sum, row) => {
      return sum + (Object.values(row.quantities) as number[]).filter(q => q > 0).reduce((s, q) => s + q, 0);
    }, 0);
    if (totalUnitsCheck === 0) {
      this.message.set('No sales recorded for this period. Please check your data.');
      this.uploadState.set('preview');
      return;
    }

    this.uploadState.set('analyzing');
    this.message.set('');
    this.salesService.analyseSalesData(menuItems, sales.rows, this.periodDays()).subscribe({
      next: (result) => {
        this.analysisResult.set(result);
        this.uploadState.set('results');
        this.expandedSugId.set(0);
        this.dismissedIds.set([]);
        storageSet('md_sales_uploaded_v1', 'true');
      },
      error: (err) => {
        this.message.set(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
        this.uploadState.set('preview');
      }
    });
  }

  resetUpload(): void {
    this.parsedSales.set(null);
    this.uploadState.set('idle');
    this.uploadError.set('');
    this.showAllRows.set(false);
  }

  resetAnalysis(): void {
    this.analysisResult.set(null);
    this.dismissedIds.set([]);
    storageRemove('md_sales_uploaded_v1');
    this.resetUpload();
  }

  loadDemoSales(): void {
    if (this.isLocked() || this.uploadState() === 'analyzing') return;
    const items = this.buildDemoItems();
    const totalRevenue = items.reduce((s, i) => s + i.revenue_idr, 0);
    const totalCost = items.reduce((s, i) => s + i.est_cost_idr, 0);
    const gross = totalRevenue - totalCost;
    const margin = totalRevenue ? (gross / totalRevenue) * 100 : 0;
    this.analysisResult.set({
      summary: {
        total_revenue_idr: totalRevenue,
        total_cost_idr: totalCost,
        total_gross_profit_idr: gross,
        overall_margin_pct: margin,
        verdict: margin > 2 ? 'profitable' : margin < -2 ? 'loss' : 'break_even',
        verdict_summary: 'Menu Anda menghasilkan gross margin sehat untuk periode sample ini.'
      },
      items,
      suggestions: this.buildDemoSuggestions()
    });
    this.periodDays.set(30);
    this.uploadState.set('results');
    this.expandedSugId.set(0);
    this.dismissedIds.set([]);
    storageSet('md_sales_uploaded_v1', 'true');
  }

  private buildDemoItems(): ProfitabilityItem[] {
    const ready = this.readyItems();
    const raw = ready.map((item) => {
      const units = DEMO_SALES[item.id] ?? 0;
      const revenue = units * item.selling_price_idr;
      const cost = units * (item.est_cost_idr ?? 0);
      const margin = revenue ? ((revenue - cost) / revenue) * 100 : 0;
      return {
        menu_item: item.name,
        units_sold: units,
        revenue_idr: revenue,
        est_cost_idr: cost,
        contribution_idr: revenue - cost,
        margin_pct: margin,
        classification: 'star' as ItemClassification
      };
    });
    const medianMargin = this.median(raw.map((i) => i.margin_pct));
    const medianUnits = this.median(raw.map((i) => i.units_sold));
    return raw.map((i) => ({ ...i, classification: this.classify(i.margin_pct, i.units_sold, medianMargin, medianUnits) }));
  }

  private classify(margin: number, units: number, medianMargin: number, medianUnits: number): ItemClassification {
    if (margin >= medianMargin && units >= medianUnits) return 'star';
    if (margin < medianMargin && units >= medianUnits) return 'workhorse';
    if (margin >= medianMargin && units < medianUnits) return 'niche';
    return 'deadweight';
  }

  private median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private buildDemoSuggestions(): AiSuggestion[] {
    return DEMO_SUGGESTIONS.map((s, i) => ({
      id: i + 1,
      suggestion_type: s.suggestion_type as AiSuggestion['suggestion_type'],
      title: s.title,
      description: s.description,
      items_involved: s.items_involved,
      estimated_impact: s.estimated_impact,
      review_status: 'new' as const
    }));
  }

  downloadTemplate(): void {
    this.exportService.downloadSalesTemplate(this.readyItems().map(i => i.name));
  }

  exportFullReport(): void {
    const result = this.analysisResult();
    if (!result) return;
    this.exportService.downloadFullReport(
      this.menuItems() as unknown as MenuItem[],
      result
    );
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

  private loadMenuItems(): StoredMenuItem[] {
    try { return JSON.parse(storageGet(MENU_STORAGE_KEY) ?? 'null') ?? []; } catch { return []; }
  }
}
