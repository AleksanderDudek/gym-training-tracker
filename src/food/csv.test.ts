import { afterEach, describe, expect, it } from 'vitest';
import { csvFormat } from '../engine/csv';
import { foodCsv, foodCsvFromDb } from './csv';
import { DietDb } from './diet/db';
import type { Entry } from './diet/db';

/** Jedzenie do arkusza: wiersz na wpis, po polsku średnik i przecinek dziesiętny. */

const PL = csvFormat('pl');
const EN = csvFormat('en');
const lines = (csv: string): string[] => csv.split('\r\n').filter(Boolean);

const entry = (over: Partial<Entry> & Record<string, unknown> = {}): Entry => ({
  date: '2026-10-05',
  time: '08:10',
  name: 'Owsianka z bananem',
  amountLabel: '1 porcja (350 g)',
  kcal: 412,
  protein: 14.2,
  carbs: 68,
  fat: 9.5,
  source: 'product',
  ...over,
});

describe('jedzenie — wiersz na wpis', () => {
  it('data, godzina, nazwa, ilość, kcal i makro; brak makro to pusta komórka', () => {
    const out = foodCsv(
      [entry({ date: '2026-10-05', time: '13:00', name: 'Zupa; pomidorowa', amountLabel: '1,5 talerza', kcal: 180, protein: null, carbs: null, fat: null, source: 'quick' }), entry()],
      PL,
    );
    expect(out.rows).toBe(2);
    expect(lines(out.text)).toEqual([
      'Data;Godzina;Nazwa;Ilość;kcal;Białko (g);Węglowodany (g);Tłuszcz (g)',
      '2026-10-05;08:10;Owsianka z bananem;1 porcja (350 g);412;14,2;68;9,5',
      '2026-10-05;13:00;"Zupa; pomidorowa";1,5 talerza;180;;;',
    ]);
  });

  it('błonnik, cukry i sól — gdy wpisy je mają; wpis bez nich ma puste komórki', () => {
    const out = foodCsv([entry({ fiber: 7.1, sugars: 15, salt: 0.4 }), entry({ time: '19:00' })], PL);
    expect(lines(out.text)).toEqual([
      'Data;Godzina;Nazwa;Ilość;kcal;Białko (g);Węglowodany (g);Tłuszcz (g);Błonnik (g);Cukry (g);Sól (g)',
      '2026-10-05;08:10;Owsianka z bananem;1 porcja (350 g);412;14,2;68;9,5;7,1;15;0,4',
      '2026-10-05;19:00;Owsianka z bananem;1 porcja (350 g);412;14,2;68;9,5;;;',
    ]);
  });

  it('kolumna tylko dla pola, które ktokolwiek zna', () => {
    const header = lines(foodCsv([entry({ salt: 1.2 }), entry({ fiber: null })], PL).text)[0]!;
    expect(header.endsWith('Tłuszcz (g);Sól (g)')).toBe(true);
  });

  it('po angielsku przecinek i kropka, nazwa z przecinkiem w cudzysłowie', () => {
    const out = foodCsv([entry({ name: 'Chicken, rice', amountLabel: '300 g' })], EN);
    expect(lines(out.text)[1]).toBe('2026-10-05,08:10,"Chicken, rice",300 g,412,14.2,68,9.5');
  });

  it('po dniu i godzinie, niezależnie od kolejności w bazie', () => {
    const out = foodCsv([entry({ date: '2026-10-06', time: '07:00' }), entry({ time: '21:00' }), entry({ time: '06:30' })], PL);
    expect(lines(out.text).slice(1).map((l) => l.slice(0, 16))).toEqual(['2026-10-05;06:30', '2026-10-05;21:00', '2026-10-06;07:00']);
  });
});

describe('jedzenie z bazy', () => {
  let database: DietDb | null = null;
  afterEach(async () => {
    await database?.delete();
    database = null;
  });

  it('czyta cały dziennik z IndexedDB', async () => {
    database = new DietDb('csv-test');
    await database.entries.bulkAdd([entry({ date: '2026-10-07' }), entry()]);
    const out = await foodCsvFromDb(database, PL);
    expect(out.rows).toBe(2);
    expect(lines(out.text)[1]!.startsWith('2026-10-05;')).toBe(true);
  });
});
