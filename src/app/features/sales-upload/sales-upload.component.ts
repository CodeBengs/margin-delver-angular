import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AiSuggestion, ItemClassification, ProfitabilityAnalysisResult, ProfitabilityItem } from '../../core/models/profitability.model';

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
  selector: 'app-sales-upload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sales-upload.component.html',
  styleUrl: './sales-upload.component.scss'
})
export class SalesUploadComponent {
  readonly message = signal('');
  readonly salesLoaded = signal(false);
  readonly analysisResult = signal<ProfitabilityAnalysisResult | null>(null);
  readonly menuItems = signal<StoredMenuItem[]>(this.loadMenuItems());

  readonly readyItems = computed(() => this.menuItems().filter((item) => item.status === 'ready' && item.est_cost_idr !== null));
  readonly isLocked = computed(() => this.readyItems().length === 0);
  readonly classificationCounts = computed(() => {
    const counts: Record<ItemClassification, number> = { star: 0, workhorse: 0, niche: 0, deadweight: 0 };
    for (const item of this.analysisResult()?.items ?? []) counts[item.classification] += 1;
    return counts;
  });

  refreshMenu(): void {
    this.menuItems.set(this.loadMenuItems());
    this.message.set('Menu state refreshed from local workspace.');
  }

  uploadSampleSales(): void {
    if (this.isLocked()) {
      this.message.set('Complete at least one ready menu item before analysing sales.');
      return;
    }
    this.salesLoaded.set(true);
    this.message.set('Sample sales workbook loaded: 30 days, all ready menu columns matched.');
  }

  analyse(): void {
    if (!this.salesLoaded()) {
      this.message.set('Upload or load the sample sales workbook first.');
      return;
    }

    const items = this.buildItems();
    const totalRevenue = items.reduce((sum, item) => sum + item.revenue_idr, 0);
    const totalCost = items.reduce((sum, item) => sum + item.est_cost_idr, 0);
    const gross = totalRevenue - totalCost;
    const margin = totalRevenue ? (gross / totalRevenue) * 100 : 0;

    this.analysisResult.set({
      summary: {
        total_revenue_idr: totalRevenue,
        total_cost_idr: totalCost,
        total_gross_profit_idr: gross,
        overall_margin_pct: margin,
        verdict: margin > 2 ? 'profitable' : margin < -2 ? 'loss' : 'break_even',
        verdict_summary: 'Menu Anda menghasilkan gross margin sehat untuk periode sample ini. Fokus berikutnya adalah menjaga volume item high-margin dan memperbaiki item volume tinggi yang margin-nya lebih tipis.'
      },
      items,
      suggestions: this.buildSuggestions(items)
    });
    this.message.set('Profitability analysis generated locally. Backend will replace this calculation when ready.');
  }

  fmtIDR(value: number | null | undefined): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  trackByName(_: number, item: { menu_item: string }): string {
    return item.menu_item;
  }

  private buildItems(): ProfitabilityItem[] {
    const ready = this.readyItems();
    const raw = ready.map((item, index) => {
      const units = [320, 210, 430, 150, 95, 280][index % 6];
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

    const medianMargin = this.median(raw.map((item) => item.margin_pct));
    const medianUnits = this.median(raw.map((item) => item.units_sold));
    return raw.map((item) => ({ ...item, classification: this.classify(item.margin_pct, item.units_sold, medianMargin, medianUnits) }));
  }

  private buildSuggestions(items: ProfitabilityItem[]): AiSuggestion[] {
    const workhorse = items.find((item) => item.classification === 'workhorse');
    const star = items.find((item) => item.classification === 'star') ?? items[0];
    const deadweight = items.find((item) => item.classification === 'deadweight');

    const suggestions: AiSuggestion[] = [];
    if (star) {
      suggestions.push({
        suggestion_type: 'promote',
        title: `Push ${star.menu_item} as anchor menu`,
        description: 'Item ini punya kombinasi volume dan margin yang kuat. Jadikan rekomendasi utama di menu board atau campaign harian.',
        items_involved: [star.menu_item],
        estimated_impact: 'Higher high-margin sales mix',
        review_status: 'new'
      });
    }
    if (workhorse) {
      suggestions.push({
        suggestion_type: 'reprice',
        title: `Review cost structure for ${workhorse.menu_item}`,
        description: 'Volume kuat tapi margin relatif rendah. Coba naikkan harga kecil atau cari ingredient substitute yang tidak mengubah rasa utama.',
        items_involved: [workhorse.menu_item],
        estimated_impact: 'Improve contribution without losing traffic',
        review_status: 'new'
      });
    }
    if (deadweight) {
      suggestions.push({
        suggestion_type: 'sunset',
        title: `Limit ${deadweight.menu_item} availability`,
        description: 'Volume dan margin sama-sama rendah. Pertimbangkan seasonal availability atau bundle dengan item yang lebih kuat.',
        items_involved: [deadweight.menu_item],
        estimated_impact: 'Reduce low-return prep complexity',
        review_status: 'new'
      });
    }
    return suggestions.slice(0, 3);
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
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
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

