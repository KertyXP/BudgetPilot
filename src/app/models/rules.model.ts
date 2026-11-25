export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isInternalTransfer?: boolean;
}

export interface IbanRuleTarget {
  merchant: string;
  categoryId: string;
}

export interface KeywordRule {
  id: string;
  pattern: string;
  isRegex: boolean;
  merchant: string;
  categoryId: string;
}

export interface RulesConfig {
  categories: Category[];
  ibanRules: Record<string, IbanRuleTarget>;
  keywordRules: KeywordRule[];
}

export const UNCATEGORIZED_ID = 'uncategorized';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'revenus', name: 'Revenus & Salaires', color: '#10b981', icon: 'wallet' },
  { id: 'alimentation', name: 'Alimentation & Courses', color: '#f59e0b', icon: 'shopping-cart' },
  { id: 'logement', name: 'Logement & Charges', color: '#3b82f6', icon: 'home' },
  { id: 'transports', name: 'Transports & Mobilité', color: '#06b6d4', icon: 'car' },
  { id: 'restaurants', name: 'Restaurants & Sorties', color: '#ec4899', icon: 'utensils' },
  { id: 'sante', name: 'Santé & Pharmacie', color: '#ef4444', icon: 'heart' },
  { id: 'abonnements', name: 'Abonnements & Télécoms', color: '#8b5cf6', icon: 'wifi' },
  { id: 'shopping', name: 'Shopping & Achats', color: '#f97316', icon: 'bag' },
  { id: 'loisirs', name: 'Loisirs & Voyages', color: '#14b8a6', icon: 'plane' },
  { id: 'assurances', name: 'Assurances & Banques', color: '#64748b', icon: 'shield' },
  { id: 'epargne', name: 'Épargne & Investissements', color: '#6366f1', icon: 'piggy-bank' },
  {
    id: 'transferts-internes',
    name: 'Transferts internes',
    color: '#94a3b8',
    icon: 'arrows',
    isInternalTransfer: true,
  },
  { id: 'autres', name: 'Autres dépenses', color: '#a8a29e', icon: 'tag' },
];

export function createDefaultRulesConfig(): RulesConfig {
  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    ibanRules: {},
    keywordRules: [],
  };
}
