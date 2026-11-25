import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BudgetStateService } from '../../core/services/budget-state.service';

@Component({
  selector: 'app-conflict-modal',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (state.conflict(); as conflict) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
      >
        <div
          class="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-800/60 dark:bg-slate-900"
        >
          <div class="flex items-start gap-3.5">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <h2 id="conflict-title" class="text-lg font-semibold text-slate-900 dark:text-white">
                Conflit de synchronisation Google Drive
              </h2>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Le fichier
                <code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium dark:bg-slate-800">
                  {{ conflict.fileType === 'rules' ? 'regles.json' : 'transactions.json' }}
                </code>
                a été modifié sur un autre appareil depuis votre dernier chargement.
              </p>
            </div>
          </div>

          <div
            class="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3.5 text-xs dark:bg-slate-800/70 sm:grid-cols-2"
          >
            <div>
              <span class="block text-slate-500 dark:text-slate-400">Version locale chargée</span>
              <span class="mt-0.5 block font-medium text-slate-800 dark:text-slate-200">
                {{ conflict.localModifiedTime | date: 'dd/MM/yyyy HH:mm:ss' }}
              </span>
            </div>
            <div>
              <span class="block text-slate-500 dark:text-slate-400">Dernière version Drive</span>
              <span class="mt-0.5 block font-medium text-amber-700 dark:text-amber-300">
                {{ conflict.remoteModifiedTime | date: 'dd/MM/yyyy HH:mm:ss' }}
              </span>
            </div>
          </div>

          <div class="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              (click)="state.dismissConflict()"
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="button"
              (click)="state.resolveConflictForceOverwrite()"
              class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60"
            >
              Écraser Drive
            </button>
            <button
              type="button"
              (click)="state.resolveConflictReload()"
              class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Recharger les données (recommandé)
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConflictModalComponent {
  readonly state = inject(BudgetStateService);
}
