import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BudgetStateService } from '../../core/services/budget-state.service';
import { ThemeService } from '../../core/services/theme.service';
import { DriveProject } from '../../models';

@Component({
  selector: 'app-auth-projects',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
      <!-- Top utility bar -->
      <header class="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          </div>
          <div>
            <span class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              BudgetPilot
            </span>
            <span
              class="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              BYOS Drive
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="theme.toggle()"
            class="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            [title]="theme.isDark() ? 'Passer en mode clair' : 'Passer en mode sombre'"
          >
            @if (theme.isDark()) {
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            } @else {
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            }
          </button>

          @if (auth.isAuthenticated()) {
            <button
              type="button"
              (click)="onLogout()"
              class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Déconnexion
            </button>
          }
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        @if (auth.isInitializing()) {
          <div class="flex flex-col items-center justify-center py-24 text-center">
            <div
              class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-indigo-950 dark:border-t-indigo-400"
            ></div>
            <p class="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              Vérification de votre session Google Drive…
            </p>
          </div>
        } @else if (!auth.isAuthenticated()) {
          <!-- Écran de Connexion -->
          <div class="mx-auto max-w-2xl">
            <div
              class="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-10"
            >
              <div
                class="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/70 dark:text-indigo-300"
              >
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                Architecture Zero-Database · Données 100 % sur votre Google Drive
              </div>

              <h1
                class="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl"
              >
                Pilotez votre budget sans jamais céder vos données bancaires.
              </h1>

              <p class="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Importez vos exports CSV <strong>BNP Paribas Fortis</strong>, catégorisez 80 % de
                vos dépenses en quelques clics grâce au moteur Pareto, et visualisez vos graphiques
                sur PC comme sur smartphone.
              </p>

              @if (auth.authError(); as err) {
                <div
                  class="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-200"
                >
                  <p class="font-semibold">Connexion impossible</p>
                  <p class="mt-1">{{ err }}</p>
                </div>
              }

              <div class="mt-8">
                <button
                  type="button"
                  (click)="onLogin()"
                  [disabled]="auth.isLoggingIn()"
                  class="flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  @if (auth.isLoggingIn()) {
                    <span
                      class="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    ></span>
                    Connexion en cours…
                  } @else {
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.24-.92 2.29-1.96 2.99v2.48h3.17c1.86-1.71 2.93-4.23 2.93-7.21 0-.42-.04-.84-.23-1.24z"
                        fill="#fff"
                      />
                      <path
                        d="M12.17 22c2.65 0 4.88-.88 6.51-2.38l-3.17-2.48c-.88.59-2 .94-3.34.94-2.57 0-4.74-1.73-5.52-4.06H3.38v2.56C5 19.8 8.33 22 12.17 22z"
                        fill="#fff"
                        opacity=".9"
                      />
                      <path
                        d="M6.65 14.02A5.86 5.86 0 016.34 12c0-.7.12-1.38.31-2.02V7.42H3.38A9.96 9.96 0 002.17 12c0 1.61.39 3.14 1.21 4.58l3.27-2.56z"
                        fill="#fff"
                        opacity=".8"
                      />
                      <path
                        d="M12.17 5.92c1.44 0 2.74.5 3.76 1.47l2.82-2.82C17.04 2.98 14.82 2 12.17 2 8.33 2 5 4.2 3.38 7.42l3.27 2.56c.78-2.33 2.95-4.06 5.52-4.06z"
                        fill="#fff"
                        opacity=".95"
                      />
                    </svg>
                    Se connecter avec Google
                  }
                </button>
              </div>

              <div class="mt-8 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 dark:border-slate-800 sm:grid-cols-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Scope restreint
                  </p>
                  <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Accès limité à <code class="font-mono">drive.file</code> : seuls les fichiers
                    créés par BudgetPilot sont visibles.
                  </p>
                </div>
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Déduplication SHA-256
                  </p>
                  <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Import incrémental sûr des exports Fortis avec archivage automatique des CSV
                    bruts.
                  </p>
                </div>
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Session persistante
                  </p>
                  <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Refresh token sécurisé en cookie HttpOnly : pas de déconnexion toutes les heures.
                  </p>
                </div>
              </div>
            </div>
          </div>
        } @else {
          <!-- Écran Sélection / Création de Projet -->
          <div class="space-y-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Google Drive · Budget_App_Projets/
                </p>
                <h1 class="mt-1 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                  Vos projets budgétaires
                </h1>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Sélectionnez un projet existant ou créez-en un nouveau dans votre Drive personnel.
                </p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="refreshProjects()"
                  [disabled]="state.isLoadingProjects()"
                  class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <svg
                    class="h-4 w-4"
                    [class.animate-spin]="state.isLoadingProjects()"
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
                  Actualiser
                </button>
                <button
                  type="button"
                  (click)="showCreateForm.set(!showCreateForm())"
                  class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Créer un nouveau projet
                </button>
              </div>
            </div>

            <!-- Formulaire création projet -->
            @if (showCreateForm()) {
              <form
                (ngSubmit)="onCreateProject()"
                class="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm dark:border-indigo-900/60 dark:bg-slate-900"
              >
                <h2 class="text-base font-semibold text-slate-900 dark:text-white">
                  Nouveau projet Google Drive
                </h2>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Créera automatiquement le dossier,
                  <code class="font-mono">regles.json</code> (avec catégories par défaut),
                  <code class="font-mono">transactions.json</code> et
                  <code class="font-mono">exports_bruts/</code>.
                </p>
                <div class="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    name="projectName"
                    [(ngModel)]="newProjectName"
                    placeholder="Ex : Budget_2026 ou Compte_Commun"
                    required
                    class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <div class="flex gap-2">
                    <button
                      type="submit"
                      [disabled]="state.isLoadingProject() || !newProjectName.trim()"
                      class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      @if (state.isLoadingProject()) {
                        Création…
                      } @else {
                        Créer et ouvrir
                      }
                    </button>
                    <button
                      type="button"
                      (click)="showCreateForm.set(false)"
                      class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </form>
            }

            <!-- Liste des projets -->
            @if (state.isLoadingProjects() || state.isLoadingProject()) {
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                @for (n of [1, 2, 3]; track n) {
                  <div
                    class="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  ></div>
                }
              </div>
            } @else if (state.projects().length === 0) {
              <div
                class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"
              >
                <div
                  class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                >
                  <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                    />
                  </svg>
                </div>
                <h2 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                  Aucun projet trouvé dans votre Drive
                </h2>
                <p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
                  Créez votre premier projet (par exemple <strong>Budget_2026</strong>) pour
                  commencer à importer vos relevés BNP Paribas Fortis.
                </p>
                <button
                  type="button"
                  (click)="showCreateForm.set(true)"
                  class="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Créer mon premier projet
                </button>
              </div>
            } @else {
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                @for (project of state.projects(); track project.id) {
                  <button
                    type="button"
                    (click)="onSelectProject(project)"
                    class="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div
                        class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950 dark:text-indigo-400"
                      >
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                          />
                        </svg>
                      </div>
                      <svg
                        class="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>

                    <div class="mt-4">
                      <h3 class="truncate text-base font-semibold text-slate-900 dark:text-white">
                        {{ project.name }}
                      </h3>
                      @if (project.modifiedTime) {
                        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Modifié le {{ project.modifiedTime | date: 'dd/MM/yyyy à HH:mm' }}
                        </p>
                      }
                    </div>
                  </button>
                }
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
})
export class AuthProjectsComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly state = inject(BudgetStateService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly showCreateForm = signal(false);
  newProjectName = `Budget_${new Date().getFullYear()}`;

  async ngOnInit(): Promise<void> {
    if (this.auth.isInitializing()) {
      await this.auth.initializeSession();
    }

    if (this.auth.isAuthenticated()) {
      await this.refreshProjects();
    }
  }

  async onLogin(): Promise<void> {
    const ok = await this.auth.loginWithGoogle();
    if (ok) {
      await this.refreshProjects();
    }
  }

  async refreshProjects(): Promise<void> {
    try {
      await this.state.loadProjects();
    } catch {
      // Déjà géré par toast/syncError
    }
  }

  async onCreateProject(): Promise<void> {
    const name = this.newProjectName.trim();
    if (!name) return;
    try {
      await this.state.createAndOpenProject(name);
      this.showCreateForm.set(false);
      await this.router.navigate(['/dashboard']);
    } catch {
      // Déjà géré par toast
    }
  }

  async onSelectProject(project: DriveProject): Promise<void> {
    try {
      await this.state.selectProject(project);
      await this.router.navigate(['/dashboard']);
    } catch {
      // Déjà géré par toast
    }
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
    this.state.resetAll();
  }
}
