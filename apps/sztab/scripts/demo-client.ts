/**
 * Telefon demo: przyjmuje zaproszenie ze Sztabu i wysyła siedem tygodni przykładowych danych —
 * treningi z planu, ważenia, obwody, dziennik jedzenia, kroki i jedno badanie. Do sprawdzenia
 * pulpitu bez telefonu i do zrzutów ekranu. Tylko dla lokalnego Supabase (`npm run db:start`).
 *
 *   npx tsx scripts/demo-client.ts '<link zaproszenia>'
 */
import {
  AAD,
  cleanPublicJwk,
  fingerprint,
  generateIdentity,
  linkKey,
  newIdSecret,
  newToken,
  parseInviteQuery,
  pseudonymFor,
  sealJson,
} from '@gymtracker/link';
import type { SnapshotV1 } from '@gymtracker/link';

const URL_ = process.env.VITE_SZTAB_URL ?? 'http://127.0.0.1:54321';
const KEY =
  process.env.VITE_SZTAB_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await r.json()) as T & { message?: string };
  if (!r.ok) throw new Error(`${fn}: ${json.message ?? r.status}`);
  return json;
}

const DAY = 86_400_000;
const now = Date.now();
const iso = (daysAgo: number, h = 18) => new Date(Math.floor((now - daysAgo * DAY) / DAY) * DAY + h * 3600_000).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

function demoSnapshot(scopes: SnapshotV1['scopes']): SnapshotV1 {
  const start = day(49);
  const plan = { templateId: 'cel-gora-dol-kb-60', start, ticked: {}, weekdays: [1, 3, 5] };
  const log: NonNullable<SnapshotV1['training']>['log'] = [];
  const names = ['Góra A', 'Dół A', 'Góra B'];
  let n = 0;
  for (let d = 49; d >= 1; d--) {
    const wd = new Date(now - d * DAY).getUTCDay();
    if (![1, 3, 5].includes(wd) || rand(d) < 0.12) continue;
    const k = n++ % 3;
    const prog = 1 + (49 - d) / 160;
    log.push({
      date: iso(d),
      workout: names[k]!,
      ready: 'ok',
      items:
        k === 1
          ? [
              { id: 'goblet', effort: 'solid', sets: [0, 1, 2].map(() => ({ reps: 10, w: Math.round(20 * prog) })) },
              { id: 'rdl', effort: 'solid', sets: [0, 1, 2].map(() => ({ reps: 8, w: Math.round(24 * prog) })) },
            ]
          : [
              { id: 'press', effort: 'solid', sets: [0, 1, 2].map(() => ({ reps: 8, w: Math.round(12 * prog) })) },
              { id: 'row', effort: 'easy', sets: [0, 1, 2].map(() => ({ reps: 10, w: Math.round(16 * prog) })) },
            ],
      time: { secs: 2900 + Math.round(rand(d + 3) * 900), parts: [] },
      ...(d === 6 ? { note: 'Lewe kolano trochę ciągnęło przy przysiadzie' } : {}),
    } as never);
  }
  const body = Array.from({ length: 25 }, (_, i) => 49 - i * 2)
    .filter((d) => d >= 0)
    .map((d) => ({ day: day(d), kg: Math.round((87.2 - (49 - d) * 0.065 + (rand(d) - 0.5) * 0.6) * 10) / 10 }));
  const entries: NonNullable<SnapshotV1['food']>['entries'] = [];
  const days: NonNullable<SnapshotV1['food']>['days'] = [];
  for (let d = 21; d >= 1; d--) {
    const date = day(d);
    days.push({ date, drinksMl: 1500 + Math.round(rand(d) * 1000), targetKcal: 2300, targetProtein: 150, partial: d === 9 ? true : false, note: null });
    const meals: [string, string, string, number, number, number, number][] = [
      ['07:40', 'Owsianka z jogurtem', '350 g', 480, 24, 62, 12],
      ['12:30', 'Kurczak, ryż, warzywa', '450 g', 640, 48, 72, 14],
      ['16:00', 'Skyr naturalny', '150 g', 95, 17, 6, 0],
      ['19:30', 'Kanapki z twarożkiem', '3 szt.', 520, 26, 58, 18],
    ];
    meals.forEach(([time, name, amount, kcal, protein, carbs, fat], i) =>
      entries.push({ date, time, name, amount, kcal: Math.round(kcal * (0.9 + rand(d * 7 + i) * 0.25)), protein, carbs, fat, fiber: null, sugars: null, salt: null }),
    );
  }
  const cardio = Array.from({ length: 21 }, (_, i) => ({ kind: 'steps', day: day(i + 1), steps: 6500 + Math.round(rand(i) * 5000), key: `s${i}`, src: 'manual' }));
  return {
    v: 1,
    at: now,
    tz: 'Europe/Warsaw',
    lang: 'pl',
    app: 'demo-client',
    scopes,
    ...(scopes.includes('training') ? { training: { log, plan, plans: [], workouts: [], snacks: [] } } : {}),
    ...(scopes.includes('movement') ? { movement: { cardio: cardio as never } } : {}),
    ...(scopes.includes('body')
      ? { body: { body, measures: [{ day: day(42), waist: 96, hips: 104 }, { day: day(7), waist: 92.5, hips: 102 }], height: 181 } }
      : {}),
    ...(scopes.includes('food') ? { food: { days, entries } } : {}),
    ...(scopes.includes('labs')
      ? {
          labs: {
            visits: [
              {
                date: day(30),
                lab: 'Diagnostyka',
                results: [
                  { marker: 'vitD', value: 18.4, cmp: null, printed: '18,4 ng/ml', ref: [30, 50], qual: null },
                  { marker: 'ferritin', value: 64, cmp: null, printed: '64 ng/ml', ref: [30, 400], qual: null },
                ],
              },
            ],
          },
        }
      : {}),
  };
}

async function main() {
  const link = process.argv[2];
  if (!link) throw new Error('Podaj link zaproszenia');
  const q = parseInviteQuery(new URLSearchParams(link.split('?')[1] ?? ''));
  if (!q) throw new Error('To nie jest link zaproszenia');
  const preview = await rpc<{ status: string; coachId: string; coachName: string; publicKey: unknown; areas: string[]; scopes: SnapshotV1['scopes'] }>(
    'invite_preview',
    { p_invite: q.inviteId },
  );
  const coachKey = cleanPublicJwk(preview.publicKey);
  if (!coachKey || (await fingerprint(coachKey)) !== q.fingerprint) throw new Error('Odcisk klucza się nie zgadza — nie przyjmuję');
  if (preview.status !== 'open') throw new Error(`Zaproszenie: ${preview.status}`);
  const phone = await generateIdentity();
  const token = newToken();
  const pseudonym = await pseudonymFor(newIdSecret(), preview.coachId);
  const scopes: SnapshotV1['scopes'] = ['training', 'movement', 'food', 'body', 'labs'];
  const id = await rpc<string>('invite_accept', {
    p_invite: q.inviteId,
    p_pseudonym: pseudonym,
    p_public_key: phone.publicJwk,
    p_token: token,
    p_areas: preview.areas,
    p_scopes: scopes,
  });
  const key = await linkKey(phone.privateKey, coachKey, q.inviteId);
  const sealed = await sealJson(key, AAD.snapshot(id), demoSnapshot(scopes));
  await rpc('client_push', { p_connection: id, p_token: token, p_ciphertext: sealed, p_bytes: sealed.length });
  console.log(`Przyjęte u ${preview.coachName}. Współpraca ${id}, paczka ${Math.round(sealed.length / 1024)} kB.`);
}

void main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
