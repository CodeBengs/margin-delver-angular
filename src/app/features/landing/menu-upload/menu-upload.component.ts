import { Component, computed, ElementRef, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ExcelParserService, MenuErrorCategory, ParsedMenuResult } from '../../../core/services/excel-parser.service';
import { FileDropZoneComponent } from '../../../shared/components/file-drop-zone/file-drop-zone.component';
import { ImportBlockedComponent, ImportBlockedCategory } from '../../../shared/components/import-blocked/import-blocked.component';

const CATEGORY_LABELS: Record<MenuErrorCategory, string> = {
  missing_name: 'Missing menu name',
  missing_price: 'Missing selling price',
  invalid_price: 'Invalid selling price',
  duplicate_item: 'Duplicate menu item'
};
const CATEGORY_ORDER: MenuErrorCategory[] = ['missing_name', 'missing_price', 'invalid_price', 'duplicate_item'];

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [CommonModule, FileDropZoneComponent, ImportBlockedComponent],
  templateUrl: './menu-upload.component.html',
  styleUrl: './menu-upload.component.scss'
})
export class MenuUploadComponent {
  @Output() itemsUploaded = new EventEmitter<ParsedMenuResult>();
  @Output() demoRequested = new EventEmitter<void>();
  @Input() remainingSlots = 20;
  @Input() existingNames: string[] = [];

  readonly state = signal<'idle' | 'preview'>('idle');
  readonly parsedResult = signal<ParsedMenuResult | null>(null);
  readonly sizeError = signal('');
  readonly isLoading = signal(false);

  readonly hasErrors = computed(() => (this.parsedResult()?.errors.length ?? 0) > 0);

  readonly rowsAffected = computed(() => {
    const result = this.parsedResult();
    if (!result) return 0;
    return result.rows.filter((r) => r.nameError || r.priceError).length;
  });

  readonly categories = computed<ImportBlockedCategory[]>(() => {
    const result = this.parsedResult();
    if (!result) return [];
    const counts = new Map<MenuErrorCategory, number>();
    for (const err of result.errors) {
      counts.set(err.category, (counts.get(err.category) ?? 0) + 1);
    }
    return CATEGORY_ORDER
      .filter((cat) => (counts.get(cat) ?? 0) > 0)
      .map((cat) => ({ label: CATEGORY_LABELS[cat], count: counts.get(cat) ?? 0 }));
  });

  readonly highlightedCount = computed(() => this.parsedResult()?.errors.length ?? 0);

  readonly netNewCount = computed(() => {
    const r = this.parsedResult();
    if (!r) return 0;
    const seen = new Set(this.existingNames.map((n) => n.toLowerCase()));
    let count = 0;
    for (const row of r.rows) {
      if (row.nameError || row.priceError) continue;
      const key = row.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      count++;
    }
    return count;
  });

  readonly exceedsCap = computed(() => this.netNewCount() > this.remainingSlots);

  readonly canConfirm = computed<boolean>(() =>
    this.state() === 'preview' && !this.hasErrors() && !this.exceedsCap()
  );

  constructor(
    private readonly excelParser: ExcelParserService,
    private readonly el: ElementRef<HTMLElement>
  ) {}

  onFileSizeError(msg: string): void {
    this.sizeError.set(msg);
  }

  async onFileSelected(file: File): Promise<void> {
    this.sizeError.set('');
    this.isLoading.set(true);
    try {
      const result = await this.excelParser.parseMenuFile(file, this.existingNames);
      this.parsedResult.set(result);
      this.state.set('preview');
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
    requestAnimationFrame(() => {
      const rect = this.el.nativeElement.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 120), behavior: 'smooth' });
    });
  }

  onReupload(): void {
    // Reset to idle so the user can pick a corrected file. The drop zone reappears.
    this.onReset();
  }
}
