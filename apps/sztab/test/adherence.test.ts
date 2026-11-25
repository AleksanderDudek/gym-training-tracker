import { describe, expect, it } from 'vitest';
import type { AssignmentBody, AssignmentV1, SnapshotV1 } from '@gymtracker/link';
import { adherence, dayIn, habitCell, lightOf, mealDayCell, weekSummary } from '../src/lib/adherence';
import type { SentAssignment } from '../src/lib/data';

/**
 * Realizacja nawyków i jadłospisu: dni w strefie telefonu, dni po paczce bez „opuszczonych”,
 * procenty z pełnych dni, światła jadłospisu.
 */

const from = { name: 'Anna', profession: 'trainer' as const };

function sent(id: string, body: AssignmentBody, sentAt: string, extra: Partial<SentAssignment> = {}): SentAssignment {
  const envelope: AssignmentV1 = { v: 1, id, area: 'nutrition', sentAt: Date.parse(sentAt), from, body };
  return { id, kind: body.kind, area: 'nutrition', createdAt: sentAt, withdrawnAt: null, visibleFrom: null, envelope, receipt: null, ...extra };
}

const HABITS: AssignmentBody = {
  kind: 'habits',
  title: 'Codzienne',
  note: '',
  until: null,
  items: [
    { label: 'Kreatyna', dose: '5 g', when: 'morning', days: [1, 2, 3, 4, 5, 6, 7] },
    { label: 'Spacer', dose: '', when: 'any', days: [1, 2, 3, 4, 5] },
  ],
};

const meal = (name: string) => ({ slot: '', name, recipe: null, kcal: null, protein: null, carbs: null, fat: null, note: '' });
const MEALS: AssignmentBody = {
  kind: 'meals',
  title: 'Redukcja',
  note: '',
  start: null,
  days: [
    { label: 'Dzień 1', meals: [meal('a'), meal('b'), meal('c')] },
    { label: 'Dzień 2', meals: [meal('d'), meal('e')] },
    { label: 'Dzień 3', meals: [meal('f'), meal('g'), meal('h'), meal('i')] },
  ],
};

function snap(at: string, coaching: unknown, tz = 'Europe/Warsaw'): SnapshotV1 {
  return { v: 1, at: Date.parse(at), tz, lang: 'pl', app: 'test', scopes: [], coaching: coaching as SnapshotV1['coaching'] };
}

// Paczka: środa 25.11 o 10:00 w Warszawie. Prowadzący patrzy w czwartek 26.11.
const SNAP_AT = '2026-11-25T09:00:00Z';
const NOW = Date.parse('2026-11-26T12:00:00Z');

describe('dzień w strefie telefonu', () => {
  it('ta sama chwila to różne dni w różnych strefach', () => {
    const t = Date.parse('2026-11-24T23:30:00Z');
    expect(dayIn('Europe/Warsaw', t)).toBe('2026-11-25');
    expect(dayIn('America/New_York', t)).toBe('2026-11-24');
    expect(dayIn('UTC', t)).toBe('2026-11-24');
  });

  it('strefa nieznana przeglądarce nie wywraca zakładki', () => {
    expect(dayIn('Mars/Olympus_Mons', Date.parse('2026-11-24T12:00:00Z'))).toMatch(/^2026-11-2[345]$/);
  });
});

describe('nawyki', () => {
  // Wysłane w niedzielę 15.11 o 23:30 UTC — w Warszawie to już poniedziałek 16.11, 00:30.
  const list = [sent('h1', HABITS, '2026-11-15T23:30:00Z')];
  const coaching = {
    answers: [],
    meals: [],
    habits: [
      {
        assignmentId: 'h1',
        days: {
          '2026-11-15': [0], // przed wysłaniem (w strefie telefonu) — nie liczy się
          '2026-11-16': [0, 1],
          '2026-11-17': [0],
          '2026-11-18': [0, 1],
          '2026-11-20': [0, 1],
          '2026-11-21': [0],
          '2026-11-22': [0],
          '2026-11-23': [0, 1],
          '2026-11-24': [1],
          '2026-11-25': [0],
          'nie-dzień': [0],
        },
      },
    ],
  };

  it('siatka 14 dni: zrobione, opuszczone, w trakcie, bez danych i poza planem', () => {
    const a = adherence(snap(SNAP_AT, coaching), list, NOW);
    expect(a.snapDay).toBe('2026-11-25');
    expect(a.today).toBe('2026-11-26');
    expect(a.days[0]).toBe('2026-11-13');
    expect(a.days.at(-1)).toBe('2026-11-26');
    const [h] = a.habits;
    expect(h!.sentDay).toBe('2026-11-16');
    // 13–15 przed wysłaniem (15. odhaczony, ale wtedy listy jeszcze nie było), 26. — po paczce.
    expect(h!.rows[0]!.cells).toEqual(['off', 'off', 'off', 'done', 'done', 'done', 'missed', 'done', 'done', 'done', 'done', 'missed', 'done', 'unknown']);
    // Spacer w dni robocze: sobota i niedziela poza planem; środa 25. — dzień paczki, jeszcze czeka.
    expect(h!.rows[1]!.cells).toEqual(['off', 'off', 'off', 'done', 'missed', 'done', 'missed', 'done', 'off', 'off', 'done', 'done', 'pending', 'unknown']);
  });

  it('procenty z pełnych dni przed paczką, dzień paczki osobno', () => {
    const [h] = adherence(snap(SNAP_AT, coaching), list, NOW).habits;
    expect(h!.rows[0]!.week).toEqual({ done: 5, due: 7, pct: 71 });
    expect(h!.rows[1]!.week).toEqual({ done: 4, due: 5, pct: 80 });
    expect(h!.week).toEqual({ done: 9, due: 12, pct: 75 });
    // 30 dni: lista obowiązuje dopiero od 16.11.
    expect(h!.rows[0]!.month).toEqual({ done: 7, due: 9, pct: 78 });
    expect(h!.rows[1]!.month).toEqual({ done: 5, due: 7, pct: 71 });
    expect(h!.snapDay).toEqual({ done: 1, due: 2 });
    expect(h!.reported).toBe(true);
  });

  it('licząc w UTC, prowadzący przesunąłby start o dzień — tu liczy strefa telefonu', () => {
    const utc = adherence(snap(SNAP_AT, coaching, 'UTC'), list, NOW).habits[0]!;
    expect(utc.sentDay).toBe('2026-11-15');
    expect(utc.rows[0]!.cells[2]).toBe('done');
  });

  it('po dacie końca punkty nie obowiązują', () => {
    const body = { ...HABITS, until: '2026-11-20' } as Extract<AssignmentBody, { kind: 'habits' }>;
    expect(habitCell(body, 0, '2026-11-20', { sentDay: '2026-11-16', snapDay: '2026-11-25', ticked: undefined })).toBe('missed');
    expect(habitCell(body, 0, '2026-11-21', { sentDay: '2026-11-16', snapDay: '2026-11-25', ticked: undefined })).toBe('off');
  });

  it('paczka starsza niż lista: nic nie jest opuszczone, procentów brak', () => {
    const late = [sent('h1', HABITS, '2026-11-25T12:00:00Z')];
    const [h] = adherence(snap('2026-11-24T18:00:00Z', { answers: [], habits: [], meals: [] }), late, NOW).habits;
    expect(h!.rows.flatMap((r) => r.cells).filter((c) => c === 'missed')).toEqual([]);
    expect(h!.week.pct).toBeNull();
    expect(h!.snapDay).toBeNull();
    expect(h!.reported).toBe(false);
  });
});

describe('jadłospis', () => {
  // Wysłany w sobotę 21.11 o 23:30 UTC — w Warszawie niedziela 22.11: od niej dzień 1 cyklu.
  const list = [sent('m1', MEALS, '2026-11-21T23:30:00Z')];
  const coaching = {
    answers: [],
    habits: [],
    meals: [{ assignmentId: 'm1', days: { '2026-11-22': [0, 1, 2], '2026-11-23': [0], '2026-11-24': [0], '2026-11-25': [0, 1] } }],
  };

  it('dni cyklu od dnia wysłania w strefie telefonu, światła i pominięte posiłki', () => {
    const [m] = adherence(snap(SNAP_AT, coaching), list, NOW).meals;
    expect(m!.startDay).toBe('2026-11-22');
    const by = Object.fromEntries(m!.days.map((d) => [d.day, d]));
    expect(by['2026-11-21']).toMatchObject({ state: 'before', index: null });
    expect(by['2026-11-22']).toMatchObject({ state: 'complete', index: 0, done: 3, due: 3, light: 'green', missed: [] });
    expect(by['2026-11-23']).toMatchObject({ state: 'complete', index: 1, done: 1, due: 2, light: 'yellow', missed: [1] });
    expect(by['2026-11-24']).toMatchObject({ state: 'complete', index: 2, done: 1, due: 4, light: 'red', missed: [1, 2, 3] });
    // Dzień paczki w trakcie: bez światła i bez „pominiętych”.
    expect(by['2026-11-25']).toMatchObject({ state: 'partial', index: 0, done: 2, due: 3, light: null, missed: [] });
    expect(by['2026-11-26']).toMatchObject({ state: 'unknown', index: 1, done: 0 });
    expect(m!.week).toEqual({ done: 5, due: 9, pct: 56 });
    expect(m!.month).toEqual({ done: 5, due: 9, pct: 56 });
  });

  it('dzień paczki ze wszystkim zjedzonym jest pełny', () => {
    const c = mealDayCell(MEALS as Extract<AssignmentBody, { kind: 'meals' }>, '2026-11-25', {
      sentDay: '2026-11-22',
      snapDay: '2026-11-25',
      ticked: new Set([0, 1, 2]),
    });
    expect(c).toMatchObject({ state: 'complete', light: 'green' });
  });

  it('data startu w przyszłości: wszystko przed startem', () => {
    const later = [sent('m2', { ...MEALS, start: '2026-12-01' } as AssignmentBody, '2026-11-20T10:00:00Z')];
    const [m] = adherence(snap(SNAP_AT, coaching), later, NOW).meals;
    expect(m!.days.every((d) => d.state === 'before')).toBe(true);
    expect(m!.week.pct).toBeNull();
  });

  it('światła: od 80 % zielone, od 50 % żółte, niżej czerwone', () => {
    expect(lightOf(4, 5)).toBe('green');
    expect(lightOf(3, 4)).toBe('yellow');
    expect(lightOf(1, 2)).toBe('yellow');
    expect(lightOf(2, 5)).toBe('red');
    expect(lightOf(0, 0)).toBeNull();
  });
});

describe('wybór zaleceń', () => {
  it('bez wycofanych, nieczytelnych i innych rodzajów; najnowsze pierwsze', () => {
    const list = [
      sent('h-old', HABITS, '2026-11-01T10:00:00Z'),
      sent('h-new', HABITS, '2026-11-20T10:00:00Z'),
      sent('h-gone', HABITS, '2026-11-21T10:00:00Z', { withdrawnAt: '2026-11-22T10:00:00Z' }),
      { ...sent('h-bad', HABITS, '2026-11-21T10:00:00Z'), envelope: null },
      sent('n1', { kind: 'note', title: 'x', text: 'y', checklist: [] }, '2026-11-21T10:00:00Z'),
      sent('m1', MEALS, '2026-11-21T10:00:00Z', { receipt: { v: 1, assignmentId: 'm1', status: 'declined', at: 0, ticked: [], comment: '', updatedAt: '' } }),
    ];
    const a = adherence(snap(SNAP_AT, null), list, NOW);
    expect(a.habits.map((h) => h.id)).toEqual(['h-new', 'h-old']);
    expect(a.meals.map((m) => [m.id, m.status])).toEqual([['m1', 'declined']]);
  });

  it('jedna liczba na tydzień: nawyki i posiłki razem', () => {
    const list = [sent('h1', HABITS, '2026-11-15T23:30:00Z'), sent('m1', MEALS, '2026-11-21T23:30:00Z')];
    const coaching = {
      answers: [],
      habits: [{ assignmentId: 'h1', days: { '2026-11-24': [0, 1] } }],
      meals: [{ assignmentId: 'm1', days: { '2026-11-24': [0, 1, 2, 3] } }],
    };
    const a = adherence(snap(SNAP_AT, coaching), list, NOW);
    // Nawyki: 2 z 12 (tydzień 18–24.11), jadłospis: 4 z 9.
    expect(weekSummary(a)).toEqual({ done: 6, due: 21, pct: 29 });
  });
});
