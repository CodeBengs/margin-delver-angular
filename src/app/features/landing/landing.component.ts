import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Ingredient } from '../../core/models/ingredient.model';
import { MenuItem } from '../../core/models/menu-item.model';

type MenuTab = 'upload' | 'manual';
type DraftIngredient = Ingredient & { id: number };
type DraftMenuItem = Omit<MenuItem, 'id' | 'ingredients'> & { id: number; ingredients: DraftIngredient[] };

const STORAGE_KEY = 'md_angular_menu_v1';

const DEMO_ITEMS: DraftMenuItem[] = [
  {
    id: 1,
    name: 'Nasi Goreng Ayam',
    selling_price_idr: 28000,
    est_cost_idr: 9300,
    gross_margin_idr: 18700,
    gross_margin_pct: 66.8,
    status: 'ready',
    ingredients: [
      { id: 11, name: 'Nasi putih', quantity: 180, unit: 'gram', unit_cost_idr: 15, total_cost_idr: 2700, cost_source: 'price_list' },
      { id: 12, name: 'Ayam', quantity: 70, unit: 'gram', unit_cost_idr: 58, total_cost_idr: 4060, cost_source: 'price_list' },
      { id: 13, name: 'Bumbu nasi goreng', quantity: 1, unit: 'porsi', unit_cost_idr: 2540, total_cost_idr: 2540, cost_source: 'manual' }
    ]
  },
  {
    id: 2,
    name: 'Ayam Geprek Sambal Matah',
    selling_price_idr: 32000,
    est_cost_idr: 15150,
    gross_margin_idr: 16850,
    gross_margin_pct: 52.7,
    status: 'ready',
    ingredients: [
      { id: 21, name: 'Ayam fillet', quantity: 120, unit: 'gram', unit_cost_idr: 65, total_cost_idr: 7800, cost_source: 'price_list' },
      { id: 22, name: 'Tepung bumbu', quantity: 45, unit: 'gram', unit_cost_idr: 38, total_cost_idr: 1710, cost_source: 'price_list' },
      { id: 23, name: 'Sambal matah', quantity: 1, unit: 'porsi', unit_cost_idr: 5640, total_cost_idr: 5640, cost_source: 'manual' }
    ]
  },
  {
    id: 3,
    name: 'Es Kopi Susu Aren',
    selling_price_idr: 22000,
    est_cost_idr: 7800,
    gross_margin_idr: 14200,
    gross_margin_pct: 64.5,
    status: 'ready',
    ingredients: [
      { id: 31, name: 'Espresso', quantity: 35, unit: 'ml', unit_cost_idr: 95, total_cost_idr: 3325, cost_source: 'manual' },
      { id: 32, name: 'Susu', quantity: 120, unit: 'ml', unit_cost_idr: 24, total_cost_idr: 2880, cost_source: 'price_list' },
      { id: 33, name: 'Gula aren', quantity: 25, unit: 'ml', unit_cost_idr: 64, total_cost_idr: 1600, cost_source: 'price_list' }
    ]
  }
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  readonly activeTab = signal<MenuTab>('upload');
  readonly menuItems = signal<DraftMenuItem[]>(this.loadItems());
  readonly selectedItemId = signal<number | null>(this.menuItems()[0]?.id ?? null);
  readonly processing = signal(false);
  readonly notice = signal('');
  readonly manualName = signal('');
  readonly manualPrice = signal<number | null>(null);

  readonly selectedItem = computed(() => this.menuItems().find((item) => item.id === this.selectedItemId()) ?? null);
  readonly readyItems = computed(() => this.menuItems().filter((item) => item.status === 'ready'));
  readonly totalRevenuePotential = computed(() => this.menuItems().reduce((sum, item) => sum + item.selling_price_idr, 0));
  readonly totalCost = computed(() => this.menuItems().reduce((sum, item) => sum + (item.est_cost_idr ?? 0), 0));
  readonly averageMargin = computed(() => {
    const ready = this.readyItems();
    if (!ready.length) return 0;
    return ready.reduce((sum, item) => sum + (item.gross_margin_pct ?? 0), 0) / ready.length;
  });

  readonly units = ['gram', 'ml', 'butir', 'lembar', 'siung', 'buah', 'sdm', 'sdt', 'porsi'] as const;

  setTab(tab: MenuTab): void {
    this.activeTab.set(tab);
  }

  loadDemo(): void {
    this.menuItems.set(this.cloneItems(DEMO_ITEMS));
    this.selectedItemId.set(1);
    this.notice.set('Demo menu loaded. Semua data masih lokal di browser.');
    this.persist();
  }

  clearWorkspace(): void {
    this.menuItems.set([]);
    this.selectedItemId.set(null);
    this.notice.set('Workspace cleared.');
    this.persist();
  }

  setManualName(value: string): void {
    this.manualName.set(value);
  }

  setManualPrice(value: string | number | null): void {
    const parsed = Number(value);
    this.manualPrice.set(Number.isFinite(parsed) ? parsed : null);
  }

  addManualItem(): void {
    const name = this.manualName().trim();
    const price = Number(this.manualPrice());
    if (!name || !price || price <= 0) {
      this.notice.set('Isi nama menu dan selling price lebih dari 0.');
      return;
    }

    const duplicate = this.menuItems().some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      this.notice.set('Menu dengan nama yang sama sudah ada.');
      return;
    }

    const item: DraftMenuItem = {
      id: Date.now(),
      name,
      selling_price_idr: price,
      est_cost_idr: null,
      gross_margin_idr: null,
      gross_margin_pct: null,
      status: 'draft',
      ingredients: []
    };

    this.menuItems.update((items) => [item, ...items]);
    this.selectedItemId.set(item.id);
    this.manualName.set('');
    this.manualPrice.set(null);
    this.notice.set('Menu added. Jalankan estimate atau isi ingredient manual.');
    this.persist();
  }

  simulateUpload(): void {
    this.loadDemo();
    this.notice.set('Excel sample accepted: 3 menu items detected, header row skipped.');
  }

  estimateMargins(): void {
    if (!this.menuItems().length) {
      this.notice.set('Tambahkan menu dulu sebelum estimate margin.');
      return;
    }

    this.processing.set(true);
    this.menuItems.update((items) => items.map((item) => item.status === 'draft' ? { ...item, status: 'estimating' } : item));

    window.setTimeout(() => {
      this.menuItems.update((items) => items.map((item) => {
        if (item.status !== 'estimating') return item;
        const fallbackIngredients = this.fakeIngredients(item.id);
        return this.recalculate({ ...item, ingredients: fallbackIngredients, status: 'ready' });
      }));
      this.processing.set(false);
      this.notice.set('Local estimate selesai. Nanti step ini akan diganti response Claude dari backend Go.');
      this.persist();
    }, 600);
  }

  selectItem(item: DraftMenuItem): void {
    this.selectedItemId.set(this.selectedItemId() === item.id ? null : item.id);
  }

  isExpanded(item: DraftMenuItem): boolean {
    return this.selectedItemId() === item.id;
  }

  addIngredient(item: DraftMenuItem | null): void {
    if (!item) return;
    const ingredient: DraftIngredient = {
      id: Date.now(),
      name: 'Ingredient baru',
      quantity: 1,
      unit: 'porsi',
      unit_cost_idr: 0,
      total_cost_idr: 0,
      cost_source: 'manual'
    };
    this.updateItem({ ...item, ingredients: [...item.ingredients, ingredient] });
  }

  removeIngredient(item: DraftMenuItem, ingredientId: number): void {
    this.updateItem({ ...item, ingredients: item.ingredients.filter((ingredient) => ingredient.id !== ingredientId) });
  }

  updateIngredient(item: DraftMenuItem, ingredient: DraftIngredient, key: keyof DraftIngredient, value: string | number | null): void {
    const ingredients = item.ingredients.map((current) => {
      if (current.id !== ingredient.id) return current;
      const updated = { ...current, [key]: value } as DraftIngredient;
      updated.quantity = Number(updated.quantity) || 0;
      updated.unit_cost_idr = updated.unit_cost_idr === null ? null : Number(updated.unit_cost_idr) || 0;
      updated.total_cost_idr = updated.unit_cost_idr === null ? null : updated.quantity * updated.unit_cost_idr;
      updated.cost_source = updated.unit_cost_idr === null ? 'unknown' : 'manual';
      return updated;
    });
    this.updateItem({ ...item, ingredients });
  }

  deleteItem(item: DraftMenuItem): void {
    this.menuItems.update((items) => items.filter((current) => current.id !== item.id));
    this.selectedItemId.set(this.menuItems()[0]?.id ?? null);
    this.persist();
  }

  fmtIDR(value: number | null | undefined): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  marginClass(item: DraftMenuItem): string {
    const margin = item.gross_margin_pct ?? 0;
    if (item.status !== 'ready') return 'muted';
    if (margin >= 60) return 'good';
    if (margin >= 45) return 'warn';
    return 'bad';
  }

  private updateItem(item: DraftMenuItem): void {
    const recalculated = this.recalculate(item);
    this.menuItems.update((items) => items.map((current) => current.id === item.id ? recalculated : current));
    this.persist();
  }

  private recalculate(item: DraftMenuItem): DraftMenuItem {
    const hasUnknown = item.ingredients.some((ingredient) => ingredient.unit_cost_idr === null);
    const cost = item.ingredients.reduce((sum, ingredient) => sum + (ingredient.total_cost_idr ?? 0), 0);
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DraftMenuItem[];
    } catch {
      return [];
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.menuItems()));
  }

  private cloneItems(items: DraftMenuItem[]): DraftMenuItem[] {
    return JSON.parse(JSON.stringify(items)) as DraftMenuItem[];
  }
}





