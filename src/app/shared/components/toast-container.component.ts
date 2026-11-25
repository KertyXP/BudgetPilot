import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div
      class="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:top-auto sm:w-96"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md transition-all"
          [class]="toastClasses(toast.type)"
          role="status"
        >
          <div class="mt-0.5 shrink-0">
            @switch (toast.type) {
              @case ('success') {
                <svg class="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clip-rule="evenodd"
                  />
                </svg>
              }
              @case ('error') {
                <svg class="h-5 w-5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd"
                  />
                </svg>
              }
              @case ('warning') {
                <svg class="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd"
                  />
                </svg>
              }
              @default {
                <svg class="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                    clip-rule="evenodd"
                  />
                </svg>
              }
            }
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ toast.title }}</p>
            @if (toast.description) {
              <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                {{ toast.description }}
              </p>
            }
          </div>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-slate-700/60 dark:hover:text-slate-200"
            aria-label="Fermer"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  toastClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'border-emerald-200 bg-white/95 dark:border-emerald-800/70 dark:bg-slate-900/95';
      case 'error':
        return 'border-rose-200 bg-white/95 dark:border-rose-800/70 dark:bg-slate-900/95';
      case 'warning':
        return 'border-amber-200 bg-white/95 dark:border-amber-800/70 dark:bg-slate-900/95';
      default:
        return 'border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95';
    }
  }
}
