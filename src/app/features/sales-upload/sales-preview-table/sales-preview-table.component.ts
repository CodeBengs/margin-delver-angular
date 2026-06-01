import { Component, Input } from '@angular/core';

import { SalesUploadResult } from '../../../core/models/sales-data.model';

@Component({
  selector: 'app-sales-preview-table',
  standalone: true,
  templateUrl: './sales-preview-table.component.html',
  styleUrl: './sales-preview-table.component.scss'
})
export class SalesPreviewTableComponent {
  @Input() uploadResult: SalesUploadResult | null = null;
}

