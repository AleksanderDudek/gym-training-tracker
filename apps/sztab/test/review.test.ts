import { describe, expect, it, vi } from 'vitest';

// Powody są po polsku (język główny) — język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'pl';
});

import { localDay } from '@gymtracker/link';
import type { AssignmentBody, AssignmentV1, CoachingV1, FormBody, HabitsBody, MealsBody, SnapshotV1 } from '@gymtracker/link';
import type { Connection, SentAssignment, SnapshotRead } from '../src/lib/data';
import type { Overview } from '../src/lib/metrics';
import { adherence, weekRates } from '../src/lib/adherence';
import { sentForms, formState } from '../src/lib/forms';
import { compareReviews, dayIn, prepare, reasonText, review } from '../src/lib/review';
import type { ReviewData } from '../src/lib/review';
import { forgetReview, loadReview, pool } from '../src/lib/reviewLoad';

const store = vi.hoisted(() => ({ snapshot: null as unknown, sent: [] as unknown[], reads: 0 }));
vi.mock('../src/lib/data', async (orig) => ({
  ...(await orig<typeof import('../src/lib/data')>()),
  readSnapshot: vi.fn(async () => {
    store.reads++;
    return { snapshot: store.snapshot, at: store.snapshot ? new Date().toISOString() : null, bytes: 100, unreadable: false };
  }),
  listAssignments: vi.fn(async () => store.sent),
}));

const DAY = 86_400_000;
/** Środa 25.11.2026, 23:30 UTC — w Warszawie już czwartek 26.11, 00:30. */
const NOW = Date.parse('2026-11-25T23:30:00Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const conn = { createdAt: ago(60), lastPushAt: ago(0.1) };

let seq = 0;
function sent(body: AssignmentBody, opts: Partial<Pick<SentAssignment, 'withdrawnAt' | 'visibleFrom' | 'receipt'>> & { sentAt?: number } = {}): SentAssignment {
  const id = `a${++seq}`;
  const area = body.kind === 'meals' || body.kind === 'targets' ? 'nutrition' : 'training';
  const envelope: AssignmentV1 = { v: 1, id, area, sentAt: opts.sentAt ?? NOW - 20 * DAY, from: { name: 'Ola', profession: 'trainer' }, body };
  return {
    id,
    kind: body.kind,
    area,
    createdAt: new Date(envelope.sentAt).toISOString(),
    withdrawnAt: opts.withdrawnAt ?? null,
    visibleFrom: opts.visibleFrom ?? null,
    envelope,
    receipt: opts.receipt ?? null,
  };
}

const form = (patch: Partial<FormBody> = {}): FormBody => ({
  kind: 'form',
  title: 'Check-in',
  intro: '',
  questions: [{ id: 'q1', type: 'scale', label: 'Samopoczucie', help: '', required: true, unit: '', min: 0, max: 10, options: [] }],
  repeat: 'weekly',
  weekday: 1,
  intake: false,
  ...patch,
});

const habits = (patch: Partial<HabitsBody> = {}): HabitsBody => ({
  kind: 'habits',
  title: 'Codziennie',
  items: [
    { label: 'Kreatyna', dose: '5 g', when: 'morning', days: [1, 2, 3, 4, 5, 6, 7] },
    { label: 'Spacer', dose: '', when: 'any', days: [1, 3, 5] },
  ],
  note: '',
  until: null,
  ...patch,
});

const meal = (name: string) => ({ slot: '', name, recipe: null, kcal: null, protein: null, carbs: null, fat: null, note: '' });
const meals = (patch: Partial<MealsBody> = {}): MealsBody => ({
  kind: 'meals',
  title: 'Redukcja',
  days: [
    { label: 'A', meals: [meal('Owsianka'), meal('Kurczak'), meal('Skyr')] },
    { label: 'B', meals: [meal('Jajka'), meal('Łosoś')] },
  ],
  start: null,
  note: '',
  ...patch,
});

/** Paczka sprzed 10 minut — w Warszawie już z czwartku 26.11, w UTC ze środy 25.11 (dzień paczki = dziś). */
function snapshot(coaching: CoachingV1 | undefined, tz = 'Europe/Warsaw', extra: Partial<SnapshotV1> = {}): SnapshotV1 {
  return { v: 1, at: NOW - 600_000, tz, lang: 'pl', app: 'test', scopes: [], ...(coaching ? { coaching } : {}), ...extra };
}

const read = (s: SnapshotV1 | null, unreadable = false): SnapshotRead => ({ snapshot: s, at: s || unreadable ? ago(0.1) : null, bytes: 100, unreadable });
const none: CoachingV1 = { answers: [], habits: [], meals: [] };
const ctx = (patch: Partial<Parameters<typeof review>[2]> = {}) => ({ unread: 0, lastSeen: null, now: NOW, ...patch });

describe('Dzień w strefie telefonu', () => {
  it('ta sama chwila to inny dzień w Warszawie i w UTC; zła strefa — strefa przeglądarki', () => {
    expect(dayIn('Europe/Warsaw', NOW)).toBe('2026-11-26');
    expect(dayIn('UTC', NOW)).toBe('2026-11-25');
    expect(dayIn('America/New_York', NOW)).toBe('2026-11-25');
    expect(dayIn('Mars/Olympus', NOW)).toBe(localDay(NOW));
    expect(dayIn(null, NOW)).toBe(localDay(NOW));
  });
});

describe('Powody do przejrzenia', () => {
  it('nieprzeczytane wiadomości i stare dane wiadomo od razu, bez paczki', () => {
    const r = review({ createdAt: ago(90), lastPushAt: ago(10) }, null, ctx({ unread: 2 }));
    expect(r.loaded).toBe(false);
    expect(r.stale).toBe(true);
    expect(r.ageDays).toBe(10);
    expect(r.reasons.map(reasonText)).toEqual(['2 nowe wiadomości', 'dane sprzed 10 dni']);
    expect(r.training).toBeNull();
    expect(r.newAnswers).toBeNull();
  });

  it('siedem dni to jeszcze nie stare dane', () => {
    const r = review({ createdAt: ago(90), lastPushAt: ago(6.9) }, null, ctx());
    expect(r.stale).toBe(false);
    expect(r.score).toBe(0);
  });

  it('brak danych: nowy podopieczny ma trzy dni, potem to powód', () => {
    expect(review({ createdAt: ago(1), lastPushAt: null }, null, ctx()).reasons).toEqual([]);
    const r = review({ createdAt: ago(5), lastPushAt: null }, null, ctx());
    expect(r.ageDays).toBeNull();
    expect(r.reasons.map(reasonText)).toEqual(['jeszcze bez danych']);
  });

  it('paczka, która się nie otwiera, to powód — a odhaczeń z niej nie liczymy', () => {
    const d = prepare(read(null, true), [sent(habits())], null, NOW);
    const r = review(conn, d, ctx());
    expect(r.reasons.map(reasonText)).toEqual(['paczka się nie otwiera']);
    expect(r.habits).toBeNull();
  });

  it('zaległy check-in: cotygodniowy formularz po swoim dniu bez odpowiedzi w tym tygodniu', () => {
    const f = sent(form({ weekday: 1 }));
    const lastWeek = { assignmentId: f.id, period: '2026-W47', at: NOW - 8 * DAY, values: { q1: 7 } };
    const d = prepare(read(snapshot({ ...none, answers: [lastWeek] })), [f], null, NOW);
    const r = review(conn, d, ctx({ lastSeen: NOW - DAY }));
    expect(r.checkinsOverdue).toBe(1);
    expect(r.reasons.map(reasonText)).toEqual(['zaległy formularz']);

    // Odpowiedź z tego tygodnia (czwartek w Warszawie to tydzień 48) zamyka sprawę.
    const thisWeek = { assignmentId: f.id, period: '2026-W48', at: NOW - 2 * DAY, values: { q1: 8 } };
    const ok = review(conn, prepare(read(snapshot({ ...none, answers: [lastWeek, thisWeek] })), [f], null, NOW), ctx({ lastSeen: NOW }));
    expect(ok.checkinsOverdue).toBe(0);
    expect(ok.score).toBe(0);
  });

  it('check-in liczy dzień tygodnia w strefie telefonu: środowy jest zaległy w Warszawie (już czwartek), w UTC jeszcze nie', () => {
    const f = sent(form({ weekday: 3 }));
    const warsaw = review(conn, prepare(read(snapshot(none, 'Europe/Warsaw')), [f], null, NOW), ctx());
    const utc = review(conn, prepare(read(snapshot(none, 'UTC')), [f], null, NOW), ctx());
    expect(warsaw.checkinsOverdue).toBe(1);
    expect(utc.checkinsOverdue).toBe(0);
  });

  it('check-in wysłany już po swoim dniu w tym tygodniu nie jest zaległy; wycofany, odrzucony i zaplanowany się nie liczą', () => {
    const late = sent(form({ weekday: 1 }), { sentAt: Date.parse('2026-11-24T10:00:00Z') });
    const withdrawn = sent(form(), { withdrawnAt: ago(1) });
    const declined = sent(form(), { receipt: { v: 1, assignmentId: 'x', status: 'declined', at: NOW, ticks: [], note: '', updatedAt: ago(1) } as never });
    const scheduled = sent(form(), { visibleFrom: new Date(NOW + DAY).toISOString() });
    const d = prepare(read(snapshot(none)), [late, withdrawn, declined, scheduled], null, NOW);
    expect(d.items.map((x) => x.id)).toEqual([late.id]);
    expect(review(conn, d, ctx()).checkinsOverdue).toBe(0);
  });

  it('nowe odpowiedzi: od ostatniego otwarcia z listy, a bez śladu otwarcia — z ostatnich 7 dni', () => {
    const f = sent(form({ repeat: 'daily', weekday: null }));
    const answers = [1, 3, 5, 9, 12].map((n) => ({ assignmentId: f.id, period: dayIn('Europe/Warsaw', NOW - n * DAY), at: NOW - n * DAY, values: { q1: 5 } }));
    const d = prepare(read(snapshot({ ...none, answers })), [f], null, NOW);
    const seen = review(conn, d, ctx({ lastSeen: NOW - 4 * DAY }));
    expect(seen.newAnswers).toBe(2);
    expect(seen.reasons.map(reasonText)).toEqual(['2 nowe odpowiedzi']);
    expect(review(conn, d, ctx()).newAnswers).toBe(3);
    expect(review(conn, d, ctx({ lastSeen: NOW })).reasons).toEqual([]);
  });

  it('nawyki: odhaczone z należnych w 7 pełnych dniach przed dzisiejszym, dni w strefie telefonu', () => {
    const h = sent(habits());
    // Warszawa: dziś czwartek 26.11 — okno to 19–25.11. Odhaczone wszystko w tych dniach.
    const days: Record<string, number[]> = {};
    for (let d = 19; d <= 25; d++) days[`2026-11-${d}`] = [0, 1];
    const coaching = { ...none, habits: [{ assignmentId: h.id, days }] };
    const warsaw = review(conn, prepare(read(snapshot(coaching, 'Europe/Warsaw')), [h], null, NOW), ctx());
    expect(warsaw.habits).toBe(100);
    // UTC: dziś środa 25.11 — okno 18–24.11; 18.11 (środa: kreatyna i spacer) nieodhaczony.
    const utc = review(conn, prepare(read(snapshot(coaching, 'UTC')), [h], null, NOW), ctx());
    expect(utc.habits).toBe(Math.round((8 / 10) * 100));
  });

  it('nawyki poniżej 60% to powód; dni przed wysłaniem i po „do kiedy” się nie liczą', () => {
    const h = sent(habits({ items: [{ label: 'Woda', dose: '2 l', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }] }), {
      sentAt: Date.parse('2026-11-21T08:00:00Z'),
    });
    // Należne: 21–25.11 (5 dni); odhaczone 2.
    const coaching = { ...none, habits: [{ assignmentId: h.id, days: { '2026-11-22': [0], '2026-11-25': [0], '2026-11-15': [0] } }] };
    const r = review(conn, prepare(read(snapshot(coaching)), [h], null, NOW), ctx());
    expect(r.habits).toBe(40);
    expect(r.reasons.map(reasonText)).toEqual(['nawyki 40%']);

    const ended = sent(habits({ until: '2026-11-10' }));
    expect(review(conn, prepare(read(snapshot(none)), [ended], null, NOW), ctx()).habits).toBeNull();
  });

  it('jadłospis: cykl od dnia wysłania w strefie telefonu, albo od daty startu', () => {
    // Wysłany 15.11 23:30 UTC — w Warszawie to już 16.11: dzień A przypada na 16, 18, 20, 22, 24.
    const m = sent(meals(), { sentAt: Date.parse('2026-11-15T23:30:00Z') });
    const days: Record<string, number[]> = {};
    for (let d = 19; d <= 25; d++) days[`2026-11-${d}`] = (d - 16) % 2 === 0 ? [0, 1, 2] : [0, 1];
    const coaching = { ...none, meals: [{ assignmentId: m.id, days }] };
    expect(review(conn, prepare(read(snapshot(coaching)), [m], null, NOW), ctx()).meals).toBe(100);

    // Start 23.11: wcześniej nic nie należy. 23 (A: 3), 24 (B: 2), 25 (A: 3) — zjedzone 4 z 8.
    const s = sent(meals({ start: '2026-11-23' }));
    const c2 = { ...none, meals: [{ assignmentId: s.id, days: { '2026-11-20': [0, 1, 2], '2026-11-23': [0, 1], '2026-11-24': [0, 1] } }] };
    const r = review(conn, prepare(read(snapshot(c2)), [s], null, NOW), ctx());
    expect(r.meals).toBe(50);
    expect(r.reasons.map(reasonText)).toEqual(['jadłospis 50%']);
  });

  it('telefon bez części „coaching” (starsza wersja) — nawyki i check-in nie dotyczą, zamiast fałszywych alarmów', () => {
    const d = prepare(read(snapshot(undefined)), [sent(habits()), sent(form())], null, NOW);
    const r = review(conn, d, ctx());
    expect(d.coaching).toBeNull();
    expect(r.habits).toBeNull();
    expect(r.checkinsOverdue).toBe(0);
    expect(r.newAnswers).toBeNull();
  });
});

describe('Lista i karta podopiecznego mówią to samo', () => {
  it('stara paczka: dni po niej są nieznane, nie opuszczone — lista i „Realizacja” dają 100%, nikt nie trafia do przejrzenia', () => {
    const h = sent(habits({ items: [{ label: 'Woda', dose: '2 l', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }] }));
    // Paczka sprzed 4 dni (Warszawa: niedziela 22.11, 00:30); odhaczone każde 7 dni przed nią.
    const at = Date.parse('2026-11-21T23:30:00Z');
    const days: Record<string, number[]> = {};
    for (let d = 15; d <= 21; d++) days[`2026-11-${d}`] = [0];
    const s = { ...snapshot({ ...none, habits: [{ assignmentId: h.id, days }] }), at };
    const r = review({ createdAt: ago(60), lastPushAt: new Date(at).toISOString() }, prepare({ ...read(s), at: new Date(at).toISOString() }, [h], null, NOW), ctx());
    expect(r.habits).toBe(100);
    expect(r.score).toBe(0);
    expect(weekRates(adherence(s, [h], NOW)).habits.pct).toBe(100);
  });

  it('trening po starej paczce nie jest opuszczony: okno kończy się przed dniem paczki', () => {
    const s = { ...snapshot(none, 'UTC', { training: { log: [], plan: { templateId: 'x', start: '2026-10-01', ticked: {} }, plans: [], workouts: [], snacks: [] } } as Partial<SnapshotV1>), at: Date.parse('2026-11-21T10:00:00Z') };
    const o = { today: '2026-11-25', plan: { name: 'FBW', week: 3, weeks: 8, daysPerWeek: 3, adherence: 80, missed: 0, next: null }, sessions: ['2026-11-20', '2026-11-18', '2026-11-16'].map((day) => ({ day })) } as unknown as Overview;
    const d = prepare(read(s), [], o, NOW);
    expect(d.training).toEqual({ done: 3, expected: 3 });
    expect(review(conn, d, ctx()).training).toBe(100);
  });

  it('codzienny formularz bez wczorajszej odpowiedzi: zaległy i na liście, i w zakładce „Odpowiedzi”', () => {
    const f = sent(form({ title: 'Skala bólu', repeat: 'daily', weekday: null }));
    // Warszawa: dziś 26.11; odpowiedź z 24.11, za 25.11 — brak.
    const s = snapshot({ ...none, answers: [{ assignmentId: f.id, period: '2026-11-24', at: NOW - DAY, values: { q1: 3 } }] });
    const r = review(conn, prepare(read(s), [f], null, NOW), ctx({ lastSeen: NOW }));
    expect(r.checkinsOverdue).toBe(1);
    expect(r.reasons.map(reasonText)).toEqual(['zaległy formularz']);
    const [tab] = sentForms([f], NOW).map((x) => formState(x, s.coaching, s.tz, NOW));
    expect(tab!.status.kind).toBe('overdue');
  });

  it('odpowiedzi i odhaczenia pod numerem wiersza małymi literami; numer w środku inny niż wiersz — zalecenie odpada jak w telefonie', () => {
    const h = sent(habits({ items: [{ label: 'Woda', dose: '', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }] }));
    const upper: SentAssignment = { ...h, id: 'AB12-CD', envelope: { ...h.envelope!, id: 'ab12-cd' } };
    const days: Record<string, number[]> = {};
    for (let d = 19; d <= 25; d++) days[`2026-11-${d}`] = [0];
    const s = snapshot({ ...none, habits: [{ assignmentId: 'ab12-cd', days }] });
    const d = prepare(read(s), [upper], null, NOW);
    expect(d.items.map((x) => x.id)).toEqual(['ab12-cd']);
    expect(review(conn, d, ctx()).habits).toBe(100);

    const moved: SentAssignment = { ...h, id: 'other-row' };
    expect(prepare(read(s), [moved], null, NOW).items).toEqual([]);
    // Nawyki w obszarze „wgląd” nie przejdą sprawdzenia telefonu (tam tylko formularze).
    const wrongArea: SentAssignment = { ...h, envelope: { ...h.envelope!, area: 'insight' } };
    expect(prepare(read(s), [wrongArea], null, NOW).items).toEqual([]);
  });

  it('zaplanowane nie czeka na odpowiedź, ale przegląd liczy się od nowa w chwili „pokaż od”', () => {
    const soon = new Date(NOW + 2 * 3600_000).toISOString();
    const later = new Date(NOW + 5 * DAY).toISOString();
    const d = prepare(read(snapshot(none)), [sent(form({ repeat: 'daily', weekday: null }), { visibleFrom: later }), sent(habits(), { visibleFrom: soon })], null, NOW);
    expect(d.items).toEqual([]);
    expect(d.refreshAt).toBe(Date.parse(soon));
    expect(review(conn, d, ctx()).checkinsOverdue).toBe(0);
    expect(prepare(read(snapshot(none)), [sent(habits())], null, NOW).refreshAt).toBeNull();
  });
});

describe('Trening z 7 dni', () => {
  const ov = (sessions: string[], plan: Overview['plan']): Overview =>
    ({ today: '2026-11-25', perWeek: null, plan, weight: { avg: null, delta: null, series: [] }, food: null, steps: null, sessions: sessions.map((day) => ({ day })), exercises: [], flags: [] }) as unknown as Overview;
  const plan = (daysPerWeek: number): Overview['plan'] => ({ name: 'FBW', week: 3, weeks: 8, daysPerWeek, adherence: 80, missed: 0, next: null });
  const training = (start: string, weekdays?: number[]) =>
    ({ training: { log: [], plan: { templateId: 'x', start, ticked: {}, ...(weekdays ? { weekdays } : {}) }, plans: [], workouts: [], snacks: [] } }) as Partial<SnapshotV1>;

  it('treningi z 7 pełnych dni wobec dni planu (dzisiejszy jeszcze się nie liczy); poniżej 60% to powód', () => {
    const s = snapshot(none, 'Europe/Warsaw', training('2026-10-01'));
    // Okno 18–24.11: 24 i 21 się liczą; 25 (dziś) i 17 — poza oknem.
    const d = prepare(read(s), [], ov(['2026-11-25', '2026-11-24', '2026-11-21', '2026-11-17', '2026-11-10'], plan(4)), NOW);
    expect(d.training).toEqual({ done: 2, expected: 4 });
    const r = review(conn, d, ctx());
    expect(r.training).toBe(50);
    expect(r.reasons.map(reasonText)).toEqual(['trening 50% planu']);
  });

  it('dni wybrane ręcznie mają pierwszeństwo przed szablonem; świeży plan — oczekiwania proporcjonalnie', () => {
    const custom = prepare(read(snapshot(none, 'UTC', training('2026-10-01', [1, 3, 5]))), [], ov(['2026-11-24', '2026-11-21', '2026-11-20'], plan(4)), NOW);
    expect(review(conn, custom, ctx()).training).toBe(100);

    // Plan od 23.11: w oknie 18–24.11 obowiązuje dwa dni.
    const fresh = prepare(read(snapshot(none, 'UTC', training('2026-11-23'))), [], ov(['2026-11-24'], plan(4)), NOW);
    expect(fresh.training!.expected).toBeCloseTo((4 * 2) / 7);
    expect(review(conn, fresh, ctx()).training).toBe(88);

    const today = prepare(read(snapshot(none, 'UTC', training('2026-11-25'))), [], ov([], plan(4)), NOW);
    expect(review(conn, today, ctx()).training).toBeNull();
  });

  it('bez planu — cel „treningi w tygodniu” z wysłanych celów; bez celu i planu nie dotyczy', () => {
    const t = sent({ kind: 'targets', kcal: null, protein: null, steps: null, workoutsPerWeek: 3, weightGoal: null, weeklyRate: null, note: '' });
    const s = snapshot(none, 'UTC', { training: { log: [], plan: null, plans: [], workouts: [], snacks: [] } });
    const d = prepare(read(s), [t], ov(['2026-11-24', '2026-11-22', '2026-11-19'], null), NOW);
    expect(review(conn, d, ctx()).training).toBe(100);
    expect(review(conn, prepare(read(s), [], ov(['2026-11-24'], null), NOW), ctx()).training).toBeNull();
    // Podopieczny nie udostępnia treningów.
    expect(prepare(read(snapshot(none)), [t], null, NOW).training).toBeNull();
  });
});

describe('Kolejność „Do przejrzenia”', () => {
  it('wiadomości przed zaległym check-inem, ten przed starymi danymi; bez powodów — wynik 0', () => {
    const f = sent(form({ weekday: 1 }));
    const overdue: ReviewData = prepare(read(snapshot(none)), [f], null, NOW);
    const a = review(conn, null, ctx({ unread: 1 }));
    const b = review(conn, overdue, ctx());
    const c = review({ createdAt: ago(90), lastPushAt: ago(10) }, null, ctx());
    const d = review(conn, prepare(read(snapshot(none)), [], null, NOW), ctx());
    expect(d.score).toBe(0);
    const sorted = [d, c, b, a].sort(compareReviews);
    expect(sorted).toEqual([a, b, c, d]);
    expect(a.score).toBeGreaterThan(b.score);
    expect(b.score).toBeGreaterThan(c.score);
  });

  it('powody w wierszu od najważniejszego; wynik to ich suma', () => {
    const f = sent(form({ weekday: 1 }));
    const old = { ...read(snapshot(none)), at: ago(9) };
    const r = review({ createdAt: ago(90), lastPushAt: ago(9) }, prepare(old, [f], null, NOW), ctx({ unread: 3 }));
    expect(r.reasons.map((x) => x.code)).toEqual(['unread', 'checkin', 'stale']);
    expect(r.score).toBe(r.reasons.reduce((s, x) => s + x.weight, 0));
    expect(reasonText({ code: 'unread', n: 5 })).toBe('5 nowych wiadomości');
    expect(reasonText({ code: 'answers', n: 1 })).toBe('1 nowa odpowiedź');
    expect(reasonText({ code: 'checkin', n: 2 })).toBe('2 zaległe formularze');
    expect(reasonText({ code: 'checkin', n: 5 })).toBe('5 zaległych formularzy');
  });
});

describe('Pamięć przeglądu', () => {
  it('wpis trzyma się do nowej paczki, wysyłki albo chwili „pokaż od” zaplanowanego zalecenia', async () => {
    const key = {} as CryptoKey;
    const c = { id: 'conn-1', lastPushAt: '2026-11-25T10:00:00Z' } as Connection;
    const soon = Date.now() + 3600_000;
    store.snapshot = null;
    store.sent = [sent(habits(), { visibleFrom: new Date(soon).toISOString() })];
    store.reads = 0;
    const first = await loadReview(key, c);
    expect(first.refreshAt).toBe(soon);
    await loadReview(key, c);
    expect(store.reads).toBe(1);
    // Zaplanowane zaczyna obowiązywać — wpis nieaktualny.
    await loadReview(key, c, soon + 1);
    expect(store.reads).toBe(2);
    // Wysyłka albo wycofanie: `forgetReview`.
    store.sent = [];
    forgetReview(key, c.id);
    expect((await loadReview(key, c)).refreshAt).toBeNull();
    expect(store.reads).toBe(3);
    await loadReview(key, c, Date.now() + 400 * DAY);
    expect(store.reads).toBe(3);
  });
});

describe('Kolejka wczytywania', () => {
  it('najwyżej tyle zadań naraz, ile limit; reszta czeka po kolei, błąd nie blokuje kolejki', async () => {
    const run = pool(2);
    let now = 0;
    let max = 0;
    const order: number[] = [];
    const job = (i: number, fail = false) => async () => {
      now++;
      max = Math.max(max, now);
      await new Promise((r) => setTimeout(r, 5));
      now--;
      order.push(i);
      if (fail) throw new Error('x');
      return i;
    };
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map((i) => run(job(i, i === 2))));
    expect(max).toBe(2);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled', 'fulfilled']);
    expect(order.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
