export interface Transaction {
  /** Identifiant unique déterministe (basé sur numéro de séquence Fortis ou hash SHA-256) */
  id: string;
  /** Numéro de séquence bancaire BNP Paribas Fortis si disponible */
  sequenceNumber?: string;
  /** Date d'exécution au format ISO YYYY-MM-DD */
  date: string;
  /** Montant signé (négatif = dépense, positif = revenu) */
  amount: number;
  /** Code devise ISO (ex: EUR) */
  currency: string;
  /** IBAN normalisé de la contrepartie (sans espaces, majuscules) */
  counterpartyIban?: string;
  /** Nom de la contrepartie issu de l'extrait bancaire */
  counterpartyName: string;
  /** Communication / libellé complet de l'opération */
  details: string;
  /** ID de la catégorie résolue ou forcée manuellement */
  categoryId?: string;
  /** Nom propre du commerçant résolu par le moteur de règles */
  merchantName?: string;
  /** Vrai si la catégorie a été forcée manuellement sur cette transaction isolée */
  manualOverride?: boolean;
}

export interface TransactionsFile {
  version: number;
  updatedAt: string;
  transactions: Transaction[];
}
