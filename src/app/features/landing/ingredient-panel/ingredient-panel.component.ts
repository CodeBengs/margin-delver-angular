import { Component, Input } from '@angular/core';

import { MenuItem } from '../../../core/models/menu-item.model';
import { IdrCurrencyPipe } from '../../../shared/pipes/idr-currency.pipe';

@Component({
  selector: 'app-ingredient-panel',
  standalone: true,
  imports: [IdrCurrencyPipe],
  templateUrl: './ingredient-panel.component.html',
  styleUrl: './ingredient-panel.component.scss'
})
export class IngredientPanelComponent {
  @Input() item: MenuItem | null = null;
}

