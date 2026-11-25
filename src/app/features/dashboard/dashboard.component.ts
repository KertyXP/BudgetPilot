import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { BudgetStateService } from '../../core/services/budget-state.service';
import { ThemeService } from '../../core/services/theme.service';
import { Transaction, UNCATEGORIZED_ID } from '../../models';

type PeriodMode = 'month' | 'quarter' | 'year' | 'all' | 'custom';

interface CategorySlice {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  count: number;
  sharePct: number;
}

interface TopMerchant {
  name: string;
  total: number;
  count: number;
  sharePct: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- En-tête + Filtres globaux -->
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {{ periodLabel() }} · {{ filteredTransactions().length }} opération(s)
          </p>
        </div>

        <!-- Barre de filtres -->
        <div
          class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <select
            [ngModel]="periodMode()"
            (ngModelChange)="periodMode.set($event)"
            aria-label="Type de période"
            class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="month">Mois précis</option>
            <option value="quarter">Trimestre</option>
            <option value="year">Année complète</option>
            <option value="all">Tout l’historique</option>
            <option value="custom">Plage personnalisée</option>
          </select>

          @switch (periodMode()) {
            @case ('month') {
              <input
                type="month"
                [ngModel]="selectedMonth()"
                (ngModelChange)="selectedMonth.set($event)"
                class="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            }
            @case ('quarter') {
              <select
                [ngModel]="selectedQuarter()"
                (ngModelChange)="selectedQuarter.set(+$event)"
                class="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option [value]="1">T1 (Jan–Mar)</option>
                <option [value]="2">T2 (Avr–Juin)</option>
                <option [value]="3">T3 (Juil–Sep)</option>
                <option [value]="4">T4 (Oct–Déc)</option>
              </select>
              <select
                [ngModel]="selectedYear()"
                (ngModelChange)="selectedYear.set(+$event)"
                class="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                @for (y of availableYears(); track y) {
                  <option [value]="y">{{ y }}</option>
                }
              </select>
            }
            @case ('year') {
              <select
                [ngModel]="selectedYear()"
                (ngModelChange)="selectedYear.set(+$event)"
                class="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                @for (y of availableYears(); track y) {
                  <option [value]="y">{{ y }}</option>
                }
              </select>
            }
            @case ('custom') {
              <input
                type="date"
                [ngModel]="customFrom()"
                (ngModelChange)="customFrom.set($event)"
                class="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <span class="text-xs text-slate-400">→</span>
              <input
                type="date"
                [ngModel]="customTo()"
                (ngModelChange)="customTo.set($event)"
                class="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            }
          }

          <label
            class="ml-1 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <input
              type="checkbox"
              [ngModel]="excludeInternalTransfers()"
              (ngModelChange)="excludeInternalTransfers.set($event)"
              class="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Exclure transferts internes
          </label>
        </div>
      </div>

      @if (state.transactions().length === 0) {
        <div
          class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            Aucune transaction dans ce projet
          </h2>
          <p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Importez votre premier export CSV BNP Paribas Fortis pour voir apparaître vos KPIs et
            graphiques budgétaires.
          </p>
          <a
            routerLink="/import"
            class="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Importer un fichier CSV
          </a>
        </div>
      } @else {
        <!-- Badge filtre catégorie actif (issu du clic sur le Donut) -->
        @if (selectedCategoryId(); as activeCatId) {
          <div
            class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 dark:border-indigo-900/70 dark:bg-indigo-950/50"
          >
            <div class="flex items-center gap-2 text-sm text-indigo-900 dark:text-indigo-200">
              <span>Filtre catégorie actif :</span>
              <span class="font-bold">{{ categoryLabel(activeCatId) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="openTransactionsForCategory(activeCatId)"
                class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Voir les transactions
              </button>
              <button
                type="button"
                (click)="selectedCategoryId.set(null)"
                class="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-200"
              >
                Effacer le filtre
              </button>
            </div>
          </div>
        }

        <!-- 5 Cartes KPI -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Revenus totaux</p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {{ kpis().income | currency: 'EUR' : 'symbol' : '1.2-2' }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Dépenses totales</p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {{ kpis().expenses | currency: 'EUR' : 'symbol' : '1.2-2' }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Solde net</p>
            <p
              class="mt-2 text-2xl font-bold tabular-nums"
              [class]="
                kpis().net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              "
            >
              {{ kpis().net | currency: 'EUR' : 'symbol' : '1.2-2' }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Taux d’épargne</p>
            <p
              class="mt-2 text-2xl font-bold tabular-nums"
              [class]="
                kpis().savingsRate >= 0
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-rose-600 dark:text-rose-400'
              "
            >
              @if (kpis().income > 0) {
                {{ kpis().savingsRate | number: '1.1-1' }} %
              } @else {
                —
              }
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Catégorisées</p>
              @if (kpis().categorizedPct < 100) {
                <a
                  routerLink="/pareto"
                  class="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Compléter →
                </a>
              }
            </div>
            <p class="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {{ kpis().categorizedPct | number: '1.0-1' }} %
            </p>
          </div>
        </div>

        <!-- Graphiques principaux -->
        <div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <!-- Donut Dépenses par catégorie -->
          <section
            class="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:col-span-5"
          >
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-slate-900 dark:text-white">
                  Dépenses par catégorie
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Cliquez sur une tranche pour filtrer
                </p>
              </div>
              @if (selectedCategoryId()) {
                <button
                  type="button"
                  (click)="selectedCategoryId.set(null)"
                  class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Réinitialiser
                </button>
              }
            </div>

            @if (expenseSlices().length === 0) {
              <div class="flex flex-1 items-center justify-center py-16 text-sm text-slate-400">
                Aucune dépense sur cette période.
              </div>
            } @else {
              <div class="relative mx-auto mt-4 h-64 w-full max-w-xs">
                <canvas #donutCanvas></canvas>
              </div>

              <!-- Légende interactive -->
              <ul class="mt-4 max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs">
                @for (slice of expenseSlices(); track slice.categoryId) {
                  <li>
                    <button
                      type="button"
                      (click)="toggleCategorySlice(slice.categoryId)"
                      class="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition"
                      [class]="
                        selectedCategoryId() === slice.categoryId
                          ? 'bg-indigo-50 ring-1 ring-indigo-300 dark:bg-indigo-950/70 dark:ring-indigo-700'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      "
                    >
                      <span class="flex min-w-0 items-center gap-2">
                        <span
                          class="h-2.5 w-2.5 shrink-0 rounded-full"
                          [style.background-color]="slice.color"
                        ></span>
                        <span class="truncate font-medium text-slate-800 dark:text-slate-200">
                          {{ slice.name }}
                        </span>
                        <span class="text-[11px] text-slate-400">({{ slice.count }})</span>
                      </span>
                      <span class="ml-3 shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">
                        {{ slice.total | currency: 'EUR' : 'symbol' : '1.0-0' }}
                        <span class="ml-1 font-normal text-slate-400">
                          {{ slice.sharePct | number: '1.0-0' }}%
                        </span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            }
          </section>

          <!-- Barres empilées mensuelles + Courbe des revenus -->
          <section
            class="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:col-span-7"
          >
            <div>
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">
                Évolution mensuelle des dépenses & revenus
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Barres empilées par catégorie + courbe verte des revenus mensuels
              </p>
            </div>

            @if (monthlyLabels().length === 0) {
              <div class="flex flex-1 items-center justify-center py-20 text-sm text-slate-400">
                Aucune donnée mensuelle sur cette période.
              </div>
            } @else {
              <div class="relative mt-4 min-h-[320px] flex-1">
                <canvas #monthlyCanvas></canvas>
              </div>
            }
          </section>
        </div>

        <!-- Top 10 des commerçants -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">
                Top 10 des commerçants
                @if (selectedCategoryId(); as catId) {
                  <span class="text-indigo-600 dark:text-indigo-400">
                    — {{ categoryLabel(catId) }}
                  </span>
                }
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Classés par montant total dépensé sur la période sélectionnée
              </p>
            </div>
            <a
              routerLink="/transactions"
              class="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Toutes les transactions →
            </a>
          </div>

          @if (topMerchants().length === 0) {
            <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Aucune dépense à classer pour ce filtre.
            </p>
          } @else {
            <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              @for (m of topMerchants(); track m.name; let i = $index) {
                <div class="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <div class="flex min-w-0 items-center gap-2">
                      <span
                        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {{ i + 1 }}
                      </span>
                      <span class="truncate font-semibold text-slate-900 dark:text-white">
                        {{ m.name }}
                      </span>
                      <span class="shrink-0 text-xs text-slate-400">({{ m.count }}×)</span>
                    </div>
                    <span class="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">
                      {{ m.total | currency: 'EUR' : 'symbol' : '1.2-2' }}
                    </span>
                  </div>
                  <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      class="h-full rounded-full bg-indigo-500"
                      [style.width.%]="m.sharePct"
                    ></div>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class DashboardComponent implements OnDestroy {
  readonly state = inject(BudgetStateService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly donutCanvas = viewChild<ElementRef<HTMLCanvasElement>>('donutCanvas');
  readonly monthlyCanvas = viewChild<ElementRef<HTMLCanvasElement>>('monthlyCanvas');

  readonly periodMode = signal<PeriodMode>('year');
  readonly selectedYear = signal<number>(new Date().getFullYear());
  readonly selectedQuarter = signal<number>(Math.floor(new Date().getMonth() / 3) + 1);
  readonly selectedMonth = signal<string>(new Date().toISOString().slice(0, 7));
  readonly customFrom = signal<string>(`${new Date().getFullYear()}-01-01`);
  readonly customTo = signal<string>(new Date().toISOString().slice(0, 10));
  readonly excludeInternalTransfers = signal<boolean>(true);
  readonly selectedCategoryId = signal<string | null>(null);

  private donutChart: Chart | null = null;
  private monthlyChart: Chart | null = null;
  private initializedYearFromData = false;

  readonly availableYears = computed(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const tx of this.state.transactions()) {
      const y = Number(tx.date.slice(0, 4));
      if (Number.isFinite(y) && y > 1990) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  });

  readonly internalTransferIds = computed(() => {
    const set = new Set<string>();
    for (const c of this.state.rules().categories) {
      if (c.isInternalTransfer) set.add(c.id);
    }
    return set;
  });

  readonly periodLabel = computed(() => {
    switch (this.periodMode()) {
      case 'month':
        return `Mois ${this.selectedMonth()}`;
      case 'quarter':
        return `Trimestre T${this.selectedQuarter()} ${this.selectedYear()}`;
      case 'year':
        return `Année ${this.selectedYear()}`;
      case 'custom':
        return `Du ${this.customFrom()} au ${this.customTo()}`;
      case 'all':
        return 'Tout l’historique';
    }
  });

  /** Transactions filtrées par période + exclusion transferts internes */
  readonly periodTransactions = computed<Transaction[]>(() => {
    const all = this.state.transactions();
    const excludeTransfers = this.excludeInternalTransfers();
    const transferIds = this.internalTransferIds();
    const mode = this.periodMode();

    return all.filter((tx) => {
      if (excludeTransfers && tx.categoryId && transferIds.has(tx.categoryId)) {
        return false;
      }

      switch (mode) {
        case 'all':
          return true;
        case 'year':
          return tx.date.startsWith(String(this.selectedYear()));
        case 'month':
          return tx.date.startsWith(this.selectedMonth());
        case 'quarter': {
          const y = Number(tx.date.slice(0, 4));
          const m = Number(tx.date.slice(5, 7));
          const q = Math.floor((m - 1) / 3) + 1;
          return y === this.selectedYear() && q === this.selectedQuarter();
        }
        case 'custom':
          return (
            (!this.customFrom() || tx.date >= this.customFrom()) &&
            (!this.customTo() || tx.date <= this.customTo())
          );
      }
    });
  });

  /** Transactions filtrées incluant le filtre catégorie cliqué dans le Donut */
  readonly filteredTransactions = computed<Transaction[]>(() => {
    const catId = this.selectedCategoryId();
    const list = this.periodTransactions();
    if (!catId) return list;
    return list.filter((tx) => (tx.categoryId || UNCATEGORIZED_ID) === catId);
  });

  readonly kpis = computed(() => {
    const list = this.filteredTransactions();
    let income = 0;
    let expenses = 0;
    let categorized = 0;
    const validIds = new Set(this.state.rules().categories.map((c) => c.id));

    for (const tx of list) {
      if (tx.amount >= 0) {
        income += tx.amount;
      } else {
        expenses += Math.abs(tx.amount);
      }
      if (tx.categoryId && tx.categoryId !== UNCATEGORIZED_ID && validIds.has(tx.categoryId)) {
        categorized++;
      }
    }

    const net = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    const categorizedPct = list.length > 0 ? (categorized / list.length) * 100 : 100;

    return { income, expenses, net, savingsRate, categorizedPct };
  });

  readonly expenseSlices = computed<CategorySlice[]>(() => {
    const list = this.periodTransactions();
    const catMap = this.state.categoryMap();
    const totals = new Map<string, { total: number; count: number }>();
    let grandTotal = 0;

    for (const tx of list) {
      if (tx.amount >= 0) continue;
      const cid =
        tx.categoryId && catMap.has(tx.categoryId) ? tx.categoryId : UNCATEGORIZED_ID;
      const abs = Math.abs(tx.amount);
      grandTotal += abs;
      const prev = totals.get(cid);
      if (prev) {
        prev.total += abs;
        prev.count++;
      } else {
        totals.set(cid, { total: abs, count: 1 });
      }
    }

    return Array.from(totals.entries())
      .map(([categoryId, data]) => {
        const cat = catMap.get(categoryId);
        return {
          categoryId,
          name: cat?.name ?? 'Non catégorisé',
          color: cat?.color ?? '#cbd5e1',
          total: Math.round(data.total * 100) / 100,
          count: data.count,
          sharePct: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  readonly monthlyLabels = computed<string[]>(() => {
    const months = new Set<string>();
    for (const tx of this.filteredTransactions()) {
      months.add(tx.date.slice(0, 7));
    }
    return Array.from(months).sort();
  });

  readonly topMerchants = computed<TopMerchant[]>(() => {
    const list = this.filteredTransactions();
    const byMerchant = new Map<string, { total: number; count: number }>();

    for (const tx of list) {
      if (tx.amount >= 0) continue;
      const name = tx.merchantName?.trim() || tx.counterpartyName?.trim() || 'Inconnu';
      const abs = Math.abs(tx.amount);
      const prev = byMerchant.get(name);
      if (prev) {
        prev.total += abs;
        prev.count++;
      } else {
        byMerchant.set(name, { total: abs, count: 1 });
      }
    }

    const sorted = Array.from(byMerchant.entries())
      .map(([name, data]) => ({
        name,
        total: Math.round(data.total * 100) / 100,
        count: data.count,
        sharePct: 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const maxVal = sorted[0]?.total ?? 1;
    for (const item of sorted) {
      item.sharePct = Math.max(4, (item.total / maxVal) * 100);
    }
    return sorted;
  });

  constructor() {
    // Initialise automatiquement l'année/mois sur la transaction la plus récente si l'année courante est vide
    effect(() => {
      const txs = this.state.transactions();
      if (!this.initializedYearFromData && txs.length > 0) {
        this.initializedYearFromData = true;
        const latestDate = txs[0].date;
        const latestYear = Number(latestDate.slice(0, 4));
        if (Number.isFinite(latestYear)) {
          this.selectedYear.set(latestYear);
          this.selectedMonth.set(latestDate.slice(0, 7));
          this.customFrom.set(`${latestYear}-01-01`);
          this.customTo.set(latestDate);
        }
      }
    });

    // Met à jour le Donut Chart
    effect(() => {
      const canvasEl = this.donutCanvas()?.nativeElement;
      const slices = this.expenseSlices();
      const activeCat = this.selectedCategoryId();
      const dark = this.theme.isDark();

      if (!canvasEl || slices.length === 0) {
        this.donutChart?.destroy();
        this.donutChart = null;
        return;
      }

      this.donutChart?.destroy();
      this.donutChart = new Chart(canvasEl, {
        type: 'doughnut',
        data: {
          labels: slices.map((s) => s.name),
          datasets: [
            {
              data: slices.map((s) => s.total),
              backgroundColor: slices.map((s) =>
                activeCat && s.categoryId !== activeCat ? `${s.color}44` : s.color,
              ),
              borderColor: dark ? '#0f172a' : '#ffffff',
              borderWidth: 2,
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '64%',
          onClick: (_event, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              const clicked = slices[idx];
              if (clicked) {
                this.toggleCategorySlice(clicked.categoryId);
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = Number(ctx.raw ?? 0);
                  const pct = slices[ctx.dataIndex]?.sharePct ?? 0;
                  return ` ${ctx.label}: ${val.toFixed(2)} € (${pct.toFixed(1)} %)`;
                },
              },
            },
          },
        },
      });
    });

    // Met à jour le graphique Barres empilées + Courbe Revenus
    effect(() => {
      const canvasEl = this.monthlyCanvas()?.nativeElement;
      const months = this.monthlyLabels();
      const txs = this.filteredTransactions();
      const catMap = this.state.categoryMap();
      const dark = this.theme.isDark();

      if (!canvasEl || months.length === 0) {
        this.monthlyChart?.destroy();
        this.monthlyChart = null;
        return;
      }

      // Revenus mensuels
      const incomeByMonth = new Map<string, number>();
      // Dépenses par catégorie et par mois
      const catTotals = new Map<string, Map<string, number>>();

      for (const tx of txs) {
        const ym = tx.date.slice(0, 7);
        if (tx.amount >= 0) {
          incomeByMonth.set(ym, (incomeByMonth.get(ym) ?? 0) + tx.amount);
        } else {
          const cid =
            tx.categoryId && catMap.has(tx.categoryId) ? tx.categoryId : UNCATEGORIZED_ID;
          let map = catTotals.get(cid);
          if (!map) {
            map = new Map<string, number>();
            catTotals.set(cid, map);
          }
          map.set(ym, (map.get(ym) ?? 0) + Math.abs(tx.amount));
        }
      }

      const barDatasets = Array.from(catTotals.entries()).map(([cid, monthMap]) => {
        const cat = catMap.get(cid);
        return {
          type: 'bar' as const,
          label: cat?.name ?? 'Non catégorisé',
          data: months.map((m) => Math.round((monthMap.get(m) ?? 0) * 100) / 100),
          backgroundColor: cat?.color ?? '#cbd5e1',
          borderRadius: 4,
          stack: 'expenses',
          order: 2,
        };
      });

      const incomeDataset = {
        type: 'line' as const,
        label: 'Revenus',
        data: months.map((m) => Math.round((incomeByMonth.get(m) ?? 0) * 100) / 100),
        borderColor: '#10b981',
        backgroundColor: '#10b981',
        borderWidth: 2.5,
        pointRadius: 3.5,
        pointHoverRadius: 5,
        tension: 0.25,
        fill: false,
        order: 1,
      };

      const textColor = dark ? '#94a3b8' : '#475569';
      const gridColor = dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.22)';

      this.monthlyChart?.destroy();
      this.monthlyChart = new Chart(canvasEl, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [...barDatasets, incomeDataset],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          scales: {
            x: {
              stacked: true,
              ticks: { color: textColor },
              grid: { display: false },
            },
            y: {
              stacked: true,
              ticks: {
                color: textColor,
                callback: (val) => `${val} €`,
              },
              grid: { color: gridColor },
            },
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                boxWidth: 10,
                usePointStyle: true,
                font: { size: 11 },
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw ?? 0).toFixed(2)} €`,
              },
            },
          },
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.donutChart?.destroy();
    this.monthlyChart?.destroy();
  }

  toggleCategorySlice(categoryId: string): void {
    this.selectedCategoryId.update((curr) => (curr === categoryId ? null : categoryId));
  }

  categoryLabel(categoryId: string): string {
    if (categoryId === UNCATEGORIZED_ID) return 'Non catégorisé';
    return this.state.categoryMap().get(categoryId)?.name ?? 'Non catégorisé';
  }

  openTransactionsForCategory(categoryId: string): void {
    void this.router.navigate(['/transactions'], {
      queryParams: { category: categoryId },
    });
  }
}
