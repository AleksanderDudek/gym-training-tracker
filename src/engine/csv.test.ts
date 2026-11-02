import { describe, expect, it } from 'vitest';
import { BOM, bodyCsv, csvCell, csvFormat, csvName, fixed, measuresOf, toCsv, workoutsCsv } from './csv';
import { freshState } from './plan';
import { setBodyWeight } from './body';
import type { AppState, LogEntry } from '../types';

/**
 * Eksport do arkusza: czysty moduł CSV. Po polsku średnik i przecinek dziesiętny (tak otwiera
 * plik polski Excel), po angielsku przecinek i kropka. Testy biegną po polsku, więc format
 * angielski podajemy wprost.
 */

const PL = csvFormat('pl');
const EN = csvFormat('en');

const lines = (csv: string): string[] => csv.split('\r\n').filter(Boolean);

describe('komórki i cudzysłowy', () => {
  it('format idzie za językiem', () => {
    expect(PL).toEqual({ sep: ';', decimal: ',' });
    expect(EN).toEqual({ sep: ',', decimal: '.' });
    expect(csvFormat()).toEqual(PL);
  });

  it('liczby z przecinkiem po polsku i kropką po angielsku, bez separatora tysięcy', () => {
    expect(csvCell(12.5, PL)).toBe('12,5');
    expect(csvCell(12.5, EN)).toBe('12.5');
    expect(csvCell(1250, PL)).toBe('1250');
    expect(csvCell(1 / 3, PL)).toBe('0,33');
    expect(csvCell(fixed(85, 2), PL)).toBe('85,00');
    expect(csvCell(fixed(82.456, 2), EN)).toBe('82.46');
  });

  it('brak danych to pusta komórka, nie zero', () => {
    expect(csvCell(null, PL)).toBe('');
    expect(csvCell(undefined, PL)).toBe('');
    expect(csvCell(Number.NaN, PL)).toBe('');
  });

  it('separator, cudzysłów i koniec linii — w cudzysłowie, cudzysłów podwojony', () => {
    expect(csvCell('Kurczak; ryż', PL)).toBe('"Kurczak; ryż"');
    // Przecinek nie jest separatorem w polskim pliku — zostaje bez cudzysłowu.
    expect(csvCell('1,5 porcji', PL)).toBe('1,5 porcji');
    expect(csvCell('1,5 porcji', EN)).toBe('"1,5 porcji"');
    expect(csvCell('Baton „Mocny” "XL"', PL)).toBe('"Baton „Mocny” ""XL"""');
    expect(csvCell('dwie\nlinie', PL)).toBe('"dwie\nlinie"');
    expect(csvCell('a\rb', EN)).toBe('"a\rb"');
  });

  it('tekst wyglądający na formułę dostaje apostrof — arkusz nic nie uruchomi', () => {
    expect(csvCell('=SUMA(A1:A9)', PL)).toBe("'=SUMA(A1:A9)");
    expect(csvCell('+48 123', PL)).toBe("'+48 123");
    expect(csvCell('@trening', PL)).toBe("'@trening");
    expect(csvCell('-5 kg', PL)).toBe("'-5 kg");
    // Liczba ujemna jest liczbą, nie tekstem.
    expect(csvCell(-5, PL)).toBe('-5');
  });

  it('wiersze kończy CRLF, nagłówek idzie pierwszy', () => {
    expect(toCsv(['A', 'B'], [[1, 'x'], [2.5, null]], PL)).toBe('A;B\r\n1;x\r\n2,5;\r\n');
    expect(toCsv(['A', 'B'], [[2.5, 'x, y']], EN)).toBe('A,B\r\n2.5,"x, y"\r\n');
  });

  it('BOM i nazwa pliku z datą', () => {
    expect(BOM).toBe('﻿');
    expect(csvName('treningi', new Date('2026-11-02T10:00:00Z'))).toBe('gym-tracker-treningi-2026-11-02.csv');
  });
});

const session = (over: Partial<LogEntry> = {}): LogEntry => ({
  date: '2026-10-05T08:00:00.000Z',
  workout: 'Trening A',
  wid: 'A',
  ready: 'ok',
  items: [
    { id: 'goblet', sets: [{ reps: 8, w: 16 }, { reps: 7, w: 16 }], effort: 'solid' },
    { id: 'plank', sets: [{ reps: 45, w: null }], effort: 'easy' },
  ],
  time: { secs: 2730, parts: [] },
  ...over,
});

describe('treningi — wiersz na serię', () => {
  it('data, trening, ćwiczenie po polsku, seria, powtórzenia albo sekundy, ciężar, wysiłek, czas', () => {
    const s = freshState();
    s.log = [session()];
    const out = workoutsCsv(s, PL);
    expect(out.rows).toBe(3);
    expect(lines(out.text)).toEqual([
      'Data;Trening;Ćwiczenie;Seria;Powtórzenia;Sekundy;Ciężar (kg);Wysiłek;Zapas powtórzeń;Czas treningu (min)',
      '2026-10-05;Trening A;Goblet squat;1;8;;16;Solidnie;1–2;45,5',
      '2026-10-05;Trening A;Goblet squat;2;7;;16;Solidnie;1–2;45,5',
      '2026-10-05;Trening A;Deska;1;;45;;Łatwo;3+;45,5',
    ]);
  });

  it('po kolei w czasie; trening bez zegara ma pustą komórkę czasu; ćwiczenie spoza biblioteki zostaje z identyfikatorem', () => {
    const s = freshState();
    s.log = [
      session({ date: '2026-10-07T18:00:00.000Z', workout: 'Mój = trening', wid: 'own-1', items: [{ id: 'znikniete', sets: [{ reps: 5, w: 12.5 }], effort: 'max' }], time: undefined }),
      session(),
    ];
    const rows = lines(workoutsCsv(s, PL).text);
    expect(rows[1]!.startsWith('2026-10-05')).toBe(true);
    expect(rows.at(-1)).toBe('2026-10-07;Mój = trening;znikniete;1;5;;12,5;Na maksa;0;');
  });

  it('pusty dziennik — sam nagłówek i zero wierszy', () => {
    const out = workoutsCsv(freshState(), PL);
    expect(out.rows).toBe(0);
    expect(lines(out.text)).toHaveLength(1);
  });
});

describe('ciało — ważenia i obwody', () => {
  it('ważenia z dwoma miejscami po przecinku, po dniu', () => {
    const s = freshState();
    setBodyWeight(s, 85, '2026-10-02');
    setBodyWeight(s, 84.35, '2026-10-01');
    const out = bodyCsv(s, PL);
    expect(lines(out.text)).toEqual(['Data;Waga (kg)', '2026-10-01;84,35', '2026-10-02;85,00']);
    expect(lines(bodyCsv(s, EN).text)[2]).toBe('2026-10-02,85.00');
  });

  it('obwody, gdy zapis je ma: znane w stałej kolejności, dzień bez ważenia też jest wierszem', () => {
    const s = freshState();
    setBodyWeight(s, 85, '2026-10-02');
    (s as AppState & { measures: unknown }).measures = [
      { day: '2026-10-02', waist: 91.5, thigh: 58 },
      { day: '2026-10-09', waist: 90.2, hips: 101, note: 'rano' },
      { day: 'zepsuty', waist: 80 },
    ];
    expect(lines(bodyCsv(s, PL).text)).toEqual([
      'Data;Waga (kg);Talia (cm);Biodra (cm);Udo (cm)',
      '2026-10-02;85,00;91,5;;58',
      '2026-10-09;;90,2;101;',
    ]);
  });

  it('obwody czytane luźno: słownik dzień → pola, polskie klucze, nieznane pola pod własną nazwą', () => {
    const s = freshState() as AppState & { measures: unknown };
    s.measures = { '2026-10-03': { talia: 92, ramię: 35.5, szyja: 40 }, '2026-10-04': { talia: 'dużo' } };
    expect(measuresOf(s)).toEqual([{ day: '2026-10-03', values: { waist: 92, arm: 35.5, szyja: 40 } }]);
    expect(lines(bodyCsv(s, PL).text)[0]).toBe('Data;Waga (kg);Talia (cm);Ramię (cm);szyja');
  });

  it('bez obwodów w zapisie — tylko waga, a bez niczego — zero wierszy', () => {
    expect(measuresOf(freshState())).toEqual([]);
    expect(bodyCsv(freshState(), PL).rows).toBe(0);
  });
});
