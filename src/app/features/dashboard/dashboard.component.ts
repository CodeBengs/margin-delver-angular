import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DEMO_MENU as DEMO_MENU_FULL } from '../../core/demo-data';
import { storageGet, storageRemove, storageSet } from '../../core/utils/storage.util';
import { SalesStateService } from '../../core/services/sales-state.service';

interface StoredMenuItem {
  id: number;
  name: string;
  selling_price_idr: number;
  est_cost_idr: number | null;
  gross_margin_pct: number | null;
  status: string;
}

type StoredSales = Record<string, unknown>;

const MENU_KEY = 'md_angular_menu_v1';
const SALES_KEY = 'md_angular_sales_v1';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly salesState = inject(SalesStateService);
  private demoListener = () => this.loadDemo();

  readonly menuItems = signal<StoredMenuItem[]>(this.loadMenuItems());

  readonly hasMenu = computed(() => this.menuItems().length > 0);
  readonly hasSales = computed(() => this.salesState.analysisResult() !== null);
  readonly readyCount = computed(() => this.menuItems().filter((i) => i.status === 'ready').length);

  readonly avgMargin = computed(() => {
    const items = this.menuItems();
    if (!items.length) return 0;
    return items.reduce((s, i) => s + (i.gross_margin_pct ?? 0), 0) / items.length;
  });

  readonly totalRevenue = computed(() => this.salesState.analysisResult()?.summary.total_revenue_idr ?? 0);
  readonly totalCost = computed(() => this.salesState.analysisResult()?.summary.total_cost_idr ?? 0);
  readonly totalProfit = computed(() => this.salesState.analysisResult()?.summary.total_gross_profit_idr ?? 0);
  readonly overallMargin = computed(() => this.salesState.analysisResult()?.summary.overall_margin_pct ?? 0);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    window.addEventListener('md:load-demo', this.demoListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('md:load-demo', this.demoListener);
  }

  loadDemo(): void {
    storageSet(MENU_KEY, JSON.stringify(DEMO_MENU_FULL));
    this.menuItems.set(DEMO_MENU_FULL.map((i) => ({ ...i })));
  }

  goToMenu(): void {
    this.router.navigate(['/menu']);
  }

  goToAnalysis(): void {
    this.router.navigate(['/sales-upload']);
  }

  readonly confirmReset = signal(false);

  requestReset(): void {
    this.confirmReset.set(true);
  }

  cancelReset(): void {
    this.confirmReset.set(false);
  }

  resetSession(): void {
    storageRemove(MENU_KEY);
    storageRemove(SALES_KEY);
    window.location.reload();
  }

  fmtIDR(value: number): string {
    if (!value && value !== 0) return '—';
    return 'Rp ' + Math.round(value).toLocaleString('id-ID');
  }

  fmtPct(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  fmtNum(value: number): string {
    return value.toLocaleString('id-ID');
  }

  private loadMenuItems(): StoredMenuItem[] {
    try {
      const raw = storageGet(MENU_KEY);
      return raw ? (JSON.parse(raw) as StoredMenuItem[]) : [];
    } catch {
      return [];
    }
  }

  private loadSales(): StoredSales {
    try {
      const raw = storageGet(SALES_KEY);
      return raw ? (JSON.parse(raw) as StoredSales) : {};
    } catch {
      return {};
    }
  }
}
