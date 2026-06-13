import { Injectable, signal, WritableSignal } from '@angular/core';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  route: string;
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

export interface ToastOptions {
  type?: ToastType;
  action?: ToastAction;
  /** Auto-dismiss delay in ms. Use 0 to keep the toast until dismissed manually. */
  duration?: number;
}

const DEFAULT_DURATION = 6000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts: WritableSignal<Toast[]> = signal([]);
  private seq = 0;

  show(message: string, opts: ToastOptions = {}): number {
    const id = ++this.seq;
    const toast: Toast = {
      id,
      message,
      type: opts.type ?? 'info',
      action: opts.action
    };
    this.toasts.update((list) => [...list, toast]);

    const duration = opts.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
