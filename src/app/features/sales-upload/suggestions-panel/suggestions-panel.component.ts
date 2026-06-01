import { Component, Input } from '@angular/core';

import { AiSuggestion } from '../../../core/models/profitability.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-suggestions-panel',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './suggestions-panel.component.html',
  styleUrl: './suggestions-panel.component.scss'
})
export class SuggestionsPanelComponent {
  @Input() suggestions: AiSuggestion[] = [];
}

