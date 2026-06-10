import { Injectable, signal, WritableSignal } from '@angular/core';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';

@Injectable({ providedIn: 'root' })
export class SalesStateService {
  readonly analysisResult: WritableSignal<ProfitabilityAnalysisResult | null> = signal(null);
  readonly periodDays: WritableSignal<number> = signal(0);

  clear(): void {
    this.analysisResult.set(null);
    this.periodDays.set(0);
  }
}
