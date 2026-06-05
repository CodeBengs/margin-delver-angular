import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { MenuItem } from '../models/menu-item.model';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  exportMarginReport(items: MenuItem[]): void {
    const exportable = items.filter(
      (i) => i.status === 'ready' || i.status === 'incomplete'
    );

    const data = [
      ['Menu Name', 'Selling Price (IDR)', 'Est. Ingredient Cost (IDR)', 'Est. Gross Margin (IDR)', 'Est. Gross Margin (%)']
    ];

    for (const item of exportable) {
      data.push([
        item.name,
        Math.round(item.selling_price_idr).toString(),
        Math.round(item.est_cost_idr ?? 0).toString(),
        Math.round(item.gross_margin_idr ?? 0).toString(),
        ((item.gross_margin_pct ?? 0).toFixed(2)).toString()
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Margin Report');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    this.triggerDownload(buf, 'margin-report.xlsx');
  }

  exportSalesTemplate(menuItemNames: string[]): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(month + 1).padStart(2, '0');
      dates.push(`${dd}/${mm}/${year}`);
    }

    const headerRow = ['Date', ...menuItemNames];
    const dataRows = dates.map((date) => [date, ...menuItemNames.map(() => '')]);

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Data');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    this.triggerDownload(buf, 'sales-template.xlsx');
  }

  exportFullReport(items: MenuItem[], analysis: ProfitabilityAnalysisResult): void {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Margin Data
    const exportable = items.filter(
      (i) => i.status === 'ready' || i.status === 'incomplete'
    );
    const marginData = [
      ['Menu Name', 'Selling Price (IDR)', 'Est. Ingredient Cost (IDR)', 'Est. Gross Margin (IDR)', 'Est. Gross Margin (%)']
    ];
    for (const item of exportable) {
      marginData.push([
        item.name,
        Math.round(item.selling_price_idr).toString(),
        Math.round(item.est_cost_idr ?? 0).toString(),
        Math.round(item.gross_margin_idr ?? 0).toString(),
        ((item.gross_margin_pct ?? 0).toFixed(2)).toString()
      ]);
    }
    const wsMargin = XLSX.utils.aoa_to_sheet(marginData);
    XLSX.utils.book_append_sheet(wb, wsMargin, 'Margin Data');

    // Sheet 2: Sales Performance
    const salesData = [
      ['Menu Item', 'Units Sold', 'Revenue (IDR)', 'Est. Cost (IDR)', 'Contribution (IDR)', 'Margin %', 'Classification']
    ];
    for (const item of analysis.items) {
      salesData.push([
        item.menu_item,
        item.units_sold.toString(),
        Math.round(item.revenue_idr).toString(),
        Math.round(item.est_cost_idr).toString(),
        Math.round(item.contribution_idr).toString(),
        item.margin_pct.toFixed(2),
        item.classification
      ]);
    }
    const wsSales = XLSX.utils.aoa_to_sheet(salesData);
    XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Performance');

    // Sheet 3: Suggestions
    const suggestionsData = [
      ['#', 'Type', 'Title', 'Description', 'Items Involved', 'Estimated Impact']
    ];
    analysis.suggestions.forEach((s, idx) => {
      suggestionsData.push([
        (idx + 1).toString(),
        s.suggestion_type,
        s.title,
        s.description,
        s.items_involved.join(', '),
        s.estimated_impact
      ]);
    });
    const wsSuggestions = XLSX.utils.aoa_to_sheet(suggestionsData);
    XLSX.utils.book_append_sheet(wb, wsSuggestions, 'Suggestions');

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    this.triggerDownload(buf, 'full-report.xlsx');
  }

  private triggerDownload(buffer: ArrayBuffer, filename: string): void {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
