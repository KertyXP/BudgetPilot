import { TestBed } from '@angular/core/testing';
import { CsvImportService } from './csv-import.service';

describe('CsvImportService (BNP Paribas Fortis)', () => {
  let service: CsvImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CsvImportService);
  });

  it('parse correctement les montants au format européen et anglo-saxon', () => {
    expect(service.parseEuropeanAmount('-12,50')).toBe(-12.5);
    expect(service.parseEuropeanAmount('-4.00')).toBe(-4);
    expect(service.parseEuropeanAmount('1.250,00')).toBe(1250);
    expect(service.parseEuropeanAmount('-1 250,75 €')).toBe(-1250.75);
    expect(service.parseEuropeanAmount('+2500,00')).toBe(2500);
    expect(service.parseEuropeanAmount('42.90')).toBe(42.9);
    expect(service.parseEuropeanAmount('')).toBeNull();
  });

  it('parse correctement les dates DD/MM/YYYY en ISO YYYY-MM-DD', () => {
    expect(service.parseDateToIso('15/03/2026')).toBe('2026-03-15');
    expect(service.parseDateToIso('25/11/2026')).toBe('2026-11-25');
    expect(service.parseDateToIso('01-12-2025')).toBe('2025-12-01');
    expect(service.parseDateToIso('2026-04-20')).toBe('2026-04-20');
    expect(service.parseDateToIso('31/02/2026')).toBeNull();
  });

  it('parse le format réel BNP Paribas Fortis (Nº de séquence incomplet "2026-", paiement carte, Statut Accepté/Refusé, Communication + Détails)', async () => {
    const csv = [
      "Nº de séquence;Date d'exécution;Date valeur;Montant;Devise du compte;Numéro de compte;Type de transaction;Contrepartie;Nom de la contrepartie;Communication;Détails;Statut;Motif du refus",
      '2026-;25/11/2026;24/11/2026;-4.00;EUR;BE75001744947851;Paiement par carte;;;;PAIEMENT AVEC LA CARTE DE DEBIT NUMERO 4871 04XX XXXX 8858 DR LAURENT GUIOT NAMUR 24/11/2026 VISA DEBIT - Google Pay REFERENCE BANQUE : 2611251424241850 DATE VALEUR : 24/11/2026 ;Accepté;',
      '2026-;25/11/2026;24/11/2026;-18.50;EUR;BE75001744947851;Paiement par carte;;;;PAIEMENT AVEC LA CARTE DE DEBIT NUMERO 4871 04XX XXXX 8858 DELHAIZE NAMUR 24/11/2026 BANCONTACT REFERENCE BANQUE : 2611251424249999 DATE VALEUR : 24/11/2026 ;Accepté;',
      '2026-0142;20/11/2026;20/11/2026;-750.00;EUR;BE75001744947851;Virement en euros;BE68539007547034;PROPRIETAIRE IMMO;Loyer novembre 2026;VIREMENT EUROPEEN;Accepté;',
      '2026-;19/11/2026;19/11/2026;-50.00;EUR;BE75001744947851;Paiement par carte;;;;PAIEMENT ECHOUE;Refusé;Solde insuffisant',
    ].join('\n');

    const res = await service.parseFortisCsvText(csv, 'CSV_2026-11-25-20.28.csv', 'UTF-8', new Set());

    // La ligne "Refusé" est ignorée avec un avertissement
    expect(res.warnings.length).toBe(1);
    expect(res.warnings[0]).toContain('Refusé');
    expect(res.warnings[0]).toContain('Solde insuffisant');

    // Les 2 lignes avec "2026-" ne doivent PAS entrer en collision entre elles !
    expect(res.parsedTransactions.length).toBe(3);
    expect(res.newTransactions.length).toBe(3);
    expect(res.duplicateCount).toBe(0);

    const card1 = res.newTransactions[0];
    expect(card1.sequenceNumber).toBeUndefined();
    expect(card1.date).toBe('2026-11-25');
    expect(card1.amount).toBe(-4);
    expect(card1.counterpartyIban).toBeUndefined();
    expect(card1.counterpartyName).toBe('DR LAURENT GUIOT NAMUR');

    const card2 = res.newTransactions[1];
    expect(card2.sequenceNumber).toBeUndefined();
    expect(card2.counterpartyName).toBe('DELHAIZE NAMUR');
    expect(card2.id).not.toBe(card1.id);

    const wire = res.newTransactions[2];
    expect(wire.sequenceNumber).toBe('2026-0142');
    expect(wire.counterpartyIban).toBe('BE68539007547034');
    expect(wire.counterpartyName).toBe('PROPRIETAIRE IMMO');
    expect(wire.details).toContain('Loyer novembre 2026');
    expect(wire.details).toContain('VIREMENT EUROPEEN');
  });

  it('déduplique par numéro de séquence valide et gère 2 paiements identiques le même jour sans séquence', async () => {
    const csv = [
      "Numéro de séquence;Date d'exécution;Date valeur;Montant;Devise du compte;Compte de la contrepartie;Nom de la contrepartie;Détails",
      '2026-0001;15/03/2026;15/03/2026;-45,80;EUR;BE68 5390 0754 7034;DELHAIZE SA;PAIEMENT PAR CARTE DELHAIZE',
      '2026-0001;15/03/2026;15/03/2026;-45,80;EUR;BE68 5390 0754 7034;DELHAIZE SA;PAIEMENT PAR CARTE DELHAIZE',
      ';16/03/2026;16/03/2026;-3,50;EUR;;BOULANGERIE PAUL;CAFE MATIN',
      ';16/03/2026;16/03/2026;-3,50;EUR;;BOULANGERIE PAUL;CAFE MATIN',
      '2026-0002;17/03/2026;17/03/2026;2.850,00;EUR;BE12 0010 0000 0000;EMPLOYEUR SA;SALAIRE MARS',
    ].join('\n');

    const firstPass = await service.parseFortisCsvText(csv, 'fortis_mars.csv', 'UTF-8', new Set());

    expect(firstPass.parsedTransactions.length).toBe(5);
    expect(firstPass.newTransactions.length).toBe(4);
    expect(firstPass.duplicateCount).toBe(1);

    const existingIds = new Set(firstPass.newTransactions.map((t) => t.id));
    const secondPass = await service.parseFortisCsvText(
      csv,
      'fortis_mars.csv',
      'UTF-8',
      existingIds,
    );
    expect(secondPass.newTransactions.length).toBe(0);
    expect(secondPass.duplicateCount).toBe(5);
  });
});
