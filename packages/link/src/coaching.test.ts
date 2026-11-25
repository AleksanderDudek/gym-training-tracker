import { describe, expect, it } from 'vitest';
import {
  addDays,
  cleanAnswers,
  cleanCoaching,
  daysBetween,
  formDue,
  formPeriod,
  habitsFor,
  isoWeek,
  mealDayIndex,
  parseAssignment,
  parseMessage,
  parsePhoto,
  weekdayOf,
} from './index';
import type { FormBody } from './index';

const form = (over: Partial<FormBody> = {}): FormBody => ({
  kind: 'form',
  title: 'Check-in',
  intro: '',
  repeat: 'weekly',
  weekday: 5,
  intake: false,
  questions: [
    { id: 'q1', type: 'number', label: 'Waga', help: '', required: true, unit: 'kg', min: 30, max: 300, options: [] },
    { id: 'q2', type: 'scale', label: 'Energia', help: '', required: false, unit: '', min: 0, max: 10, options: [] },
    { id: 'q3', type: 'multi', label: 'Co poszło', help: '', required: false, unit: '', min: null, max: null, options: ['sen', 'dieta', 'trening'] },
  ],
  ...over,
});

const envelope = (area: string, body: unknown) => ({ v: 1, id: 'a1', area, sentAt: 1, from: { name: 'Ola', profession: 'trainer' }, body });

describe('daty prowadzenia', () => {
  it('dzień tygodnia i tydzień ISO jak w kalendarzu, także na przełomie roku', () => {
    expect(weekdayOf('2026-11-23')).toBe(1); // poniedziałek
    expect(weekdayOf('2026-11-29')).toBe(7);
    expect(isoWeek('2026-11-25')).toBe('2026-W48');
    expect(isoWeek('2027-01-01')).toBe('2026-W53'); // piątek należy do ostatniego tygodnia 2026
    expect(isoWeek('2024-12-30')).toBe('2025-W01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(daysBetween('2026-11-20', '2026-11-25')).toBe(5);
  });

  it('cotygodniowy check-in czeka od swojego dnia do niedzieli i znika po odpowiedzi', () => {
    const f = form();
    expect(formDue(f, new Set(), '2026-11-26')).toBe(false); // czwartek — jeszcze nie
    expect(formDue(f, new Set(), '2026-11-27')).toBe(true); // piątek
    expect(formDue(f, new Set([formPeriod(f, '2026-11-27')]), '2026-11-29')).toBe(false);
    expect(formDue(f, new Set([formPeriod(f, '2026-11-27')]), '2026-12-04')).toBe(true); // następny tydzień
    const once = form({ repeat: 'once', weekday: null });
    expect(formPeriod(once, '2026-11-27')).toBe('once');
    expect(formDue(once, new Set(['once']), '2027-05-01')).toBe(false);
  });

  it('nawyki obowiązują w swoje dni i do daty końca', () => {
    const h = { items: [{ label: 'Kreatyna', dose: '5 g', when: 'any' as const, days: [1, 2, 3, 4, 5, 6, 7] }, { label: 'Spacer', dose: '', when: 'evening' as const, days: [6, 7] }], until: '2026-11-30' };
    expect(habitsFor(h, '2026-11-25')).toEqual([0]);
    expect(habitsFor(h, '2026-11-29')).toEqual([0, 1]);
    expect(habitsFor(h, '2026-12-01')).toEqual([]);
  });

  it('jadłospis idzie cyklem od startu albo od dnia wysłania', () => {
    const m = { days: [{ label: 'A', meals: [] }, { label: 'B', meals: [] }, { label: 'C', meals: [] }], start: null };
    expect(mealDayIndex(m, '2026-11-25', '2026-11-24')).toBeNull();
    expect(mealDayIndex(m, '2026-11-25', '2026-11-25')).toBe(0);
    expect(mealDayIndex(m, '2026-11-25', '2026-11-29')).toBe(1);
    expect(mealDayIndex({ ...m, start: '2026-11-20' }, '2026-11-25', '2026-11-25')).toBe(2);
  });
});

describe('formularz', () => {
  it('przechodzi w obszarze rehabilitacji, a pytanie bez opcji psuje całość', () => {
    expect(parseAssignment(envelope('rehab', form()))?.body.kind).toBe('form');
    const bad = form({ questions: [{ id: 'q1', type: 'choice', label: 'Jedno', help: '', required: false, unit: '', min: null, max: null, options: ['tylko'] }] });
    expect(parseAssignment(envelope('rehab', bad))).toBeNull();
    const dup = form({ questions: [form().questions[0]!, { ...form().questions[1]!, id: 'q1' }] });
    expect(parseAssignment(envelope('rehab', dup))).toBeNull();
  });

  it('wywiad bywa tylko jednorazowy, a skala bez granic to 0–10', () => {
    const p = parseAssignment(envelope('training', { ...form({ repeat: 'weekly' }), intake: true }));
    expect(p?.body.kind === 'form' && p.body.intake).toBe(false);
    const s = parseAssignment(envelope('training', form({ questions: [{ id: 'b', type: 'scale', label: 'Ból', help: '', required: true, unit: '', min: null, max: null, options: [] }] })));
    expect(s?.body.kind === 'form' && s.body.questions[0]).toMatchObject({ min: 0, max: 10 });
  });

  it('odpowiedzi sprawdzone pytaniami; brak wymaganej — nic', () => {
    const f = form();
    expect(cleanAnswers(f, { q1: 82.5, q2: 7.4, q3: [2, 0, 0, 9] })).toEqual({ q1: 82.5, q2: 7, q3: [0, 2] });
    expect(cleanAnswers(f, { q2: 5 })).toBeNull();
    expect(cleanAnswers(f, { q2: 5 }, { partial: true })).toEqual({ q1: null, q2: 5, q3: null });
    expect(cleanAnswers(f, { q1: 900 })).toBeNull(); // poza granicą
  });
});

describe('rodzaje według obszaru', () => {
  it('jadłospis tylko w żywieniu, nawyki nie we wglądzie', () => {
    const meals = { kind: 'meals', title: 'Tydzień', start: null, note: '', days: [{ label: 'Pn', meals: [{ slot: 'Śniadanie', name: 'Owsianka', recipe: 'owsianka-1', kcal: 450, protein: 25, carbs: 60, fat: 12, note: '' }] }] };
    expect(parseAssignment(envelope('nutrition', meals))?.body.kind).toBe('meals');
    expect(parseAssignment(envelope('training', meals))).toBeNull();
    const habits = { kind: 'habits', title: 'Sen', note: '', until: null, items: [{ label: '8 h snu', dose: '', when: 'evening', days: [1, 2, 3, 4, 5, 6, 7] }] };
    expect(parseAssignment(envelope('rehab', habits))?.body.kind).toBe('habits');
    expect(parseAssignment(envelope('insight', habits))).toBeNull();
    expect(parseAssignment(envelope('nutrition', { ...habits, items: [{ label: 'x', days: [] }] }))).toBeNull();
  });
});

describe('paczka, wiadomość, zdjęcie z zewnątrz', () => {
  it('coaching odsiewa śmieci, ale zostawia dobre wpisy', () => {
    const c = cleanCoaching({
      answers: [
        { assignmentId: 'a1', period: '2026-W48', at: 5, values: { q1: 80, 'zły klucz': 1, q2: { x: 1 } } },
        { assignmentId: 'a1', period: 'jutro', at: 5, values: {} },
      ],
      habits: [{ assignmentId: 'h1', days: { '2026-11-25': [0, 0, 2, -1], nie: [1] } }],
      meals: 'x',
    });
    expect(c.answers).toEqual([{ assignmentId: 'a1', period: '2026-W48', at: 5, values: { q1: 80 } }]);
    expect(c.habits).toEqual([{ assignmentId: 'h1', days: { '2026-11-25': [0, 2] } }]);
    expect(c.meals).toEqual([]);
  });

  it('wiadomość: tekst przycięty, nieznane odniesienie znika', () => {
    expect(parseMessage({ v: 1, id: 'm1', at: 1, text: '  hej  ', ref: { kind: 'session', at: '2026-11-25T18:00:00.000Z', label: 'Push' } })).toEqual({
      v: 1, id: 'm1', at: 1, text: 'hej', ref: { kind: 'session', at: '2026-11-25T18:00:00.000Z', label: 'Push' },
    });
    expect(parseMessage({ v: 1, id: 'm1', at: 1, text: 'x', ref: { kind: 'other' } })?.ref).toBeNull();
    expect(parseMessage({ v: 1, id: 'm1', at: 1, text: '   ' })).toBeNull();
  });

  it('zdjęcie: tylko base64 w granicy i rozsądne wymiary', () => {
    expect(parsePhoto({ v: 1, id: 'p1', day: '2026-11-25', w: 540, h: 720, jpeg: 'AAAA' })?.w).toBe(540);
    expect(parsePhoto({ v: 1, id: 'p1', day: '2026-11-25', w: 540, h: 720, jpeg: '<svg>' })).toBeNull();
    expect(parsePhoto({ v: 1, id: 'p1', day: '25.11', w: 540, h: 720, jpeg: 'AAAA' })).toBeNull();
  });
});

describe('daty z zewnątrz, które nie istnieją', () => {
  it('2026-02-30 i 2026-13-45 nie przechodzą, a jadłospis z takim startem nie wywraca rachunku dni', () => {
    const meals = { kind: 'meals', title: 'T', start: '2026-02-30', note: '', days: [{ label: 'A', meals: [{ slot: '', name: 'x', recipe: null, kcal: null, protein: null, carbs: null, fat: null, note: '' }] }] };
    const p = parseAssignment(envelope('nutrition', meals));
    expect(p?.body.kind === 'meals' && p.body.start).toBeNull();
    expect(mealDayIndex({ days: [{ label: 'A', meals: [] }], start: '2026-13-45' }, '2026-11-25', '2026-11-25')).toBeNull();
    expect(mealDayIndex({ days: [{ label: 'A', meals: [] }], start: null }, 'NaN-NaN-NaN', '2026-11-25')).toBeNull();
    const h = { kind: 'habits', title: 'H', note: '', until: '2026-02-31', items: [{ label: 'x', dose: '', when: 'any', days: [1] }] };
    const ph = parseAssignment(envelope('training', h));
    expect(ph?.body.kind === 'habits' && ph.body.until).toBeNull();
  });

  it('chwila wysłania poza rozsądnym zakresem odrzuca zalecenie', () => {
    const note = { kind: 'note', title: 't', text: 'x', checklist: [] };
    expect(parseAssignment({ ...envelope('training', note), sentAt: 1e300 })).toBeNull();
    expect(parseAssignment({ ...envelope('training', note), sentAt: -5 })).toBeNull();
    expect(parseAssignment({ ...envelope('training', note), sentAt: Date.parse('2026-11-25') })).not.toBeNull();
  });
});
