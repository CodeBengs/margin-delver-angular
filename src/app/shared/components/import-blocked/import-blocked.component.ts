import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ImportBlockedCategory {
  label: string;
  count: number;
}

@Component({
  selector: 'app-import-blocked',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-blocked.component.html',
  styleUrl: './import-blocked.component.scss'
})
export class ImportBlockedComponent {
  @Input() fileName = '';
  @Input() errorCount = 0;
  @Input() rowsAffected = 0;
  @Input() totalRows = 0;
  @Input() rowsNoun = 'rows';            // 'rows' (menu) | 'day rows' (sales)
  @Input() previewTitle = '';            // 'Preview · Menu' | 'Preview · Sales'
  @Input() categories: ImportBlockedCategory[] = [];
  @Input() highlightedCount = 0;

  @Output() cancel = new EventEmitter<void>();
  @Output() reupload = new EventEmitter<void>();
}
