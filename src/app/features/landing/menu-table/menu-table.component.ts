import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MenuItem } from '../../../core/models/menu-item.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IdrCurrencyPipe } from '../../../shared/pipes/idr-currency.pipe';

@Component({
  selector: 'app-menu-table',
  standalone: true,
  imports: [StatusBadgeComponent, IdrCurrencyPipe],
  templateUrl: './menu-table.component.html',
  styleUrl: './menu-table.component.scss'
})
export class MenuTableComponent {
  @Input() items: MenuItem[] = [];
  @Output() itemSelected = new EventEmitter<MenuItem>();

  toneFor(status: MenuItem['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    const map: Record<MenuItem['status'], 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
      draft: 'neutral',
      estimating: 'info',
      ready: 'success',
      unrecognised: 'warning',
      incomplete: 'warning',
      failed: 'danger'
    };

    return map[status];
  }
}

