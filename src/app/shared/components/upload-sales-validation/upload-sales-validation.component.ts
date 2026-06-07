import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upload-sales-validation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-sales-validation.component.html',
  styleUrl: './upload-sales-validation.component.scss'
})
export class UploadSalesValidationComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() details: string[] = [];
  @Output() closed = new EventEmitter<void>();
}
