import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BudgetStateService } from '../../core/services/budget-state.service';
import { Transaction, UNCATEGORIZED_ID } from '../../models';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CurrencyPipe, FormsModule],
  template: `
    <div class="space-y-5">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Transactions</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ filteredTransactions().length }} résultat(s) sur {{ state.transactions().length }}
            opération(s)
          </p>
        </div>

        <div class="flex flex-wrap gap-3 text-xs font-semibold tabular-nums">
          <span class="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            +{{ summary().inflows | currency: 'EUR' : 'symbol' : '1.2-2' }}
          </span>
          <span class="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            -{{ summary().outflows | currency: 'EUR' : 'symbol' : '1.2-2' }}
          </span>
          <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            Net : {{ summary().net | currency: 'EUR' : 'symbol' : '1.2-2' }}
          </span>
        </div>
      </div>

      <!-- Barre de filtres -->
      <div
        class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div class="sm:col-span-2">
          <label class="mb-1 block text-[11px] font-medium text-slate-500">Recherche texte</label>
          <input
            type="search"
            [ngModel]="searchText()"
            (ngModelChange)="searchText.set($event); pageSize.set(50)"
            placeholder="Commerçant, libellé, IBAN, séquence…"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div>
          <label class="mb-1 block text-[11px] font-medium text-slate-500">Catégorie</label>
          <select
            [ngModel]="selectedCategory()"
            (ngModelChange)="selectedCategory.set($event); pageSize.set(50)"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="all">Toutes les catégories</option>
            <option [value]="UNCATEGORIZED_ID">Non catégorisées</option>
            @for (cat of state.rules().categories; track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </div>

        <div>
          <label class="mb-1 block text-[11px] font-medium text-slate-500">Montant min (€)</label>
          <input
            type="number"
            step="0.01"
            [ngModel]="minAmount()"
            (ngModelChange)="minAmount.set($event)"
            placeholder="Ex : -500"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div>
          <label class="mb-1 block text-[11px] font-medium text-slate-500">Montant max (€)</label>
          <input
            type="number"
            step="0.01"
            [ngModel]="maxAmount()"
            (ngModelChange)="maxAmount.set($event)"
            placeholder="Ex : 0"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div class="flex flex-col justify-end gap-1.5">
          <label class="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              [ngModel]="onlyUncategorized()"
              (ngModelChange)="onlyUncategorized.set($event); pageSize.set(50)"
              class="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            Non catégorisées uniquement
          </label>
          <button
            type="button"
            (click)="resetFilters()"
            class="text-left text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      <!-- Liste des transactions -->
      @if (filteredTransactions().length === 0) {
        <div
          class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          Aucune transaction ne correspond à vos filtres.
        </div>
      } @else {
        <div
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (tx of visibleTransactions(); track tx.id) {
              <div class="p-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <!-- Infos principales -->
                  <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {{ tx.date }}
                      </span>
                      <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {{ tx.merchantName || tx.counterpartyName }}
                      </span>
                      @if (tx.manualOverride) {
                        <span
                          class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        >
                          Forcé manuellement
                        </span>
                      }
                    </div>

                    <p class="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {{ tx.details }}
                    </p>

                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      @if (tx.counterpartyIban) {
                        <span class="font-mono">IBAN : {{ tx.counterpartyIban }}</span>
                      }
                      @if (tx.sequenceNumber) {
                        <span class="font-mono">Séq. {{ tx.sequenceNumber }}</span>
                      }
                    </div>
                  </div>

                  <!-- Catégorie & Montant -->
                  <div class="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <div class="flex items-center gap-2">
                      <select
                        [ngModel]="tx.categoryId || UNCATEGORIZED_ID"
                        (ngModelChange)="onCategoryOverride(tx, $event)"
                        [disabled]="state.isSaving()"
                        aria-label="Forcer la catégorie"
                        class="max-w-[190px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        [style.border-left-width.px]="4"
                        [style.border-left-color]="categoryColor(tx.categoryId)"
                      >
                        <option [value]="UNCATEGORIZED_ID">Non catégorisé (auto)</option>
                        @for (cat of state.rules().categories; track cat.id) {
                          <option [value]="cat.id">{{ cat.name }}</option>
                        }
                      </select>

                      @if (tx.manualOverride) {
                        <button
                          type="button"
                          (click)="resetManualOverride(tx)"
                          [disabled]="state.isSaving()"
                          title="Réappliquer les règles automatiques"
                          class="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Auto
                        </button>
                      }
                    </div>

                    <p
                      class="min-w-[96px] text-right text-sm font-bold tabular-nums"
                      [class]="
                        tx.amount >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      "
                    >
                      {{ tx.amount | currency: tx.currency : 'symbol' : '1.2-2' }}
                    </p>
                  </div>
                </div>
              </div>
            }
          </div>

          @if (filteredTransactions().length > pageSize()) {
            <div class="border-t border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/50">
              <button
                type="button"
                (click)="showMore()"
                class="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-indigo-600 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-indigo-400 dark:ring-slate-700"
              >
                Afficher plus ({{ filteredTransactions().length - pageSize() }} restantes)
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TransactionsComponent implements OnInit {
  readonly state = inject(BudgetStateService);
  private readonly route = inject(ActivatedRoute);
  readonly UNCATEGORIZED_ID = UNCATEGORIZED_ID;

  readonly searchText = signal('');
  readonly selectedCategory = signal<string>('all');
  readonly onlyUncategorized = signal<boolean>(false);
  readonly minAmount = signal<string | number | null>(null);
  readonly maxAmount = signal<string | number | null>(null);
  readonly pageSize = signal<number>(50);

  ngOnInit(): void {
    const categoryParam = this.route.snapshot.queryParamMap.get('category');
    if (categoryParam) {
      this.selectedCategory.set(categoryParam);
    }
  }

  readonly filteredTransactions = computed<Transaction[]>(() => {
    const query = this.searchText().trim().toLowerCase();
    const cat = this.selectedCategory();
    const onlyUncat = this.onlyUncategorized();
    const min = this.parseOptionalNumber(this.minAmount());
    const max = this.parseOptionalNumber(this.maxAmount());
    const validIds = new Set(this.state.rules().categories.map((c) => c.id));

    return this.state.transactions().filter((tx) => {
      const effectiveCat =
        tx.categoryId && validIds.has(tx.categoryId) ? tx.categoryId : UNCATEGORIZED_ID;

      if (onlyUncat && effectiveCat !== UNCATEGORIZED_ID) {
        return false;
      }

      if (cat !== 'all' && effectiveCat !== cat) {
        return false;
      }

      if (min !== null && tx.amount < min) return false;
      if (max !== null && tx.amount > max) return false;

      if (query) {
        const hay = [
          tx.merchantName ?? '',
          tx.counterpartyName ?? '',
          tx.details ?? '',
          tx.counterpartyIban ?? '',
          tx.sequenceNumber ?? '',
          tx.date,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }

      return true;
    });
  });

  readonly visibleTransactions = computed(() =>
    this.filteredTransactions().slice(0, this.pageSize()),
  );

  readonly summary = computed(() => {
    let inflows = 0;
    let outflows = 0;
    for (const tx of this.filteredTransactions()) {
      if (tx.amount >= 0) inflows += tx.amount;
      else outflows += Math.abs(tx.amount);
    }
    return { inflows, outflows, net: inflows - outflows };
  });

  categoryColor(categoryId?: string): string {
    if (!categoryId || categoryId === UNCATEGORIZED_ID) return '#f59e0b';
    return this.state.categoryMap().get(categoryId)?.color ?? '#94a3b8';
  }

  async onCategoryOverride(tx: Transaction, categoryId: string): Promise<void> {
    if (categoryId === UNCATEGORIZED_ID) {
      await this.state.setManualCategoryOverride(tx.id, null);
    } else {
      await this.state.setManualCategoryOverride(tx.id, categoryId);
    }
  }

  async resetManualOverride(tx: Transaction): Promise<void> {
    await this.state.setManualCategoryOverride(tx.id, null);
  }

  showMore(): void {
    this.pageSize.update((n) => n + 50);
  }

  resetFilters(): void {
    this.searchText.set('');
    this.selectedCategory.set('all');
    this.onlyUncategorized.set(false);
    this.minAmount.set(null);
    this.maxAmount.set(null);
    this.pageSize.set(50);
  }

  private parseOptionalNumber(val: string | number | null): number | null {
    if (val === null || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
}
