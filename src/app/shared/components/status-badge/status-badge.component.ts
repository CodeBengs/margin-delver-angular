import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss'
})
export class StatusBadgeComponent {
  @Input({ required: true }) label = '';
  @Input() tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' = 'neutral';
}

