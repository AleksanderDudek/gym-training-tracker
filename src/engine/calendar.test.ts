import { describe, expect, it } from 'vitest';
import {
  ALARM_MIN,
  EXPORT_WEEKS,
  NO_DIET,
  TRAIN_AT,
  TRAIN_TIMES,
  calendarEvents,
  calendarIcs,
  cleanCalendarCfg,
  googleLinks,
  kindsAhead,
  shopRrule,
  trainTimeOf,
  trainTitle,
  upcoming,
  type DietCalendar,
  type ToInstant,
} from './calendar';
import { freshState } from './plan';
import { addDays } from './schedule';
import { snapshot } from './snapshot';
import type { AppState, LogEntry } from '../types';

/**
 * Kalendarz liczy z tego samego planu co ekran Dziś i przypomnienia; tu sprawdzamy, co z tego
 * wychodzi w miesiącu, w pliku .ics i w odnośnikach do Kalendarza Google.
 */

// 2026-11-02 to poniedziałek, 2026-11-03 wtorek. Plan „cel-start-30”: pn, śr, pt; trening A i B.
const MONDAY = '2026-11-02';
const TODAY = '2026-11-03';

/** Strefa jak w Warszawie zimą (UTC+1) — niezależnie od strefy maszyny z testami. */
const WARSAW_WINTER: ToInstant = (date, at) => new Date(`${date}T${at}:00+01:00`);

const withPlan = (start = MONDAY): AppState => {
  const s = freshState();
  s.plan = { templateId: 'cel-start-30', start, ticked: {} };
  return s;
};

const log = (date: string, workout = 'Trening A'): LogEntry => ({ date: `${date}T16:00:00.000Z`, workout, ready: 'ok', items: [] });

const diet = (over: Partial<DietCalendar> = {}): DietCalendar => ({ ...NO_DIET, ...over });

const unfold = (ics: string): string[] => ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean);

describe('treningi w kalendarzu', () => {
  it('termin zrobiony, dzisiejszy brak terminu i przyszłe z godziną z ustawień', () => {
    const s = withPlan();
    s.log.push(log(MONDAY));
    const ev = calendarEvents(s, null, MONDAY, addDays(MONDAY, 6), TODAY);
    expect(ev.map((e) => [e.date, e.status, e.at])).toEqual([
      ['2026-11-02', 'done', null],
      ['2026-11-04', 'planned', TRAIN_AT],
      ['2026-11-06', 'planned', TRAIN_AT],
    ]);
    expect(ev[0]!.title).toBe('Trening A');
    expect(ev[1]!.title).toBe('Trening B');
    expect(ev.every((e) => e.kind === 'train')).toBe(true);
  });

  it('nadrobiony termin stoi w dniu treningu i mówi, z którego terminu przyszedł', () => {
    const s = withPlan('2026-10-26');
    s.log.push(log('2026-10-27'));
    const ev = calendarEvents(s, null, '2026-10-26', '2026-10-27', TODAY);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ date: '2026-10-27', status: 'done', note: 'termin z 26.10' });
  });

  it('opuszczony po oknie łaski, do nadrobienia w oknie', () => {
    const s = withPlan('2026-10-26');
    const ev = calendarEvents(s, null, '2026-10-26', '2026-11-02', TODAY);
    expect(ev.map((e) => [e.date, e.status])).toEqual([
      ['2026-10-26', 'missed'],
      ['2026-10-28', 'missed'],
      ['2026-10-30', 'missed'],
      ['2026-11-02', 'open'],
    ]);
  });

  it('trening poza planem jest zrobiony i podpisany', () => {
    const s = withPlan();
    s.log.push(log(MONDAY), log(TODAY, 'Trening B'), log('2026-11-04', 'Mój trening'));
    const ev = calendarEvents(s, null, MONDAY, '2026-11-04', '2026-11-04');
    // Wtorek domknął środę z wyprzedzeniem, więc sesja ze środy jest dodatkowa.
    expect(ev.map((e) => [e.date, e.status, e.note])).toEqual([
      ['2026-11-02', 'done', null],
      ['2026-11-03', 'done', 'termin z 04.11'],
      ['2026-11-04', 'done', 'poza planem'],
    ]);
    expect(ev[2]!.title).toBe('Trening: Mój trening');
  });

  it('bez planu: dni z zapisanym treningiem, kilka treningów jednego dnia razem', () => {
    const s = freshState();
    s.log.push(log('2026-10-20', 'A'), log('2026-10-20', 'B'), log('2026-10-22', 'A'));
    const ev = calendarEvents(s, null, '2026-10-01', '2026-10-31', TODAY);
    expect(ev.map((e) => [e.date, e.title, e.note])).toEqual([
      ['2026-10-20', 'Trening: A + B', null],
      ['2026-10-22', 'Trening: A', null],
    ]);
    expect(trainTitle('trening nóg')).toBe('trening nóg');
    expect(trainTitle('Push')).toBe('Trening: Push');
  });

  it('historia sprzed startu planu nie jest „poza planem”', () => {
    const s = withPlan();
    s.log.push(log('2026-10-10'));
    const ev = calendarEvents(s, null, '2026-10-01', '2026-10-31', TODAY);
    expect(ev).toEqual([expect.objectContaining({ date: '2026-10-10', status: 'done', note: null })]);
  });
});

describe('zakupy i badania', () => {
  it('zakupy w stałe dni tygodnia, z godziną z rytmu', () => {
    const ev = calendarEvents(freshState(), diet({ shop: { kind: 'weekdays', days: [2, 6], at: '17:30' } }), MONDAY, addDays(MONDAY, 13), TODAY);
    expect(ev.map((e) => [e.date, e.kind, e.at])).toEqual([
      ['2026-11-03', 'shop', '17:30'],
      ['2026-11-07', 'shop', '17:30'],
      ['2026-11-10', 'shop', '17:30'],
      ['2026-11-14', 'shop', '17:30'],
    ]);
  });

  it('zakupy co N dni od podanej daty, i tylko od dziś — wstecz rytm nic nie mówi', () => {
    const ev = calendarEvents(freshState(), diet({ shop: { kind: 'every', days: 10, from: '2026-11-07', at: '10:00' } }), '2026-10-25', '2026-11-30', TODAY);
    expect(ev.map((e) => e.date)).toEqual(['2026-11-07', '2026-11-17', '2026-11-27']);
  });

  it('badanie kontrolne o 8:00 z markerami, dni z wynikami jako zrobione', () => {
    const d = diet({ retest: { date: '2026-11-30', markers: ['Ferrytyna', 'Witamina D'] }, labDays: ['2026-10-02'] });
    const ev = calendarEvents(freshState(), d, '2026-10-01', '2026-11-30', TODAY);
    expect(ev.map((e) => [e.date, e.status, e.at, e.note])).toEqual([
      ['2026-10-02', 'done', null, null],
      ['2026-11-30', 'planned', '08:00', 'Ferrytyna, Witamina D'],
    ]);
    expect(ev[1]!.title).toBe('Badanie kontrolne');
  });

  it('badanie kontrolne znika, gdy wyniki z tego dnia już są', () => {
    const d = diet({ retest: { date: '2026-11-30', markers: [] }, labDays: ['2026-11-30'] });
    const ev = calendarEvents(freshState(), d, '2026-11-30', '2026-11-30', TODAY);
    expect(ev.map((e) => e.status)).toEqual(['done']);
    expect(kindsAhead(freshState(), d, TODAY).lab).toBe(false);
  });

  it('jednego dnia: trening, potem zakupy, potem badanie', () => {
    const s = withPlan();
    const d = diet({ shop: { kind: 'weekdays', days: [3], at: '09:00' }, retest: { date: '2026-11-04', markers: [] } });
    expect(calendarEvents(s, d, '2026-11-04', '2026-11-04', TODAY).map((e) => e.kind)).toEqual(['train', 'shop', 'lab']);
  });
});

describe('najbliższe dni', () => {
  it('od dziś na 14 dni, tylko to, co przed nami, razem z terminem do nadrobienia', () => {
    const s = withPlan('2026-10-26');
    s.log.push(log('2026-10-26'), log('2026-10-28'), log('2026-10-30'));
    const d = diet({ shop: { kind: 'weekdays', days: [6], at: '10:00' } });
    const up = upcoming(s, d, TODAY);
    // Poniedziałek 2.11 jeszcze w oknie łaski — stoi na górze listy.
    expect(up[0]).toMatchObject({ date: MONDAY, status: 'open' });
    expect(up.slice(1).every((e) => e.status === 'planned' && e.date >= TODAY && e.date <= '2026-11-16')).toBe(true);
    expect(up.filter((e) => e.kind === 'shop').map((e) => e.date)).toEqual(['2026-11-07', '2026-11-14']);
  });
});

describe('godzina treningu', () => {
  it('domyślnie 18:00, z ustawień — wybrana', () => {
    const s = freshState();
    expect(trainTimeOf(s)).toBe('18:00');
    s.cfg.calendar = { trainAt: '06:30' };
    expect(trainTimeOf(s)).toBe('06:30');
    s.cfg.calendar = { trainAt: '25:00' };
    expect(trainTimeOf(s)).toBe('18:00');
  });

  it('zapis i import: tylko poprawna godzina, reszta znika', () => {
    expect(cleanCalendarCfg({ trainAt: '07:00', extra: 1 })).toEqual({ trainAt: '07:00' });
    expect(cleanCalendarCfg({ trainAt: '7:00' })).toBeUndefined();
    expect(cleanCalendarCfg({ trainAt: 700 })).toBeUndefined();
    expect(cleanCalendarCfg('18:00')).toBeUndefined();
    expect(cleanCalendarCfg([])).toBeUndefined();
    expect(cleanCalendarCfg(null)).toBeUndefined();
  });

  it('lista godzin od 5:00 do 22:00 co pół godziny', () => {
    expect(TRAIN_TIMES[0]).toBe('05:00');
    expect(TRAIN_TIMES.at(-1)).toBe('22:00');
    expect(TRAIN_TIMES).toContain(TRAIN_AT);
  });
});

describe('plik .ics', () => {
  const stamp = new Date('2026-11-03T09:00:00Z');

  it('przyszłe terminy na 12 tygodni, każdy osobno w UTC, z przypomnieniem i stałym UID', () => {
    const s = withPlan();
    s.log.push(log(MONDAY));
    s.cfg.calendar = { trainAt: '19:00' };
    const d = diet({ shop: { kind: 'weekdays', days: [6], at: '10:00' }, retest: { date: '2026-11-30', markers: ['Ferrytyna'] } });
    const { text, count } = calendarIcs(s, d, TODAY, stamp, WARSAW_WINTER);
    const lines = unfold(text);
    const uids = lines.filter((l) => l.startsWith('UID:')).map((l) => l.slice(4));

    // Zrobiony poniedziałek to historia — nie trafia do pliku.
    expect(uids).not.toContain('trening-2026-11-02@gym-tracker');
    expect(uids).toContain('trening-2026-11-04@gym-tracker');
    expect(uids).toContain('zakupy-2026-11-07@gym-tracker');
    expect(uids).toContain('badanie-2026-11-30@gym-tracker');
    expect(new Set(uids).size).toBe(uids.length);
    expect(count).toBe(uids.length);

    // Środa 19:00 w Warszawie zimą to 18:00 UTC.
    const i = lines.indexOf('UID:trening-2026-11-04@gym-tracker');
    expect(lines.slice(i, i + 8)).toEqual(
      expect.arrayContaining(['DTSTART:20261104T180000Z', 'DTEND:20261104T190000Z', 'SUMMARY:Trening B']),
    );
    expect(lines).toContain('DTSTART:20261130T070000Z');
    expect(lines.filter((l) => l.startsWith('TRIGGER:'))).toEqual(
      expect.arrayContaining([`TRIGGER:-PT1H`, 'TRIGGER:-PT30M', 'TRIGGER:-PT13H']),
    );
    expect(ALARM_MIN).toEqual({ train: 60, shop: 30, lab: 780 });

    // Nic dalej niż 12 tygodni, poza badaniem.
    const last = addDays(TODAY, EXPORT_WEEKS * 7 - 1).replace(/-/g, '');
    lines
      .filter((l) => l.startsWith('DTSTART:'))
      .forEach((l) => expect(l.slice(8, 16) <= last).toBe(true));
  });

  it('opis badania bez porad: tylko „zapytaj w laboratorium o przygotowanie”', () => {
    const { text } = calendarIcs(freshState(), diet({ retest: { date: '2026-11-30', markers: ['TSH'] } }), TODAY, stamp, WARSAW_WINTER);
    const desc = unfold(text).find((l) => l.startsWith('DESCRIPTION:'))!;
    expect(desc).toContain('Zapytaj w laboratorium o przygotowanie.');
    expect(desc).toContain('TSH');
  });

  it('badanie kontrolne dalej niż 12 tygodni i tak wchodzi do pliku', () => {
    const far = addDays(TODAY, 120);
    const { text } = calendarIcs(freshState(), diet({ retest: { date: far, markers: [] } }), TODAY, stamp, WARSAW_WINTER);
    expect(text).toContain(`UID:badanie-${far}@gym-tracker`);
  });

  it('pusto, gdy nie ma niczego przed nami', () => {
    const { count, text } = calendarIcs(freshState(), null, TODAY, stamp, WARSAW_WINTER);
    expect(count).toBe(0);
    expect(text).not.toContain('BEGIN:VEVENT');
  });
});

describe('odnośniki do Kalendarza Google', () => {
  it('treningi: co tydzień w dni planu od najbliższego terminu do końca planu', () => {
    const s = withPlan();
    s.log.push(log(MONDAY));
    const links = googleLinks(s, null, TODAY, 'Europe/Warsaw', WARSAW_WINTER);
    expect(Object.keys(links)).toEqual(['train']);
    const q = new URL(links.train!).searchParams;
    expect(q.get('dates')).toBe('20261104T180000/20261104T190000');
    expect(q.get('ctz')).toBe('Europe/Warsaw');
    const days = snapshot(s, TODAY)!.schedule.days;
    const end = days[days.length - 1]!.date;
    // Koniec ostatniego dnia planu w Warszawie (23:59 UTC+1) zapisany w UTC.
    expect(q.get('recur')).toBe(`RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=${end.replace(/-/g, '')}T225900Z`);
    expect(q.get('text')).toContain(snapshot(s, TODAY)!.template.name);
  });

  it('zakupy: tygodniowo w dni rytmu albo codziennie co N dni', () => {
    expect(shopRrule({ kind: 'weekdays', days: [2, 5], at: '10:00' })).toBe('FREQ=WEEKLY;BYDAY=TU,FR');
    expect(shopRrule({ kind: 'every', days: 10, from: '2026-11-07', at: '10:00' })).toBe('FREQ=DAILY;INTERVAL=10');
    expect(shopRrule({ kind: 'every', days: 1, from: '2026-11-07', at: '10:00' })).toBe('FREQ=DAILY');
    const links = googleLinks(freshState(), diet({ shop: { kind: 'every', days: 10, from: '2026-10-28', at: '11:15' } }), TODAY, 'Europe/Warsaw');
    const q = new URL(links.shop!).searchParams;
    expect(q.get('dates')).toBe('20261107T111500/20261107T121500');
    expect(q.get('recur')).toBe('RRULE:FREQ=DAILY;INTERVAL=10');
  });

  it('badanie: jedno wydarzenie o 8:00, tylko gdy przed nami', () => {
    const ahead = googleLinks(freshState(), diet({ retest: { date: '2026-11-30', markers: [] } }), TODAY, 'Europe/Warsaw');
    const q = new URL(ahead.lab!).searchParams;
    expect(q.get('dates')).toBe('20261130T080000/20261130T083000');
    expect(q.has('recur')).toBe(false);
    expect(q.get('details')).toContain('Zapytaj w laboratorium o przygotowanie');
    const past = googleLinks(freshState(), diet({ retest: { date: '2026-10-30', markers: [] } }), TODAY, 'Europe/Warsaw');
    expect(past.lab).toBeUndefined();
  });

  it('bez planu, rytmu i badania — żadnego odnośnika', () => {
    expect(googleLinks(freshState(), null, TODAY, 'Europe/Warsaw')).toEqual({});
    expect(kindsAhead(freshState(), null, TODAY)).toEqual({ train: false, shop: false, lab: false });
  });
});
