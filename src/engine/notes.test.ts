import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import { NOTE_MAX, cleanNote, lastNote, restoreNotes, sessionNote, setLogNotes, setSessionNote } from './notes';
import type { AppState, LogEntry, LogItem, Session } from '../types';

const item = (id: string, note?: string): LogItem => ({
  id,
  sets: [{ reps: 10, w: 16 }],
  effort: 'solid',
  ...(note !== undefined ? { note } : {}),
});

const entry = (date: string, items: LogItem[], note?: string): LogEntry => ({
  date: `${date}T18:00:00.000Z`,
  workout: 'Trening A',
  ready: 'ok',
  items,
  ...(note !== undefined ? { note } : {}),
});

const session = (extra: Partial<Session> = {}): Session => ({
  workout: 'A',
  started: '2026-10-14T17:00:00.000Z',
  ready: 'ok',
  res: {},
  done: {},
  skip: {},
  ...extra,
});

const stateWith = (log: LogEntry[], s: Session | null = null): AppState => {
  const st = freshState();
  st.log = log;
  st.session = s;
  return st;
};

describe('cleanNote', () => {
  it('obcina spacje na brzegach, a pusty tekst i nie-tekst to brak notatki', () => {
    expect(cleanNote('  wyżej siodełko \n')).toBe('wyżej siodełko');
    expect(cleanNote('   ')).toBeUndefined();
    expect(cleanNote('')).toBeUndefined();
    expect(cleanNote(42)).toBeUndefined();
    expect(cleanNote({ note: 'x' })).toBeUndefined();
    expect(cleanNote(null)).toBeUndefined();
  });

  it('przycina do 500 znaków po znakach, nie rozcinając emoji', () => {
    expect(cleanNote('a'.repeat(NOTE_MAX + 20))).toHaveLength(NOTE_MAX);
    const emoji = `${'a'.repeat(NOTE_MAX - 1)}💪💪`;
    const out = cleanNote(emoji)!;
    expect([...out]).toHaveLength(NOTE_MAX);
    expect(out.endsWith('💪')).toBe(true);
  });
});

describe('notatki w trwającej sesji', () => {
  it('zapisuje, zmienia i usuwa notatkę; ostatnia usunięta zabiera całe pole', () => {
    const s = session();
    setSessionNote(s, 'goblet', '  pięty na talerzach ');
    expect(sessionNote(s, 'goblet')).toBe('pięty na talerzach');
    setSessionNote(s, 'curl', 'łokcie przy sobie');
    expect(s.notes).toEqual({ goblet: 'pięty na talerzach', curl: 'łokcie przy sobie' });
    setSessionNote(s, 'goblet', '   ');
    expect(s.notes).toEqual({ curl: 'łokcie przy sobie' });
    setSessionNote(s, 'curl', '');
    expect('notes' in s).toBe(false);
  });

  it('bez sesji albo bez notatki odczyt daje pusty tekst', () => {
    expect(sessionNote(null, 'goblet')).toBe('');
    expect(sessionNote(session(), 'goblet')).toBe('');
  });
});

describe('lastNote', () => {
  it('bierze notatkę z najpóźniejszej sesji, w której ją wpisano, a nie z ostatniej sesji', () => {
    const log = [
      entry('2026-10-01', [item('goblet', 'wyżej siodełko')]),
      entry('2026-10-08', [item('goblet', 'chwyt szerzej')]),
      // Ostatnia sesja bez notatki — „chwyt szerzej” dalej obowiązuje.
      entry('2026-10-12', [item('goblet')]),
    ];
    expect(lastNote(log, 'goblet')).toEqual({ note: 'chwyt szerzej', date: '2026-10-08T18:00:00.000Z' });
  });

  it('kolejność w dzienniku nie ma znaczenia', () => {
    const log = [entry('2026-10-08', [item('goblet', 'nowsza')]), entry('2026-10-01', [item('goblet', 'starsza')])];
    expect(lastNote(log, 'goblet')?.note).toBe('nowsza');
  });

  it('notatka innego ćwiczenia albo jej brak daje null', () => {
    expect(lastNote([entry('2026-10-01', [item('curl', 'łokcie')])], 'goblet')).toBeNull();
    expect(lastNote([], 'goblet')).toBeNull();
  });
});

describe('setLogNotes', () => {
  it('zmienia notatkę treningu i ćwiczeń zapisanego wpisu, pusty tekst usuwa pole', () => {
    const st = stateWith([entry('2026-10-01', [item('goblet', 'stara'), item('curl')], 'po nocce')]);
    const date = st.log[0]!.date;
    expect(setLogNotes(st, date, { note: '', items: { goblet: 'nowa', curl: '  łokcie ' } })).toBe(true);
    const e = st.log[0]!;
    expect('note' in e).toBe(false);
    expect(e.items[0]!.note).toBe('nowa');
    expect(e.items[1]!.note).toBe('łokcie');
    setLogNotes(st, date, { items: { goblet: '' } });
    expect('note' in e.items[0]!).toBe(false);
  });

  it('pomija ćwiczenie spoza wpisu i nie rusza notatki treningu, gdy jej nie podano', () => {
    const st = stateWith([entry('2026-10-01', [item('goblet')], 'po nocce')]);
    setLogNotes(st, st.log[0]!.date, { items: { swing2: 'x' } });
    expect(st.log[0]!.note).toBe('po nocce');
    expect(st.log[0]!.items).toHaveLength(1);
  });

  it('nieznana data zwraca false i niczego nie zmienia', () => {
    const st = stateWith([entry('2026-10-01', [item('goblet')])]);
    const before = JSON.stringify(st.log);
    expect(setLogNotes(st, '2020-01-01T00:00:00.000Z', { note: 'x' })).toBe(false);
    expect(JSON.stringify(st.log)).toBe(before);
  });
});

describe('restoreNotes — wczytanie i import', () => {
  it('odrzuca notatki, które nie są tekstem, i przycina za długie', () => {
    const bad = entry('2026-10-01', [item('goblet'), item('curl')]);
    (bad as unknown as Record<string, unknown>).note = 12;
    (bad.items[0] as unknown as Record<string, unknown>).note = { x: 1 };
    bad.items[1]!.note = `  ${'b'.repeat(NOTE_MAX + 5)}`;
    const st = stateWith([bad, entry('2026-10-02', [item('goblet', '   ')], '  ok  ')]);
    restoreNotes(st);
    expect('note' in st.log[0]!).toBe(false);
    expect('note' in st.log[0]!.items[0]!).toBe(false);
    expect(st.log[0]!.items[1]!.note).toHaveLength(NOTE_MAX);
    expect(st.log[1]!.note).toBe('ok');
    expect('note' in st.log[1]!.items[0]!).toBe(false);
  });

  it('stara kopia bez notatek zostaje bez zmian', () => {
    const st = stateWith([entry('2026-10-01', [item('goblet')])]);
    const before = JSON.stringify(st.log);
    restoreNotes(st);
    expect(JSON.stringify(st.log)).toBe(before);
  });

  it('przesiewa notatki trwającej sesji: zła wartość odpada, pusta mapa znika', () => {
    const s1 = session({ notes: { goblet: ' dobra ', curl: 5 as unknown as string } });
    const st = stateWith([], s1);
    restoreNotes(st);
    expect(st.session!.notes).toEqual({ goblet: 'dobra' });

    const s2 = session({ notes: ['x'] as unknown as Record<string, string> });
    const st2 = stateWith([], s2);
    restoreNotes(st2);
    expect('notes' in st2.session!).toBe(false);
  });

  it('nie wywraca się na uszkodzonym wpisie', () => {
    const st = stateWith([null as unknown as LogEntry, { ...entry('2026-10-01', []), items: 'x' } as unknown as LogEntry]);
    expect(() => restoreNotes(st)).not.toThrow();
  });
});
