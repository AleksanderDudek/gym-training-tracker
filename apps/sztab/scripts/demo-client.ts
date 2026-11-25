/**
 * Telefon demo: przyjmuje zaproszenie ze Sztabu i wysyła siedem tygodni przykładowych danych —
 * treningi z planu, ważenia, obwody, dziennik jedzenia, kroki i jedno badanie (`src/lib/demo/snapshot.ts`,
 * ta sama paczka co „Podopieczny demonstracyjny” w Sztabie). Do sprawdzenia pulpitu bez telefonu i do
 * zrzutów ekranu. Tylko dla lokalnego Supabase (`npm run db:start`).
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
import { demoSnapshot } from '../src/lib/demo/snapshot';

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
