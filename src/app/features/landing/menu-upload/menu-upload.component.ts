import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ExcelParserService, ParsedMenuResult, ParsedMenuRow } from '../../../core/services/excel-parser.service';
import { FileDropZoneComponent } from '../../../shared/components/file-drop-zone/file-drop-zone.component';

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [CommonModule, FileDropZoneComponent],
  templateUrl: './menu-upload.component.html',
  styleUrl: './menu-upload.component.scss'
})
export class MenuUploadComponent {
  @Output() itemsUploaded = new EventEmitter<ParsedMenuResult>();
  @Output() demoRequested = new EventEmitter<void>();
  @Input() remainingSlots = 20;

  readonly state = signal<'idle' | 'preview' | 'idr-confirm'>('idle');
  readonly parsedResult = signal<ParsedMenuResult | null>(null);
  readonly sizeError = signal('');
  readonly isLoading = signal(false);

  readonly idrRows = computed<ParsedMenuRow[]>(() => {
    const result = this.parsedResult();
    if (!result) return [];
    return result.rows.filter((r) => this.isIdrFormatted(r.priceRaw));
  });

  readonly blockingRows = computed<ParsedMenuRow[]>(() => {
    const result = this.parsedResult();
    if (!result) return [];
    return result.rows.filter((r) => r.errors.length > 0);
  });

  readonly validRowCount = computed<number>(() => {
    const result = this.parsedResult();
    if (!result) return 0;
    return result.rows.filter((r) => r.errors.length === 0).length;
  });

  readonly exceedsCap = computed<boolean>(() => {
    const result = this.parsedResult();
    if (!result) return false;
    return this.validRowCount() > this.remainingSlots;
  });

  readonly canConfirm = computed<boolean>(() => {
    const s = this.state();
    return (s === 'preview' || s === 'idr-confirm') && this.blockingRows().length === 0 && !this.exceedsCap();
  });

  constructor(
    private readonly excelParser: ExcelParserService
  ) {}

  onFileSizeError(msg: string): void {
    this.sizeError.set(msg);
  }

  async onFileSelected(file: File): Promise<void> {
    this.sizeError.set('');
    this.isLoading.set(true);
    try {
      const result = await this.excelParser.parseMenuFile(file);
      this.parsedResult.set(result);
      const hasIdr = result.rows.some((r) => this.isIdrFormatted(r.priceRaw));
      this.state.set(hasIdr ? 'idr-confirm' : 'preview');
    } catch {
      this.sizeError.set('Could not parse the file. Make sure it is a valid .xlsx or .xls file.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onConfirm(): void {
    const result = this.parsedResult();
    if (!result) return;
    this.itemsUploaded.emit(result);
    this.onReset();
  }

  onReset(): void {
    this.state.set('idle');
    this.parsedResult.set(null);
    this.sizeError.set('');
    this.isLoading.set(false);
  }

  rowIssues(row: ParsedMenuRow): string {
    return row.errors.map((e) => {
      switch (e) {
        case 'empty_name': return 'Menu name is required';
        case 'empty_price': return 'Price is required';
        case 'invalid_price': return `Invalid price: '${row.priceRaw}'`;
        default: return e;
      }
    }).join(', ');
  }

  private isIdrFormatted(priceRaw: string): boolean {
    // Matches "Rp 25.000" style OR bare thousands-dot "25.000" (no decimal part)
    return /Rp/i.test(priceRaw) || /^\d{1,3}(\.\d{3})+$/.test(priceRaw.trim());
  }
}
