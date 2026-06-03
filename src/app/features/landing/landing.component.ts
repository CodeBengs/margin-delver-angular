import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { DEMO_MENU } from '../../core/demo-data';
import { Ingredient } from '../../core/models/ingredient.model';
import { MenuItem } from '../../core/models/menu-item.model';

type MenuTab = 'upload' | 'manual';
type DraftIngredient = Ingredient & { id: number };
type DraftMenuItem = Omit<MenuItem, 'id' | 'ingredients'> & { id: number; ingredients: DraftIngredient[] };

const STORAGE_KEY = 'md_angular_menu_v1';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  readonly hasMenu = computed(() => this.menuItems().length > 0);
  readonly readyItems = computed(() => this.menuItems().filter((i) => i.status === 'ready'));
  readonly readyCount = computed(() => this.readyItems().length);
  readonly hasPendingItems = computed(() => this.menuItems().some((i) => ['draft', 'pending', 'incomplete'].includes(i.status)));
  readonly totalRevenuePotential = computed(() => this.menuItems().reduce((s, i) => s + i.selling_price_idr, 0));
  readonly totalCost = computed(() => this.menuItems().reduce((s, i) => s + (i.est_cost_idr ?? 0), 0));
  readonly averageMargin = computed(() => {
    const ready = this.readyItems();
    return ready.length ? ready.reduce((s, i) => s + (i.gross_margin_pct ?? 0), 0) / ready.length : 0;
  });

  ngOnInit(): void { window.addEventListener('md:load-demo', this.demoListener); }
  ngOnDestroy(): void { window.removeEventListener('md:load-demo', this.demoListener); }

  setTab(tab: MenuTab): void { this.activeTab.set(tab); }

  loadDemo(): void {
    this.menuItems.set(JSON.parse(JSON.stringify(DEMO_MENU)) as DraftMenuItem[]);
    this.selectedItemId.set(null);
    this.persist();
    window.dispatchEvent(new CustomEvent('md:load-demo'));
  }

  setManualName(v: string): void { this.manualName.set(v); }
  setManualPrice(v: string | number | null): void {
    const n = Number(v);
    this.manualPrice.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  addManualItem(): void {
    const name = this.manualName().trim();
    const price = Number(this.manualPrice());
    if (!name || !price) return;
    if (this.menuItems().some((i) => i.name.toLowerCase() === name.toLowerCase())) return;
    const item: DraftMenuItem = {
      id: Date.now(), name, selling_price_idr: price,
      est_cost_idr: null, gross_margin_idr: null, gross_margin_pct: null,
      status: 'draft', ingredients: []
    };
    this.menuItems.update((items) => [item, ...items]);
    this.selectedItemId.set(item.id);
    this.manualName.set('');
    this.manualPrice.set(null);
    this.persist();
  }

  simulateUpload(): void { this.loadDemo(); }

  estimateMargins(): void {
    if (!this.hasPendingItems()) return;
    this.processing.set(true);
    this.menuItems.update((items) =>
      items.map((i) => ['draft', 'pending', 'incomplete'].includes(i.status) ? { ...i, status: 'estimating' } : i)
    );
    window.setTimeout(() => {
      this.menuItems.update((items) =>
        items.map((i) => {
          if (i.status !== 'estimating') return i;
          return this.recalculate({ ...i, ingredients: this.fakeIngredients(i.id), status: 'ready' });
        })
      );
      this.processing.set(false);
      this.persist();
    }, 600);
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

  private fakeIngredients(seed: number): DraftIngredient[] {
    return [
      { id: seed * 10 + 1, name: 'Bahan utama', quantity: 100, unit: 'gram', unit_cost_idr: 55, total_cost_idr: 5500, cost_source: 'manual' },
      { id: seed * 10 + 2, name: 'Bumbu', quantity: 1, unit: 'porsi', unit_cost_idr: 2500, total_cost_idr: 2500, cost_source: 'manual' }
    ];
  }

  private loadItems(): DraftMenuItem[] {
    try {
      const items: DraftMenuItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? [];
      return items.map((i) => ({ ...i, ingredients: i.ingredients ?? [] }));
    } catch { return []; }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.menuItems()));
  }
}
