import { TestBed } from '@angular/core/testing';
import { lastValueFrom, of } from 'rxjs';

import { MenuItem } from '../models/menu-item.model';
import { ClaudeApiService } from './claude-api.service';
import { EnrichmentService } from './enrichment.service';
import { GeminiApiService } from './gemini-api.service';
import { IngredientPriceService } from './ingredient-price.service';

function item(name: string, price: number): MenuItem {
  return { name, selling_price_idr: price, status: 'draft' };
}

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let claude: jasmine.SpyObj<ClaudeApiService>;
  let priceSvc: jasmine.SpyObj<IngredientPriceService>;

  function setup(responseText: string, lookupReturns: number | null = 1000) {
    localStorage.clear(); // default provider = claude
    claude = jasmine.createSpyObj<ClaudeApiService>('ClaudeApiService', ['call']);
    claude.call.and.returnValue(of(responseText));
    const gemini = jasmine.createSpyObj<GeminiApiService>('GeminiApiService', ['call']);
    priceSvc = jasmine.createSpyObj<IngredientPriceService>('IngredientPriceService', ['loadPrices', 'lookup']);
    priceSvc.loadPrices.and.returnValue(of(undefined));
    priceSvc.lookup.and.returnValue(lookupReturns);

    TestBed.configureTestingModule({
      providers: [
        EnrichmentService,
        { provide: ClaudeApiService, useValue: claude },
        { provide: GeminiApiService, useValue: gemini },
        { provide: IngredientPriceService, useValue: priceSvc }
      ]
    });
    service = TestBed.inject(EnrichmentService);
  }

  afterEach(() => localStorage.clear());

  it('marks an item "ready" and computes margin when all costs are known', async () => {
    setup(JSON.stringify({ ingredients: [{ name: 'Beras', quantity: 2, unit: 'gram' }] }), 1000);
    const result = await lastValueFrom(service.estimateItem(item('Nasi', 20000)));

    expect(result.status).toBe('ready');
    expect(result.est_cost_idr).toBe(2000);          // 2 * 1000
    expect(result.gross_margin_idr).toBe(18000);
    expect(result.gross_margin_pct).toBeCloseTo(90);
  });

  it('marks an item "incomplete" when a price is unknown', async () => {
    setup(JSON.stringify({ ingredients: [{ name: 'Mystery', quantity: 1, unit: 'gram' }] }), null);
    const result = await lastValueFrom(service.estimateItem(item('X', 10000)));
    expect(result.status).toBe('incomplete');
    expect(result.ingredients?.[0].cost_source).toBe('unknown');
  });

  it('marks an item "unrecognised" when the AI says so', async () => {
    setup(JSON.stringify({ unrecognised: true }));
    const result = await lastValueFrom(service.estimateItem(item('???', 10000)));
    expect(result.status).toBe('unrecognised');
  });

  it('marks an item "failed" on unparseable AI output', async () => {
    setup('garbage');
    const result = await lastValueFrom(service.estimateItem(item('X', 10000)));
    expect(result.status).toBe('failed');
  });

  describe('estimateMargins', () => {
    it('short-circuits when there are no draft items', async () => {
      setup('{}');
      const ready: MenuItem = { name: 'Done', selling_price_idr: 1, status: 'analysed' as any };
      const result = await lastValueFrom(service.estimateMargins([{ ...ready, status: 'ready' }]));
      expect(result.estimated_count).toBe(0);
      expect(claude.call).not.toHaveBeenCalled();
    });

    it('counts estimated items after processing drafts', async () => {
      setup(JSON.stringify({ ingredients: [{ name: 'Beras', quantity: 1, unit: 'gram' }] }), 500);
      const result = await lastValueFrom(service.estimateMargins([item('Nasi', 10000)]));
      expect(result.estimated_count).toBe(1);
      expect(result.items[0].status).toBe('ready');
    });
  });
});
