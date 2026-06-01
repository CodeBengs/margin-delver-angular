import { Component, EventEmitter, Output, signal } from '@angular/core';

import { MenuItem } from '../../../core/models/menu-item.model';
import { MenuService } from '../../../core/services/menu.service';
import { SessionService } from '../../../core/services/session.service';
import { FileDropZoneComponent } from '../../../shared/components/file-drop-zone/file-drop-zone.component';

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [FileDropZoneComponent],
  templateUrl: './menu-upload.component.html'
})
export class MenuUploadComponent {
  @Output() itemsUploaded = new EventEmitter<MenuItem[]>();
  readonly message = signal('');

  constructor(
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService
  ) {}

  upload(file: File): void {
    this.sessionService.ensureSession().subscribe((session) => {
      this.menuService.uploadMenu(session.session_key, file).subscribe({
        next: (result) => {
          this.itemsUploaded.emit(result.items);
          this.message.set(`${result.items_detected} menu items detected.`);
        },
        error: (error) => this.message.set(error.message)
      });
    });
  }
}

