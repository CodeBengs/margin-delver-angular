import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface StoredMenuItem {
  id: number;
  name: string;
  selling_price_idr: number;
  est_cost_idr: number | null;
  gross_margin_pct: number | null;
  status: string;
}

const MENU_STORAGE_KEY = 'md_angular_menu_v1';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  readonly menuItems = signal<StoredMenuItem[]>(this.loadMenuItems());
  readonly hasMenu = computed(() => this.menuItems().length > 0);
  readonly readyCount = computed(() => this.menuItems().filter((item) => item.status === 'ready').length);
  readonly avgMargin = computed(() => {
    const items = this.menuItems();
    if (!items.length) return 0;
    return items.reduce((sum, item) => sum + (item.gross_margin_pct ?? 0), 0) / items.length;
  });

  resetSession(): void {
    localStorage.removeItem(MENU_STORAGE_KEY);
    this.menuItems.set([]);
  }

  fmtPct(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  private loadMenuItems(): StoredMenuItem[] {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as StoredMenuItem[];
    } catch {
      return [];
    }
  }
}

