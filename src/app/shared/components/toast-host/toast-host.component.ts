import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss'
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);
  readonly toasts = this.toastService.toasts;

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
