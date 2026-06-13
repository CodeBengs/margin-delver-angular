import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Subscription } from 'rxjs';

import { MenuItem } from '../models/menu-item.model';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';
import { ParsedSalesResult, ParsedSalesRow } from './excel-parser.service';
import { SalesService } from './sales.service';
import { storageSet } from '../utils/storage.util';

export type UploadState = 'idle' | 'preview' | 'analyzing' | 'results';

@Injectable({ providedIn: 'root' })
export class SalesStateService {
  private readonly salesService = inject(SalesService);

  /** Final analysis result, persisted across navigation. */
  readonly analysisResult: WritableSignal<ProfitabilityAnalysisResult | null> = signal(null);
  readonly periodDays: WritableSignal<number> = signal(0);

  /**
   * Upload/analysis lifecycle state. Lives in this root service (not the component)
   * so it survives navigation — an in-flight analysis keeps running and the parsed
   * preview is retained when the user leaves and returns to the page.
   */
  readonly uploadState: WritableSignal<UploadState> = signal('idle');
  readonly parsedSales: WritableSignal<ParsedSalesResult | null> = signal(null);
  readonly analysisMessage: WritableSignal<string> = signal('');

  private analysisSub: Subscription | null = null;

  /**
   * Kick off the AI analysis. Runs asynchronously in this singleton service so it
   * continues regardless of which page the user is on. Re-entrant calls are ignored
   * while a run is already in flight.
   */
  runAnalysis(menuItems: MenuItem[], salesRows: ParsedSalesRow[], periodDays: number): void {
    if (this.uploadState() === 'analyzing') return;

    this.uploadState.set('analyzing');
    this.analysisMessage.set('');
    this.analysisSub?.unsubscribe();
    this.analysisSub = this.salesService.analyseSalesData(menuItems, salesRows, periodDays).subscribe({
      next: (result) => {
        this.analysisResult.set(result);
        this.uploadState.set('results');
        this.analysisSub = null;
        if (!storageSet('md_sales_uploaded_v1', 'true')) {
          window.dispatchEvent(new CustomEvent('md:storage-error'));
        }
      },
      error: (err) => {
        this.analysisMessage.set(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
        this.uploadState.set('preview');
        this.analysisSub = null;
      }
    });
  }

  /** Reset only the upload flow (parsed preview), keeping any existing result cleared by the caller. */
  resetUpload(): void {
    this.analysisSub?.unsubscribe();
    this.analysisSub = null;
    this.parsedSales.set(null);
    this.uploadState.set('idle');
    this.analysisMessage.set('');
  }

  clear(): void {
    this.analysisSub?.unsubscribe();
    this.analysisSub = null;
    this.analysisResult.set(null);
    this.periodDays.set(0);
    this.parsedSales.set(null);
    this.uploadState.set('idle');
    this.analysisMessage.set('');
  }
}
