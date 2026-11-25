import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import { Transaction } from '../../models';
import { normalizeIban } from './categorization-engine.service';

export interface ParsedCsvFileResult {
  fileName: string;
  detectedEncoding: 'UTF-8' | 'ISO-8859-1 / Windows-1252';
  rawText: string;
  totalRows: number;
  parsedTransactions: Transaction[];
  newTransactions: Transaction[];
  duplicateCount: number;
  warnings: string[];
}

interface ColumnMapping {
  date?: string;
  amount?: string;
  currency?: string;
  counterpartyIban?: string;
  counterpartyName?: string;
  communication?: string;
  details?: string;
  sequenceNumber?: string;
  transactionType?: string;
  status?: string;
  rejectionReason?: string;
}

const REJECTED_STATUS_KEYWORDS = ['refus', 'rejet', 'geweigerd', 'rejected', 'declined', 'annul'];

@Injectable({ providedIn: 'root' })
export class CsvImportService {
  /**
   * Parse un fichier CSV BNP Paribas Fortis (Belgique), déduplique en interne
   * et par rapport aux IDs existants dans `transactions.json`.
   */
  async parseFortisCsvFile(
    file: File,
    existingIds: Set<string>,
  ): Promise<ParsedCsvFileResult> {
    const buffer = await file.arrayBuffer();
    const { text, encoding } = this.decodeBuffer(buffer);
    return this.parseFortisCsvText(text, file.name, encoding, existingIds);
  }

  async parseFortisCsvText(
    rawText: string,
    fileName: string,
    detectedEncoding: 'UTF-8' | 'ISO-8859-1 / Windows-1252',
    existingIds: Set<string>,
  ): Promise<ParsedCsvFileResult> {
    const cleanedText = rawText.replace(/^\uFEFF/, '').trim();
    const warnings: string[] = [];

    if (!cleanedText) {
      return {
        fileName,
        detectedEncoding,
        rawText: cleanedText,
        totalRows: 0,
        parsedTransactions: [],
        newTransactions: [],
        duplicateCount: 0,
        warnings: ['Le fichier CSV est vide.'],
      };
    }

    const delimiter = this.detectDelimiter(cleanedText);
    const parsed = Papa.parse<Record<string, string>>(cleanedText, {
      header: true,
      delimiter,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      for (const err of parsed.errors.slice(0, 5)) {
        warnings.push(`Ligne ${(err.row ?? 0) + 2} : ${err.message}`);
      }
    }

    const headers = parsed.meta.fields ?? [];
    const mapping = this.resolveColumnMapping(headers);

    if (!mapping.date || !mapping.amount) {
      throw new Error(
        `Colonnes obligatoires introuvables dans « ${fileName} » (attendu : Date d'exécution et Montant). Colonnes détectées : ${headers.join(', ') || 'aucune'}.`,
      );
    }

    const parsedTransactions: Transaction[] = [];
    const dailyOccurrenceMap = new Map<string, number>();

    for (let index = 0; index < parsed.data.length; index++) {
      const row = parsed.data[index];
      const rawDate = (row[mapping.date] ?? '').trim();
      const rawAmount = (row[mapping.amount] ?? '').trim();

      if (!rawDate && !rawAmount) {
        continue;
      }

      // Ignore les transactions refusées / rejetées (colonne Statut Fortis)
      const rawStatus = (mapping.status ? row[mapping.status] : '')?.trim() ?? '';
      if (this.isRejectedStatus(rawStatus)) {
        const reason = (mapping.rejectionReason ? row[mapping.rejectionReason] : '')?.trim();
        warnings.push(
          `Ligne ${index + 2} ignorée : opération refusée (${rawStatus}${reason ? ` — ${reason}` : ''}).`,
        );
        continue;
      }

      const isoDate = this.parseDateToIso(rawDate);
      const amount = this.parseEuropeanAmount(rawAmount);

      if (!isoDate) {
        warnings.push(`Ligne ${index + 2} ignorée : date invalide (« ${rawDate} »).`);
        continue;
      }
      if (amount === null) {
        warnings.push(`Ligne ${index + 2} ignorée : montant invalide (« ${rawAmount} »).`);
        continue;
      }

      const currency = (mapping.currency ? row[mapping.currency] : '')?.trim().toUpperCase() || 'EUR';
      const counterpartyIban =
        normalizeIban(mapping.counterpartyIban ? row[mapping.counterpartyIban] : '') || undefined;
      const rawName = (mapping.counterpartyName ? row[mapping.counterpartyName] : '')?.trim() ?? '';
      const rawCommunication =
        (mapping.communication ? row[mapping.communication] : '')?.trim() ?? '';
      const rawDetails = (mapping.details ? row[mapping.details] : '')?.trim() ?? '';
      const txType = (mapping.transactionType ? row[mapping.transactionType] : '')?.trim() ?? '';
      const rawSequence = (mapping.sequenceNumber ? row[mapping.sequenceNumber] : '')?.trim() ?? '';

      // BNP Paribas Fortis met "2026-" (sans numéro après le tiret) pour les opérations
      // pas encore définitivement numérotées : on l'ignore pour ne pas collisionner toutes les lignes !
      const sequenceNumber = this.parseValidSequenceNumber(rawSequence);

      const details = this.combineDetails(rawCommunication, rawDetails, txType);
      const counterpartyName =
        rawName || this.extractCounterpartyFromFortisDetails(rawDetails, rawCommunication, txType);

      const id = await this.computeDeterministicId(
        {
          sequenceNumber,
          date: isoDate,
          amount,
          counterpartyIban,
          counterpartyName,
          details,
        },
        dailyOccurrenceMap,
      );

      parsedTransactions.push({
        id,
        sequenceNumber,
        date: isoDate,
        amount,
        currency,
        counterpartyIban,
        counterpartyName,
        details,
      });
    }

    const seenInImport = new Set<string>();
    const newTransactions: Transaction[] = [];
    let duplicateCount = 0;

    for (const tx of parsedTransactions) {
      if (existingIds.has(tx.id) || seenInImport.has(tx.id)) {
        duplicateCount++;
      } else {
        seenInImport.add(tx.id);
        newTransactions.push(tx);
      }
    }

    return {
      fileName,
      detectedEncoding,
      rawText: cleanedText,
      totalRows: parsed.data.length,
      parsedTransactions,
      newTransactions,
      duplicateCount,
      warnings,
    };
  }

  /**
   * Valide un numéro de séquence BNP Paribas Fortis.
   * Rejette les préfixes incomplets comme "2026-" (opérations en cours de comptabilisation)
   * qui provoqueraient des faux doublons si utilisés comme ID unique.
   */
  parseValidSequenceNumber(raw: string): string | undefined {
    const cleaned = raw.replace(/\s+/g, '').toUpperCase();
    if (!cleaned) return undefined;
    // Ex: "2026-" ou "-" -> incomplet, pas encore attribué par la banque
    if (cleaned.endsWith('-') || /^\d{4}-0*$/.test(cleaned)) {
      return undefined;
    }
    return cleaned;
  }

  /**
   * Extrait le nom réel du commerçant depuis le champ Détails d'un paiement par carte
   * BNP Paribas Fortis lorsque "Nom de la contrepartie" est vide.
   *
   * Exemple réel :
   * "PAIEMENT AVEC LA CARTE DE DEBIT NUMERO 4871 04XX XXXX 8858 DR LAURENT GUIOT NAMUR 24/11/2026 VISA DEBIT - Google Pay REFERENCE BANQUE : 2611251424241850 DATE VALEUR : 24/11/2026"
   * -> "DR LAURENT GUIOT NAMUR"
   */
  extractCounterpartyFromFortisDetails(
    details: string,
    communication: string,
    txType: string,
  ): string {
    const source = (details || communication || '').replace(/\s+/g, ' ').trim();
    if (!source) {
      return txType || 'Inconnu';
    }

    // 1. Pattern carte bancaire Fortis : "... NUMERO <carte masquée> <COMMERÇANT> <DD/MM/YYYY> ..."
    const cardPattern =
      /(?:NUM[EÉ]RO|NUMMER|CARD)\s+(?:[0-9X*]{4}\s+){2,3}[0-9X*]{4}\s+(.+?)(?:\s+\d{2}[/.-]\d{2}[/.-]\d{2,4}\b|\s+(?:BANCONTACT|VISA|MAESTRO|MASTERCARD|DEBIT|REFERENCE\s+BANQUE|BANKREFERENTIE|DATE\s+VALEUR|VALUTADATUM)\b|$)/i;
    const cardMatch = cardPattern.exec(source);
    if (cardMatch?.[1]) {
      const merchant = cardMatch[1].replace(/\s+/g, ' ').trim();
      if (merchant.length >= 2) {
        return merchant;
      }
    }

    // 2. Fallback si pas de numéro de carte masqué : retire les métadonnées techniques Fortis
    const stripped = source
      .replace(
        /^(PAIEMENT\s+AVEC\s+LA\s+CARTE\s+DE\s+DEBIT|PAIEMENT\s+PAR\s+CARTE|PAIEMENT\s+SANS\s+CONTACT|BETALING\s+MET\s+DEBETKAART|BETALING\s+MET\s+KAART|RETRAIT\s+D['’]ESPECES|DOMICILIATION\s+EUROPEENNE|VIREMENT\s+EN\s+EUROS|ORDRE\s+PERMANENT)\s*/i,
        '',
      )
      .replace(/REFERENCE\s+BANQUE\s*:.*$/i, '')
      .replace(/BANKREFERENTIE\s*:.*$/i, '')
      .replace(/DATE\s+VALEUR\s*:.*$/i, '')
      .replace(/VALUTADATUM\s*:.*$/i, '')
      .replace(/\s+\d{2}[/.-]\d{2}[/.-]\d{2,4}\b.*$/i, '')
      .trim();

    if (stripped.length >= 2) {
      return stripped.slice(0, 80);
    }

    return txType || source.slice(0, 60) || 'Inconnu';
  }

  /**
   * Calcule un ID déterministe SHA-256 :
   * - Si `sequenceNumber` valide est présent : SHA-256 de `fortis-seq:<sequenceNumber>`
   * - Sinon : SHA-256 de `date|amount|iban|name|details#<occurrence_journalière>`
   */
  async computeDeterministicId(
    fields: {
      sequenceNumber?: string;
      date: string;
      amount: number;
      counterpartyIban?: string;
      counterpartyName: string;
      details: string;
    },
    dailyOccurrenceMap: Map<string, number>,
  ): Promise<string> {
    if (fields.sequenceNumber) {
      const normalizedSeq = fields.sequenceNumber.replace(/\s+/g, '').toUpperCase();
      return this.sha256Hex(`fortis-seq:${normalizedSeq}`);
    }

    const baseSignature = [
      fields.date,
      fields.amount.toFixed(2),
      fields.counterpartyIban ?? '',
      fields.counterpartyName.trim().toUpperCase(),
      fields.details.trim().toUpperCase(),
    ].join('|');

    const occurrence = (dailyOccurrenceMap.get(baseSignature) ?? 0) + 1;
    dailyOccurrenceMap.set(baseSignature, occurrence);

    return this.sha256Hex(`${baseSignature}#${occurrence}`);
  }

  parseEuropeanAmount(raw: string): number | null {
    if (!raw) return null;
    let cleaned = raw
      .trim()
      .replace(/\u00A0/g, '')
      .replace(/\s+/g, '')
      .replace(/€/g, '')
      .replace(/EUR/gi, '');

    if (!cleaned) return null;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        // Format européen : 1.250,50
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Format anglo-saxon : 1,250.50
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Format européen : -12,50
      cleaned = cleaned.replace(',', '.');
    }

    const num = Number(cleaned);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * 100) / 100;
  }

  parseDateToIso(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // YYYY-MM-DD
    const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(trimmed);
    if (isoMatch) {
      return this.formatValidDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }

    // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY (standard Fortis)
    const euMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
    if (euMatch) {
      return this.formatValidDate(Number(euMatch[3]), Number(euMatch[2]), Number(euMatch[1]));
    }

    return null;
  }

  private combineDetails(communication: string, details: string, txType: string): string {
    const cleanComm = communication.replace(/\s+/g, ' ').trim();
    const cleanDetails = details.replace(/\s+/g, ' ').trim();

    if (cleanComm && cleanDetails) {
      if (cleanDetails.toLowerCase().includes(cleanComm.toLowerCase())) {
        return cleanDetails;
      }
      return `${cleanComm} — ${cleanDetails}`;
    }

    return cleanDetails || cleanComm || txType || '';
  }

  private isRejectedStatus(status: string): boolean {
    if (!status) return false;
    const norm = this.normalizeHeader(status);
    return REJECTED_STATUS_KEYWORDS.some((kw) => norm.includes(kw));
  }

  private formatValidDate(year: number, month: number, day: number): string | null {
    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      return null;
    }
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  private decodeBuffer(buffer: ArrayBuffer): {
    text: string;
    encoding: 'UTF-8' | 'ISO-8859-1 / Windows-1252';
  } {
    try {
      const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      return { text: utf8, encoding: 'UTF-8' };
    } catch {
      const latin = new TextDecoder('windows-1252').decode(buffer);
      return { text: latin, encoding: 'ISO-8859-1 / Windows-1252' };
    }
  }

  private detectDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;
    return semicolons >= commas ? ';' : ',';
  }

  private resolveColumnMapping(headers: string[]): ColumnMapping {
    const normalizedHeaders = headers.map((original) => ({
      original,
      norm: this.normalizeHeader(original),
    }));

    const findMatch = (candidates: string[], fallbackIncludes?: string[]): string | undefined => {
      for (const candidate of candidates) {
        const exact = normalizedHeaders.find((h) => h.norm === candidate);
        if (exact) return exact.original;
      }
      if (fallbackIncludes) {
        for (const inc of fallbackIncludes) {
          const partial = normalizedHeaders.find((h) => h.norm.includes(inc));
          if (partial) return partial.original;
        }
      }
      return undefined;
    };

    return {
      sequenceNumber: findMatch(
        [
          'n de sequence',
          'no de sequence',
          'numero de sequence',
          'sequence',
          'volgnummer',
          'sequence number',
        ],
        ['sequence', 'volgnummer'],
      ),
      date: findMatch(
        [
          'date d execution',
          'date execution',
          'date operation',
          'date de valeur',
          'date valeur',
          'date',
          'uitvoeringsdatum',
          'valutadatum',
          'execution date',
          'value date',
        ],
        ['execution', 'uitvoeringsdatum', 'date'],
      ),
      amount: findMatch(['montant', 'bedrag', 'amount'], ['montant', 'bedrag', 'amount']),
      currency: findMatch(
        ['devise du compte', 'devise', 'munt', 'valuta', 'currency'],
        ['devise', 'munt', 'currency'],
      ),
      counterpartyIban: findMatch(
        [
          'contrepartie',
          'compte de la contrepartie',
          'compte contrepartie',
          'numero de compte de la contrepartie',
          'iban de la contrepartie',
          'tegenpartij',
          'rekening tegenpartij',
          'counterparty account',
          'counterparty iban',
          'iban',
        ],
        ['compte de la contrepartie', 'compte contrepartie', 'rekening tegenpartij', 'iban'],
      ),
      counterpartyName: findMatch(
        [
          'nom de la contrepartie',
          'nom contrepartie',
          'naam van de tegenpartij',
          'naam tegenpartij',
          'counterparty name',
          'beneficiaire',
        ],
        [
          'nom de la contrepartie',
          'nom contrepartie',
          'naam van de tegenpartij',
          'counterparty name',
        ],
      ),
      communication: findMatch(
        ['communication', 'mededeling', 'message'],
        ['communication', 'mededeling'],
      ),
      details: findMatch(
        ['details', 'libelle', 'description', 'omschrijving'],
        ['detail', 'libelle', 'omschrijving', 'description'],
      ),
      transactionType: findMatch(
        ['type de transaction', 'type operation', 'type', 'transactietype', 'transaction type'],
        ['type de transaction', 'transactietype'],
      ),
      status: findMatch(['statut', 'status'], ['statut', 'status']),
      rejectionReason: findMatch(
        ['motif du refus', 'raison du refus', 'reden van weigering', 'rejection reason'],
        ['refus', 'weigering', 'rejection'],
      ),
    };
  }

  private normalizeHeader(header: string): string {
    return header
      .replace(/[º°]/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, ' ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private async sha256Hex(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const bytes = new Uint8Array(hashBuffer);
    let hex = '';
    for (const b of bytes) {
      hex += b.toString(16).padStart(2, '0');
    }
    return hex;
  }
}
