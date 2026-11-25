export interface DriveProject {
  id: string;
  name: string;
  modifiedTime?: string;
  createdTime?: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

export interface DriveLoadedFile<T> {
  fileId: string;
  modifiedTime: string;
  data: T;
}

export interface ProjectFiles {
  project: DriveProject;
  rulesFileId: string;
  rulesModifiedTime: string;
  transactionsFileId: string;
  transactionsModifiedTime: string;
  rawExportsFolderId: string;
}

export type DriveDataFileType = 'rules' | 'transactions';

export class DriveConflictError extends Error {
  constructor(
    public readonly fileType: DriveDataFileType,
    public readonly localModifiedTime: string,
    public readonly remoteModifiedTime: string,
  ) {
    super(
      `Conflit détecté sur ${fileType === 'rules' ? 'regles.json' : 'transactions.json'} : le fichier a été modifié sur Google Drive depuis son dernier chargement.`,
    );
    this.name = 'DriveConflictError';
  }
}
