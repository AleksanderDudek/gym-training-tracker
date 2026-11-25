import { afterAll, describe, expect, it } from 'vitest';

// Daty programu liczą się w czasie przeglądarki — testy zmiany czasu potrzebują strefy z DST.
const prevTz = process.env.TZ;
process.env.TZ = 'Europe/Warsaw';
afterAll(() => {
  if (prevTz === undefined) delete process.env.TZ;
  else process.env.TZ = prevTz;
});

const {
  MAX_DAY,
  MAX_STEPS,
  addLocalDays,
  areaFor,
  datedSteps,
  dayOf,
  duplicateWeek,
  fmtWhen,
  isMissing,
  nextMonday,
  parseDay,
  parseTime,
  planLaunch,
  planRecipients,
  programSummary,
  scheduleAt,
  sortSteps,
  startError,
  stepAt,
  weekOf,
  weeksOf,
} = await import('../src/lib/program');
type LibraryItem = import('../src/lib/data').LibraryItem;
type Connection = import('../src/lib/data').Connection;

const item = (id: string, kind: LibraryItem['kind'], title = id): LibraryItem => ({
  id,
  kind,
  title,
  body: { kind: 'note', title, text: 'x', checklist: [] } as LibraryItem['body'],
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
});

const conn = (id: string, areas: Connection['areas'], status: Connection['status'] = 'active') =>
  ({ id, areas, status, pseudonym: id.padEnd(20, '0').toUpperCase() }) as Connection;

describe('Daty programu: kalendarz przeglądarki', () => {
  it('pilnuje pól: godzina GG:MM, prawdziwy dzień', () => {
    expect(parseTime('07:00')).toEqual([7, 0]);
    expect(parseTime('23:59')).toEqual([23, 59]);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('7:00')).toBeNull();
    expect(parseDay('2026-02-28')).toEqual([2026, 2, 28]);
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('2026-13-01')).toBeNull();
    expect(stepAt('2026-12-01', MAX_DAY + 1, '07:00')).toBeNull();
    expect(stepAt('2026-12-01', 1.5, '07:00')).toBeNull();
  });

  it('marcowa zmiana czasu: 7:00 zostaje 7:00, doba ma 23 godziny', () => {
    const sat = stepAt('2026-03-28', 0, '07:00')!;
    const sun = stepAt('2026-03-28', 1, '07:00')!;
    expect(sat.toISOString()).toBe('2026-03-28T06:00:00.000Z'); // CET, UTC+1
    expect(sun.toISOString()).toBe('2026-03-29T05:00:00.000Z'); // CEST, UTC+2
    expect(sun.getHours()).toBe(7);
    expect(sun.getTime() - sat.getTime()).toBe(23 * 3600_000);
    // 2:30 tej nocy nie istnieje — wypada godzinę później, nie znika.
    expect(stepAt('2026-03-28', 1, '02:30')!.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('październikowa zmiana czasu: doba ma 25 godzin, godzina na zegarku ta sama', () => {
    const sat = stepAt('2026-10-24', 0, '07:00')!;
    const sun = stepAt('2026-10-24', 1, '07:00')!;
    expect(sat.toISOString()).toBe('2026-10-24T05:00:00.000Z');
    expect(sun.toISOString()).toBe('2026-10-25T06:00:00.000Z');
    expect(sun.getTime() - sat.getTime()).toBe(25 * 3600_000);
    const later = datedSteps([{ day: 14, time: '18:15', itemId: 'a' }], '2026-10-20');
    expect(later[0]!.at.getHours()).toBe(18);
    expect(later[0]!.at.getMinutes()).toBe(15);
    expect(later[0]!.at.getDate()).toBe(3);
  });

  it('dni kalendarza dodaje po kalendarzu, nie po 24 h', () => {
    expect(addLocalDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addLocalDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('najbliższy poniedziałek: zawsze po dziś', () => {
    expect(nextMonday(new Date(2026, 10, 25, 12))).toBe('2026-11-30'); // środa
    expect(nextMonday(new Date(2026, 10, 29, 23))).toBe('2026-11-30'); // niedziela
    expect(nextMonday(new Date(2026, 10, 30, 8))).toBe('2026-12-07'); // poniedziałek
  });
});

describe('Tydzień i dzień tygodnia', () => {
  it('tydzień N, dzień D ↔ dzień programu', () => {
    expect(dayOf(1, 1)).toBe(0);
    expect(dayOf(2, 3)).toBe(9);
    expect(weekOf(9)).toEqual({ week: 2, weekday: 3 });
    expect(weekOf(0)).toEqual({ week: 1, weekday: 1 });
    expect(weekOf(MAX_DAY)).toEqual({ week: 53, weekday: 1 });
    for (let d = 0; d <= MAX_DAY; d += 17) {
      const w = weekOf(d);
      expect(dayOf(w.week, w.weekday)).toBe(d);
    }
  });

  it('poza zakresem przycina zamiast psuć', () => {
    expect(dayOf(53, 7)).toBe(MAX_DAY);
    expect(dayOf(0, 0)).toBe(0);
    expect(dayOf(Number.NaN, 9)).toBe(6);
  });
});

describe('Kroki programu', () => {
  const steps = [
    { day: 7, time: '07:00', itemId: 'a' },
    { day: 0, time: '18:00', itemId: 'b' },
    { day: 0, time: '07:00', itemId: 'a' },
    { day: 2, time: '07:00', itemId: 'c' },
  ];

  it('po kolei: dzień, potem godzina — w tygodniach', () => {
    expect(sortSteps(steps).map((s) => `${s.day} ${s.time}`)).toEqual(['0 07:00', '0 18:00', '2 07:00', '7 07:00']);
    const w = weeksOf(steps);
    expect(w.map((g) => g.week)).toEqual([1, 2]);
    expect(w[0]!.steps.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(w[1]!.steps[0]!.index).toBe(3);
    expect(steps[0]!.day).toBe(7); // wejście nietknięte
  });

  it('„Powiel tydzień” dokłada tydzień później, bez dubli', () => {
    const r = duplicateWeek(steps, 1);
    // dzień 7, 7:00, „a” już jest — dochodzą dwa pozostałe.
    expect(r.added).toBe(2);
    expect(r.dropped).toBe(0);
    expect(r.steps.filter((s) => weekOf(s.day).week === 2).map((s) => `${s.day} ${s.time} ${s.itemId}`)).toEqual([
      '7 07:00 a',
      '7 18:00 b',
      '9 07:00 c',
    ]);
    expect(duplicateWeek(r.steps, 1).added).toBe(0);
  });

  it('„Powiel tydzień” na końcu roku i przy limicie kroków — co się nie mieści, przepada', () => {
    const end = duplicateWeek([{ day: 357, time: '07:00', itemId: 'a' }, { day: 359, time: '07:00', itemId: 'b' }], 52);
    expect(end.steps.map((s) => s.day)).toEqual([357, 359, 364]);
    expect(end.dropped).toBe(1);
    const full = Array.from({ length: MAX_STEPS }, (_, i) => ({ day: i % 7, time: `${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, itemId: `x${i}` }));
    const r = duplicateWeek(full, 1);
    expect(r.steps).toHaveLength(MAX_STEPS);
    expect(r.added).toBe(0);
    expect(r.dropped).toBe(MAX_STEPS);
  });

  it('podsumowanie: tygodnie, rodzaje, brakujące elementy', () => {
    const items = [item('a', 'workout'), item('b', 'form'), item('p', 'program')];
    const s = programSummary([...steps, { day: 20, time: '07:00', itemId: 'p' }], items);
    expect(s.days).toBe(21);
    expect(s.weeks).toBe(3);
    expect(s.byKind).toEqual([
      ['workout', 2],
      ['form', 1],
    ]);
    // „c” usunięty z biblioteki, „p” to program — oba się nie wyślą.
    expect(s.missing).toBe(2);
    expect(isMissing({ day: 0, time: '07:00', itemId: 'c' }, items)).toBe(true);
    expect(isMissing({ day: 0, time: '07:00', itemId: 'a' }, items)).toBe(false);
    expect(programSummary([], items)).toEqual({ weeks: 0, days: 0, byKind: [], missing: 0 });
  });
});

describe('Zaplanowana wysyłka', () => {
  const now = new Date(2026, 10, 25, 12, 0).getTime();

  it('w przyszłości, najwyżej rok naprzód', () => {
    const ok = scheduleAt('2026-12-03', '07:00', now);
    expect('at' in ok && ok.at.getTime()).toBe(new Date(2026, 11, 3, 7, 0).getTime());
    expect(scheduleAt('2026-11-25', '11:59', now)).toEqual({ error: 'past' });
    expect(scheduleAt('2026-11-25', '12:00', now)).toEqual({ error: 'past' });
    expect('at' in scheduleAt('2027-11-25', '11:00', now)).toBe(true);
    expect(scheduleAt('2027-11-26', '12:01', now)).toEqual({ error: 'far' });
    expect(scheduleAt('2026-02-30', '07:00', now)).toEqual({ error: 'invalid' });
    expect(scheduleAt('2026-12-03', '', now)).toEqual({ error: 'invalid' });
  });

  it('dzień startu programu: od dziś do roku', () => {
    expect(startError('2026-11-25', now)).toBeNull();
    expect(startError('2026-11-24', now)).toBe('past');
    expect(startError('2027-11-25', now)).toBeNull();
    expect(startError('2027-11-26', now)).toBe('far');
    expect(startError('', now)).toBe('invalid');
  });

  it('start dziś: kroki, których godzina minęła, idą od razu', () => {
    const d = datedSteps(
      [
        { day: 1, time: '07:00', itemId: 'b' },
        { day: 0, time: '07:00', itemId: 'a' },
        { day: 0, time: '18:00', itemId: 'c' },
      ],
      '2026-11-25',
      now,
    );
    expect(d.map((x) => [x.step.itemId, x.now])).toEqual([
      ['a', true],
      ['c', false],
      ['b', false],
    ]);
  });

  it('„3 grudnia, 7:00”, z rokiem tylko gdy inny', () => {
    expect(fmtWhen(new Date(2026, 11, 3, 7, 0), now)).toMatch(/^3 (grudnia|December), 7:00$/);
    expect(fmtWhen(new Date(2027, 0, 5, 18, 30), now)).toMatch(/2027/);
  });
});

describe('Odbiorcy i uruchomienie programu', () => {
  it('obszar: pierwszy z obszarów współpracy, który pozwala na rodzaj', () => {
    expect(areaFor(conn('a', ['training']), 'meals')).toBeNull();
    expect(areaFor(conn('a', ['nutrition', 'training']), 'note')).toBe('nutrition');
    expect(areaFor(conn('a', ['insight', 'training']), 'workout')).toBe('training');
  });

  it('wysyłka do wielu: kto dostaje i w jakim obszarze, kto pominięty i dlaczego', () => {
    const list = [conn('a', ['training']), conn('b', ['nutrition']), conn('c', ['insight']), conn('d', ['nutrition'], 'ended'), conn('b', ['nutrition'])];
    const p = planRecipients(list, 'meals');
    expect(p.send.map((r) => [r.c.id, r.area])).toEqual([['b', 'nutrition']]);
    expect(p.skip.map((s) => [s.c.id, s.reason])).toEqual([
      ['a', 'kind'],
      ['c', 'kind'],
      ['d', 'ended'],
    ]);
    const note = planRecipients(list, 'note');
    expect(note.send.map((r) => r.area)).toEqual(['training', 'nutrition', 'insight']);
  });

  it('każdy krok: element, obszar albo powód pominięcia', () => {
    const items = [item('w', 'workout'), item('m', 'meals'), item('n', 'note'), item('p', 'program')];
    const dated = datedSteps(
      ['w', 'm', 'n', 'gone', 'p'].map((itemId, day) => ({ day, time: '07:00', itemId })),
      '2026-12-01',
      new Date(2026, 10, 25).getTime(),
    );
    const tasks = planLaunch(conn('a', ['training']), dated, items, (i) => i.id !== 'n');
    expect(tasks.map((t) => [t.step.itemId, t.area, t.skip])).toEqual([
      ['w', 'training', null],
      ['m', null, 'kind'],
      ['n', 'training', 'invalid'],
      ['gone', null, 'missing'],
      ['p', null, 'missing'],
    ]);
    expect(tasks[0]!.at.getTime()).toBe(new Date(2026, 11, 1, 7, 0).getTime());
  });
});
