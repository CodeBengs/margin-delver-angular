import { Component, Input } from '@angular/core';

export interface SortableTableColumn<T> {
  key: keyof T & string;
  label: string;
}

@Component({
  selector: 'app-sortable-table',
  standalone: true,
  templateUrl: './sortable-table.component.html',
  styleUrl: './sortable-table.component.scss'
})
export class SortableTableComponent<T extends Record<string, unknown>> {
  @Input() columns: SortableTableColumn<T>[] = [];
  @Input() rows: T[] = [];

  sortKey = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  get sortedRows(): T[] {
    if (!this.sortKey) {
      return this.rows;
    }

    return [...this.rows].sort((left, right) => {
      const leftValue = String(left[this.sortKey] ?? '');
      const rightValue = String(right[this.sortKey] ?? '');
      const result = leftValue.localeCompare(rightValue, 'id-ID', { numeric: true });
      return this.sortDirection === 'asc' ? result : -result;
    });
  }

  sortBy(key: string): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortKey = key;
    this.sortDirection = 'asc';
  }
}

