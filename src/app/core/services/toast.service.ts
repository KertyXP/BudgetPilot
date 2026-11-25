import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(type: ToastType, title: string, description?: string, durationMs = 4500): void {
    const id = this.nextId++;
    this._toasts.update((list) => [...list, { id, type, title, description }]);
    if (durationMs > 0) {
      window.setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  success(title: string, description?: string): void {
    this.show('success', title, description);
  }

  error(title: string, description?: string): void {
    this.show('error', title, description, 6500);
  }

  warning(title: string, description?: string): void {
    this.show('warning', title, description, 6000);
  }

  info(title: string, description?: string): void {
    this.show('info', title, description);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
