import {
  AAD,
  addDays,
  cleanAnswers,
  formPeriod,
  generateIdentity,
  habitsFor,
  importPrivate,
  linkKey,
  mealDayIndex,
  newIdSecret,
  newToken,
  openJson,
  parseAssignment,
  pseudonymFor,
  sealJson,
  weekdayOf,
} from '@gymtracker/link';
import type {
  AnswerValue,
  Area,
  AssignmentBody,
  AssignmentV1,
  CoachingV1,
  FormBody,
  FormQuestion,
  MessageV1,
  PhotoV1,
  Profession,
  PublicJwk,
  ReceiptV1,
  Scope,
  SnapshotV1,
} from '@gymtracker/link';
import { dayIn } from '../coached';
import { DEMO_TZ, demoSnapshot, demoWeight } from './snapshot';
import type { DemoLang } from './snapshot';

/**
 * Telefon symulowany — jedna implementacja dla „Podopiecznego demonstracyjnego” w Sztabie (przeglądarka
 * prowadzącego) i dla `scripts/seed.ts phone` (Node). Robi to, co robi GYM TRACKER, **tymi samymi funkcjami
 * bazy co telefon** (`invite_accept`, `client_pull`, `client_push`, `client_receipt`, `client_message`,
 * `client_photo_put`, `client_book`…) i tym samym szyfrowaniem: klucz współpracy z ECDH, AAD związane
 * z wierszem. Serwer widzi szyfrogram — demo pokazuje E2E w działaniu, a nie jego atrapę.
 *
 * Odpowiedzi jak prawdziwy telefon (`src/link/sync.ts`, `src/link/today.ts`):
 * - zalecenia pod **numerem wiersza małymi literami**, tylko te, których numer w środku zgadza się z wierszem;
 * - dni w **strefie telefonu** (`Europe/Warsaw`), nigdy sprzed dnia wysłania (zaplanowane — od „pokaż od”)
 *   i nigdy z przyszłości;
 * - realizacja 70–90 % — stała dla zalecenia i dnia (pseudolosowo z numeru), więc kolejna symulacja nie
 *   przepisuje historii, tylko dokłada nowe dni.
 *
 * Importuje tylko protokół i `coached.ts`, żeby działać też w Node (`tsx`) bez aliasu `@gt`. Teksty
 * telefonu (odpowiedzi, wiadomości) są w obu językach — telefon demo mówi językiem prowadzącego.
 */

export type Rpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

/** Telefon symulowany: tyle wystarczy, żeby działać jak GYM TRACKER po przyjęciu zaproszenia. */
export interface DemoPhone {
  connectionId: string;
  inviteId: string;
  token: string;
  privateJwk: JsonWebKey;
}

/** Zakres paczki (bez zdjęć — te idą osobno, za własną zgodą). */
export const SNAPSHOT_SCOPES: Scope[] = ['training', 'movement', 'food', 'body', 'labs'];
export const DEMO_SCOPES: Scope[] = [...SNAPSHOT_SCOPES, 'photos'];
export const DEMO_AREAS: Area[] = ['training', 'nutrition'];

/** Ile dni wstecz telefon odpowiada najwyżej (formularze, nawyki, jadłospis). */
export const SIM_DAYS = 56;

const DAY_MS = 86_400_000;

/* ── Pseudolosowość stała dla zalecenia i dnia ─────────────────────────────────────── */

/** FNV-1a → [0, 1): ta sama wartość dla tego samego napisu, w przeglądarce i w Node. */
export function chance(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 0x1_0000_0000;
}

/** Realizacja zalecenia: 70–90 %, stała dla numeru. */
export const adherenceOf = (rowId: string): number => 0.7 + 0.2 * chance(`rate|${rowId}`);

/* ── Teksty telefonu ───────────────────────────────────────────────────────────────── */

/** Odpowiedzi tekstowe po treści pytania (pierwsze pasujące; pusta lista — bez odpowiedzi), ostatnie — reszta. */
const TEXTS: Record<DemoLang, [RegExp, string[]][]> = {
  pl: [
    [/kontuzj|uraz|dolegliw/i, ['Brak. Czasem ciągnie lewe kolano przy głębokim przysiadzie.']],
    [/alergi|nietoler/i, ['Brak.']],
    [/cel/i, ['Zejść do ok. 82 kg i mieć siłę na treningi — bez liczenia każdej kalorii.']],
    [/przeszkadza/i, ['Nieregularna praca i wieczorne podjadanie.']],
    [/trudne/i, ['Dużo pracy w środę, jeden trening przesunięty na sobotę.', 'Słodycze wieczorem, dwa razy.', 'Mało snu — dziecko chore.', 'Weekendowe wyjście ze znajomymi.']],
    [/dobrze/i, ['Wszystkie treningi zrobione.', 'Więcej kroków niż zwykle.', 'Przysiad poszedł lżej niż tydzień temu.', 'Jadłospis bez problemu.']],
    [/gdzie/i, ['Lewe kolano, przy głębokim przysiadzie.']],
    [/jeśli tak/i, []],
    [/nie lubisz/i, ['Wątróbki i grzybów.']],
    [/lubisz|nie znosisz/i, ['Lubię siłownię i rower, nie przepadam za bieganiem.']],
    [/ulubion/i, ['Kurczak, jajka, owsianka, pierogi.']],
    [/o której/i, ['Około 7:30 i 20:00.']],
    [/(?:)/, ['Bez uwag.', 'Wszystko w porządku.', 'Trochę zmęczenia po pracy, ale daję radę.']],
  ],
  en: [
    [/injur|ache/i, ['None. My left knee pulls a little in a deep squat sometimes.']],
    [/allerg|intoler/i, ['None.']],
    [/goal/i, ['Get down to about 82 kg and keep my strength — without counting every calorie.']],
    [/kept you/i, ['Irregular work hours and snacking in the evening.']],
    [/difficult|hard/i, ['Busy Wednesday, one workout moved to Saturday.', 'Sweets in the evening, twice.', 'Little sleep — sick kid.', 'Weekend out with friends.']],
    [/went well/i, ['All workouts done.', 'More steps than usual.', 'The squat felt lighter than last week.', 'Meal plan went fine.']],
    [/where/i, ['Left knee, in the deep squat.']],
    [/if so/i, []],
    [/dislike|do not like|don’t like/i, ['Liver and mushrooms.']],
    [/enjoy|hate/i, ['I like the gym and cycling, not a fan of running.']],
    [/favourite|favorite/i, ['Chicken, eggs, porridge, dumplings.']],
    [/what time/i, ['Around 7:30 and 20:00.']],
    [/(?:)/, ['Nothing to add.', 'All good.', 'A bit tired after work, but managing.']],
  ],
};

/** Pytania „w dół” (ból, stres, głód, gorzej, ograniczenia) — tu dobra odpowiedź to mała liczba albo „nie”. */
const NEGATIVE = /b[óo]l|gorzej|stres|g[łl][óo]d|ogranicz|podjad|pain|hurt|worse|stress|hung|limit|snack/i;

export const REPLIES: Record<DemoLang, string[]> = {
  pl: [
    'Dzięki, jasne! Wieczorem dam znać, jak poszło.',
    'Ok, zrobione. W niedzielę wyślę podsumowanie tygodnia.',
    'Rozumiem, spróbuję w tym tygodniu i dam znać.',
    'Dziękuję! A czy mogę zamienić środowy trening na czwartek?',
  ],
  en: [
    'Thanks, got it! I will let you know tonight how it went.',
    'OK, done. I will send the weekly summary on Sunday.',
    'Understood, I will try it this week and report back.',
    'Thank you! Can I move Wednesday’s workout to Thursday?',
  ],
};

/** Pierwsze wiadomości podopiecznego demo (przy zakładaniu). */
export const HELLO: Record<DemoLang, string[]> = {
  pl: [
    'Dzień dobry! Przyjąłem zaproszenie — zaczynam w poniedziałek. Wywiad wypełniony.',
    'Mam pytanie: po przysiadach trochę ciągnie mnie lewe kolano. Zmienić coś w rozgrzewce?',
  ],
  en: [
    'Hello! I accepted the invite — starting on Monday. The interview is filled in.',
    'A question: my left knee pulls a little after squats. Should I change something in the warm-up?',
  ],
};

/* ── Odpowiedzi na formularz ───────────────────────────────────────────────────────── */

const round = (n: number, step: number) => Math.round(n / step) * step;
const clamp = (n: number, lo: number | null, hi: number | null) => Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, n));

function answerQuestion(q: FormQuestion, seed: string, lang: DemoLang, weight: number | null): AnswerValue {
  const r = chance(seed);
  const neg = NEGATIVE.test(q.label);
  switch (q.type) {
    case 'text': {
      const pool = TEXTS[lang].find(([re]) => re.test(q.label))![1];
      if (!pool.length || (!q.required && r < 0.4)) return null;
      return pool[Math.floor(chance(`${seed}|t`) * pool.length)]!;
    }
    case 'number': {
      let v: number;
      if (q.unit === 'kg' && weight !== null) v = weight;
      else if (q.unit === 'h') v = round(6.5 + r * 1.5, 0.5);
      else if (q.min !== null && q.max !== null) v = round(q.min + (q.max - q.min) * (0.25 + 0.15 * r), q.unit === 'l' ? 0.5 : 1);
      else v = round(1 + r * 4, 1);
      return clamp(v, q.min, q.max);
    }
    case 'scale': {
      const lo = q.min ?? 0;
      const hi = q.max ?? 10;
      return Math.round(lo + (hi - lo) * (neg ? 0.1 + 0.3 * r : 0.55 + 0.3 * r));
    }
    case 'choice':
      // Cel podopiecznego demo to redukcja (pierwsza odpowiedź gotowych wywiadów) — zgodnie z odpowiedzią opisową.
      if (/\bcel\b|goal/i.test(q.label)) return 0;
      // Ostatnia odpowiedź bywa „Inny” — telefon demo wybiera z pozostałych.
      return Math.floor(r * Math.max(1, q.options.length - 1));
    case 'multi': {
      const picked = q.options.map((_, j) => j).filter((j) => chance(`${seed}|${j}`) < 0.35);
      return picked.length ? picked.slice(0, 3) : [Math.floor(r * q.options.length)];
    }
    case 'yesno':
      return neg ? r < 0.08 : r < 0.85;
  }
}

/** Odpowiedź na formularz, jaką mógłby wysłać człowiek — przechodzi `cleanAnswers` (wymagane wypełnione). */
export function answerForm(form: FormBody, seed: string, lang: DemoLang, weight: number | null = null): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const q of form.questions) out[q.id] = answerQuestion(q, `${seed}|${q.id}`, lang, weight);
  return cleanAnswers(form, out) ?? out;
}

/* ── Dni odpowiedzi ────────────────────────────────────────────────────────────────── */

/** Dni od `from` do `to` włącznie. */
const span = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

/**
 * Dni, w które telefon odpowie na formularz — tylko wtedy, kiedy telefon go pokazuje (`formDue`):
 * jednorazowy w dniu wysłania, codzienny co dzień, cotygodniowy od swojego dnia tygodnia do niedzieli
 * (przyszedł po swoim dniu — i tak do niedzieli). Opuszczone okresy — zgodnie z realizacją.
 */
export function formAnswerDays(form: Pick<FormBody, 'repeat' | 'weekday'>, rowId: string, sentDay: string, today: string, maxDays = SIM_DAYS): string[] {
  if (sentDay > today) return [];
  if (form.repeat === 'once') return [sentDay];
  const rate = adherenceOf(rowId);
  const first = sentDay > addDays(today, 1 - maxDays) ? sentDay : addDays(today, 1 - maxDays);
  if (form.repeat === 'daily') return span(first, today).filter((d) => chance(`form|${rowId}|${d}`) < rate);
  const out: string[] = [];
  for (let monday = addDays(first, 1 - weekdayOf(first)); monday <= today; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    const due = addDays(monday, (form.weekday ?? 1) - 1);
    // Dzień, w którym telefon pokazuje formularz najwcześniej — i czasem dzień później (do niedzieli, nie po dziś).
    const opens = due < sentDay ? sentDay : due;
    if (opens > today || opens > sunday) continue;
    // Check-in raz w tygodniu to mniej niż codzienna lista — opuszcza się go rzadziej (85–95 %).
    if (chance(`form|${rowId}|${monday}`) >= (1 + rate) / 2) continue;
    const late = addDays(opens, 1);
    out.push(chance(`late|${rowId}|${monday}`) < 0.3 && late <= sunday && late <= today ? late : opens);
  }
  return out;
}

/** Chwila odpowiedzi tego dnia: koło południa w Polsce, nigdy przed wysłaniem ani w przyszłości. */
export function answerAt(day: string, sentAt: number, now: number): number {
  const noon = Date.parse(`${day}T10:30:00Z`) + Math.round(chance(`at|${day}`) * 6 * 3600_000);
  return Math.min(Math.max(noon, sentAt + 10 * 60_000), now);
}

/* ── Część „coaching” paczki ───────────────────────────────────────────────────────── */

export interface LiveAssignment {
  /** Numer wiersza małymi literami — pod nim telefon trzyma odpowiedzi i odhaczenia. */
  rowId: string;
  a: AssignmentV1;
}

/**
 * Odpowiedzi i odhaczenia telefonu na zalecenia — od dnia wysłania (w strefie telefonu) do dziś,
 * najwyżej `maxDays` wstecz; wywiad (jednorazowy) zawsze.
 */
export function simulateCoaching(
  live: readonly LiveAssignment[],
  opts: { now: number; lang: DemoLang; tz?: string; maxDays?: number; weight?: (day: string) => number | null },
): CoachingV1 {
  const tz = opts.tz ?? DEMO_TZ;
  const maxDays = opts.maxDays ?? SIM_DAYS;
  const today = dayIn(tz, opts.now);
  const coaching: CoachingV1 = { answers: [], habits: [], meals: [] };
  for (const { rowId, a } of live) {
    const b = a.body;
    const sentDay = dayIn(tz, a.sentAt);
    if (sentDay > today) continue;
    const first = sentDay > addDays(today, 1 - maxDays) ? sentDay : addDays(today, 1 - maxDays);
    const rate = adherenceOf(rowId);
    if (b.kind === 'form') {
      const periods = new Set<string>();
      for (const day of formAnswerDays(b, rowId, sentDay, today, maxDays)) {
        const period = formPeriod(b, day);
        if (periods.has(period)) continue;
        periods.add(period);
        const values = answerForm(b, `${rowId}|${day}`, opts.lang, opts.weight?.(day) ?? null);
        coaching.answers.push({ assignmentId: rowId, period, at: answerAt(day, a.sentAt, opts.now), values });
      }
    } else if (b.kind === 'habits' || b.kind === 'meals') {
      const days: Record<string, number[]> = {};
      for (const day of span(first, today)) {
        let due: number[];
        if (b.kind === 'habits') due = habitsFor(b, day);
        else {
          // Jak telefon (`src/link/today.ts`): cykl od `start` albo od dnia wysłania.
          const i = mealDayIndex(b, sentDay, day);
          due = i === null ? [] : b.days[i]!.meals.map((_, j) => j);
        }
        // Dziś jeszcze trwa: część dnia odhaczona, reszta przyjdzie później.
        const share = day === today ? 0.5 : 1;
        const done = due.filter((j) => chance(`tick|${rowId}|${day}|${j}`) < rate * share);
        if (done.length) days[day] = done;
      }
      (b.kind === 'habits' ? coaching.habits : coaching.meals).push({ assignmentId: rowId, days });
    }
  }
  return coaching;
}

/** Potwierdzenie telefonu: plan, trening, nawyki, jadłospis i zalecenie z listą — „rozpoczęte”, reszta — „przeczytane”. */
export function simulatedReceipt(rowId: string, body: AssignmentBody, now: number): ReceiptV1 {
  const started = body.kind === 'plan' || body.kind === 'workout' || body.kind === 'habits' || body.kind === 'meals' || body.kind === 'note';
  const ticked = body.kind === 'note' ? body.checklist.map((_, i) => i).filter((i) => chance(`check|${rowId}|${i}`) < adherenceOf(rowId)) : [];
  return { v: 1, assignmentId: rowId, status: started ? 'started' : 'seen', at: now, ticked, comment: '' };
}

/* ── Strona prowadzącego: zalecenie „z historią” ──────────────────────────────────── */

/**
 * Zalecenie wysłane wstecz, tak jak `sendAssignment`: numer z przeglądarki, AAD `assignment|<współpraca>|<numer>`,
 * ta sama zawartość koperty — tylko `sentAt` i `created_at` cofnięte, żeby telefon demo miał tygodnie na
 * odpowiedzi. Wiersz wstawia klient zalogowanego prowadzącego. Przechodzi sprawdzenie telefonu albo rzuca.
 */
export async function backdatedAssignment(
  key: CryptoKey,
  connectionId: string,
  area: Area,
  body: AssignmentBody,
  sentAt: number,
  from: { name: string; profession: Profession },
): Promise<{ id: string; connection_id: string; kind: AssignmentBody['kind']; area: Area; ciphertext: string; created_at: string }> {
  const id = crypto.randomUUID();
  const envelope: AssignmentV1 = { v: 1, id, area, sentAt, from, body };
  if (!parseAssignment(envelope)) throw new Error(`demo: ${body.kind}`); // i18n-ignore: błąd programisty, nie tekst interfejsu
  const ciphertext = await sealJson(key, AAD.assignment(connectionId, id), envelope);
  return { id, connection_id: connectionId, kind: body.kind, area, ciphertext, created_at: new Date(sentAt).toISOString() };
}

/* ── Telefon: przyjęcie zaproszenia i rozmowa z serwerem ───────────────────────────── */

/** Przyjęcie zaproszenia tak jak GYM TRACKER: nowa tożsamość, token, ID podopiecznego z sekretu telefonu. */
export async function acceptInvite(
  rpc: Rpc,
  input: { inviteId: string; coachId: string; areas: Area[]; scopes: Scope[] },
): Promise<{ phone: DemoPhone; pseudonym: string; publicJwk: PublicJwk }> {
  const me = await generateIdentity(true);
  const token = newToken();
  const pseudonym = await pseudonymFor(newIdSecret(), input.coachId);
  const connectionId = await rpc<string>('invite_accept', {
    p_invite: input.inviteId,
    p_pseudonym: pseudonym,
    p_public_key: me.publicJwk,
    p_token: token,
    p_areas: input.areas,
    p_scopes: input.scopes,
  });
  const privateJwk = await crypto.subtle.exportKey('jwk', me.privateKey);
  return { phone: { connectionId, inviteId: input.inviteId, token, privateJwk }, pseudonym, publicJwk: me.publicJwk };
}

/** Klucz współpracy po stronie telefonu (ECDH z kluczem prowadzącego → HKDF z numerem zaproszenia). */
export async function phoneKey(phone: DemoPhone, coachKey: PublicJwk): Promise<CryptoKey> {
  return linkKey(await importPrivate(phone.privateJwk), coachKey, phone.inviteId);
}

const ids = (phone: DemoPhone) => ({ p_connection: phone.connectionId, p_token: phone.token });

interface PullReply {
  status: string;
  scopes: Scope[];
  assignments: { id: string; ciphertext: string; withdrawnAt: string | null }[];
}

/** Zalecenia, które telefon by pokazał: otwarte, sprawdzone, z numerem w środku równym numerowi wiersza. */
export async function pullAssignments(rpc: Rpc, phone: DemoPhone, key: CryptoKey): Promise<{ live: LiveAssignment[]; scopes: Scope[] }> {
  const pulled = await rpc<PullReply>('client_pull', ids(phone));
  const live: LiveAssignment[] = [];
  for (const x of pulled.assignments) {
    if (x.withdrawnAt) continue;
    const a = parseAssignment(await openJson(key, AAD.assignment(phone.connectionId, x.id), x.ciphertext));
    if (a && a.id.toLowerCase() === x.id.toLowerCase()) live.push({ rowId: x.id.toLowerCase(), a });
  }
  return { live, scopes: pulled.scopes ?? [] };
}

export type PushResult = 'sent' | 'ended' | 'busy';

/** Paczka do serwera; serwer przyjmuje jedną na 30 s — wtedy telefon czeka swoją kolej (`wait`) i próbuje raz jeszcze. */
export async function pushSnapshot(
  rpc: Rpc,
  phone: DemoPhone,
  key: CryptoKey,
  snapshot: SnapshotV1,
  wait: (ms: number) => Promise<void>,
  onWait?: (seconds: number) => void,
): Promise<PushResult> {
  const sealed = await sealJson(key, AAD.snapshot(phone.connectionId), snapshot);
  const args = { ...ids(phone), p_ciphertext: sealed, p_bytes: sealed.length };
  let r = await rpc<{ ok: boolean; ended?: boolean; retryAfter?: number }>('client_push', args);
  if (!r.ok && r.retryAfter && !r.ended) {
    onWait?.(r.retryAfter + 1);
    await wait((r.retryAfter + 1) * 1000);
    r = await rpc('client_push', args);
  }
  return r.ok ? 'sent' : r.ended ? 'ended' : 'busy';
}

export async function sendClientMessage(rpc: Rpc, phone: DemoPhone, key: CryptoKey, text: string, now = Date.now()): Promise<void> {
  const id = crypto.randomUUID();
  const msg: MessageV1 = { v: 1, id, at: now, text, ref: null };
  await rpc('client_message', { ...ids(phone), p_id: id, p_ciphertext: await sealJson(key, AAD.message(phone.connectionId, id, 'client'), msg) });
}

export async function putPhoto(rpc: Rpc, phone: DemoPhone, key: CryptoKey, photo: Omit<PhotoV1, 'v' | 'id'>): Promise<void> {
  const id = crypto.randomUUID();
  const p: PhotoV1 = { v: 1, id, ...photo };
  await rpc('client_photo_put', { ...ids(phone), p_id: id, p_ciphertext: await sealJson(key, AAD.photo(phone.connectionId, id), p) });
}

/* ── Symulacja ─────────────────────────────────────────────────────────────────────── */

export type SimStep = 'pull' | 'receipts' | 'push' | 'wait' | 'messages' | 'booking';

export interface SimOptions {
  now?: number;
  lang?: DemoLang;
  maxDays?: number;
  /** Odpowiedzieć na ostatnią wiadomość prowadzącego (i oznaczyć jego wiadomości jako przeczytane). */
  reply?: boolean;
  /** Zarezerwować pierwszy wolny termin, jeśli telefon nie ma jeszcze rezerwacji. */
  book?: boolean;
  /** Czekanie na kolejkę paczek (w testach — od razu). */
  wait?: (ms: number) => Promise<void>;
  onStep?: (step: SimStep, detail?: number) => void;
}

export interface SimReport {
  assignments: number;
  answers: number;
  /** Dni z odhaczeniami (nawyki i jadłospis razem). */
  ticks: number;
  receipts: number;
  push: PushResult;
  replied: boolean;
  booked: boolean;
}

interface MessagesReply {
  messages: { id: string; author: 'coach' | 'client'; ciphertext: string; createdAt: string }[];
}

interface SlotsReply {
  slots: { id: string; taken: number; capacity: number }[];
  bookings: { id: string; cancelledAt: string | null; startsAt: string }[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Jedno „otwarcie aplikacji” telefonu demo: odbiór zaleceń, potwierdzenia, odpowiedzi i odhaczenia
 * od dnia wysłania, paczka z częścią `coaching`, a na życzenie — odpowiedź na wiadomość prowadzącego
 * i rezerwacja pierwszego wolnego terminu.
 */
export async function simulatePhone(rpc: Rpc, phone: DemoPhone, coachKey: PublicJwk, opts: SimOptions = {}): Promise<SimReport> {
  const now = opts.now ?? Date.now();
  const lang = opts.lang ?? 'pl';
  const step = opts.onStep ?? (() => undefined);
  const key = await phoneKey(phone, coachKey);

  step('pull');
  const { live, scopes } = await pullAssignments(rpc, phone, key);

  step('receipts');
  let receipts = 0;
  for (const { rowId, a } of live) {
    const r = simulatedReceipt(rowId, a.body, now);
    await rpc('client_receipt', { ...ids(phone), p_assignment: rowId, p_ciphertext: await sealJson(key, AAD.receipt(phone.connectionId, rowId), r) });
    receipts++;
  }

  const today = dayIn(DEMO_TZ, now);
  const weight = (day: string) => demoWeight(Math.max(0, Math.round((Date.parse(today) - Date.parse(day)) / DAY_MS)));
  const coaching = simulateCoaching(live, { now, lang, maxDays: opts.maxDays, weight });
  const shared = (scopes.length ? scopes : SNAPSHOT_SCOPES).filter((s) => s !== 'photos');
  step('push');
  const push = await pushSnapshot(rpc, phone, key, { ...demoSnapshot(shared, { now, lang }), coaching }, opts.wait ?? sleep, (s) => step('wait', s));

  let replied = false;
  if (opts.reply) {
    step('messages');
    const { messages } = await rpc<MessagesReply>('client_messages', { ...ids(phone), p_since: null });
    const coachMsgs = messages.filter((m) => m.author === 'coach');
    const last = messages[messages.length - 1];
    if (last && last.author === 'coach') {
      const pool = REPLIES[lang];
      await sendClientMessage(rpc, phone, key, pool[Math.floor(chance(`reply|${last.id}`) * pool.length)]!, now);
      replied = true;
    }
    const upto = coachMsgs[coachMsgs.length - 1]?.createdAt;
    if (upto) await rpc('client_read', { ...ids(phone), p_upto: upto });
  }

  let booked = false;
  if (opts.book) {
    step('booking');
    const s = await rpc<SlotsReply>('client_slots', ids(phone));
    const mine = s.bookings.some((b) => !b.cancelledAt && Date.parse(b.startsAt) > now);
    const free = mine ? undefined : s.slots.find((x) => x.taken < x.capacity);
    if (free) {
      booked = await rpc('client_book', { ...ids(phone), p_slot: free.id }).then(
        () => true,
        () => false,
      );
    }
  }

  return {
    assignments: live.length,
    answers: coaching.answers.length,
    ticks: [...coaching.habits, ...coaching.meals].reduce((n, t) => n + Object.keys(t.days).length, 0),
    receipts,
    push,
    replied,
    booked,
  };
}

/** Dni zdjęć demo: siedem i cztery tygodnie temu oraz dziś (w strefie telefonu). */
export const photoDays = (now = Date.now()): string[] => [49, 28, 0].map((d) => dayIn(DEMO_TZ, now - d * DAY_MS));
