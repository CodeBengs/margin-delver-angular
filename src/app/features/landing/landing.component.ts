import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { DEMO_MENU } from '../../core/demo-data';
import { Ingredient } from '../../core/models/ingredient.model';
import { MenuItem } from '../../core/models/menu-item.model';
import { ParsedMenuResult } from '../../core/services/excel-parser.service';
import { ExportService } from '../../core/services/export.service';
import { EnrichmentService } from '../../core/services/enrichment.service';
import { MenuUploadComponent } from './menu-upload/menu-upload.component';

type MenuTab = 'upload' | 'manual';
type DraftIngredient = Ingredient & { id: number };
type DraftMenuItem = Omit<MenuItem, 'id' | 'ingredients'> & { id: number; ingredients: DraftIngredient[] };

const STORAGE_KEY = 'md_angular_menu_v1';
const MAX_MENU_ITEMS = 20;

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MenuUploadComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly demoListener = () => {
    const fresh = this.loadItems();
    if (fresh.length) {
      this.menuItems.set(fresh);
      this.selectedItemId.set(null);
    }
  };
  readonly activeTab = signal<MenuTab>('upload');
  readonly menuItems = signal<DraftMenuItem[]>(this.loadItems());
  readonly selectedItemId = signal<number | null>(null);
  readonly processing = signal(false);
  readonly manualName = signal('');
  readonly manualPrice = signal<number | null>(null);
  readonly dragOver = signal(false);
  readonly confirmDeleteItem = signal<DraftMenuItem | null>(null);
  readonly confirmDeleteIngredient = signal<{ item: DraftMenuItem; ingIdx: number } | null>(null);
  readonly editingNameId = signal<number | null>(null);
  readonly editingPriceId = signal<number | null>(null);
  readonly editNameValue = signal<string>('');
  readonly editPriceValue = signal<number | null>(null);
  readonly editNameError = signal<string>('');
  readonly manualDuplicateWarning = signal<string>('');
  readonly capError = signal('');
  readonly maxItems = MAX_MENU_ITEMS;
  readonly remainingSlots = computed(() => Math.max(0, MAX_MENU_ITEMS - this.menuItems().length));
  readonly existingNames = computed(() => this.menuItems().map((i) => i.name.toLowerCase()));
  readonly atCapacity = computed(() => this.menuItems().length >= MAX_MENU_ITEMS);
  readonly hasMenu = computed(() => this.menuItems().length > 0);
  readonly readyItems = computed(() => this.menuItems().filter((i) => i.status === 'ready'));
  readonly readyCount = computed(() => this.readyItems().length);
  readonly hasPendingItems = computed(() => this.menuItems().some((i) => ['draft', 'incomplete'].includes(i.status)));
  readonly totalRevenuePotential = computed(() => this.menuItems().reduce((s, i) => s + i.selling_price_idr, 0));
  readonly totalCost = computed(() => this.menuItems().reduce((s, i) => s + (i.est_cost_idr ?? 0), 0));
  readonly averageMargin = computed(() => {
    const ready = this.readyItems();
    return ready.length ? ready.reduce((s, i) => s + (i.gross_margin_pct ?? 0), 0) / ready.length : 0;
  });

  readonly menuChangedAfterSales = signal(false);

  readonly retryAltName: WritableSignal<Partial<Record<number, string>>> = signal({});
  readonly retryLoading: WritableSignal<Partial<Record<number, boolean>>> = signal({});
  readonly retryError: WritableSignal<Partial<Record<number, string>>> = signal({});
  readonly failedCount = computed(() => this.menuItems().filter(i => i.status === 'failed').length);
  readonly ingredientErrors = signal<Record<string, string>>({});

  constructor(
    private readonly exportService: ExportService,
    private readonly enrichmentService: EnrichmentService
  ) {}

  ngOnInit(): void { window.addEventListener('md:load-demo', this.demoListener); }
  ngOnDestroy(): void { window.removeEventListener('md:load-demo', this.demoListener); }

  setTab(tab: MenuTab): void { this.activeTab.set(tab); }

  loadDemo(): void {
    this.menuItems.set(JSON.parse(JSON.stringify(DEMO_MENU)) as DraftMenuItem[]);
    this.selectedItemId.set(null);
    this.persist();
    window.dispatchEvent(new CustomEvent('md:load-demo'));
  }

  setManualName(v: string): void { this.manualName.set(v); this.manualDuplicateWarning.set(''); }
  setManualPrice(v: string | number | null): void {
    const n = Number(v);
    this.manualPrice.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  addManualItem(): void {
    if (this.menuItems().length >= MAX_MENU_ITEMS) {
      return;
    }
    const name = this.manualName().trim();
    const price = Number(this.manualPrice());
    if (!name || !price) return;
    if (this.menuItems().some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      this.manualDuplicateWarning.set('This menu item already exists. Please use a unique name.');
      return;
    }
    const item: DraftMenuItem = {
      id: Date.now(), name, selling_price_idr: price,
      est_cost_idr: null, gross_margin_idr: null, gross_margin_pct: null,
      status: 'draft', ingredients: []
    };
    this.menuItems.update((items) => [item, ...items]);
    this.selectedItemId.set(item.id);
    this.manualName.set('');
    this.manualPrice.set(null);
    this.manualDuplicateWarning.set('');
    this.persist();
  }

  onItemsUploaded(result: ParsedMenuResult): void {
    const existing = this.menuItems();
    const newItems: DraftMenuItem[] = [];
    let idx = 0;
    for (const row of result.rows) {
      // Emitted results are clean; guard defensively against any malformed rows.
      if (row.nameError || row.priceError || !row.name || row.price === null) continue;
      const isDuplicate = existing.some(
        (i) => i.name.toLowerCase() === row.name.toLowerCase()
      ) || newItems.some(
        (i) => i.name.toLowerCase() === row.name.toLowerCase()
      );
      if (isDuplicate) continue;
      const item: DraftMenuItem = {
        id: Date.now() + idx,
        name: row.name,
        selling_price_idr: row.price!,
        est_cost_idr: null,
        gross_margin_idr: null,
        gross_margin_pct: null,
        status: 'draft',
        ingredients: []
      };
      newItems.push(item);
      idx++;
    }
    const existingCount = existing.length;
    const validNewCount = newItems.length;
    if (existingCount + validNewCount > MAX_MENU_ITEMS) {
      this.capError.set('Maximum ' + MAX_MENU_ITEMS + ' menu items. You have ' + existingCount + '; this file would add ' + validNewCount + '. Remove rows or existing items, then re-upload.');
      return;
    }
    this.capError.set('');
    this.menuItems.update((items) => [...items, ...newItems]);
    this.persist();
  }

  exportMargins(): void {
    this.exportService.downloadMarginReport(this.menuItems() as MenuItem[]);
  }

  downloadMenuTemplate(): void {
    this.exportService.downloadMenuTemplate();
  }

  estimateMargins(): void {
    if (!this.hasPendingItems()) return;
    this.processing.set(true);

    // Mark pending items as estimating
    const pendingItems = this.menuItems().filter(i => ['draft', 'incomplete'].includes(i.status));
    this.menuItems.update(items =>
      items.map(i => pendingItems.some(p => p.id === i.id) ? { ...i, status: 'estimating' } : i)
    );

    // Call enrichment service for each item sequentially
    this.enrichmentService.estimateMargins(pendingItems as MenuItem[]).subscribe({
      next: (result) => {
        // Merge results back into menuItems by matching on name (since items may lack backend IDs)
        this.menuItems.update(items =>
          items.map(cur => {
            const updated = result.items.find(r => r.name === cur.name);
            if (!updated) return cur;
            // Preserve local id and ingredients structure
            return {
              ...cur,
              ...updated,
              id: cur.id,
              ingredients: (updated.ingredients ?? []).map((ing, idx) => ({
                ...ing,
                id: cur.id * 100 + idx + 1
              }))
            } as DraftMenuItem;
          })
        );
        this.processing.set(false);
        this.persist();
      },
      error: (err) => {
        // Mark estimating items as failed
        this.menuItems.update(items =>
          items.map(i => i.status === 'estimating' ? { ...i, status: 'failed' } : i)
        );
        this.processing.set(false);
        this.persist();
        console.error('Enrichment error:', err);
      }
    });
  }

  retryFailedItems(): void {
    // Reset all failed items back to draft so they get re-estimated
    this.menuItems.update(items =>
      items.map(i => i.status === 'failed' ? { ...i, status: 'draft' } : i)
    );
    this.estimateMargins();
  }

  setRetryAltName(itemId: number, value: string): void {
    this.retryAltName.update(m => ({ ...m, [itemId]: value }));
  }

  retryLookup(item: DraftMenuItem): void {
    const altName = (this.retryAltName()[item.id] ?? '').trim();
    if (!altName) return;

    // Mark as loading
    this.retryLoading.update(m => ({ ...m, [item.id]: true }));
    this.retryError.update(m => ({ ...m, [item.id]: '' }));

    this.enrichmentService.retryLookup(item as MenuItem, altName).subscribe({
      next: (updated) => {
        this.menuItems.update(items => items.map(cur => {
          if (cur.id !== item.id) return cur;
          const newRetryCount = (cur.retryCount ?? 0) + 1;
          return {
            ...cur,
            ...updated,
            id: cur.id,
            retryCount: newRetryCount,
            ingredients: (updated.ingredients ?? []).map((ing, idx) => ({
              ...ing,
              id: cur.id * 100 + idx + 1
            }))
          } as DraftMenuItem;
        }));
        this.retryLoading.update(m => ({ ...m, [item.id]: false }));
        this.retryAltName.update(m => { const n = { ...m }; delete n[item.id]; return n; });
        this.persist();
      },
      error: (err) => {
        // Update retryCount even on failure
        this.menuItems.update(items => items.map(cur =>
          cur.id === item.id ? { ...cur, retryCount: (cur.retryCount ?? 0) + 1 } : cur
        ));
        this.retryLoading.update(m => ({ ...m, [item.id]: false }));
        this.retryError.update(m => ({ ...m, [item.id]: err instanceof Error ? err.message : 'Retry failed. Try a different name.' }));
        this.persist();
      }
    });
  }

  switchToManualEntry(item: DraftMenuItem): void {
    // Reset item to draft with empty ingredients for manual entry
    this.menuItems.update(items => items.map(cur =>
      cur.id === item.id ? { ...cur, status: 'draft', ingredients: [], retryCount: 0 } : cur
    ));
    this.selectedItemId.set(item.id);  // expand ingredient panel
    this.persist();
  }

  selectItem(item: DraftMenuItem): void {
    this.selectedItemId.set(this.selectedItemId() === item.id ? null : item.id);
  }

  isExpanded(item: DraftMenuItem): boolean { return this.selectedItemId() === item.id; }
  isDanger(item: DraftMenuItem): boolean { return (item.gross_margin_pct ?? 0) < 0; }

  openDeleteConfirm(item: DraftMenuItem): void { this.confirmDeleteItem.set(item); }
  cancelDelete(): void { this.confirmDeleteItem.set(null); }
  confirmDelete(): void {
    const item = this.confirmDeleteItem();
    if (!item) return;
    this.menuItems.update((items) => items.filter((i) => i.id !== item.id));
    if (this.selectedItemId() === item.id) this.selectedItemId.set(null);
    this.confirmDeleteItem.set(null);
    this.persist();
  }

  openIngDeleteConfirm(item: DraftMenuItem, ingIdx: number): void {
    this.confirmDeleteIngredient.set({ item, ingIdx });
  }
  cancelIngDelete(): void { this.confirmDeleteIngredient.set(null); }
  confirmIngDelete(): void {
    const conf = this.confirmDeleteIngredient();
    if (!conf) return;
    const updated = { ...conf.item, ingredients: conf.item.ingredients.filter((_, i) => i !== conf.ingIdx) };
    this.updateItem(updated);
    this.confirmDeleteIngredient.set(null);
  }

  addIngredient(item: DraftMenuItem): void {
    const ing: DraftIngredient = { id: Date.now(), name: '', quantity: 0, unit: 'gram', unit_cost_idr: 0, total_cost_idr: 0, cost_source: 'manual' };
    this.updateItem({ ...item, ingredients: [...item.ingredients, ing] });
  }

  updateIngredient(item: DraftMenuItem, ing: DraftIngredient, key: keyof DraftIngredient, value: string | number | null): void {
    if (key === 'quantity') {
      const num = Number(value);
      if (value === '' || value === null || num <= 0) {
        this.ingredientErrors.update(e => ({ ...e, [`${item.id}_${ing.id}_qty`]: 'Quantity must be greater than 0.' }));
        return;
      }
      this.ingredientErrors.update(e => { const n = { ...e }; delete n[`${item.id}_${ing.id}_qty`]; return n; });
    }

    if (key === 'unit_cost_idr') {
      if (value !== null) {
        const num = Number(value);
        if (value === '' || num <= 0) {
          this.ingredientErrors.update(e => ({ ...e, [`${item.id}_${ing.id}_cost`]: 'Unit cost must be greater than 0.' }));
          return;
        }
      }
      this.ingredientErrors.update(e => { const n = { ...e }; delete n[`${item.id}_${ing.id}_cost`]; return n; });
    }

    const ingredients = item.ingredients.map((cur) => {
      if (cur.id !== ing.id) return cur;
      const upd = { ...cur, [key]: value } as DraftIngredient;
      upd.quantity = Number(upd.quantity) || 0;
      upd.unit_cost_idr = upd.unit_cost_idr === null ? null : Number(upd.unit_cost_idr) || 0;
      upd.total_cost_idr = upd.unit_cost_idr === null ? null : upd.quantity * upd.unit_cost_idr;
      upd.cost_source = upd.unit_cost_idr === null ? 'unknown' : 'manual';
      return upd;
    });
    this.updateItem({ ...item, ingredients });
  }

  ingredientError(itemId: number, ingId: number, field: 'qty' | 'cost'): string {
    return this.ingredientErrors()[`${itemId}_${ingId}_${field}`] ?? '';
  }

  marginClass(item: DraftMenuItem): string {
    if (item.status !== 'ready') return '';
    const pct = item.gross_margin_pct ?? 0;
    if (pct >= 60) return 'pct-good';
    if (pct >= 30) return 'pct-ok';
    if (pct >= 0) return 'pct-warn';
    return 'pct-bad';
  }

  iconForName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('kopi') || n.includes('coffee')) return 'coffee';
    if (n.startsWith('es ') || n.includes('teh') || n.includes('jeruk')) return 'cup';
    if (n.includes('mie') || n.includes('soto') || n.includes('gado') || n.includes('bakso')) return 'bowl';
    return 'fastfood';
  }

  fmtIDR(value: number | null | undefined): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  ingDeleteName(): string {
    const conf = this.confirmDeleteIngredient();
    if (!conf) return 'Unnamed ingredient';
    return conf.item.ingredients[conf.ingIdx]?.name || 'Unnamed ingredient';
  }

  trackById(_: number, item: { id: number }): number { return item.id; }

  onEditNameInput(event: Event): void {
    this.editNameValue.set((event.target as HTMLInputElement).value);
  }

  onEditPriceInput(event: Event): void {
    const v = (event.target as HTMLInputElement).valueAsNumber;
    this.editPriceValue.set(Number.isFinite(v) ? v : null);
  }

  startEditName(event: Event, item: DraftMenuItem): void {
    event.stopPropagation();
    this.editingNameId.set(item.id);
    this.editNameValue.set(item.name);
    this.editNameError.set('');
  }

  saveEditName(item: DraftMenuItem): void {
    if (this.editingNameId() !== item.id) return;
    const newName = this.editNameValue().trim();
    if (!newName) {
      this.cancelEditName();
      return;
    }
    const duplicate = this.menuItems().some(
      (i) => i.id !== item.id && i.name.toLowerCase() === newName.toLowerCase()
    );
    if (duplicate) {
      this.editNameError.set('This menu name is already taken.');
      return;
    }
    this.updateItemNamePrice(item, newName, item.selling_price_idr);
    this.editingNameId.set(null);
    this.editNameValue.set('');
    this.editNameError.set('');
  }

  cancelEditName(): void {
    this.editingNameId.set(null);
    this.editNameValue.set('');
    this.editNameError.set('');
  }

  startEditPrice(event: Event, item: DraftMenuItem): void {
    event.stopPropagation();
    this.editingPriceId.set(item.id);
    this.editPriceValue.set(item.selling_price_idr);
  }

  saveEditPrice(item: DraftMenuItem): void {
    if (this.editingPriceId() !== item.id) return;
    const newPrice = this.editPriceValue();
    if (newPrice === null || newPrice <= 0) {
      this.cancelEditPrice();
      return;
    }
    this.updateItemNamePrice(item, item.name, newPrice);
    this.editingPriceId.set(null);
    this.editPriceValue.set(null);
  }

  cancelEditPrice(): void {
    this.editingPriceId.set(null);
    this.editPriceValue.set(null);
  }

  private updateItemNamePrice(item: DraftMenuItem, newName: string, newPrice: number): void {
    this.menuItems.update(items => items.map(cur => {
      if (cur.id !== item.id) return cur;
      const updated = { ...cur, name: newName, selling_price_idr: newPrice };
      return newPrice !== item.selling_price_idr ? this.recalculate(updated) : updated;
    }));
    this.persist();
  }

  private updateItem(item: DraftMenuItem): void {
    const recalculated = this.recalculate(item);
    this.menuItems.update((items) => items.map((cur) => cur.id === item.id ? recalculated : cur));
    this.persist();
  }

  private recalculate(item: DraftMenuItem): DraftMenuItem {
    const hasUnknown = item.ingredients.some((i) => i.unit_cost_idr === null);
    const cost = item.ingredients.reduce((s, i) => s + (i.total_cost_idr ?? 0), 0);
    const gross = item.selling_price_idr - cost;
    return {
      ...item,
      est_cost_idr: cost,
      gross_margin_idr: gross,
      gross_margin_pct: item.selling_price_idr > 0 ? (gross / item.selling_price_idr) * 100 : 0,
      status: hasUnknown || item.ingredients.length === 0 ? 'incomplete' : 'ready'
    };
  }

  private loadItems(): DraftMenuItem[] {
    try {
      const items: DraftMenuItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? [];
      return items.map((i) => ({ ...i, ingredients: i.ingredients ?? [] }));
    } catch { return []; }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.menuItems()));
    } catch {
      window.dispatchEvent(new CustomEvent('md:storage-error'));
    }
    if (localStorage.getItem('md_sales_uploaded_v1') === 'true') {
      this.menuChangedAfterSales.set(true);
    }
  }
}
