import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Category,
  DriveConflictError,
  DriveDataFileType,
  DriveProject,
  KeywordRule,
  ProjectFiles,
  RulesConfig,
  Transaction,
  TransactionsFile,
  UNCATEGORIZED_ID,
  createDefaultRulesConfig,
} from '../../models';
import { GoogleDriveService } from '../drive/google-drive.service';
import { CategorizationEngineService, normalizeIban } from './categorization-engine.service';
import { ToastService } from './toast.service';

const LAST_PROJECT_STORAGE_KEY = 'budgetpilot_last_project_id';

export interface DriveConflictState {
  fileType: DriveDataFileType;
  localModifiedTime: string;
  remoteModifiedTime: string;
  forceAction: () => Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class BudgetStateService {
  private readonly drive = inject(GoogleDriveService);
  private readonly engine = inject(CategorizationEngineService);
  private readonly toast = inject(ToastService);

  private readonly _projects = signal<DriveProject[]>([]);
  private readonly _isLoadingProjects = signal<boolean>(false);
  private readonly _projectFiles = signal<ProjectFiles | null>(null);
  private readonly _rules = signal<RulesConfig>(createDefaultRulesConfig());
  private readonly _transactions = signal<Transaction[]>([]);
  private readonly _isLoadingProject = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _syncError = signal<string | null>(null);
  private readonly _conflict = signal<DriveConflictState | null>(null);

  readonly projects = this._projects.asReadonly();
  readonly isLoadingProjects = this._isLoadingProjects.asReadonly();
  readonly projectFiles = this._projectFiles.asReadonly();
  readonly activeProject = computed(() => this._projectFiles()?.project ?? null);
  readonly rules = this._rules.asReadonly();
  readonly transactions = this._transactions.asReadonly();
  readonly isLoadingProject = this._isLoadingProject.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly syncError = this._syncError.asReadonly();
  readonly conflict = this._conflict.asReadonly();

  readonly categoryMap = computed(() => {
    const map = new Map<string, Category>();
    for (const c of this._rules().categories) {
      map.set(c.id, c);
    }
    return map;
  });

  readonly uncategorizedTransactions = computed(() => {
    const validIds = new Set(this._rules().categories.map((c) => c.id));
    return this._transactions().filter((tx) => this.engine.isUncategorized(tx, validIds));
  });

  readonly uncategorizedCount = computed(() => this.uncategorizedTransactions().length);

  readonly categorizationRate = computed(() => {
    const total = this._transactions().length;
    if (total === 0) return 100;
    const categorized = total - this.uncategorizedCount();
    return Math.round((categorized / total) * 1000) / 10;
  });

  readonly paretoGroups = computed(() =>
    this.engine.buildParetoGroups(this._transactions(), this._rules()),
  );

  async loadProjects(): Promise<DriveProject[]> {
    this._isLoadingProjects.set(true);
    this._syncError.set(null);
    try {
      const list = await this.drive.listProjects();
      this._projects.set(list);
      return list;
    } catch (err) {
      const msg = this.extractError(err, 'Impossible de lister vos projets Google Drive.');
      this._syncError.set(msg);
      this.toast.error('Erreur Google Drive', msg);
      throw err;
    } finally {
      this._isLoadingProjects.set(false);
    }
  }

  async createAndOpenProject(name: string): Promise<DriveProject> {
    this._isLoadingProject.set(true);
    this._syncError.set(null);
    try {
      const project = await this.drive.createProject(name);
      this._projects.update((prev) => [project, ...prev]);
      await this.selectProject(project);
      this.toast.success('Projet créé', `Le dossier « ${project.name} » est prêt sur Google Drive.`);
      return project;
    } catch (err) {
      const msg = this.extractError(err, 'Échec de création du projet.');
      this._syncError.set(msg);
      this.toast.error('Création impossible', msg);
      throw err;
    } finally {
      this._isLoadingProject.set(false);
    }
  }

  async selectProject(project: DriveProject): Promise<void> {
    this._isLoadingProject.set(true);
    this._syncError.set(null);
    this._conflict.set(null);
    try {
      const loaded = await this.drive.openProject(project);
      const categorized = this.engine.categorizeAll(loaded.transactions, loaded.rules);
      categorized.sort((a, b) => b.date.localeCompare(a.date));

      this._projectFiles.set(loaded.files);
      this._rules.set(loaded.rules);
      this._transactions.set(categorized);
      this.saveLastProjectId(project.id);
    } catch (err) {
      const msg = this.extractError(err, `Impossible d’ouvrir le projet « ${project.name} ».`);
      this._syncError.set(msg);
      this.toast.error('Chargement échoué', msg);
      throw err;
    } finally {
      this._isLoadingProject.set(false);
    }
  }

  async tryAutoReopenLastProject(): Promise<boolean> {
    const lastId = this.getLastProjectId();
    if (!lastId) return false;

    try {
      const projects = this._projects().length > 0 ? this._projects() : await this.loadProjects();
      const match = projects.find((p) => p.id === lastId);
      if (!match) return false;
      await this.selectProject(match);
      return true;
    } catch {
      return false;
    }
  }

  async reloadCurrentProject(): Promise<void> {
    const current = this.activeProject();
    if (!current) return;
    await this.selectProject(current);
    this.toast.info('Données synchronisées', 'Les fichiers ont été rechargés depuis Google Drive.');
  }

  closeProject(): void {
    this._projectFiles.set(null);
    this._rules.set(createDefaultRulesConfig());
    this._transactions.set([]);
    this._conflict.set(null);
    this.clearLastProjectId();
  }

  resetAll(): void {
    this.closeProject();
    this._projects.set([]);
    this._syncError.set(null);
    this.drive.clearCache();
  }

  /**
   * Sauvegarde les règles, recatégorise toutes les transactions en mémoire
   * et synchronise `regles.json` + `transactions.json` sur Google Drive.
   */
  async updateRulesAndRecategorize(
    newRules: RulesConfig,
    successMessage = 'Règles enregistrées sur Google Drive.',
    forceOverwrite = false,
  ): Promise<boolean> {
    const files = this._projectFiles();
    if (!files) return false;

    this._isSaving.set(true);
    try {
      const recategorized = this.engine.categorizeAll(this._transactions(), newRules);
      recategorized.sort((a, b) => b.date.localeCompare(a.date));

      const newRulesModTime = await this.drive.saveJsonFile(
        files.rulesFileId,
        newRules,
        files.rulesModifiedTime,
        'rules',
        forceOverwrite,
      );

      const txPayload: TransactionsFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        transactions: recategorized,
      };

      const newTxModTime = await this.drive.saveJsonFile(
        files.transactionsFileId,
        txPayload,
        files.transactionsModifiedTime,
        'transactions',
        forceOverwrite,
      );

      this._rules.set(newRules);
      this._transactions.set(recategorized);
      this._projectFiles.set({
        ...files,
        rulesModifiedTime: newRulesModTime,
        transactionsModifiedTime: newTxModTime,
      });

      this.toast.success('Synchronisé', successMessage);
      return true;
    } catch (err) {
      if (err instanceof DriveConflictError) {
        this._conflict.set({
          fileType: err.fileType,
          localModifiedTime: err.localModifiedTime,
          remoteModifiedTime: err.remoteModifiedTime,
          forceAction: async () => {
            await this.updateRulesAndRecategorize(newRules, successMessage, true);
          },
        });
        return false;
      }
      this.toast.error('Erreur de sauvegarde', this.extractError(err, 'Échec de sauvegarde Drive.'));
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Ajoute rapidement une règle IBAN ou mot-clé (depuis l'écran Pareto ou Règles).
   */
  async addRuleAndRecategorize(params: {
    ruleType: 'iban' | 'keyword';
    pattern: string;
    isRegex?: boolean;
    merchant: string;
    categoryId: string;
  }): Promise<boolean> {
    const current = this._rules();
    const merchant = params.merchant.trim();
    const pattern = params.pattern.trim();
    if (!pattern || !params.categoryId) return false;

    const updated: RulesConfig = {
      categories: [...current.categories],
      ibanRules: { ...current.ibanRules },
      keywordRules: [...current.keywordRules],
    };

    if (params.ruleType === 'iban') {
      const ibanKey = normalizeIban(pattern);
      updated.ibanRules[ibanKey] = {
        merchant: merchant || ibanKey,
        categoryId: params.categoryId,
      };
    } else {
      const newRule: KeywordRule = {
        id: this.generateId('kw'),
        pattern,
        isRegex: Boolean(params.isRegex),
        merchant: merchant || pattern,
        categoryId: params.categoryId,
      };
      updated.keywordRules = [newRule, ...updated.keywordRules];
    }

    return this.updateRulesAndRecategorize(
      updated,
      `Règle « ${merchant || pattern} » ajoutée et transactions recatégorisées.`,
    );
  }

  /**
   * Force ou retire la catégorie manuelle sur une transaction isolée.
   */
  async setManualCategoryOverride(
    transactionId: string,
    categoryId: string | null,
    merchantName?: string,
    forceOverwrite = false,
  ): Promise<boolean> {
    const files = this._projectFiles();
    if (!files) return false;

    const currentRules = this._rules();
    const updatedList = this._transactions().map((tx) => {
      if (tx.id !== transactionId) return tx;

      if (!categoryId || categoryId === UNCATEGORIZED_ID) {
        // Retire l'override manuel et ré-applique les règles
        return this.engine.categorizeTransaction(
          { ...tx, manualOverride: false, categoryId: undefined },
          currentRules,
        );
      }

      return {
        ...tx,
        categoryId,
        merchantName: merchantName !== undefined ? merchantName.trim() || undefined : tx.merchantName,
        manualOverride: true,
      };
    });

    this._isSaving.set(true);
    try {
      const txPayload: TransactionsFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        transactions: updatedList,
      };

      const newTxModTime = await this.drive.saveJsonFile(
        files.transactionsFileId,
        txPayload,
        files.transactionsModifiedTime,
        'transactions',
        forceOverwrite,
      );

      this._transactions.set(updatedList);
      this._projectFiles.set({ ...files, transactionsModifiedTime: newTxModTime });
      this.toast.success('Transaction mise à jour', 'Modification enregistrée sur Google Drive.');
      return true;
    } catch (err) {
      if (err instanceof DriveConflictError) {
        this._conflict.set({
          fileType: err.fileType,
          localModifiedTime: err.localModifiedTime,
          remoteModifiedTime: err.remoteModifiedTime,
          forceAction: async () => {
            await this.setManualCategoryOverride(transactionId, categoryId, merchantName, true);
          },
        });
        return false;
      }
      this.toast.error('Erreur de sauvegarde', this.extractError(err, 'Échec de sauvegarde Drive.'));
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Importe de nouvelles transactions dédupliquées, archive les CSV bruts dans `exports_bruts/`
   * et sauvegarde `transactions.json`.
   */
  async commitImportedTransactions(
    newTransactions: Transaction[],
    rawFiles: { fileName: string; rawText: string }[],
    duplicateCount: number,
    forceOverwrite = false,
  ): Promise<{ imported: number; duplicates: number } | null> {
    const files = this._projectFiles();
    if (!files) return null;

    this._isSaving.set(true);
    try {
      const categorizedNew = this.engine.categorizeAll(newTransactions, this._rules());
      const existingIds = new Set(this._transactions().map((t) => t.id));
      const uniqueToAdd = categorizedNew.filter((t) => !existingIds.has(t.id));

      const merged = [...uniqueToAdd, ...this._transactions()].sort((a, b) =>
        b.date.localeCompare(a.date),
      );

      const txPayload: TransactionsFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        transactions: merged,
      };

      const newTxModTime = await this.drive.saveJsonFile(
        files.transactionsFileId,
        txPayload,
        files.transactionsModifiedTime,
        'transactions',
        forceOverwrite,
      );

      // Archive les CSV bruts dans exports_bruts/
      for (const f of rawFiles) {
        await this.drive.uploadRawCsv(files.rawExportsFolderId, f.fileName, f.rawText);
      }

      this._transactions.set(merged);
      this._projectFiles.set({ ...files, transactionsModifiedTime: newTxModTime });

      this.toast.success(
        'Import terminé',
        `${uniqueToAdd.length} nouvelle(s) transaction(s) importée(s), ${duplicateCount} doublon(s) ignoré(s).`,
      );

      return { imported: uniqueToAdd.length, duplicates: duplicateCount };
    } catch (err) {
      if (err instanceof DriveConflictError) {
        this._conflict.set({
          fileType: err.fileType,
          localModifiedTime: err.localModifiedTime,
          remoteModifiedTime: err.remoteModifiedTime,
          forceAction: async () => {
            await this.commitImportedTransactions(newTransactions, rawFiles, duplicateCount, true);
          },
        });
        return null;
      }
      this.toast.error(
        'Échec de l’import',
        this.extractError(err, 'Impossible de sauvegarder les transactions sur Drive.'),
      );
      return null;
    } finally {
      this._isSaving.set(false);
    }
  }

  async resolveConflictReload(): Promise<void> {
    this._conflict.set(null);
    await this.reloadCurrentProject();
  }

  async resolveConflictForceOverwrite(): Promise<void> {
    const active = this._conflict();
    if (!active) return;
    this._conflict.set(null);
    await active.forceAction();
  }

  dismissConflict(): void {
    this._conflict.set(null);
  }

  generateId(prefix = 'id'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private saveLastProjectId(id: string): void {
    try {
      localStorage.setItem(LAST_PROJECT_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  private getLastProjectId(): string | null {
    try {
      return localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private clearLastProjectId(): void {
    try {
      localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private extractError(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return fallback;
  }
}
