import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-file-drop-zone',
  standalone: true,
  templateUrl: './file-drop-zone.component.html',
  styleUrl: './file-drop-zone.component.scss'
})
export class FileDropZoneComponent {
  @Input() title = 'Upload file';
  @Input() description = 'Drag and drop file here, or click to browse.';
  @Input() accept = '.xlsx,.xls';
  @Output() fileSelected = new EventEmitter<File>();

  isDragging = false;

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
      this.fileSelected.emit(file);
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      this.fileSelected.emit(file);
    }
    input.value = '';
  }
}

