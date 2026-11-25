import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { BudgetStateService } from './core/services/budget-state.service';
import { ThemeService } from './core/services/theme.service';
import { ToastContainerComponent } from './shared/components/toast-container.component';
import { ConflictModalComponent } from './shared/components/conflict-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToastContainerComponent,
    ConflictModalComponent,
  ],
  template: `
    @if (showShell()) {
      <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <!-- Sidebar Desktop -->
        <aside
          class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex"
        >
          <!-- Logo + Projet actif -->
          <div class="border-b border-slate-100 p-5 dark:border-slate-800">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
              </div>
              <span class="text-base font-bold tracking-tight">BudgetPilot</span>
            </div>

            <button
              type="button"
              (click)="switchProject()"
              class="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800/70"
            >
              <div class="min-w-0">
                <span class="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Projet Drive
                </span>
                <span class="block truncate font-semibold text-slate-900 dark:text-white">
                  {{ state.activeProject()?.name }}
                </span>
              </div>
              <span class="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                Changer
              </span>
            </button>
          </div>

          <!-- Navigation -->
          <nav class="flex-1 space-y-1 p-3">
            <a
              routerLink="/dashboard"
              routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z"
                />
              </svg>
              Tableau de bord
            </a>

            <a
              routerLink="/pareto"
              routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
              class="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <span class="flex items-center gap-3">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
                À catégoriser
              </span>
              @if (state.uncategorizedCount() > 0) {
                <span
                  class="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white"
                >
                  {{ state.uncategorizedCount() }}
                </span>
              }
            </a>

            <a
              routerLink="/transactions"
              routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              Transactions
            </a>

            <a
              routerLink="/import"
              routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              Import CSV
            </a>

            <a
              routerLink="/rules"
              routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
                />
              </svg>
              Règles & Catégories
            </a>
          </nav>

          <!-- Pied de sidebar -->
          <div class="space-y-2 border-t border-slate-100 p-3 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="state.reloadCurrentProject()"
                [disabled]="state.isLoadingProject() || state.isSaving()"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <svg
                  class="h-3.5 w-3.5"
                  [class.animate-spin]="state.isLoadingProject() || state.isSaving()"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                {{ state.isSaving() ? 'Synchro…' : 'Synchroniser' }}
              </button>

              <button
                type="button"
                (click)="theme.toggle()"
                class="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                [title]="theme.isDark() ? 'Mode clair' : 'Mode sombre'"
              >
                @if (theme.isDark()) {
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                    />
                  </svg>
                } @else {
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                    />
                  </svg>
                }
              </button>
            </div>

            <button
              type="button"
              (click)="logout()"
              class="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              Déconnexion Google
            </button>
          </div>
        </aside>

        <!-- Barre supérieure Mobile (PWA) -->
        <header
          class="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 lg:hidden"
        >
          <button type="button" (click)="switchProject()" class="flex min-w-0 items-center gap-2">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <div class="min-w-0 text-left">
              <p class="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
                {{ state.activeProject()?.name }}
              </p>
              <p class="text-[10px] text-indigo-600 dark:text-indigo-400">Changer de projet</p>
            </div>
          </button>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              (click)="state.reloadCurrentProject()"
              [disabled]="state.isLoadingProject() || state.isSaving()"
              class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Synchroniser Google Drive"
            >
              <svg
                class="h-5 w-5"
                [class.animate-spin]="state.isLoadingProject() || state.isSaving()"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
            <button
              type="button"
              (click)="theme.toggle()"
              class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Changer de thème"
            >
              @if (theme.isDark()) {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                </svg>
              } @else {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                  />
                </svg>
              }
            </button>
          </div>
        </header>

        <!-- Zone principale -->
        <main class="pb-24 lg:pb-10 lg:pl-64">
          <div class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <router-outlet />
          </div>
        </main>

        <!-- Bottom Navigation Mobile (PWA) -->
        <nav
          class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
        >
          <a
            routerLink="/dashboard"
            routerLinkActive="text-indigo-600 dark:text-indigo-400"
            class="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
            Budget
          </a>

          <a
            routerLink="/pareto"
            routerLinkActive="text-indigo-600 dark:text-indigo-400"
            class="relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            Pareto
            @if (state.uncategorizedCount() > 0) {
              <span
                class="absolute right-3 top-1.5 rounded-full bg-amber-500 px-1.5 text-[9px] font-bold text-white"
              >
                {{ state.uncategorizedCount() }}
              </span>
            }
          </a>

          <a
            routerLink="/transactions"
            routerLinkActive="text-indigo-600 dark:text-indigo-400"
            class="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12" />
            </svg>
            Opérations
          </a>

          <a
            routerLink="/import"
            routerLinkActive="text-indigo-600 dark:text-indigo-400"
            class="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            Import
          </a>

          <a
            routerLink="/rules"
            routerLinkActive="text-indigo-600 dark:text-indigo-400"
            class="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75"
              />
            </svg>
            Règles
          </a>
        </nav>
      </div>
    } @else {
      <router-outlet />
    }

    <app-conflict-modal />
    <app-toast-container />
  `,
})
export class App {
  readonly auth = inject(AuthService);
  readonly state = inject(BudgetStateService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly showShell = computed(
    () => this.auth.isAuthenticated() && this.state.activeProject() !== null,
  );

  async switchProject(): Promise<void> {
    this.state.closeProject();
    await this.router.navigate(['/']);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.state.resetAll();
    await this.router.navigate(['/']);
  }
}
