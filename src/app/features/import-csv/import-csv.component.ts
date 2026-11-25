import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BudgetStateService } from '../../core/services/budget-state.service';
import { CategorizationEngineService } from '../../core/services/categorization-engine.service';
import { CsvImportService, ParsedCsvFileResult } from '../../core/services/csv-import.service';
import { GoogleDriveService } from '../../core/drive/google-drive.service';
import { ToastService } from '../../core/services/toast.service';
import { DriveFileMetadata, Transaction, UNCATEGORIZED_ID } from '../../models';

@Component({
  selector: 'app-import-csv',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Import CSV BNP Paribas Fortis</h1>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Déposez un ou plusieurs exports CSV (séparateur <code class="font-mono">;</code>, UTF-8 ou
          ISO-8859-1). Les doublons sont automatiquement détectés et ignorés, puis chaque fichier
          brut est archivé dans <code class="font-mono">exports_bruts/</code>.
        </p>
      </div>

      <!-- Zone Drag & Drop -->
      <div
        (dragover)="onDragOver($event)"
        (dragleave)="isDragging.set(false)"
        (drop)="onDrop($event)"
        class="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12"
        [class]="
          isDragging()
            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
            : 'border-slate-300 bg-white hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900'
        "
      >
        <div
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
        >
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>

        <h2 class="mt-4 text-base font-semibold text-slate-900 dark:text-white">
          Glissez-déposez vos fichiers CSV ici
        </h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Formats supportés : exports BNP Paribas Fortis Belgique (FR / NL / EN)
        </p>

        <label
          class="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Choisir des fichiers CSV
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            (change)="onFileInputChange($event)"
            class="hidden"
          />
        </label>
      </div>

      <!-- Résultat après validation -->
      @if (lastImportSummary(); as summary) {
        <div
          class="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-800/60 dark:bg-emerald-950/40 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Import synchronisé sur Google Drive
            </p>
            <p class="mt-0.5 text-sm text-emerald-800 dark:text-emerald-300">
              <strong>{{ summary.imported }}</strong> nouvelle(s) transaction(s) importée(s),
              <strong>{{ summary.duplicates }}</strong> doublon(s) ignoré(s).
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a
              routerLink="/pareto"
              class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Catégoriser ({{ state.uncategorizedCount() }})
            </a>
            <a
              routerLink="/dashboard"
              class="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200"
            >
              Voir le tableau de bord
            </a>
          </div>
        </div>
      }

      <!-- Prévisualisation avant validation -->
      @if (parsedResults().length > 0) {
        <div
          class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                Prévisualisation avant import
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ parsedResults().length }} fichier(s) analysé(s) ·
                <strong class="text-emerald-600 dark:text-emerald-400">
                  {{ totalNewTransactions().length }} nouvelle(s)
                </strong>
                ·
                <strong class="text-amber-600 dark:text-amber-400">
                  {{ totalDuplicates() }} doublon(s) ignoré(s)
                </strong>
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                (click)="clearPreview()"
                class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                (click)="confirmImport()"
                [disabled]="state.isSaving() || totalNewTransactions().length === 0"
                class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                @if (state.isSaving()) {
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                  Sauvegarde sur Drive…
                } @else {
                  Importer {{ totalNewTransactions().length }} transaction(s)
                }
              </button>
            </div>
          </div>

          <!-- Détail par fichier -->
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            @for (res of parsedResults(); track res.fileName) {
              <div class="rounded-xl border border-slate-200 p-3.5 text-xs dark:border-slate-800">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-semibold text-slate-900 dark:text-white">
                    {{ res.fileName }}
                  </span>
                  <span
                    class="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {{ res.detectedEncoding }}
                  </span>
                </div>
                <div class="mt-2 flex flex-wrap gap-3 text-slate-600 dark:text-slate-400">
                  <span>Lues : {{ res.parsedTransactions.length }}</span>
                  <span class="font-medium text-emerald-600 dark:text-emerald-400">
                    Nouvelles : {{ res.newTransactions.length }}
                  </span>
                  <span class="font-medium text-amber-600 dark:text-amber-400">
                    Doublons : {{ res.duplicateCount }}
                  </span>
                </div>
                @if (res.warnings.length > 0) {
                  <ul class="mt-2 space-y-0.5 text-amber-700 dark:text-amber-300">
                    @for (w of res.warnings; track w) {
                      <li>• {{ w }}</li>
                    }
                  </ul>
                }
              </div>
            }
          </div>

          <!-- Table d'aperçu des nouvelles transactions -->
          @if (previewTransactions().length > 0) {
            <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table class="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th class="px-3 py-2.5 font-semibold">Date</th>
                    <th class="px-3 py-2.5 font-semibold">Contrepartie / Commerçant</th>
                    <th class="px-3 py-2.5 font-semibold">Catégorie prévue</th>
                    <th class="px-3 py-2.5 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/70">
                  @for (tx of previewTransactions().slice(0, 40); track tx.id) {
                    <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td class="whitespace-nowrap px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                        {{ tx.date }}
                      </td>
                      <td class="max-w-xs px-3 py-2">
                        <p class="truncate font-medium text-slate-900 dark:text-white">
                          {{ tx.merchantName || tx.counterpartyName }}
                        </p>
                        <p class="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {{ tx.details }}
                        </p>
                      </td>
                      <td class="whitespace-nowrap px-3 py-2">
                        @if (categoryOf(tx.categoryId); as cat) {
                          <span
                            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                            [style.background-color]="cat.color + '1a'"
                            [style.color]="cat.color"
                          >
                            <span
                              class="h-1.5 w-1.5 rounded-full"
                              [style.background-color]="cat.color"
                            ></span>
                            {{ cat.name }}
                          </span>
                        } @else {
                          <span
                            class="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          >
                            Non catégorisé
                          </span>
                        }
                      </td>
                      <td
                        class="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums"
                        [class]="
                          tx.amount >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-white'
                        "
                      >
                        {{ tx.amount | currency: tx.currency : 'symbol' : '1.2-2' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (previewTransactions().length > 40) {
                <div class="bg-slate-50 px-3 py-2 text-center text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  Affichage limité aux 40 premières nouvelles transactions sur
                  {{ previewTransactions().length }}.
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Historique des archives exports_bruts/ -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">
              Archives CSV dans <code class="font-mono text-xs">exports_bruts/</code>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Fichiers bruts conservés sur votre Google Drive
            </p>
          </div>
          <button
            type="button"
            (click)="loadRawArchives()"
            class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Actualiser
          </button>
        </div>

        @if (isLoadingArchives()) {
          <p class="mt-4 text-xs text-slate-500">Chargement des archives…</p>
        } @else if (rawArchives().length === 0) {
          <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Aucun fichier CSV archivé pour le moment.
          </p>
        } @else {
          <ul class="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            @for (file of rawArchives(); track file.id) {
              <li class="flex items-center justify-between gap-4 py-2.5">
                <span class="truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                  {{ file.name }}
                </span>
                <span class="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {{ file.modifiedTime | date: 'dd/MM/yyyy HH:mm' }}
                </span>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class ImportCsvComponent implements OnInit {
  readonly state = inject(BudgetStateService);
  private readonly csvImport = inject(CsvImportService);
  private readonly engine = inject(CategorizationEngineService);
  private readonly drive = inject(GoogleDriveService);
  private readonly toast = inject(ToastService);

  readonly isDragging = signal(false);
  readonly parsedResults = signal<ParsedCsvFileResult[]>([]);
  readonly lastImportSummary = signal<{ imported: number; duplicates: number } | null>(null);
  readonly rawArchives = signal<DriveFileMetadata[]>([]);
  readonly isLoadingArchives = signal(false);

  readonly totalNewTransactions = computed<Transaction[]>(() => {
    const seen = new Set<string>();
    const list: Transaction[] = [];
    for (const res of this.parsedResults()) {
      for (const tx of res.newTransactions) {
        if (!seen.has(tx.id)) {
          seen.add(tx.id);
          list.push(tx);
        }
      }
    }
    return list;
  });

  readonly previewTransactions = computed<Transaction[]>(() =>
    this.engine.categorizeAll(this.totalNewTransactions(), this.state.rules()),
  );

  readonly totalDuplicates = computed(() => {
    const sumFileDuplicates = this.parsedResults().reduce((acc, r) => acc + r.duplicateCount, 0);
    const sumFileNew = this.parsedResults().reduce((acc, r) => acc + r.newTransactions.length, 0);
    const crossFileDuplicates = sumFileNew - this.totalNewTransactions().length;
    return sumFileDuplicates + Math.max(0, crossFileDuplicates);
  });

  async ngOnInit(): Promise<void> {
    await this.loadRawArchives();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await this.processFiles(Array.from(files));
    }
  }

  async onFileInputChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.processFiles(Array.from(input.files));
      input.value = '';
    }
  }

  private async processFiles(files: File[]): Promise<void> {
    this.lastImportSummary.set(null);
    const existingIds = new Set(this.state.transactions().map((t) => t.id));
    const results: ParsedCsvFileResult[] = [];

    for (const file of files) {
      try {
        const res = await this.csvImport.parseFortisCsvFile(file, existingIds);
        results.push(res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Erreur de lecture sur ${file.name}`;
        this.toast.error('Fichier CSV non reconnu', msg);
      }
    }

    if (results.length > 0) {
      this.parsedResults.set(results);
    }
  }

  async confirmImport(): Promise<void> {
    const newTxs = this.totalNewTransactions();
    const rawFiles = this.parsedResults().map((r) => ({
      fileName: r.fileName,
      rawText: r.rawText,
    }));

    const result = await this.state.commitImportedTransactions(
      newTxs,
      rawFiles,
      this.totalDuplicates(),
    );

    if (result) {
      this.lastImportSummary.set(result);
      this.parsedResults.set([]);
      await this.loadRawArchives();
    }
  }

  clearPreview(): void {
    this.parsedResults.set([]);
  }

  async loadRawArchives(): Promise<void> {
    const folderId = this.state.projectFiles()?.rawExportsFolderId;
    if (!folderId) return;
    this.isLoadingArchives.set(true);
    try {
      const files = await this.drive.listRawExports(folderId);
      this.rawArchives.set(files);
    } catch {
      // ignore non-critical archive list failure
    } finally {
      this.isLoadingArchives.set(false);
    }
  }

  categoryOf(categoryId?: string) {
    if (!categoryId || categoryId === UNCATEGORIZED_ID) return null;
    return this.state.categoryMap().get(categoryId) ?? null;
  }
}
