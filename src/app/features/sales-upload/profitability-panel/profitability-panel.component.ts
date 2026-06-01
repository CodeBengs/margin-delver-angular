import { Component, Input } from '@angular/core';

import { ProfitabilityAnalysisResult } from '../../../core/models/profitability.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IdrCurrencyPipe } from '../../../shared/pipes/idr-currency.pipe';

@Component({
  selector: 'app-profitability-panel',
  standalone: true,
  imports: [StatusBadgeComponent, IdrCurrencyPipe],
  templateUrl: './profitability-panel.component.html',
  styleUrl: './profitability-panel.component.scss'
})
export class ProfitabilityPanelComponent {
  @Input() analysis: ProfitabilityAnalysisResult | null = null;
}

