import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BudgetStateService } from '../../core/services/budget-state.service';
import { ParetoGroup } from '../../core/services/categorization-engine.service';

interface GroupDraftForm {
  ruleType: 'iban' | 'keyword';
  pattern: string;
  isRegex: boolean;
  merchant: string;
  categoryId: string;
}

@Component({
  selector: 'app-pareto',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- En-tête & Progression Pareto -->
      <div
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
                À catégoriser (Pareto 80/20)
              </h1>
              @if (state.uncategorizedCount() > 0) {
                <span
                  class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                >
                  {{ state.uncategorizedCount() }} restantes
                </span>
              }
            </div>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Les groupes sont triés par montant total absolu décroissant : traitez d’abord les
              plus gros volumes pour catégoriser rapidement 80 % de votre budget.
            </p>
          </div>

          <div class="text-left sm:text-right">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
              Taux de catégorisation global
            </p>
            <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {{ state.categorizationRate() | number: '1.0-1' }} %
            </p>
          </div>
        </div>

        <div class="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
            [style.width.%]="state.categorizationRate()"
          ></div>
        </div>

        @if (groups().length > 0) {
          <div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              <strong>{{ groups().length }}</strong> groupe(s) à traiter
            </span>
            <span>
              Volume restant :
              <strong class="text-slate-800 dark:text-slate-200">
                {{ totalRemainingAbs() | currency: 'EUR' : 'symbol' : '1.2-2' }}
              </strong>
            </span>
            @if (top80GroupCount() > 0) {
              <span class="text-indigo-600 dark:text-indigo-400">
                Les <strong>{{ top80GroupCount() }}</strong> premiers groupes représentent ~80 % du
                volume non catégorisé.
              </span>
            }
          </div>
        }
      </div>

      <!-- État vide / 100% catégorisé -->
      @if (groups().length === 0) {
        <div
          class="rounded-3xl border border-emerald-200 bg-white p-12 text-center dark:border-emerald-900/60 dark:bg-slate-900"
        >
          <div
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          >
            <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 class="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Toutes vos transactions sont catégorisées !
          </h2>
          <p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Votre budget est entièrement à jour. Vous pouvez consulter vos analyses ou importer de
            nouveaux extraits CSV.
          </p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <a
              routerLink="/dashboard"
              class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Ouvrir le tableau de bord
            </a>
            <a
              routerLink="/import"
              class="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Importer un CSV
            </a>
          </div>
        </div>
      } @else {
        <!-- Liste des groupes Pareto -->
        <div class="space-y-4">
          @for (group of groups(); track group.key; let idx = $index) {
            @let draft = getDraft(group);
            <article
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
            >
              <!-- En-tête du groupe -->
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      class="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      #{{ idx + 1 }}
                    </span>
                    <span
                      class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      [class]="
                        group.groupType === 'iban'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300'
                      "
                    >
                      {{ group.groupType === 'iban' ? 'IBAN détecté' : 'Motif / Carte' }}
                    </span>
                    <h2 class="truncate text-base font-bold text-slate-900 dark:text-white">
                      {{ group.displayLabel }}
                    </h2>
                    @if (group.iban) {
                      <code
                        class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {{ group.iban }}
                      </code>
                    }
                  </div>

                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    <strong>{{ group.count }}</strong> transaction(s) · du
                    {{ group.dateRange.min }} au {{ group.dateRange.max }} ·
                    <span class="text-indigo-600 dark:text-indigo-400">
                      {{ group.sharePct | number: '1.1-1' }} % du reste (cumul :
                      {{ group.cumulativeSharePct | number: '1.0-0' }} %)
                    </span>
                  </p>
                </div>

                <div class="shrink-0 text-left sm:text-right">
                  <p
                    class="text-lg font-bold tabular-nums"
                    [class]="
                      group.totalSignedAmount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    "
                  >
                    {{ group.totalSignedAmount | currency: 'EUR' : 'symbol' : '1.2-2' }}
                  </p>
                  @if (Math.abs(group.totalSignedAmount) !== group.totalAbsAmount) {
                    <p class="text-[11px] text-slate-500 dark:text-slate-400">
                      Volume absolu : {{ group.totalAbsAmount | currency: 'EUR' : 'symbol' : '1.2-2' }}
                    </p>
                  }
                </div>
              </div>

              <!-- Aperçu des libellés -->
              @if (group.sampleDetails.length > 0) {
                <div class="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Aperçu des libellés bancaires
                  </p>
                  <ul class="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    @for (sample of group.sampleDetails; track sample) {
                      <li class="truncate font-mono text-[11px]">• {{ sample }}</li>
                    }
                  </ul>
                </div>
              }

              <!-- Formulaire rapide en ligne -->
              <form
                (ngSubmit)="applyRule(group)"
                class="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-12 md:items-end"
              >
                <!-- Type de règle -->
                <div class="md:col-span-2">
                  <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Type de règle
                  </label>
                  <select
                    [(ngModel)]="draft.ruleType"
                    (ngModelChange)="onRuleTypeChanged(group, $event)"
                    [name]="'type_' + group.key"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    @if (group.iban) {
                      <option value="iban">Par IBAN</option>
                    }
                    <option value="keyword">Par mot-clé</option>
                  </select>
                </div>

                <!-- Motif / IBAN -->
                <div class="md:col-span-3">
                  <div class="mb-1 flex items-center justify-between">
                    <label class="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {{ draft.ruleType === 'iban' ? 'IBAN cible' : 'Mot-clé / Motif' }}
                    </label>
                    @if (draft.ruleType === 'keyword') {
                      <label class="inline-flex cursor-pointer items-center gap-1 text-[11px] text-slate-500">
                        <input
                          type="checkbox"
                          [(ngModel)]="draft.isRegex"
                          [name]="'regex_' + group.key"
                          class="rounded border-slate-300 text-indigo-600"
                        />
                        Regex
                      </label>
                    }
                  </div>
                  <input
                    type="text"
                    [(ngModel)]="draft.pattern"
                    [name]="'pattern_' + group.key"
                    [readonly]="draft.ruleType === 'iban'"
                    required
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:read-only:bg-slate-800/60"
                  />
                </div>

                <!-- Nom propre commerçant -->
                <div class="md:col-span-3">
                  <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Nom propre du commerçant
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="draft.merchant"
                    [name]="'merchant_' + group.key"
                    placeholder="Ex : Delhaize, Proximus…"
                    required
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <!-- Catégorie -->
                <div class="md:col-span-2">
                  <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Catégorie
                  </label>
                  <select
                    [(ngModel)]="draft.categoryId"
                    [name]="'cat_' + group.key"
                    required
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="" disabled>Choisir…</option>
                    @for (cat of state.rules().categories; track cat.id) {
                      <option [value]="cat.id">{{ cat.name }}</option>
                    }
                  </select>
                </div>

                <!-- Bouton Valider -->
                <div class="md:col-span-2">
                  <button
                    type="submit"
                    [disabled]="
                      savingGroupKey() === group.key ||
                      state.isSaving() ||
                      !draft.categoryId ||
                      !draft.pattern.trim()
                    "
                    class="w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    @if (savingGroupKey() === group.key) {
                      Enregistrement…
                    } @else {
                      Valider ({{ group.count }})
                    }
                  </button>
                </div>
              </form>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class ParetoComponent {
  readonly state = inject(BudgetStateService);
  readonly Math = Math;

  readonly groups = this.state.paretoGroups;
  readonly savingGroupKey = signal<string | null>(null);

  private readonly drafts = new Map<string, GroupDraftForm>();

  readonly totalRemainingAbs = computed(() =>
    this.groups().reduce((sum, g) => sum + g.totalAbsAmount, 0),
  );

  readonly top80GroupCount = computed(() => {
    const list = this.groups();
    if (list.length === 0) return 0;
    const idx = list.findIndex((g) => g.cumulativeSharePct >= 80);
    return idx === -1 ? list.length : idx + 1;
  });

  getDraft(group: ParetoGroup): GroupDraftForm {
    let draft = this.drafts.get(group.key);
    if (!draft) {
      draft = {
        ruleType: group.iban ? 'iban' : 'keyword',
        pattern: group.iban ?? group.suggestedPattern,
        isRegex: false,
        merchant: group.suggestedMerchant,
        categoryId: '',
      };
      this.drafts.set(group.key, draft);
    }
    return draft;
  }

  onRuleTypeChanged(group: ParetoGroup, ruleType: 'iban' | 'keyword'): void {
    const draft = this.getDraft(group);
    draft.ruleType = ruleType;
    if (ruleType === 'iban' && group.iban) {
      draft.pattern = group.iban;
      draft.isRegex = false;
    } else {
      draft.pattern = group.displayLabel;
    }
  }

  async applyRule(group: ParetoGroup): Promise<void> {
    const draft = this.getDraft(group);
    if (!draft.categoryId || !draft.pattern.trim()) return;

    this.savingGroupKey.set(group.key);
    try {
      const ok = await this.state.addRuleAndRecategorize({
        ruleType: draft.ruleType,
        pattern: draft.pattern,
        isRegex: draft.isRegex,
        merchant: draft.merchant,
        categoryId: draft.categoryId,
      });
      if (ok) {
        this.drafts.delete(group.key);
      }
    } finally {
      this.savingGroupKey.set(null);
    }
  }
}
