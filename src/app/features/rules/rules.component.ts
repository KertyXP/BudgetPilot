import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BudgetStateService } from '../../core/services/budget-state.service';
import { normalizeIban } from '../../core/services/categorization-engine.service';
import { ToastService } from '../../core/services/toast.service';
import { Category, KeywordRule, RulesConfig } from '../../models';

type RulesTab = 'categories' | 'iban' | 'keywords';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <!-- En-tête + Import/Export JSON -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Règles & Catégories</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Toute modification met à jour <code class="font-mono text-xs">regles.json</code> sur
            Google Drive et recatégorise automatiquement vos transactions.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            (click)="exportRulesJson()"
            class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Exporter regles.json
          </button>
          <label
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Importer regles.json
            <input type="file" accept=".json,application/json" (change)="importRulesJson($event)" class="hidden" />
          </label>
        </div>
      </div>

      <!-- Onglets -->
      <div class="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          (click)="activeTab.set('categories')"
          class="border-b-2 px-4 py-2.5 text-sm font-semibold transition"
          [class]="
            activeTab() === 'categories'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          "
        >
          Catégories ({{ state.rules().categories.length }})
        </button>
        <button
          type="button"
          (click)="activeTab.set('iban')"
          class="border-b-2 px-4 py-2.5 text-sm font-semibold transition"
          [class]="
            activeTab() === 'iban'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          "
        >
          Règles IBAN ({{ ibanEntries().length }})
        </button>
        <button
          type="button"
          (click)="activeTab.set('keywords')"
          class="border-b-2 px-4 py-2.5 text-sm font-semibold transition"
          [class]="
            activeTab() === 'keywords'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          "
        >
          Règles Mots-clés ({{ state.rules().keywordRules.length }})
        </button>
      </div>

      <!-- ONGLET 1 : CATÉGORIES -->
      @if (activeTab() === 'categories') {
        <div class="space-y-4">
          <!-- Formulaire ajout / édition catégorie -->
          <form
            (ngSubmit)="saveCategory()"
            class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-12 sm:items-end"
          >
            <div class="sm:col-span-5">
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {{ editingCategoryId() ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}
              </label>
              <input
                type="text"
                name="catName"
                [(ngModel)]="catName"
                placeholder="Ex : Voyages, Animaux, Enfants…"
                required
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Couleur
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  name="catColor"
                  [(ngModel)]="catColor"
                  class="h-9 w-11 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-0.5 dark:border-slate-700"
                />
                <span class="font-mono text-xs text-slate-500">{{ catColor }}</span>
              </div>
            </div>

            <div class="sm:col-span-3">
              <label class="inline-flex cursor-pointer items-center gap-2 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  name="catTransfer"
                  [(ngModel)]="catIsInternalTransfer"
                  class="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Transfert interne (excluable)
              </label>
            </div>

            <div class="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                [disabled]="state.isSaving() || !catName.trim()"
                class="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {{ editingCategoryId() ? 'Mettre à jour' : 'Ajouter' }}
              </button>
              @if (editingCategoryId()) {
                <button
                  type="button"
                  (click)="cancelEditCategory()"
                  class="rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  ×
                </button>
              }
            </div>
          </form>

          <!-- Liste des catégories -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (cat of state.rules().categories; track cat.id) {
              <div
                class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span
                    class="h-4 w-4 shrink-0 rounded-full ring-2 ring-slate-200 dark:ring-slate-700"
                    [style.background-color]="cat.color"
                  ></span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {{ cat.name }}
                    </p>
                    @if (cat.isInternalTransfer) {
                      <span
                        class="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      >
                        Transfert interne
                      </span>
                    }
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    (click)="startEditCategory(cat)"
                    class="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    (click)="deleteCategory(cat)"
                    [disabled]="state.isSaving()"
                    class="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                  >
                    Suppr.
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ONGLET 2 : RÈGLES IBAN -->
      @if (activeTab() === 'iban') {
        <div class="space-y-4">
          <form
            (ngSubmit)="saveIbanRule()"
            class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-12 sm:items-end"
          >
            <div class="sm:col-span-4">
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                IBAN de la contrepartie
              </label>
              <input
                type="text"
                name="ibanInput"
                [(ngModel)]="ibanInput"
                placeholder="BE68 5390 0754 7034"
                required
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div class="sm:col-span-3">
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Nom du commerçant
              </label>
              <input
                type="text"
                name="ibanMerchant"
                [(ngModel)]="ibanMerchant"
                placeholder="Ex : Propriétaire Loyer"
                required
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div class="sm:col-span-3">
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Catégorie
              </label>
              <select
                name="ibanCategoryId"
                [(ngModel)]="ibanCategoryId"
                required
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="" disabled>Choisir…</option>
                @for (cat of state.rules().categories; track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>

            <div class="sm:col-span-2">
              <button
                type="submit"
                [disabled]="state.isSaving() || !ibanInput.trim() || !ibanCategoryId"
                class="w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </form>

          @if (ibanEntries().length === 0) {
            <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Aucune règle IBAN définie. Créez-en ici ou depuis l’écran « À catégoriser ».
            </div>
          } @else {
            <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table class="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th class="px-4 py-3 font-semibold">IBAN</th>
                    <th class="px-4 py-3 font-semibold">Commerçant</th>
                    <th class="px-4 py-3 font-semibold">Catégorie</th>
                    <th class="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  @for (entry of ibanEntries(); track entry.iban) {
                    <tr>
                      <td class="whitespace-nowrap px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                        {{ entry.iban }}
                      </td>
                      <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {{ entry.merchant }}
                      </td>
                      <td class="px-4 py-3">
                        <span class="inline-flex items-center gap-1.5">
                          <span
                            class="h-2 w-2 rounded-full"
                            [style.background-color]="categoryColor(entry.categoryId)"
                          ></span>
                          {{ categoryName(entry.categoryId) }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          (click)="editIbanRule(entry.iban, entry.merchant, entry.categoryId)"
                          class="mr-2 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          (click)="deleteIbanRule(entry.iban)"
                          [disabled]="state.isSaving()"
                          class="font-medium text-rose-600 hover:underline dark:text-rose-400"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- ONGLET 3 : RÈGLES MOTS-CLÉS -->
      @if (activeTab() === 'keywords') {
        <div class="space-y-4">
          <form
            (ngSubmit)="saveKeywordRule()"
            class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-12 sm:items-end"
          >
            <div class="sm:col-span-4">
              <div class="mb-1 flex items-center justify-between">
                <label class="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Mot-clé ou expression régulière
                </label>
                <label class="inline-flex cursor-pointer items-center gap-1 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    name="kwIsRegex"
                    [(ngModel)]="kwIsRegex"
                    class="rounded border-slate-300 text-indigo-600"
                  />
                  Regex
                </label>
              </div>
              <input
                type="text"
                name="kwPattern"
                [(ngModel)]="kwPattern"
                placeholder="Ex : DELHAIZE ou ^CARREFOUR.*BRUX"
                required
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div class="sm:col-span-3">
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Nom du commerçant
              </label>
              <input
                type="text"
                name="kwMerchant"
                [(ngModel)]="kwMerchant"
                placeholder="Ex : Delhaize"
                required
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div class="sm:col-span-3">
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Catégorie
              </label>
              <select
                name="kwCategoryId"
                [(ngModel)]="kwCategoryId"
                required
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="" disabled>Choisir…</option>
                @for (cat of state.rules().categories; track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>

            <div class="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                [disabled]="state.isSaving() || !kwPattern.trim() || !kwCategoryId"
                class="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {{ editingKeywordId() ? 'Mettre à jour' : 'Ajouter' }}
              </button>
              @if (editingKeywordId()) {
                <button
                  type="button"
                  (click)="cancelEditKeyword()"
                  class="rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  ×
                </button>
              }
            </div>
          </form>

          @if (state.rules().keywordRules.length === 0) {
            <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Aucune règle par mot-clé définie pour le moment.
            </div>
          } @else {
            <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table class="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th class="px-4 py-3 font-semibold">Motif</th>
                    <th class="px-4 py-3 font-semibold">Mode</th>
                    <th class="px-4 py-3 font-semibold">Commerçant</th>
                    <th class="px-4 py-3 font-semibold">Catégorie</th>
                    <th class="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  @for (rule of state.rules().keywordRules; track rule.id) {
                    <tr>
                      <td class="px-4 py-3 font-mono text-slate-800 dark:text-slate-200">
                        {{ rule.pattern }}
                      </td>
                      <td class="whitespace-nowrap px-4 py-3">
                        <span
                          class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          [class]="
                            rule.isRegex
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          "
                        >
                          {{ rule.isRegex ? 'Regex' : 'Texte' }}
                        </span>
                      </td>
                      <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {{ rule.merchant }}
                      </td>
                      <td class="px-4 py-3">
                        <span class="inline-flex items-center gap-1.5">
                          <span
                            class="h-2 w-2 rounded-full"
                            [style.background-color]="categoryColor(rule.categoryId)"
                          ></span>
                          {{ categoryName(rule.categoryId) }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          (click)="startEditKeyword(rule)"
                          class="mr-2 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          (click)="deleteKeywordRule(rule.id)"
                          [disabled]="state.isSaving()"
                          class="font-medium text-rose-600 hover:underline dark:text-rose-400"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class RulesComponent {
  readonly state = inject(BudgetStateService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<RulesTab>('categories');

  // Form Catégorie
  readonly editingCategoryId = signal<string | null>(null);
  catName = '';
  catColor = '#6366f1';
  catIsInternalTransfer = false;

  // Form IBAN
  ibanInput = '';
  ibanMerchant = '';
  ibanCategoryId = '';

  // Form Mot-clé
  readonly editingKeywordId = signal<string | null>(null);
  kwPattern = '';
  kwIsRegex = false;
  kwMerchant = '';
  kwCategoryId = '';

  readonly ibanEntries = computed(() =>
    Object.entries(this.state.rules().ibanRules)
      .map(([iban, target]) => ({
        iban,
        merchant: target.merchant,
        categoryId: target.categoryId,
      }))
      .sort((a, b) => a.merchant.localeCompare(b.merchant)),
  );

  // --- CRUD Catégories ---
  startEditCategory(cat: Category): void {
    this.editingCategoryId.set(cat.id);
    this.catName = cat.name;
    this.catColor = cat.color;
    this.catIsInternalTransfer = Boolean(cat.isInternalTransfer);
  }

  cancelEditCategory(): void {
    this.editingCategoryId.set(null);
    this.catName = '';
    this.catColor = '#6366f1';
    this.catIsInternalTransfer = false;
  }

  async saveCategory(): Promise<void> {
    const name = this.catName.trim();
    if (!name) return;

    const current = this.state.rules();
    const editId = this.editingCategoryId();

    let updatedCategories: Category[];
    if (editId) {
      updatedCategories = current.categories.map((c) =>
        c.id === editId
          ? { ...c, name, color: this.catColor, isInternalTransfer: this.catIsInternalTransfer }
          : c,
      );
    } else {
      const slug =
        name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || this.state.generateId('cat');
      const uniqueId = current.categories.some((c) => c.id === slug)
        ? `${slug}-${Date.now().toString(36).slice(-4)}`
        : slug;

      updatedCategories = [
        ...current.categories,
        {
          id: uniqueId,
          name,
          color: this.catColor,
          isInternalTransfer: this.catIsInternalTransfer,
        },
      ];
    }

    const ok = await this.state.updateRulesAndRecategorize(
      { ...current, categories: updatedCategories },
      editId ? `Catégorie « ${name} » mise à jour.` : `Catégorie « ${name} » créée.`,
    );
    if (ok) {
      this.cancelEditCategory();
    }
  }

  async deleteCategory(cat: Category): Promise<void> {
    if (!window.confirm(`Supprimer la catégorie « ${cat.name} » ?`)) return;

    const current = this.state.rules();
    const updatedCategories = current.categories.filter((c) => c.id !== cat.id);
    const updatedIbanRules = { ...current.ibanRules };
    for (const [iban, target] of Object.entries(updatedIbanRules)) {
      if (target.categoryId === cat.id) {
        delete updatedIbanRules[iban];
      }
    }
    const updatedKeywordRules = current.keywordRules.filter((r) => r.categoryId !== cat.id);

    await this.state.updateRulesAndRecategorize(
      {
        categories: updatedCategories,
        ibanRules: updatedIbanRules,
        keywordRules: updatedKeywordRules,
      },
      `Catégorie « ${cat.name} » supprimée.`,
    );
  }

  // --- CRUD Règles IBAN ---
  editIbanRule(iban: string, merchant: string, categoryId: string): void {
    this.ibanInput = iban;
    this.ibanMerchant = merchant;
    this.ibanCategoryId = categoryId;
  }

  async saveIbanRule(): Promise<void> {
    const iban = normalizeIban(this.ibanInput);
    if (!iban || !this.ibanCategoryId) return;

    const current = this.state.rules();
    const updated: RulesConfig = {
      ...current,
      ibanRules: {
        ...current.ibanRules,
        [iban]: {
          merchant: this.ibanMerchant.trim() || iban,
          categoryId: this.ibanCategoryId,
        },
      },
    };

    const ok = await this.state.updateRulesAndRecategorize(
      updated,
      `Règle IBAN « ${iban} » enregistrée.`,
    );
    if (ok) {
      this.ibanInput = '';
      this.ibanMerchant = '';
      this.ibanCategoryId = '';
    }
  }

  async deleteIbanRule(iban: string): Promise<void> {
    const current = this.state.rules();
    const updatedIban = { ...current.ibanRules };
    delete updatedIban[iban];
    await this.state.updateRulesAndRecategorize(
      { ...current, ibanRules: updatedIban },
      `Règle IBAN « ${iban} » supprimée.`,
    );
  }

  // --- CRUD Règles Mots-clés ---
  startEditKeyword(rule: KeywordRule): void {
    this.editingKeywordId.set(rule.id);
    this.kwPattern = rule.pattern;
    this.kwIsRegex = rule.isRegex;
    this.kwMerchant = rule.merchant;
    this.kwCategoryId = rule.categoryId;
  }

  cancelEditKeyword(): void {
    this.editingKeywordId.set(null);
    this.kwPattern = '';
    this.kwIsRegex = false;
    this.kwMerchant = '';
    this.kwCategoryId = '';
  }

  async saveKeywordRule(): Promise<void> {
    const pattern = this.kwPattern.trim();
    if (!pattern || !this.kwCategoryId) return;

    if (this.kwIsRegex) {
      try {
        new RegExp(pattern, 'i');
      } catch {
        this.toast.error('Regex invalide', 'Veuillez vérifier la syntaxe de votre expression régulière.');
        return;
      }
    }

    const current = this.state.rules();
    const editId = this.editingKeywordId();
    const merchant = this.kwMerchant.trim() || pattern;

    let updatedKeywords: KeywordRule[];
    if (editId) {
      updatedKeywords = current.keywordRules.map((r) =>
        r.id === editId
          ? { ...r, pattern, isRegex: this.kwIsRegex, merchant, categoryId: this.kwCategoryId }
          : r,
      );
    } else {
      updatedKeywords = [
        {
          id: this.state.generateId('kw'),
          pattern,
          isRegex: this.kwIsRegex,
          merchant,
          categoryId: this.kwCategoryId,
        },
        ...current.keywordRules,
      ];
    }

    const ok = await this.state.updateRulesAndRecategorize(
      { ...current, keywordRules: updatedKeywords },
      editId ? 'Règle mot-clé mise à jour.' : 'Règle mot-clé ajoutée.',
    );
    if (ok) {
      this.cancelEditKeyword();
    }
  }

  async deleteKeywordRule(id: string): Promise<void> {
    const current = this.state.rules();
    const updatedKeywords = current.keywordRules.filter((r) => r.id !== id);
    await this.state.updateRulesAndRecategorize(
      { ...current, keywordRules: updatedKeywords },
      'Règle mot-clé supprimée.',
    );
  }

  // --- Export / Import secours regles.json ---
  exportRulesJson(): void {
    const blob = new Blob([JSON.stringify(this.state.rules(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const projectName = this.state.activeProject()?.name ?? 'budgetpilot';
    a.download = `regles_${projectName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importRulesJson(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<RulesConfig>;
      if (!Array.isArray(parsed.categories)) {
        throw new Error('Le fichier JSON doit contenir un tableau "categories".');
      }

      const normalized: RulesConfig = {
        categories: parsed.categories,
        ibanRules: parsed.ibanRules && typeof parsed.ibanRules === 'object' ? parsed.ibanRules : {},
        keywordRules: Array.isArray(parsed.keywordRules) ? parsed.keywordRules : [],
      };

      await this.state.updateRulesAndRecategorize(
        normalized,
        'Fichier regles.json importé et appliqué sur Google Drive.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Format JSON invalide.';
      this.toast.error('Import regles.json échoué', msg);
    }
  }

  categoryName(categoryId: string): string {
    return this.state.categoryMap().get(categoryId)?.name ?? 'Catégorie supprimée';
  }

  categoryColor(categoryId: string): string {
    return this.state.categoryMap().get(categoryId)?.color ?? '#94a3b8';
  }
}
