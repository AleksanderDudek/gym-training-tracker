import { afterEach, describe, expect, it } from 'vitest';
import { setBodyWeight } from '../engine/body';
import { num } from '../i18n';
import { freshState } from '../engine/plan';
import { columnName, excelSerial, excelTime, writeXlsx } from '../engine/xlsx';
import type { AppState } from '../types';
import { DietDb } from './diet/db';
import type { DayRow, Entry } from './diet/db';
import { newProfile } from './diet/validate';
import { excelDate, lastRow, readWorkbook, type Sheet } from './diet/xlsx';
import type { LabReport } from './labs/types';
import { buildReport, reportFromDb, reportName } from './report';

/**
 * Raport dla dietetyka albo lekarza: z tego, co zapisano, powstaje plik z arkuszami. Każdy test
 * czyta plik z powrotem czytnikiem planów (`readWorkbook`) — tak, jak otworzy go arkusz.
 */

const NOW = new Date(2026, 10, 3, 21, 0);
const iso = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min).toISOString();

const gym = (): AppState => {
  const s = freshState();
  s.log = [
    {
      // Zamknięty o 19:10, trwał 50 minut — start 18:20 czasu lokalnego.
      date: iso(2026, 11, 2, 19, 10),
      workout: 'Trening A',
      wid: 'nieznany',
      ready: 'ok',
      items: [
        { id: 'goblet', sets: [{ reps: 8, w: 16 }, { reps: 10, w: 16 }], effort: 'solid', note: 'wyżej łokcie' },
        { id: 'plank', sets: [{ reps: 45, w: null }], effort: 'easy' },
      ],
      time: { secs: 3000, parts: [] },
      note: 'Dobry dzień',
    },
    // Bez zegara sesji: tylko zakończenie.
    { date: iso(2026, 9, 1, 8, 0), workout: 'Stary trening', ready: 'low', items: [{ id: 'goblet', sets: [{ reps: 5, w: 12 }], effort: 'max' }] },
  ];
  setBodyWeight(s, 85.4, '2026-11-02');
  setBodyWeight(s, 86, '2026-09-01');
  s.measures = [{ day: '2026-11-02', waist: 92.5, hips: 101 }];
  s.cardio = [
    { kind: 'steps', steps: 9500, key: 'k1', day: '2026-11-02', at: iso(2026, 11, 2, 22, 0) },
    { kind: 'treadmill', kmh: 6, min: 30, grade: 3, key: 'k2', day: '2026-11-03', at: iso(2026, 11, 3, 7, 15) },
  ];
  s.snacks = [{ key: 's1', at: iso(2026, 11, 3, 11, 5), ex: 'goblet', reps: 10, w: 12 }];
  s.cfg.height = 180;
  return s;
};

const entry = (e: Partial<Entry> & Pick<Entry, 'date' | 'time' | 'name' | 'kcal'>): Entry => ({
  amountLabel: '',
  protein: null,
  carbs: null,
  fat: null,
  source: 'quick',
  ...e,
});

const entries: Entry[] = [
  entry({ id: 1, date: '2026-11-02', time: '07:40', name: 'Skyr naturalny', amountLabel: '150 g', kcal: 95, protein: 16.5, carbs: 6, fat: 0.3, source: 'product', key: 'product:5900820000011', fiber: 0, sugars: 6, salt: 0.1 }),
  entry({ id: 2, date: '2026-11-02', time: '13:15', name: 'Obiad', kcal: 650 }),
  entry({ id: 3, date: '2026-11-02', time: '16:00', name: 'Napój słodzony', amountLabel: '330 ml', kcal: 139, carbs: 35, protein: 0, fat: 0, sugars: 35 }),
  entry({ id: 4, date: '2026-11-02', time: '20:30', name: 'Banan + batonik', amountLabel: '2 części', kcal: 300, protein: 5, carbs: 50, fat: 8, source: 'set', key: 'set:7' }),
  // Spoza zakresu 30 dni.
  entry({ id: 5, date: '2026-09-01', time: '09:00', name: 'Owsianka', kcal: 400, protein: 15, carbs: 60, fat: 10 }),
];

const days: DayRow[] = [
  {
    date: '2026-11-02',
    note: 'Ból głowy wieczorem',
    partial: false,
    drinks: [
      { kind: 'water', ml: 500, at: '08:00' },
      { kind: 'coffee', ml: 250, at: '09:00' },
      { kind: 'sweet', ml: 330, at: '16:00', entryId: 3 },
    ],
  },
];

const labs: LabReport[] = [
  {
    id: 1,
    date: '2026-10-20',
    lab: 'Diagnostyka',
    source: 'pdf',
    addedAt: iso(2026, 10, 21, 10, 0),
    results: [
      { marker: 'hgb', value: 12.4, cmp: null, qual: null, printed: '12,4 g/dl', ref: [13.5, 17.5] },
      { marker: 'vitD', value: 24, cmp: null, qual: null, printed: '24 ng/ml', ref: null },
    ],
  },
];

const profile = newProfile({ sex: 'M', age: 34, heightCm: 180, startWeightKg: 88, targetWeightKg: 80, startDate: '2026-09-01' }, '2026-11-03');

const sets = new Map([[7, { name: 'Banan + batonik', parts: [
  { name: 'Banan', amountLabel: '120 g', kcal: 107, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Baton proteinowy', amountLabel: '1 szt.', kcal: 193, protein: 3.7, carbs: 23, fat: 7.6, key: 'product:5901234123457' },
] }]]);

const build = (over: Partial<Parameters<typeof buildReport>[0]> = {}, range: '30' | '90' | 'all' = 'all') =>
  buildReport({ state: gym(), profile, entries, days, sets, labs, labPrefs: null, ...over }, { range, now: NOW });

const open = (over: Parameters<typeof build>[0] = {}, range: '30' | '90' | 'all' = 'all') => readWorkbook(writeXlsx(build(over, range).book));

/** Wiersz arkusza po nagłówkach: { 'Data': …, 'kcal': … }. */
function rowsOf(sheet: Sheet): Record<string, string | number | undefined>[] {
  const heads: string[] = [];
  for (let c = 0; sheet.has(`${columnName(c)}1`); c++) heads.push(String(sheet.get(`${columnName(c)}1`)));
  const out: Record<string, string | number | undefined>[] = [];
  for (let r = 2; r <= lastRow(sheet); r++) out.push(Object.fromEntries(heads.map((h, i) => [h, sheet.get(`${columnName(i)}${r}`)])));
  return out;
}

const date = (v: unknown) => excelDate(v as number);
const time = (v: unknown) => {
  const m = Math.round((v as number) * 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

describe('raport — arkusze', () => {
  it('pełny zapis: wszystkie arkusze z danymi, w ustalonej kolejności', () => {
    const { book, summary } = build();
    expect(book.sheets.map((s) => s.name)).toEqual([
      'Informacje',
      'Dni',
      'Jedzenie',
      'Składniki',
      'Napoje',
      'Treningi',
      'Serie',
      'Ruch',
      'Pomiary',
      'Badania',
    ]);
    expect(summary.sheets.find((s) => s.name === 'Jedzenie')?.rows).toBe(5);
    expect(summary.rows).toBeGreaterThan(20);
  });

  it('Dni: sumy, cele, godziny pierwszego i ostatniego wpisu, napoje, kofeina, waga, kroki, trening', () => {
    const d = rowsOf(open().get('Dni')!).find((r) => date(r['Data']) === '2026-11-02')!;
    expect(d['kcal']).toBe(95 + 650 + 139 + 300);
    expect(d['Cel kcal']).toBe(profile.dailyKcal);
    expect(d['Cel białka (g)']).toBeGreaterThan(100);
    // Obiad bez makro nie robi zera — suma z tych, które znają.
    expect(d['Białko (g)']).toBe(21.5);
    expect(d['Wpisy jedzenia']).toBe(4);
    expect(d['Wpisy bez makro']).toBe(1);
    // Błonnik zna tylko skyr (0 g) — zero jest wtedy prawdziwe.
    expect(d['Błonnik (g)']).toBe(0);
    expect(d['Sól (g)']).toBe(0.1);
    expect(time(d['Pierwszy wpis'])).toBe('07:40');
    expect(time(d['Ostatni wpis'])).toBe('20:30');
    expect(d['Okno jedzenia (h)']).toBe(12.8);
    expect(d['Napoje (ml)']).toBe(1080);
    expect(d['Woda (ml)']).toBe(500);
    expect(d['Kofeina (mg, szacunek)']).toBe(100);
    expect(d['Dziennik dnia']).toBe('Cały dzień zapisany');
    expect(d['Waga (kg)']).toBe(85.4);
    expect(d['Kroki']).toBe(9500);
    expect(d['Treningi']).toBe('Trening A');
    expect(d['Trening (min)']).toBe(50);
    expect(d['Notatka dnia']).toBe('Ból głowy wieczorem');
    expect(d['Dzień tygodnia']).toBe('poniedziałek');

    // Dzień z samym ruchem: puste kcal, a nie zero.
    const move = rowsOf(open().get('Dni')!).find((r) => date(r['Data']) === '2026-11-03')!;
    expect(move['kcal']).toBeUndefined();
    expect(move['Cardio (min)']).toBe(30);
    expect(move['Przekąski ruchowe']).toBe(1);
  });

  it('Jedzenie i Składniki: źródło, EAN, gramy, napój słodzony jako szacunek, części zestawu', () => {
    const wb = open();
    const food = rowsOf(wb.get('Jedzenie')!);
    const skyr = food.find((r) => r['Nazwa'] === 'Skyr naturalny')!;
    expect(date(skyr['Data'])).toBe('2026-11-02');
    expect(time(skyr['Godzina'])).toBe('07:40');
    expect(skyr['Pora (wg godziny)']).toBe('Śniadanie');
    expect(skyr['Kod EAN']).toBe('5900820000011');
    expect(skyr['Gramy']).toBe(150);
    expect(skyr['Źródło danych']).toBe('Produkt (etykieta)');
    expect(skyr['Błonnik (g)']).toBe(0);
    const lunch = food.find((r) => r['Nazwa'] === 'Obiad')!;
    expect(lunch['Białko (g)']).toBeUndefined();
    expect(lunch['Błonnik (g)']).toBeUndefined();
    expect(food.find((r) => r['Nazwa'] === 'Napój słodzony')!['Źródło danych']).toBe('Napój słodzony (szacunek)');

    const parts = rowsOf(wb.get('Składniki')!);
    expect(parts.map((p) => [p['Wpis'], p['Rodzaj'], p['Składnik'], p['Gramy'], p['Kod EAN']])).toEqual([
      ['Banan + batonik', 'Zestaw', 'Banan', 120, undefined],
      ['Banan + batonik', 'Zestaw', 'Baton proteinowy', undefined, '5901234123457'],
    ]);
  });

  it('Napoje: godzina, rodzaj, szacunki tylko tam, gdzie wiadomo', () => {
    const drinks = rowsOf(open().get('Napoje')!);
    expect(drinks.map((d) => [time(d['Godzina']), d['Rodzaj'], d['ml'], d['Kofeina (mg, szacunek)'], d['kcal (szacunek)']])).toEqual([
      ['08:00', 'Woda', 500, 0, 0],
      ['09:00', 'Kawa', 250, 100, undefined],
      ['16:00', 'Napój słodzony', 330, undefined, 139],
    ]);
  });

  it('Treningi i Serie: godzina rozpoczęcia z czasu sesji, bez zegara — tylko zakończenie', () => {
    const wb = open();
    const w = rowsOf(wb.get('Treningi')!);
    expect(w).toHaveLength(2);
    const a = w.find((r) => r['Trening'] === 'Trening A')!;
    expect(date(a['Data'])).toBe('2026-11-02');
    expect(time(a['Rozpoczęcie'])).toBe('18:20');
    expect(time(a['Zakończenie'])).toBe('19:10');
    expect(a['Czas (min)']).toBe(50);
    expect(a['Serie']).toBe(3);
    expect(a['Powtórzenia']).toBe(18);
    expect(a['Sekundy (ćwiczenia na czas)']).toBe(45);
    expect(a['Objętość (kg × powt.)']).toBe(288);
    expect(a['Notatka']).toBe('Dobry dzień');
    const old = w.find((r) => r['Trening'] === 'Stary trening')!;
    expect(old['Rozpoczęcie']).toBeUndefined();
    expect(old['Czas (min)']).toBeUndefined();
    expect(old['Samopoczucie przed']).toBe('Ciężki dzień');

    const sets = rowsOf(wb.get('Serie')!).filter((r) => r['Trening'] === 'Trening A');
    expect(sets.map((s) => [s['Seria'], s['Powtórzenia'], s['Sekundy'], s['Ciężar (kg)'], s['Notatka do ćwiczenia']])).toEqual([
      [1, 8, undefined, 16, 'wyżej łokcie'],
      [2, 10, undefined, 16, 'wyżej łokcie'],
      [1, undefined, 45, undefined, undefined],
    ]);
  });

  it('Ruch, Pomiary i Badania', () => {
    const wb = open();
    const move = rowsOf(wb.get('Ruch')!);
    expect(move.map((m) => m['Rodzaj'])).toEqual(['Kroki', 'Bieżnia', 'Przekąska ruchowa']);
    expect(move[0]!['Godzina']).toBeUndefined();
    expect(move[0]!['Źródło']).toBe('wpisane ręcznie');
    expect(move[1]!['Nachylenie (%)']).toBe(3);
    expect(move[1]!['Droga (km)']).toBe(3);
    expect(move[1]!['kcal ruchu (szacunek)']).toBeGreaterThan(0);
    expect(move[2]!['Powtórzenia']).toBe(10);

    const body = rowsOf(wb.get('Pomiary')!);
    expect(body.map((b) => [date(b['Data']), b['Waga (kg)'], b['Talia (cm)']])).toEqual([
      ['2026-09-01', 86, undefined],
      ['2026-11-02', 85.4, 92.5],
    ]);
    expect(body[1]!['BMI']).toBe(26.4);

    const lab = rowsOf(wb.get('Badania')!);
    const hgb = lab.find((r) => String(r['Badanie']).startsWith('Hemoglobina'))!;
    expect(hgb['Wynik']).toBe(12.4);
    expect(hgb['Zakres od']).toBe(13.5);
    expect(hgb['Źródło zakresu']).toBe('z wydruku laboratorium');
    expect(hgb['Względem zakresu']).toBe('poniżej zakresu');
    expect(hgb['Laboratorium']).toBe('Diagnostyka');
    expect(hgb['Wprowadzono z']).toBe('PDF');
    const d = lab.find((r) => String(r['Badanie']).startsWith('Witamina D'))!;
    expect(d['Źródło zakresu']).toBe('typowy dla dorosłych (aplikacja)');
  });

  it('Informacje: osoba, cele, zakres, lista arkuszy i objaśnienie pustych komórek', () => {
    const info = open().get('Informacje')!;
    const pairs = new Map<string, unknown>();
    for (let r = 2; info.has(`B${r}`) || info.has(`A${r}`); r++) pairs.set(String(info.get(`A${r}`) ?? ''), info.get(`B${r}`));
    expect(pairs.get('Płeć')).toBe('mężczyzna');
    expect(pairs.get('Wiek (lata)')).toBe('34');
    expect(pairs.get('Wzrost (cm)')).toBe('180');
    expect(pairs.get('Dzienny cel kcal (dziś)')).toBe(num(profile.dailyKcal));
    expect(pairs.get('Waga docelowa (kg)')).toBe('80,00');
    expect(String(pairs.get('Zakres'))).toContain('wszystkie zapisane dane: 2026-09-01 – 2026-11-03');
    expect(String(pairs.get('Arkusze w pliku'))).toContain('Jedzenie: 5 wierszy');
    expect(String(pairs.get('Objaśnienia'))).toContain('nigdy zero');
    expect(String(pairs.get('Uwaga'))).toContain('nie jest wyrobem medycznym');
  });
});

describe('raport — zakres i braki', () => {
  it('30 dni: starsze wpisy, ważenia i treningi wypadają', () => {
    const wb = open({}, '30');
    expect(rowsOf(wb.get('Jedzenie')!)).toHaveLength(4);
    expect(rowsOf(wb.get('Treningi')!)).toHaveLength(1);
    expect(rowsOf(wb.get('Pomiary')!)).toHaveLength(1);
    const info = wb.get('Informacje')!;
    expect([...info.values()].some((v) => String(v).includes('ostatnie 30 dni: 2026-10-05 – 2026-11-03'))).toBe(true);
  });

  it('bez profilu diety i bez jedzenia: same treningi, ruch i pomiary; Informacje mówią, czego brak', () => {
    const { book } = build({ profile: null, entries: [], days: [], labs: [] });
    expect(book.sheets.map((s) => s.name)).toEqual(['Informacje', 'Dni', 'Treningi', 'Serie', 'Ruch', 'Pomiary']);
    const wb = readWorkbook(writeXlsx(book));
    const dni = rowsOf(wb.get('Dni')!);
    expect(dni.every((d) => d['Cel kcal'] === undefined && d['kcal'] === undefined)).toBe(true);
    const values = [...wb.get('Informacje')!.values()].map(String);
    expect(values.some((v) => v.startsWith('nie ustawiony'))).toBe(true);
    expect(values).toContain('Jedzenie, Składniki, Napoje, Badania, Urządzenia');
  });

  it('pusty zapis: plik z samymi Informacjami', () => {
    const s = freshState();
    const { book, summary } = buildReport({ state: s, profile: null, entries: [], days: [], sets: new Map(), labs: [], labPrefs: null }, { range: 'all', now: NOW });
    expect(book.sheets.map((x) => x.name)).toEqual(['Informacje']);
    expect(summary.rows).toBe(0);
    expect(readWorkbook(writeXlsx(book)).get('Informacje')!.get('A1')).toBe('Pozycja');
  });

  it('tryb bez liczenia kalorii: bez celów, zjedzone kcal zostają', () => {
    const d = rowsOf(open({ profile: { ...profile, hideKcal: true } }).get('Dni')!).find((r) => date(r['Data']) === '2026-11-02')!;
    expect(d['Cel kcal']).toBeUndefined();
    expect(d['kcal']).toBe(1184);
  });

  it('dane z zegarka: arkusz Urządzenia i bieg z godziną w Ruchu', () => {
    const state = gym();
    const start = new Date(2026, 10, 3, 6, 30);
    state.watch = {
      t: 1,
      got: NOW.toISOString(),
      days: [{ day: '2026-11-03', steps: 12000, m: 9000, floors: 4, active: 35 }],
      acts: [{ start: start.getTime() / 1000, sport: 1, sec: 1800, m: 5000 }],
      health: [{ day: '2026-11-03', rhr: 52, hrMin: 45, hrAvg: 68, hrMax: 160, stress: 30, bbMin: 20, bbMax: 85, sleep: 78 }],
    };
    const wb = readWorkbook(writeXlsx(buildReport({ state, profile, entries, days, sets, labs, labPrefs: null }, { range: 'all', now: NOW }).book));
    const dev = rowsOf(wb.get('Urządzenia')!);
    expect(dev).toHaveLength(1);
    expect(dev[0]!['Tętno spoczynkowe']).toBe(52);
    expect(dev[0]!['Sen (wynik 0–100)']).toBe(78);
    expect(dev[0]!['Sen (min)']).toBeUndefined();
    const run = rowsOf(wb.get('Ruch')!).find((r) => String(r['Rodzaj']).startsWith('Bieg'))!;
    expect(time(run['Godzina'])).toBe('06:30');
    expect(run['Droga (km)']).toBe(5);
    expect(run['Prędkość (km/h)']).toBe(10);
  });
});

describe('raport z bazy', () => {
  const database = new DietDb('raport-test');
  afterEach(async () => {
    await database.delete();
  });

  it('czyta profil, dziennik, dni, zestawy i badania; nazwa pliku z dzisiejszą datą', async () => {
    await database.profile.put({ ...profile, id: 'me' });
    await database.entries.bulkAdd(entries.map(({ id: _id, ...e }) => e));
    await database.days.bulkPut(days);
    await database.sets.put({ ...sets.get(7)!, id: 7 });
    await database.labs.bulkAdd(labs.map(({ id: _id, ...r }) => r));
    // Zepsuty wiersz wypada, zamiast zepsuć plik.
    await database.entries.add({ date: 'nie-data', name: 5 } as unknown as Entry);
    const out = await reportFromDb(gym(), 'all', database, NOW);
    expect(out.name).toBe('gym-tracker-raport-2026-11-03.xlsx');
    expect(reportName(NOW)).toBe(out.name);
    const wb = readWorkbook(out.bytes);
    expect(rowsOf(wb.get('Jedzenie')!)).toHaveLength(5);
    expect(rowsOf(wb.get('Składniki')!)).toHaveLength(2);
    expect(rowsOf(wb.get('Badania')!)).toHaveLength(2);
    expect(out.summary.sheets[0]).toEqual({ name: 'Informacje', rows: expect.any(Number) });
    // Daty i godziny jako liczby seryjne Excela.
    const first = wb.get('Jedzenie')!;
    expect(first.get('A2')).toBe(excelSerial('2026-09-01'));
    expect(first.get('B2')).toBeCloseTo(excelTime('09:00'), 12);
  });
});
