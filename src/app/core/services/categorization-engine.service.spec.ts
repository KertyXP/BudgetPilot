import { TestBed } from '@angular/core/testing';
import { CategorizationEngineService } from './categorization-engine.service';
import { RulesConfig, Transaction, UNCATEGORIZED_ID, createDefaultRulesConfig } from '../../models';

describe('CategorizationEngineService', () => {
  let service: CategorizationEngineService;
  let rules: RulesConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CategorizationEngineService);
    rules = {
      ...createDefaultRulesConfig(),
      ibanRules: {
        BE68539007547034: { merchant: 'Propriétaire Loyer', categoryId: 'logement' },
      },
      keywordRules: [
        {
          id: 'kw_1',
          pattern: 'DELHAIZE',
          isRegex: false,
          merchant: 'Delhaize',
          categoryId: 'alimentation',
        },
        {
          id: 'kw_2',
          pattern: '^SNCB|NMBS',
          isRegex: true,
          merchant: 'SNCB',
          categoryId: 'transports',
        },
      ],
    };
  });

  it('respecte l’ordre de priorité : manualOverride > IBAN > mots-clés/regex > non catégorisé', () => {
    const manualTx: Transaction = {
      id: '1',
      date: '2026-03-01',
      amount: -50,
      currency: 'EUR',
      counterpartyIban: 'BE68539007547034',
      counterpartyName: 'DELHAIZE',
      details: 'Achat exceptionnel',
      categoryId: 'shopping',
      manualOverride: true,
    };
    expect(service.categorizeTransaction(manualTx, rules).categoryId).toBe('shopping');

    const ibanTx: Transaction = {
      id: '2',
      date: '2026-03-02',
      amount: -950,
      currency: 'EUR',
      counterpartyIban: 'BE68 5390 0754 7034',
      counterpartyName: 'DUPONT IMMO',
      details: 'Loyer mars',
    };
    const resIban = service.categorizeTransaction(ibanTx, rules);
    expect(resIban.categoryId).toBe('logement');
    expect(resIban.merchantName).toBe('Propriétaire Loyer');

    const kwTx: Transaction = {
      id: '3',
      date: '2026-03-03',
      amount: -64.2,
      currency: 'EUR',
      counterpartyName: 'AD DELHAIZE IXELLES',
      details: 'Paiement carte',
    };
    const resKw = service.categorizeTransaction(kwTx, rules);
    expect(resKw.categoryId).toBe('alimentation');
    expect(resKw.merchantName).toBe('Delhaize');

    const regexTx: Transaction = {
      id: '4',
      date: '2026-03-04',
      amount: -14.8,
      currency: 'EUR',
      counterpartyName: 'NMBS BRUXELLES',
      details: 'Ticket train',
    };
    expect(service.categorizeTransaction(regexTx, rules).categoryId).toBe('transports');

    const unknownTx: Transaction = {
      id: '5',
      date: '2026-03-05',
      amount: -19.99,
      currency: 'EUR',
      counterpartyName: 'MYSTERY SHOP',
      details: 'Achat divers',
    };
    expect(service.categorizeTransaction(unknownTx, rules).categoryId).toBe(UNCATEGORIZED_ID);
  });

  it('regroupe les transactions non catégorisées pour Pareto et trie par montant absolu décroissant', () => {
    const txs: Transaction[] = [
      {
        id: 'a',
        date: '2026-03-01',
        amount: -20,
        currency: 'EUR',
        counterpartyName: 'CAFE DU COIN',
        details: 'Carte',
        categoryId: UNCATEGORIZED_ID,
      },
      {
        id: 'b',
        date: '2026-03-02',
        amount: -400,
        currency: 'EUR',
        counterpartyIban: 'BE11111111111111',
        counterpartyName: 'ENGIE ELECTRABEL',
        details: 'Acompte gaz',
        categoryId: UNCATEGORIZED_ID,
      },
      {
        id: 'c',
        date: '2026-03-10',
        amount: -400,
        currency: 'EUR',
        counterpartyIban: 'BE11 1111 1111 1111',
        counterpartyName: 'ENGIE ELECTRABEL',
        details: 'Acompte électricité',
        categoryId: UNCATEGORIZED_ID,
      },
    ];

    const groups = service.buildParetoGroups(txs, rules);
    expect(groups.length).toBe(2);
    expect(groups[0].groupType).toBe('iban');
    expect(groups[0].iban).toBe('BE11111111111111');
    expect(groups[0].count).toBe(2);
    expect(groups[0].totalAbsAmount).toBe(800);
    expect(groups[1].displayLabel).toBe('CAFE DU COIN');
    expect(groups[1].totalAbsAmount).toBe(20);
  });
});
