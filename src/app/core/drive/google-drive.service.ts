import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  DriveConflictError,
  DriveDataFileType,
  DriveFileMetadata,
  DriveLoadedFile,
  DriveProject,
  ProjectFiles,
  RulesConfig,
  Transaction,
  TransactionsFile,
  createDefaultRulesConfig,
} from '../../models';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ROOT_FOLDER_NAME = 'Budget_App_Projets';
const RULES_FILENAME = 'regles.json';
const TRANSACTIONS_FILENAME = 'transactions.json';
const RAW_EXPORTS_FOLDER = 'exports_bruts';

interface DriveListResponse {
  files: DriveFileMetadata[];
}

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  private readonly http = inject(HttpClient);
  private rootFolderIdCache: string | null = null;

  clearCache(): void {
    this.rootFolderIdCache = null;
  }

  /**
   * Récupère ou crée automatiquement le dossier racine `Budget_App_Projets/`.
   */
  async ensureRootFolder(): Promise<string> {
    if (this.rootFolderIdCache) {
      return this.rootFolderIdCache;
    }

    const q = [
      `name = '${this.escapeQuery(ROOT_FOLDER_NAME)}'`,
      `mimeType = '${FOLDER_MIME}'`,
      'trashed = false',
    ].join(' and ');

    const existing = await this.listFiles(q, 'modifiedTime desc');
    if (existing.length > 0) {
      this.rootFolderIdCache = existing[0].id;
      return existing[0].id;
    }

    const created = await this.createFolder(ROOT_FOLDER_NAME);
    this.rootFolderIdCache = created.id;
    return created.id;
  }

  /**
   * Liste les dossiers de projets présents dans `Budget_App_Projets/`.
   */
  async listProjects(): Promise<DriveProject[]> {
    const rootId = await this.ensureRootFolder();
    const q = [
      `'${rootId}' in parents`,
      `mimeType = '${FOLDER_MIME}'`,
      'trashed = false',
    ].join(' and ');

    const files = await this.listFiles(q, 'modifiedTime desc');
    return files.map((f) => ({
      id: f.id,
      name: f.name,
      modifiedTime: f.modifiedTime,
    }));
  }

  /**
   * Crée un nouveau projet complet :
   * - Dossier `<nom>`
   * - Sous-dossier `exports_bruts/`
   * - `regles.json` initialisé avec les catégories par défaut
   * - `transactions.json` vide
   */
  async createProject(projectName: string): Promise<DriveProject> {
    const cleanName = projectName.trim();
    if (!cleanName) {
      throw new Error('Le nom du projet ne peut pas être vide.');
    }

    const rootId = await this.ensureRootFolder();

    // Vérifie si un projet du même nom existe déjà
    const duplicateQ = [
      `'${rootId}' in parents`,
      `name = '${this.escapeQuery(cleanName)}'`,
      `mimeType = '${FOLDER_MIME}'`,
      'trashed = false',
    ].join(' and ');
    const duplicates = await this.listFiles(duplicateQ);
    if (duplicates.length > 0) {
      throw new Error(`Un projet nommé « ${cleanName} » existe déjà dans votre Google Drive.`);
    }

    const folder = await this.createFolder(cleanName, rootId);

    const initialRules = createDefaultRulesConfig();
    const initialTransactions: TransactionsFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      transactions: [],
    };

    await Promise.all([
      this.createFolder(RAW_EXPORTS_FOLDER, folder.id),
      this.createJsonFile(RULES_FILENAME, folder.id, initialRules),
      this.createJsonFile(TRANSACTIONS_FILENAME, folder.id, initialTransactions),
    ]);

    return {
      id: folder.id,
      name: folder.name,
      modifiedTime: folder.modifiedTime,
    };
  }

  /**
   * Ouvre un projet existant, garantit la présence de `regles.json`, `transactions.json`
   * et `exports_bruts/`, puis charge leurs contenus et leurs `modifiedTime`.
   */
  async openProject(project: DriveProject): Promise<{
    files: ProjectFiles;
    rules: RulesConfig;
    transactions: Transaction[];
  }> {
    const children = await this.listFiles(`'${project.id}' in parents and trashed = false`);

    let rulesMeta = children.find((f) => f.name === RULES_FILENAME && f.mimeType !== FOLDER_MIME);
    let txMeta = children.find(
      (f) => f.name === TRANSACTIONS_FILENAME && f.mimeType !== FOLDER_MIME,
    );
    let rawFolder = children.find(
      (f) => f.name === RAW_EXPORTS_FOLDER && f.mimeType === FOLDER_MIME,
    );

    if (!rulesMeta) {
      rulesMeta = await this.createJsonFile(RULES_FILENAME, project.id, createDefaultRulesConfig());
    }
    if (!txMeta) {
      txMeta = await this.createJsonFile(TRANSACTIONS_FILENAME, project.id, {
        version: 1,
        updatedAt: new Date().toISOString(),
        transactions: [],
      } satisfies TransactionsFile);
    }
    if (!rawFolder) {
      rawFolder = await this.createFolder(RAW_EXPORTS_FOLDER, project.id);
    }

    const [rulesLoaded, txLoaded] = await Promise.all([
      this.loadJsonFile<Partial<RulesConfig>>(rulesMeta.id),
      this.loadJsonFile<TransactionsFile | Transaction[]>(txMeta.id),
    ]);

    const normalizedRules = this.normalizeRulesConfig(rulesLoaded.data);
    const normalizedTransactions = this.normalizeTransactionsData(txLoaded.data);

    return {
      files: {
        project,
        rulesFileId: rulesLoaded.fileId,
        rulesModifiedTime: rulesLoaded.modifiedTime,
        transactionsFileId: txLoaded.fileId,
        transactionsModifiedTime: txLoaded.modifiedTime,
        rawExportsFolderId: rawFolder.id,
      },
      rules: normalizedRules,
      transactions: normalizedTransactions,
    };
  }

  async loadJsonFile<T>(fileId: string): Promise<DriveLoadedFile<T>> {
    const [meta, content] = await Promise.all([
      this.getFileMetadata(fileId),
      firstValueFrom(
        this.http.get<T>(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
          params: new HttpParams().set('alt', 'media'),
        }),
      ),
    ]);

    return {
      fileId: meta.id,
      modifiedTime: meta.modifiedTime,
      data: content,
    };
  }

  async getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
    return firstValueFrom(
      this.http.get<DriveFileMetadata>(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
        params: new HttpParams().set('fields', 'id,name,mimeType,modifiedTime,size'),
      }),
    );
  }

  /**
   * Sauvegarde un fichier JSON sur Google Drive avec vérification optimiste du `modifiedTime`.
   * Si le fichier distant a changé depuis sa lecture et que `forceOverwrite` est faux,
   * lève une `DriveConflictError`.
   */
  async saveJsonFile<T>(
    fileId: string,
    data: T,
    expectedModifiedTime: string,
    fileType: DriveDataFileType,
    forceOverwrite = false,
  ): Promise<string> {
    if (!forceOverwrite && expectedModifiedTime) {
      const remoteMeta = await this.getFileMetadata(fileId);
      if (remoteMeta.modifiedTime && remoteMeta.modifiedTime !== expectedModifiedTime) {
        throw new DriveConflictError(fileType, expectedModifiedTime, remoteMeta.modifiedTime);
      }
    }

    const updated = await firstValueFrom(
      this.http.patch<DriveFileMetadata>(
        `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}`,
        JSON.stringify(data, null, 2),
        {
          params: new HttpParams().set('uploadType', 'media').set('fields', 'id,modifiedTime'),
          headers: new HttpHeaders({ 'Content-Type': 'application/json; charset=UTF-8' }),
        },
      ),
    );

    return updated.modifiedTime;
  }

  /**
   * Archive un fichier CSV brut dans le sous-dossier `exports_bruts/` du projet.
   */
  async uploadRawCsv(
    rawExportsFolderId: string,
    originalFileName: string,
    csvContent: string,
  ): Promise<DriveFileMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = originalFileName.replace(/[^\w.\-() ]+/g, '_');
    const archiveName = `${timestamp}_${safeName}`;

    return this.uploadMultipartFile(
      {
        name: archiveName,
        parents: [rawExportsFolderId],
        mimeType: 'text/csv',
      },
      csvContent,
      'text/csv; charset=UTF-8',
    );
  }

  async listRawExports(rawExportsFolderId: string): Promise<DriveFileMetadata[]> {
    const q = [`'${rawExportsFolderId}' in parents`, 'trashed = false'].join(' and ');
    return this.listFiles(q, 'modifiedTime desc');
  }

  private async listFiles(query: string, orderBy?: string): Promise<DriveFileMetadata[]> {
    let params = new HttpParams()
      .set('q', query)
      .set('fields', 'files(id,name,mimeType,modifiedTime,size)')
      .set('pageSize', '200')
      .set('spaces', 'drive');

    if (orderBy) {
      params = params.set('orderBy', orderBy);
    }

    const res = await firstValueFrom(
      this.http.get<DriveListResponse>(`${DRIVE_API}/files`, { params }),
    );
    return res.files ?? [];
  }

  private async createFolder(name: string, parentId?: string): Promise<DriveFileMetadata> {
    const metadata: Record<string, unknown> = {
      name,
      mimeType: FOLDER_MIME,
    };
    if (parentId) {
      metadata['parents'] = [parentId];
    }

    return firstValueFrom(
      this.http.post<DriveFileMetadata>(`${DRIVE_API}/files`, metadata, {
        params: new HttpParams().set('fields', 'id,name,mimeType,modifiedTime'),
      }),
    );
  }

  private async createJsonFile<T>(
    name: string,
    parentId: string,
    data: T,
  ): Promise<DriveFileMetadata> {
    return this.uploadMultipartFile(
      {
        name,
        parents: [parentId],
        mimeType: 'application/json',
      },
      JSON.stringify(data, null, 2),
      'application/json; charset=UTF-8',
    );
  }

  private async uploadMultipartFile(
    metadata: Record<string, unknown>,
    content: string,
    contentType: string,
  ): Promise<DriveFileMetadata> {
    const boundary = `-------BudgetPilotBoundary${Date.now().toString(36)}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${contentType}\r\n\r\n` +
      content +
      closeDelimiter;

    return firstValueFrom(
      this.http.post<DriveFileMetadata>(`${DRIVE_UPLOAD_API}/files`, multipartBody, {
        params: new HttpParams()
          .set('uploadType', 'multipart')
          .set('fields', 'id,name,mimeType,modifiedTime,size'),
        headers: new HttpHeaders({
          'Content-Type': `multipart/related; boundary=${boundary}`,
        }),
      }),
    );
  }

  private escapeQuery(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private normalizeRulesConfig(raw: Partial<RulesConfig> | null | undefined): RulesConfig {
    const fallback = createDefaultRulesConfig();
    if (!raw || typeof raw !== 'object') {
      return fallback;
    }
    return {
      categories:
        Array.isArray(raw.categories) && raw.categories.length > 0
          ? raw.categories
          : fallback.categories,
      ibanRules: raw.ibanRules && typeof raw.ibanRules === 'object' ? raw.ibanRules : {},
      keywordRules: Array.isArray(raw.keywordRules) ? raw.keywordRules : [],
    };
  }

  private normalizeTransactionsData(
    raw: TransactionsFile | Transaction[] | null | undefined,
  ): Transaction[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.transactions)) return raw.transactions;
    return [];
  }
}
