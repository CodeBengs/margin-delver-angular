import { Component, ElementRef, EventEmitter, Input, Output, signal, ViewChild } from '@angular/core';

@Component({
  selector: 'app-file-drop-zone',
  standalone: true,
  templateUrl: './file-drop-zone.component.html',
  styleUrl: './file-drop-zone.component.scss'
})
export class FileDropZoneComponent {
  @Input() iconSrc = 'ds/icons/upload.svg';
  @Input() title = 'Upload file';
  @Input() description = 'Drag and drop file here, or click to browse.';
  @Input() accept = '.xlsx,.xls';
  @Input() maxSizeMb = 5;
  @Output() fileSelected = new EventEmitter<File>();
  @Output() fileSizeError = new EventEmitter<string>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isDragging = false;
  readonly sizeError = signal('');

  openPicker(): void {
    this.fileInput.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files.item(0);
    if (file) {
      this.handleFile(file);
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      this.handleFile(file);
    }
    input.value = '';
  }

  private handleFile(file: File): void {
    if (file.size > this.maxSizeMb * 1024 * 1024) {
      const message = `File size exceeds the ${this.maxSizeMb}MB limit. Please reduce the file size and try again.`;
      this.sizeError.set(message);
      this.fileSizeError.emit(message);
      return;
    }
    this.sizeError.set('');
    this.fileSelected.emit(file);
  }
}
