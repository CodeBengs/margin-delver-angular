import { Component, computed, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ExcelExportService } from '../../../core/services/excel-export.service';
import { ExcelParserService, ParsedMenuResult, ParsedMenuRow } from '../../../core/services/excel-parser.service';
import { FileDropZoneComponent } from '../../../shared/components/file-drop-zone/file-drop-zone.component';

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [CommonModule, FileDropZoneComponent],
  templateUrl: './menu-upload.component.html'
})
export class MenuUploadComponent {
  @Output() itemsUploaded = new EventEmitter<ParsedMenuResult>();

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

  readonly canConfirm = computed<boolean>(() => {
    const s = this.state();
    return (s === 'preview' || s === 'idr-confirm') && this.blockingRows().length === 0;
  });

  constructor(
    private readonly excelParser: ExcelParserService,
    private readonly excelExport: ExcelExportService
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

  downloadTemplate(): void {
    this.excelExport.exportMenuTemplate();
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
    return /Rp|[.,]/.test(priceRaw);
  }
}
