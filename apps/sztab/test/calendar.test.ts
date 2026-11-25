import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BookingRow, SlotRow } from '../src/lib/data';

/**
 * Kalendarz wizyt bez sieci: tydzień od poniedziałku, powtarzanie co tydzień przez zmianę czasu,
 * formularz „Nowy termin” i plik .ics (ucieczki, łamanie wierszy, UTC, odwołane).
 *
 * Strefa Europe/Warsaw na czas pliku — powtarzanie przez koniec i początek czasu letniego ma
 * sprawdzać prawdziwe przestawienie zegarów, także na maszynie w UTC.
 */

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'pl';
});

const TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Warsaw';
});
afterAll(() => {
  if (TZ === undefined) delete process.env.TZ;
  else process.env.TZ = TZ;
});

const cal = await import('../src/lib/calendar');
const { addDays, dayKey, defaultStart, draftProblems, draftRows, slotsIcs, startOfWeek, videoLink, weekGrid, weeklyStarts } = cal;

const H = 3_600_000;

describe('tydzień', () => {
  it('poniedziałek o północy — od środy, od niedzieli i od samego poniedziałku', () => {
    expect(dayKey(startOfWeek(new Date(2026, 10, 25, 15, 30)))).toBe('2026-11-23');
    expect(dayKey(startOfWeek(new Date(2026, 10, 29, 23, 59)))).toBe('2026-11-23');
    const mon = startOfWeek(new Date(2026, 10, 23, 0, 0));
    expect(dayKey(mon)).toBe('2026-11-23');
    expect(mon.getHours()).toBe(0);
  });

  it('tydzień ze zmianą czasu: siedem dni kalendarzowych, każdy od północy', () => {
    const mon = startOfWeek(new Date(2026, 9, 28));
    const days = weekGrid(mon, []);
    expect(days.map((d) => d.key)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    const backThen = weekGrid(startOfWeek(new Date(2026, 9, 21)), []);
    expect(backThen.at(-1)!.key).toBe('2026-10-25');
    expect(backThen.every((d) => d.date.getHours() === 0)).toBe(true);
    expect(dayKey(addDays(new Date(2026, 9, 24), 1))).toBe('2026-10-25');
    expect(dayKey(addDays(new Date(2026, 9, 25), 1))).toBe('2026-10-26');
  });

  it('terminy w swoich dniach, od najwcześniejszego; spoza tygodnia odpadają; dziś i miniony dzień', () => {
    const mon = new Date(2026, 10, 23);
    const at = (d: number, h: number, m = 0) => ({ startsAt: new Date(2026, 10, d, h, m).toISOString(), id: `${d}-${h}` });
    const days = weekGrid(mon, [at(26, 18), at(24, 7, 30), at(26, 9), at(30, 10), at(22, 23)], new Date(2026, 10, 25, 12));
    expect(days.map((d) => d.slots.map((s) => s.id))).toEqual([[], ['24-7'], [], ['26-9', '26-18'], [], [], []]);
    expect(days.map((d) => d.today)).toEqual([false, false, true, false, false, false, false]);
    expect(days.map((d) => d.past)).toEqual([true, true, false, false, false, false, false]);
  });
});

describe('powtarzanie co tydzień', () => {
  it('przez koniec czasu letniego: ta sama godzina na zegarze, w UTC 169 godzin odstępu', () => {
    const starts = weeklyStarts('2026-10-20', '18:00', 3);
    expect(starts.map(dayKey)).toEqual(['2026-10-20', '2026-10-27', '2026-11-03']);
    expect(starts.every((d) => d.getHours() === 18 && d.getMinutes() === 0)).toBe(true);
    expect(starts.map((d) => d.toISOString())).toEqual(['2026-10-20T16:00:00.000Z', '2026-10-27T17:00:00.000Z', '2026-11-03T17:00:00.000Z']);
    expect((starts[1]!.getTime() - starts[0]!.getTime()) / H).toBe(169);
  });

  it('przez początek czasu letniego: 167 godzin odstępu, dalej 7:30', () => {
    const starts = weeklyStarts('2027-03-23', '07:30', 2);
    expect(starts.map((d) => d.toISOString())).toEqual(['2027-03-23T06:30:00.000Z', '2027-03-30T05:30:00.000Z']);
    expect((starts[1]!.getTime() - starts[0]!.getTime()) / H).toBe(167);
  });

  it('liczba tygodni w granicach 1–12; zła data albo godzina — nic', () => {
    expect(weeklyStarts('2026-12-01', '09:00', 40)).toHaveLength(12);
    expect(weeklyStarts('2026-12-01', '09:00', 0)).toHaveLength(1);
    expect(weeklyStarts('2026-02-30', '09:00', 2)).toEqual([]);
    expect(weeklyStarts('2026-12-01', '24:00', 2)).toEqual([]);
    expect(weeklyStarts('2026-12-01', '9:00', 2)).toEqual([]);
  });

  it('wiersze do zapisu: koniec to prawdziwe minuty od początku (także w nocy zmiany czasu)', () => {
    const base = { title: '  Trening personalny ', capacity: 2, place: ' Studio ', note: '', repeat: true, weeks: 2 };
    const rows = draftRows({ ...base, date: '2026-10-25', time: '01:30', minutes: 120 });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.endsAt.getTime() - rows[0]!.startsAt.getTime()).toBe(2 * H);
    // 01:30 w czasie letnim + 2 h prawdziwego czasu = 02:30 po cofnięciu zegarów.
    expect(rows[0]!.endsAt.getHours()).toBe(2);
    expect(rows[0]).toMatchObject({ title: 'Trening personalny', place: 'Studio', capacity: 2 });
    expect(draftRows({ ...base, repeat: false, date: '2026-12-01', time: '09:00', minutes: 45 })).toHaveLength(1);
  });
});

describe('formularz „Nowy termin”', () => {
  const now = new Date(2026, 10, 25, 12, 0);
  const ok = { date: '2026-11-26', time: '18:00', minutes: 60, title: 'Trening personalny', capacity: 1, place: '', note: '', repeat: false, weeks: 4 };

  it('poprawny formularz przechodzi; link https i adres sali też', () => {
    expect(draftProblems(ok, now)).toEqual([]);
    expect(draftProblems({ ...ok, place: 'https://meet.example.com/abc-def' }, now)).toEqual([]);
    expect(draftProblems({ ...ok, place: 'Studio, ul. Długa 5' }, now)).toEqual([]);
    expect(draftProblems({ ...ok, repeat: true, weeks: 12 }, now)).toEqual([]);
  });

  it('każde pole ze swoim problemem', () => {
    expect(draftProblems({ ...ok, date: '' }, now)).toEqual(['date']);
    expect(draftProblems({ ...ok, time: '25:00' }, now)).toEqual(['time']);
    expect(draftProblems({ ...ok, date: '2026-11-25', time: '11:59' }, now)).toEqual(['past']);
    expect(draftProblems({ ...ok, minutes: 0 }, now)).toEqual(['minutes']);
    expect(draftProblems({ ...ok, minutes: 721 }, now)).toEqual(['minutes']);
    expect(draftProblems({ ...ok, minutes: Number.NaN }, now)).toEqual(['minutes']);
    expect(draftProblems({ ...ok, title: '   ' }, now)).toEqual(['title']);
    expect(draftProblems({ ...ok, title: 'x'.repeat(81) }, now)).toEqual(['title']);
    expect(draftProblems({ ...ok, capacity: 0 }, now)).toEqual(['capacity']);
    expect(draftProblems({ ...ok, capacity: 51 }, now)).toEqual(['capacity']);
    expect(draftProblems({ ...ok, capacity: 1.5 }, now)).toEqual(['capacity']);
    expect(draftProblems({ ...ok, place: 'http://meet.example.com/abc' }, now)).toEqual(['link']);
    expect(draftProblems({ ...ok, place: 'www.zoom.us/j/1' }, now)).toEqual(['link']);
    expect(draftProblems({ ...ok, place: 'x'.repeat(301) }, now)).toEqual(['place']);
    expect(draftProblems({ ...ok, note: 'x'.repeat(501) }, now)).toEqual(['note']);
    expect(draftProblems({ ...ok, repeat: true, weeks: 1 }, now)).toEqual(['weeks']);
    expect(draftProblems({ ...ok, repeat: true, weeks: 13 }, now)).toEqual(['weeks']);
    // Liczba tygodni bez powtarzania nie ma znaczenia.
    expect(draftProblems({ ...ok, repeat: false, weeks: 99 }, now)).toEqual([]);
  });

  it('domyślny początek: wybrany dzień o 18:00; dziś wieczorem najbliższa pełna godzina, późno — jutro', () => {
    expect(defaultStart('2026-11-27', now)).toEqual({ date: '2026-11-27', time: '18:00' });
    expect(defaultStart('2026-11-20', now)).toEqual({ date: '2026-11-25', time: '18:00' });
    expect(defaultStart(null, new Date(2026, 10, 25, 19, 40))).toEqual({ date: '2026-11-25', time: '20:00' });
    expect(defaultStart(null, new Date(2026, 10, 25, 22, 5))).toEqual({ date: '2026-11-26', time: '18:00' });
  });

  it('link do rozmowy rozpoznany tylko jako pełny https', () => {
    expect(videoLink('https://meet.example.com/abc')).toBe('https://meet.example.com/abc');
    expect(videoLink('https://meet example.com')).toBeNull();
    expect(videoLink('https://intranet/x')).toBeNull();
    expect(videoLink('ftp://example.com')).toBeNull();
    expect(videoLink(null)).toBeNull();
  });
});

describe('plik .ics', () => {
  const slot = (over: Partial<SlotRow> = {}): SlotRow => ({
    id: 's1',
    startsAt: '2026-12-01T17:00:00.000Z',
    endsAt: '2026-12-01T18:00:00.000Z',
    capacity: 2,
    title: 'Trening personalny',
    place: null,
    note: null,
    cancelledAt: null,
    ...over,
  });
  const booking = (id: string, connectionId: string, cancelled = false): BookingRow => ({
    id,
    slotId: 's1',
    connectionId,
    createdAt: '2026-11-20T10:00:00.000Z',
    cancelledAt: cancelled ? '2026-11-21T10:00:00.000Z' : null,
    cancelledBy: cancelled ? 'client' : null,
  });
  const opts = { stamp: new Date('2026-11-25T12:00:00Z'), name: 'Wizyty — GYM TRACKER Sztab' };
  const unfold = (ics: string) => ics.replace(/\r\n /g, '');

  it('czasy w UTC, CRLF, stały UID, zapisani tylko nieodwołani, miejsce z ucieczkami', () => {
    const ics = slotsIcs(
      [slot({ place: 'Studio; sala 2, ul. Długa 5', note: 'Weź ręcznik\nI wodę' })],
      [booking('b1', 'c1'), booking('b2', 'c2', true)],
      (id) => (id === 'c1' ? 'GT-AB12-CD34 · Jan, wtorki' : 'GT-XXXX-YYYY'),
      opts,
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
    const flat = unfold(ics);
    expect(flat).toContain('UID:termin-s1@gym-tracker-sztab\r\n');
    expect(flat).toContain('DTSTAMP:20261125T120000Z\r\n');
    expect(flat).toContain('DTSTART:20261201T170000Z\r\nDTEND:20261201T180000Z\r\n');
    expect(flat).toContain('SUMMARY:Trening personalny · 1/2\r\n');
    expect(flat).toContain('LOCATION:Studio\\; sala 2\\, ul. Długa 5\r\n');
    expect(flat).toContain('DESCRIPTION:Zapisani (1 z 2): GT-AB12-CD34 · Jan\\, wtorki\\nWeź ręcznik\\nI wodę\r\n');
    expect(flat).not.toContain('GT-XXXX-YYYY');
    expect(flat).toContain('STATUS:CONFIRMED\r\n');
  });

  it('link do rozmowy jako URL (bez LOCATION), odwołany termin jako CANCELLED, pusty — „nikt”', () => {
    const ics = unfold(slotsIcs([slot({ place: 'https://meet.example.com/abc', cancelledAt: '2026-11-24T08:00:00Z' })], [], () => '', opts));
    expect(ics).toContain('URL:https://meet.example.com/abc\r\n');
    expect(ics).not.toContain('LOCATION:');
    expect(ics).toContain('DESCRIPTION:Nikt się jeszcze nie zapisał (miejsc: 2).\\nRozmowa wideo: https://meet.example.com/abc\r\n');
    expect(ics).toContain('STATUS:CANCELLED\r\n');
  });

  it('długie wiersze łamane po 75 oktetach, polskie litery całe', () => {
    const ics = slotsIcs([slot({ note: 'Ćwiczenia źródłowe żółwia: '.repeat(12) })], [], () => '', opts);
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toContain('�');
    expect(unfold(ics)).toContain(`\\n${'Ćwiczenia źródłowe żółwia: '.repeat(12).trim()}`);
  });
});
