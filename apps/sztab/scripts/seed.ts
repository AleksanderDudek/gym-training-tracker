/**
 * Lokalny Sztab z danymi — do sprawdzania ekranów (Playwright) bez przechodzenia rejestracji.
 * Tylko lokalny Supabase (`npm run db:start`), klucze z `supabase status` (demonstracyjne CLI).
 *
 *   npx tsx apps/sztab/scripts/seed.ts coach <stan.json> [--bez-historii]
 *       prowadzący z sejfem + dwa telefony z paczką danych; każdy dostaje też zalecenia wysłane
 *       „4 tygodnie temu” (cotygodniowy check-in, nawyki, jadłospis na 7 dni) — szyfrowane kluczem
 *       prowadzącego tak jak `sendAssignment` w przeglądarce. `--bez-historii` — bez nich.
 *   npx tsx apps/sztab/scripts/seed.ts phone <stan.json>
 *       telefony odpowiadają jak prawdziwy telefon: formularze, nawyki i jadłospis najwyżej 4 tygodnie
 *       wstecz i nigdy sprzed wysłania zalecenia, dni w strefie paczki (`Europe/Warsaw`), klucz —
 *       numer wiersza małymi literami; do tego wiadomość, zdjęcia i rezerwacja pierwszego wolnego terminu.
 *
 * Logowanie w przeglądarce: /logowanie (#email, #password, „Zaloguj się”), potem /sejf (#code, kod
 * odzyskiwania z wydruku) — i jesteś na /podopieczni.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  AAD,
  addDays,
  cleanPublicJwk,
  fingerprint,
  formPeriod,
  generateIdentity,
  habitsFor,
  importPrivate,
  linkKey,
  mealDayIndex,
  newIdSecret,
  newRecoveryCode,
  newToken,
  openJson,
  parseAssignment,
  pseudonymFor,
  sealJson,
  sealPrivate,
  weekdayOf,
} from '@gymtracker/link';
import type { AnswerValue, AssignmentBody, AssignmentV1, Area, CoachingV1, FormBody, FormQuestion, PublicJwk, Scope } from '@gymtracker/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dayIn } from '../src/lib/coached';
import { demoSnapshot } from './demo-client';

const app = fileURLToPath(new URL('..', import.meta.url));
const status = JSON.parse(execSync('npx supabase status -o json', { cwd: app, stdio: ['ignore', 'pipe', 'ignore'] }).toString()) as {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = () => createClient(status.API_URL, status.ANON_KEY, opts);
const admin = () => createClient(status.API_URL, status.SERVICE_ROLE_KEY, opts);

const SCOPES: Scope[] = ['training', 'movement', 'food', 'body', 'labs', 'photos'];
const PASSWORD = 'sztab-demo-haslo-1';
/** Strefa telefonu demo — ta z paczki (`snapshot.tz`): w niej telefon liczy dni odhaczeń i okresy formularzy. */
const TZ = demoSnapshot([]).tz;
const DAY_MS = 86_400_000;
/** Zalecenia „z historią” przyszły tyle dni temu. */
const HISTORY_DAYS = 28;
const COACH = { name: 'Ola Demo', profession: 'trainer' as const };
/** Mała sylwetka 120×160 (JPEG) — zdjęcia demo. */
const PHOTO = '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';

interface Phone {
  label: string;
  connectionId: string;
  inviteId: string;
  token: string;
  privateJwk: JsonWebKey;
}
interface State {
  email: string;
  password: string;
  code: string;
  coachId: string;
  coachKey: PublicJwk;
  phones: Phone[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await anon().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

const question = (id: string, type: FormQuestion['type'], label: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id,
  type,
  label,
  help: '',
  required: false,
  unit: '',
  min: type === 'scale' ? 0 : null,
  max: type === 'scale' ? 10 : null,
  options: [],
  ...extra,
});

const meal = (slot: string, name: string, kcal: number, protein: number, carbs: number, fat: number) => ({ slot, name, recipe: null, kcal, protein, carbs, fat, note: '' });

/** Zalecenia z historią: co tydzień check-in, codzienne nawyki i jadłospis na 7 dni. */
const HISTORY: { area: Area; body: AssignmentBody }[] = [
  {
    area: 'training',
    body: {
      kind: 'form',
      title: 'Check-in tygodniowy',
      intro: 'Krótkie podsumowanie tygodnia — 2 minuty.',
      repeat: 'weekly',
      weekday: 1,
      intake: false,
      questions: [
        question('q1', 'number', 'Waga', { unit: 'kg', min: 30, max: 300 }),
        question('q2', 'scale', 'Energia w tym tygodniu', { required: true }),
        question('q3', 'number', 'Sen — średnio godzin na noc', { unit: 'h', min: 0, max: 14 }),
        question('q4', 'scale', 'Stres'),
        question('q5', 'yesno', 'Czy treningi poszły zgodnie z planem?', { required: true }),
        question('q6', 'text', 'Co było trudne w tym tygodniu?'),
      ],
    },
  },
  {
    area: 'training',
    body: {
      kind: 'habits',
      title: 'Codzienne nawyki',
      note: '',
      until: null,
      items: [
        { label: 'Kreatyna', dose: '5 g', when: 'morning', days: [1, 2, 3, 4, 5, 6, 7] },
        { label: 'Woda', dose: '2 l', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] },
        { label: 'Spacer', dose: '30 min', when: 'evening', days: [1, 2, 3, 4, 5] },
      ],
    },
  },
  {
    area: 'nutrition',
    body: {
      kind: 'meals',
      title: 'Jadłospis 2000 kcal — 7 dni',
      note: '',
      start: null,
      days: ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'].map((label, i) => ({
        label,
        meals: [
          meal('Śniadanie', i % 2 ? 'Jajecznica z pomidorami' : 'Owsianka z jogurtem i owocami', 520, 28, 60, 16),
          meal('Obiad', ['Kurczak z ryżem i warzywami', 'Łosoś z ziemniakami', 'Indyk z kaszą', 'Makaron z tuńczykiem'][i % 4]!, 720, 48, 80, 18),
          meal('Przekąska', 'Skyr z orzechami', 280, 20, 18, 12),
          meal('Kolacja', i % 3 ? 'Kanapki z pastą z ciecierzycy' : 'Sałatka z jajkiem i fetą', 480, 24, 40, 20),
        ],
      })),
    },
  },
];

/**
 * Zalecenie wysłane wstecz — tak jak `sendAssignment` w przeglądarce: numer z przeglądarki, AAD
 * `assignment|<współpraca>|<numer>`, wstawione klientem zalogowanego prowadzącego. `sentAt`
 * i `created_at` cofnięte o `HISTORY_DAYS`, żeby telefon miał 4 tygodnie na odpowiedzi.
 */
async function sendBackdated(client: SupabaseClient, key: CryptoKey, connectionId: string, area: Area, body: AssignmentBody, sentAt: number): Promise<void> {
  const id = crypto.randomUUID();
  const envelope: AssignmentV1 = { v: 1, id, area, sentAt, from: COACH, body };
  // To samo sprawdzenie, które zrobi telefon — inaczej zalecenie przepadłoby jako „zepsute”.
  if (!parseAssignment(envelope)) throw new Error(`seed: zalecenie „${body.kind}” nie przechodzi sprawdzenia telefonu`);
  const ciphertext = await sealJson(key, AAD.assignment(connectionId, id), envelope);
  const { error } = await client
    .from('assignments')
    .insert({ id, connection_id: connectionId, kind: body.kind, area, ciphertext, created_at: new Date(sentAt).toISOString() });
  if (error) throw error;
}

async function coach(file: string, history: boolean) {
  const email = `coach-demo-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const made = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (made.error) throw made.error;
  const coachId = made.data.user.id;
  const client = anon();
  const signed = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signed.error) throw signed.error;
  const me = await generateIdentity();
  const code = newRecoveryCode();
  const ins = await client.from('coaches').insert({
    id: coachId,
    display_name: COACH.name,
    profession: COACH.profession,
    bio: 'Trening siłowy i odżywianie. Konto demonstracyjne.',
    public_key: me.publicJwk,
    key_fingerprint: await fingerprint(me.publicJwk),
    sealed_key: await sealPrivate(me.privateKey, code, coachId),
  });
  if (ins.error) throw ins.error;

  const phones: Phone[] = [];
  for (const label of ['Jan (siłownia)', 'Ewa (redukcja)']) {
    const inv = await client
      .from('invites')
      .insert({ coach_id: coachId, areas: ['training', 'nutrition'], scopes: SCOPES, label })
      .select('id')
      .single();
    if (inv.error) throw inv.error;
    const phone = await generateIdentity(true);
    const token = newToken();
    const connectionId = await rpc<string>('invite_accept', {
      p_invite: inv.data.id,
      p_pseudonym: await pseudonymFor(newIdSecret(), coachId),
      p_public_key: phone.publicJwk,
      p_token: token,
      p_areas: ['training', 'nutrition'],
      p_scopes: SCOPES,
    });
    const key = await linkKey(phone.privateKey, me.publicJwk, inv.data.id);
    const sealed = await sealJson(key, AAD.snapshot(connectionId), demoSnapshot(SCOPES.filter((s) => s !== 'photos')));
    await rpc('client_push', { p_connection: connectionId, p_token: token, p_ciphertext: sealed, p_bytes: sealed.length });
    if (history) {
      // Klucz współpracy po stronie prowadzącego (ECDH jest symetryczne — ten sam co w telefonie).
      const coachKey = await linkKey(me.privateKey, phone.publicJwk, inv.data.id);
      const sentAt = Date.now() - HISTORY_DAYS * DAY_MS;
      for (const h of HISTORY) await sendBackdated(client, coachKey, connectionId, h.area, h.body, sentAt);
    }
    phones.push({ label, connectionId, inviteId: inv.data.id as string, token, privateJwk: await crypto.subtle.exportKey('jwk', phone.privateKey) });
  }
  const state: State = { email, password: PASSWORD, code, coachId, coachKey: me.publicJwk, phones };
  writeFileSync(file, JSON.stringify(state, null, 2));
  console.log(
    `Prowadzący: ${email} / ${PASSWORD}\nKod sejfu: ${code}\nPodopieczni: ${phones.map((p) => `${p.label} → /podopieczni/${p.connectionId}`).join(', ')}\n${
      history ? `Zalecenia sprzed ${HISTORY_DAYS} dni: ${HISTORY.map((h) => h.body.kind).join(', ')} (teraz \`seed.ts phone\`)\n` : ''
    }Stan: ${file}`,
  );
}

const pick = <T,>(list: readonly T[], seed: number): T => list[Math.abs(Math.floor(seed)) % list.length]!;

function answer(form: FormBody, seed: number): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  form.questions.forEach((q, i) => {
    const r = Math.abs(Math.sin(seed * 31 + i * 7));
    switch (q.type) {
      case 'text':
        out[q.id] = pick(['Dobrze, bez bólu.', 'Trochę zmęczony po pracy.', 'Świetny tydzień!', 'Mało snu, ale treningi zrobione.'], seed + i);
        break;
      case 'number': {
        const lo = q.min ?? 0;
        const hi = q.max ?? lo + 100;
        out[q.id] = Math.round((lo + (hi - lo) * (0.4 + 0.2 * r)) * 10) / 10;
        break;
      }
      case 'scale':
        out[q.id] = Math.round((q.min ?? 0) + ((q.max ?? 10) - (q.min ?? 0)) * r);
        break;
      case 'choice':
        out[q.id] = Math.floor(r * q.options.length) % q.options.length;
        break;
      case 'multi':
        out[q.id] = q.options.map((_, j) => j).filter((j) => Math.sin(seed + j * 3) > 0).slice(0, 3);
        break;
      case 'yesno':
        out[q.id] = r > 0.3;
        break;
    }
  });
  return out;
}

/** Chwila odpowiedzi w danym dniu telefonu: koło południa w Warszawie, nigdy w przyszłości. */
const answerAt = (day: string): number => Math.min(Date.parse(`${day}T11:00:00Z`), Date.now() - 60_000);

/** Dni, w które telefon odpowie na formularz: tylko od dnia wysłania, wtedy, kiedy telefon go pokazuje (`formDue`). */
function answerDays(b: FormBody, sentDay: string, today: string): string[] {
  if (b.repeat === 'once') return [sentDay < addDays(today, -1) ? addDays(today, -1) : sentDay];
  if (b.repeat === 'daily') return [...Array(14).keys()].map((d) => addDays(today, -d)).filter((day) => day >= sentDay);
  const out: string[] = [];
  const monday = addDays(today, 1 - weekdayOf(today));
  for (let k = 0; k < 7; k++) {
    const weekStart = addDays(monday, -7 * k);
    const due = addDays(weekStart, (b.weekday ?? 1) - 1);
    // Formularz, który przyszedł już po swoim dniu, telefon i tak pokazuje do niedzieli.
    const day = due < sentDay ? sentDay : due;
    if (day > today || day > addDays(weekStart, 6)) continue;
    // Bieżący tydzień czasem bez odpowiedzi — żeby było widać „czeka” i „zaległy”.
    if (k === 0 && Math.random() < 0.5) continue;
    out.push(day);
  }
  return out;
}

async function phone(file: string) {
  const state = JSON.parse(readFileSync(file, 'utf8')) as State;
  const today = dayIn(TZ, Date.now());
  for (const [pi, p] of state.phones.entries()) {
    const priv = await importPrivate(p.privateJwk);
    const key = await linkKey(priv, cleanPublicJwk(state.coachKey)!, p.inviteId);
    const pulled = await rpc<{ assignments: { id: string; ciphertext: string; withdrawnAt: string | null }[] }>('client_pull', {
      p_connection: p.connectionId,
      p_token: p.token,
    });
    // Jak telefon (`src/link/sync.ts`): numer w środku równy numerowi wiersza, zapis pod numerem wiersza małymi literami.
    const list: { rowId: string; a: AssignmentV1 }[] = [];
    for (const x of pulled.assignments.filter((a) => !a.withdrawnAt)) {
      const a = parseAssignment(await openJson(key, AAD.assignment(p.connectionId, x.id), x.ciphertext));
      if (a && a.id.toLowerCase() === x.id.toLowerCase()) list.push({ rowId: x.id.toLowerCase(), a });
    }
    const coaching: CoachingV1 = { answers: [], habits: [], meals: [] };
    for (const { rowId, a } of list) {
      const b = a.body;
      // Dzień wysłania w strefie telefonu — wcześniej zalecenia nie było, więc nie ma odpowiedzi ani odhaczeń.
      const sentDay = dayIn(TZ, a.sentAt);
      if (b.kind === 'form') {
        const periods = new Set<string>();
        for (const day of answerDays(b, sentDay, today)) {
          const period = formPeriod(b, day);
          if (periods.has(period)) continue;
          periods.add(period);
          coaching.answers.push({ assignmentId: rowId, period, at: answerAt(day), values: answer(b, Date.parse(day) / DAY_MS + pi * 100) });
        }
      } else if (b.kind === 'habits' || b.kind === 'meals') {
        const days: Record<string, number[]> = {};
        for (let d = 0; d < HISTORY_DAYS; d++) {
          const day = addDays(today, -d);
          if (day < sentDay) break;
          const due =
            b.kind === 'habits'
              ? habitsFor(b, day)
              : (() => {
                  // Jak telefon (`src/link/today.ts`): cykl od `start` albo od dnia wysłania.
                  const i = mealDayIndex(b, sentDay, day);
                  return i === null ? [] : b.days[i]!.meals.map((_, j) => j);
                })();
          const done = due.filter((j) => Math.sin(d * 13 + j * 5 + pi) > -0.5);
          if (done.length) days[day] = done;
        }
        (b.kind === 'habits' ? coaching.habits : coaching.meals).push({ assignmentId: rowId, days });
      }
    }
    const snap = { ...demoSnapshot(SCOPES.filter((s) => s !== 'photos')), coaching };
    const sealed = await sealJson(key, AAD.snapshot(p.connectionId), snap);
    let pushed = await rpc<{ ok: boolean; retryAfter?: number }>('client_push', { p_connection: p.connectionId, p_token: p.token, p_ciphertext: sealed, p_bytes: sealed.length });
    if (!pushed.ok && pushed.retryAfter) {
      await new Promise((r) => setTimeout(r, (pushed.retryAfter! + 1) * 1000));
      pushed = await rpc('client_push', { p_connection: p.connectionId, p_token: p.token, p_ciphertext: sealed, p_bytes: sealed.length });
    }
    const msgId = crypto.randomUUID();
    await rpc('client_message', {
      p_connection: p.connectionId,
      p_token: p.token,
      p_id: msgId,
      p_ciphertext: await sealJson(key, AAD.message(p.connectionId, msgId), {
        v: 1,
        id: msgId,
        at: Date.now(),
        text: pi === 0 ? 'Dzień dobry! Check-in wysłany. Kolano po przysiadach trochę pobolewa.' : 'Czy mogę zamienić kolację z czwartku na piątek?',
        ref: null,
      }),
    });
    for (const [i, d] of [56, 28, 0].entries()) {
      const id = crypto.randomUUID();
      const photo = { v: 1, id, day: addDays(today, -d), w: 120, h: 160, jpeg: PHOTO };
      await rpc('client_photo_put', { p_connection: p.connectionId, p_token: p.token, p_id: id, p_ciphertext: await sealJson(key, AAD.photo(p.connectionId, id), photo) });
      void i;
    }
    const slots = await rpc<{ slots: { id: string; taken: number; capacity: number }[] }>('client_slots', { p_connection: p.connectionId, p_token: p.token });
    const free = slots.slots.find((s) => s.taken < s.capacity);
    if (free) await rpc('client_book', { p_connection: p.connectionId, p_token: p.token, p_slot: free.id }).catch(() => undefined);
    console.log(`${p.label}: zaleceń ${list.length}, odpowiedzi ${coaching.answers.length}, nawyki ${coaching.habits.length}, jadłospisy ${coaching.meals.length}, paczka ${pushed.ok ? 'wysłana' : 'odłożona'}${free ? ', rezerwacja' : ''}`);
  }
}

const [mode, file, ...flags] = process.argv.slice(2);
if (!file || (mode !== 'coach' && mode !== 'phone')) {
  console.error('Użycie: seed.ts coach <stan.json> [--bez-historii] | seed.ts phone <stan.json>');
  process.exit(1);
}
void (mode === 'coach' ? coach(file, !flags.includes('--bez-historii')) : phone(file)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
