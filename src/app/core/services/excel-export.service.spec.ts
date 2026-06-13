import { TestBed } from '@angular/core/testing';

import { MenuItem } from '../models/menu-item.model';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';
import { ExcelExportService } from './excel-export.service';

describe('ExcelExportService', () => {
  let service: ExcelExportService;
  let clickSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExcelExportService);
    // Prevent real file downloads during the test run.
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');
    clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
  });

  const items: MenuItem[] = [
    { name: 'Kopi', selling_price_idr: 20000, est_cost_idr: 8000, gross_margin_idr: 12000, gross_margin_pct: 60, status: 'ready' }
  ];

  const analysis: ProfitabilityAnalysisResult = {
    summary: {
      total_revenue_idr: 0, total_cost_idr: 0, total_gross_profit_idr: 0,
      overall_margin_pct: 0, verdict: 'profitable', verdict_summary: ''
    },
    items: [
      { menu_item: 'Kopi', units_sold: 5, revenue_idr: 100000, est_cost_idr: 40000, contribution_idr: 60000, margin_pct: 60, classification: 'star' }
    ],
    suggestions: [
      { id: 1, suggestion_type: 'promote', title: 't', description: 'd', items_involved: ['Kopi'], estimated_impact: '+Rp 1jt' }
    ]
  };

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('builds and triggers a download for each report type', () => {
    service.exportMarginReport(items);
    service.exportSalesTemplate(['Kopi', 'Teh']);
    service.exportFullReport(items, analysis);
    service.exportMenuTemplate();
    expect(clickSpy).toHaveBeenCalledTimes(4);
  });
});
