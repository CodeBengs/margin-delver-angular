import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProfitabilityAnalysisResult } from '../models/profitability.model';
import { SalesService } from './sales.service';
import { SalesStateService } from './sales-state.service';

const RESULT = {
  summary: { total_revenue_idr: 0, total_cost_idr: 0, total_gross_profit_idr: 0, overall_margin_pct: 0, verdict: 'profitable', verdict_summary: '' },
  items: [],
  suggestions: []
} as ProfitabilityAnalysisResult;

describe('SalesStateService', () => {
  let service: SalesStateService;
  let salesService: jasmine.SpyObj<SalesService>;

  beforeEach(() => {
    localStorage.clear();
    salesService = jasmine.createSpyObj<SalesService>('SalesService', ['analyseSalesData']);
    TestBed.configureTestingModule({
      providers: [SalesStateService, { provide: SalesService, useValue: salesService }]
    });
    service = TestBed.inject(SalesStateService);
  });

  afterEach(() => localStorage.clear());

  it('starts idle', () => {
    expect(service.uploadState()).toBe('idle');
  });

  it('stores the result and moves to "results" on success', () => {
    salesService.analyseSalesData.and.returnValue(of(RESULT));
    service.runAnalysis([], [], 30);
    expect(service.uploadState()).toBe('results');
    expect(service.analysisResult()).toBe(RESULT);
  });

  it('moves to "preview" and surfaces the message on error', () => {
    salesService.analyseSalesData.and.returnValue(throwError(() => new Error('boom')));
    service.runAnalysis([], [], 30);
    expect(service.uploadState()).toBe('preview');
    expect(service.analysisMessage()).toBe('boom');
  });

  it('ignores re-entrant calls while analyzing', () => {
    // Observable that never emits keeps state in "analyzing".
    salesService.analyseSalesData.and.returnValue(of());
    service.uploadState.set('analyzing');
    service.runAnalysis([], [], 30);
    expect(salesService.analyseSalesData).not.toHaveBeenCalled();
  });

  it('clear() resets all state', () => {
    salesService.analyseSalesData.and.returnValue(of(RESULT));
    service.runAnalysis([], [], 30);
    service.periodDays.set(30);
    service.clear();
    expect(service.uploadState()).toBe('idle');
    expect(service.analysisResult()).toBeNull();
    expect(service.periodDays()).toBe(0);
  });

  it('resetUpload() clears the preview but keeps it idle', () => {
    service.parsedSales.set({} as any);
    service.resetUpload();
    expect(service.parsedSales()).toBeNull();
    expect(service.uploadState()).toBe('idle');
  });
});
