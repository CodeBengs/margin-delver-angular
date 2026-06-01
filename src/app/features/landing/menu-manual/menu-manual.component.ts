import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MenuItem } from '../../../core/models/menu-item.model';
import { MenuService } from '../../../core/services/menu.service';
import { SessionService } from '../../../core/services/session.service';

@Component({
  selector: 'app-menu-manual',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './menu-manual.component.html',
  styleUrl: './menu-manual.component.scss'
})
export class MenuManualComponent {
  @Output() itemAdded = new EventEmitter<MenuItem>();

  name = '';
  sellingPrice: number | null = null;
  readonly error = signal('');

  constructor(
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService
  ) {}

  addItem(): void {
    if (!this.name.trim() || !this.sellingPrice || this.sellingPrice <= 0) {
      this.error.set('Menu name and valid selling price are required.');
      return;
    }

    this.sessionService.ensureSession().subscribe((session) => {
      this.menuService
        .addMenuItem(session.session_key, {
          name: this.name.trim(),
          selling_price_idr: this.sellingPrice ?? 0
        })
        .subscribe({
          next: (item) => {
            this.itemAdded.emit(item);
            this.name = '';
            this.sellingPrice = null;
            this.error.set('');
          },
          error: (error) => this.error.set(error.message)
        });
    });
  }
}

