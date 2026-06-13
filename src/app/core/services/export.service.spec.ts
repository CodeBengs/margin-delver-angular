import { TestBed } from '@angular/core/testing';

import { MenuItem } from '../models/menu-item.model';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';
import { ExcelExportService } from './excel-export.service';
import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;
  let excel: jasmine.SpyObj<ExcelExportService>;

  beforeEach(() => {
    excel = jasmine.createSpyObj<ExcelExportService>('ExcelExportService', [
      'exportMarginReport',
      'exportSalesTemplate',
      'exportFullReport',
      'exportMenuTemplate'
    ]);
    TestBed.configureTestingModule({
      providers: [ExportService, { provide: ExcelExportService, useValue: excel }]
    });
    service = TestBed.inject(ExportService);
  });

  it('delegates each download to ExcelExportService', () => {
    const items: MenuItem[] = [];
    const analysis = {} as ProfitabilityAnalysisResult;

    service.downloadMarginReport(items);
    service.downloadSalesTemplate(['Kopi']);
    service.downloadFullReport(items, analysis);
    service.downloadMenuTemplate();

    expect(excel.exportMarginReport).toHaveBeenCalledWith(items);
    expect(excel.exportSalesTemplate).toHaveBeenCalledWith(['Kopi']);
    expect(excel.exportFullReport).toHaveBeenCalledWith(items, analysis);
    expect(excel.exportMenuTemplate).toHaveBeenCalled();
  });
});
