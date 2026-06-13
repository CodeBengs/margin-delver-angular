import { TestBed } from '@angular/core/testing';
import { lastValueFrom, of } from 'rxjs';

import { MenuItem } from '../models/menu-item.model';
import { ClaudeApiService } from './claude-api.service';
import { GeminiApiService } from './gemini-api.service';
import { ParsedSalesRow } from './excel-parser.service';
import { SalesService } from './sales.service';

function menuItem(name: string, price: number, cost: number): MenuItem {
  return {
    name,
    selling_price_idr: price,
    est_cost_idr: cost,
    gross_margin_pct: ((price - cost) / price) * 100,
    status: 'ready'
  };
}

function salesRow(quantities: Record<string, number>): ParsedSalesRow {
  return { rowIndex: 1, date: '01/06/2026', dateValid: true, quantities, rawCells: {}, cellErrors: {} };
}

describe('SalesService', () => {
  let service: SalesService;
  let claude: jasmine.SpyObj<ClaudeApiService>;

  function setup(responseText: string) {
    localStorage.clear(); // default provider = claude
    claude = jasmine.createSpyObj<ClaudeApiService>('ClaudeApiService', ['call']);
    claude.call.and.returnValue(of(responseText));
    const gemini = jasmine.createSpyObj<GeminiApiService>('GeminiApiService', ['call']);

    TestBed.configureTestingModule({
      providers: [
        SalesService,
        { provide: ClaudeApiService, useValue: claude },
        { provide: GeminiApiService, useValue: gemini }
      ]
    });
    service = TestBed.inject(SalesService);
  }

  afterEach(() => localStorage.clear());

  it('computes per-item revenue, cost, contribution and margin', async () => {
    setup(JSON.stringify({
      verdict_summary: 'good',
      item_classifications: [{ menu_item: 'Kopi', classification: 'star' }]
    }));

    const result = await lastValueFrom(
      service.analyseSalesData(
        [menuItem('Kopi', 20000, 8000)],
        [salesRow({ Kopi: 10 })],
        30
      )
    );

    const item = result.items[0];
    expect(item.units_sold).toBe(10);
    expect(item.revenue_idr).toBe(200000);
    expect(item.est_cost_idr).toBe(80000);
    expect(item.contribution_idr).toBe(120000);
    expect(item.margin_pct).toBeCloseTo(60);
    expect(item.classification).toBe('star');
    expect(result.summary.verdict).toBe('profitable');
    expect(result.summary.verdict_summary).toBe('good');
  });

  it('defaults classification to deadweight when the AI omits the item', async () => {
    setup(JSON.stringify({ item_classifications: [] }));
    const result = await lastValueFrom(
      service.analyseSalesData([menuItem('Teh', 8000, 2000)], [salesRow({ Teh: 1 })], 30)
    );
    expect(result.items[0].classification).toBe('deadweight');
  });

  it('strips markdown code fences before parsing', async () => {
    setup('```json\n{"item_classifications":[],"suggestions":[]}\n```');
    const result = await lastValueFrom(
      service.analyseSalesData([menuItem('Teh', 8000, 2000)], [salesRow({ Teh: 1 })], 30)
    );
    expect(result.items.length).toBe(1);
  });

  it('throws a friendly error when the response is not valid JSON', async () => {
    setup('not json at all');
    await expectAsync(
      lastValueFrom(service.analyseSalesData([menuItem('Teh', 8000, 2000)], [salesRow({ Teh: 1 })], 30))
    ).toBeRejectedWithError(/Failed to parse analysis response/);
  });

  it('maps AI suggestions with ids and a "new" review status', async () => {
    setup(JSON.stringify({
      item_classifications: [],
      suggestions: [
        { suggestion_type: 'reprice', title: 'Raise', description: 'd', items_involved: ['Teh'], estimated_impact: '+Rp 1jt' }
      ]
    }));
    const result = await lastValueFrom(
      service.analyseSalesData([menuItem('Teh', 8000, 2000)], [salesRow({ Teh: 1 })], 30)
    );
    expect(result.suggestions[0]).toEqual(jasmine.objectContaining({ id: 1, review_status: 'new', suggestion_type: 'reprice' }));
  });
});
