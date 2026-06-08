import { Injectable } from '@angular/core';

import { MenuItem } from '../models/menu-item.model';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';
import { ExcelExportService } from './excel-export.service';

@Injectable({ providedIn: 'root' })
export class ExportService {
  constructor(private readonly excelExport: ExcelExportService) {}

  downloadMarginReport(items: MenuItem[]): void {
    this.excelExport.exportMarginReport(items);
  }

  downloadSalesTemplate(menuItemNames: string[]): void {
    this.excelExport.exportSalesTemplate(menuItemNames);
  }

  downloadFullReport(items: MenuItem[], analysis: ProfitabilityAnalysisResult): void {
    this.excelExport.exportFullReport(items, analysis);
  }

  downloadMenuTemplate(): void {
    this.excelExport.exportMenuTemplate();
  }
}
