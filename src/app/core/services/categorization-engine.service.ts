import { Injectable } from '@angular/core';
import { RulesConfig, Transaction, UNCATEGORIZED_ID } from '../../models';

export interface ParetoGroup {
  key: string;
  groupType: 'iban' | 'keyword';
  iban?: string;
  displayLabel: string;
  suggestedPattern: string;
  suggestedMerchant: string;
  transactions: Transaction[];
  count: number;
  totalSignedAmount: number;
  totalAbsAmount: number;
  sharePct: number;
  cumulativeSharePct: number;
  sampleDetails: string[];
  dateRange: { min: string; max: string };
}

export function normalizeIban(iban: string | undefined | null): string {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').toUpperCase();
}

export function toCleanMerchantName(raw: string): string {
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\b(S\.?A\.?|S\.?R\.?L\.?|S\.?P\.?R\.?L\.?|B\.?V\.?|N\.?V\.?|ASBL)\b/gi, '')
    .trim();
  if (!cleaned) return '';
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-/'])([a-zà-öø-ÿ])/g, (_, sep: string, char: string) => sep + char.toUpperCase());
}

@Injectable({ providedIn: 'root' })
export class CategorizationEngineService {
  /**
   * Applique les règles de catégorisation à une transaction unique (fonction pure).
   * Ordre de priorité :
   * 1. manualOverride (forcé manuellement)
   * 2. ibanRules (correspondance exacte sur IBAN normalisé)
   * 3. keywordRules (regex ou sous-chaîne insensible à la casse sur counterpartyName + " " + details)
   * 4. Non catégorisé (UNCATEGORIZED_ID)
   */
  categorizeTransaction(tx: Transaction, rules: RulesConfig): Transaction {
    const validCategoryIds = new Set(rules.categories.map((c) => c.id));

    if (tx.manualOverride && tx.categoryId && validCategoryIds.has(tx.categoryId)) {
      return { ...tx };
    }

    // 1. Règles IBAN
    const normIban = normalizeIban(tx.counterpartyIban);
    if (normIban) {
      const ibanRule = this.findIbanRule(normIban, rules);
      if (ibanRule && validCategoryIds.has(ibanRule.categoryId)) {
        return {
          ...tx,
          categoryId: ibanRule.categoryId,
          merchantName: ibanRule.merchant || tx.counterpartyName || undefined,
          manualOverride: false,
        };
      }
    }

    // 2. Règles mots-clés / regex
    const haystack = `${tx.counterpartyName ?? ''} ${tx.details ?? ''}`.trim();
    const haystackLower = haystack.toLowerCase();

    for (const rule of rules.keywordRules) {
      if (!rule.pattern || !validCategoryIds.has(rule.categoryId)) continue;

      let matched = false;
      if (rule.isRegex) {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          matched = regex.test(haystack);
        } catch {
          matched = false;
        }
      } else {
        matched = haystackLower.includes(rule.pattern.trim().toLowerCase());
      }

      if (matched) {
        return {
          ...tx,
          categoryId: rule.categoryId,
          merchantName: rule.merchant || tx.counterpartyName || undefined,
          manualOverride: false,
        };
      }
    }

    // 3. Non catégorisé
    return {
      ...tx,
      categoryId: UNCATEGORIZED_ID,
      merchantName: undefined,
      manualOverride: false,
    };
  }

  /**
   * Recatégorise tout le jeu de transactions à partir de la configuration de règles.
   */
  categorizeAll(transactions: Transaction[], rules: RulesConfig): Transaction[] {
    return transactions.map((tx) => this.categorizeTransaction(tx, rules));
  }

  isUncategorized(tx: Transaction, validCategoryIds?: Set<string>): boolean {
    if (!tx.categoryId || tx.categoryId === UNCATEGORIZED_ID) {
      return true;
    }
    if (validCategoryIds && !validCategoryIds.has(tx.categoryId)) {
      return true;
    }
    return false;
  }

  /**
   * Construit les groupes Pareto (80/20) des transactions non catégorisées :
   * - Regroupe par IBAN normalisé si disponible, sinon par nom de contrepartie / motif nettoyé.
   * - Trie par montant total absolu décroissant.
   */
  buildParetoGroups(transactions: Transaction[], rules: RulesConfig): ParetoGroup[] {
    const validIds = new Set(rules.categories.map((c) => c.id));
    const uncategorized = transactions.filter((tx) => this.isUncategorized(tx, validIds));

    if (uncategorized.length === 0) {
      return [];
    }

    const bucketMap = new Map<
      string,
      {
        groupType: 'iban' | 'keyword';
        iban?: string;
        displayLabel: string;
        suggestedPattern: string;
        transactions: Transaction[];
      }
    >();

    for (const tx of uncategorized) {
      const normIban = normalizeIban(tx.counterpartyIban);

      if (normIban) {
        const key = `iban:${normIban}`;
        const existing = bucketMap.get(key);
        if (existing) {
          existing.transactions.push(tx);
          if (!existing.displayLabel && tx.counterpartyName) {
            existing.displayLabel = tx.counterpartyName;
          }
        } else {
          bucketMap.set(key, {
            groupType: 'iban',
            iban: normIban,
            displayLabel: tx.counterpartyName?.trim() || normIban,
            suggestedPattern: normIban,
            transactions: [tx],
          });
        }
      } else {
        const stem = this.extractGroupStem(tx);
        const key = `kw:${stem.toLowerCase()}`;
        const existing = bucketMap.get(key);
        if (existing) {
          existing.transactions.push(tx);
        } else {
          bucketMap.set(key, {
            groupType: 'keyword',
            displayLabel: stem,
            suggestedPattern: stem,
            transactions: [tx],
          });
        }
      }
    }

    const totalVolumeAbs = uncategorized.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const groups: ParetoGroup[] = Array.from(bucketMap.entries())
      .map(([key, bucket]) => {
        const totalSignedAmount = bucket.transactions.reduce((sum, t) => sum + t.amount, 0);
        const totalAbsAmount = bucket.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const sampleDetails = Array.from(
          new Set(
            bucket.transactions
              .map((t) => t.details?.trim() || t.counterpartyName?.trim() || '')
              .filter(Boolean),
          ),
        ).slice(0, 4);

        const dates = bucket.transactions.map((t) => t.date).sort();
        const sharePct = totalVolumeAbs > 0 ? (totalAbsAmount / totalVolumeAbs) * 100 : 0;

        return {
          key,
          groupType: bucket.groupType,
          iban: bucket.iban,
          displayLabel: bucket.displayLabel,
          suggestedPattern: bucket.suggestedPattern,
          suggestedMerchant: toCleanMerchantName(bucket.displayLabel) || bucket.displayLabel,
          transactions: bucket.transactions,
          count: bucket.transactions.length,
          totalSignedAmount,
          totalAbsAmount,
          sharePct,
          cumulativeSharePct: 0,
          sampleDetails,
          dateRange: {
            min: dates[0] ?? '',
            max: dates[dates.length - 1] ?? '',
          },
        };
      })
      .sort((a, b) => b.totalAbsAmount - a.totalAbsAmount);

    let running = 0;
    for (const g of groups) {
      running += g.sharePct;
      g.cumulativeSharePct = Math.min(100, running);
    }

    return groups;
  }

  private findIbanRule(normIban: string, rules: RulesConfig) {
    if (rules.ibanRules[normIban]) {
      return rules.ibanRules[normIban];
    }
    for (const [k, v] of Object.entries(rules.ibanRules)) {
      if (normalizeIban(k) === normIban) {
        return v;
      }
    }
    return undefined;
  }

  /**
   * Extrait un motif stable pour regrouper les paiements par carte / sans IBAN
   * (ex: "PAIEMENT PAR CARTE BANCONTACT DELHAIZE 1234 BRUXELLES" -> "DELHAIZE").
   */
  private extractGroupStem(tx: Transaction): string {
    const rawName = (tx.counterpartyName ?? '').trim();
    if (rawName) {
      const simplified = rawName
        .replace(/\b\d{3,}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return simplified || rawName;
    }

    const details = (tx.details ?? '').trim();
    if (!details) return 'Opération sans libellé';

    // Nettoie les préfixes et métadonnées techniques BNP Paribas Fortis courants
    const cleaned = details
      .replace(
        /^(PAIEMENT AVEC LA CARTE DE DEBIT|PAIEMENT PAR CARTE|PAIEMENT SANS CONTACT|BETALING MET DEBETKAART|BETALING MET KAART|PAIEMENT BANCONTACT|PAIEMENT MAESTRO|PAIEMENT VISA DEBIT|RETRAIT D['’]ESPECES|DOMICILIATION EUROPEENNE|VIREMENT EN EUROS|ORDRE PERMANENT|FRAIS)\s*/gi,
        '',
      )
      .replace(/(?:NUM[EÉ]RO|NUMMER)\s+(?:[0-9X*]{4}\s+){2,3}[0-9X*]{4}/gi, ' ')
      .replace(/REFERENCE\s+BANQUE\s*:.*$/gi, '')
      .replace(/BANKREFERENTIE\s*:.*$/gi, '')
      .replace(/DATE\s+VALEUR\s*:.*$/gi, '')
      .replace(/VALUTADATUM\s*:.*$/gi, '')
      .replace(/\b\d{2}[/.-]\d{2}[/.-]\d{2,4}\b/g, ' ')
      .replace(/\b\d{2}:\d{2}\b/g, ' ')
      .replace(
        /\b(NUM[EÉ]RO|CARTE|BANCONTACT|MAESTRO|VISA|DEBIT|GOOGLE\s+PAY|APPLE\s+PAY|AVEC|PAR|POUR|LE|DU|DE|AU)\b/gi,
        ' ',
      )
      .replace(/[0-9*#/:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleaned.split(' ').filter((w) => w.length >= 2);
    if (words.length === 0) {
      return details.slice(0, 32).trim();
    }
    return words.slice(0, 3).join(' ');
  }
}
