import { PHOTO_MAX_CHARS, cleanPublicJwk } from '@gymtracker/link';
import type { Area, AssignmentBody, PhotoV1, PublicJwk } from '@gymtracker/link';
import { LANG } from '@gt/i18n';
import { saveAlias } from '../aliases';
import { toAssignment } from '../assign';
import { connectionKey, createInvite, endConnection, getConnection } from '../data';
import type { Coach, LibraryItem, SendableBody } from '../data';
import { sb, errorCode } from '../sb';
import { exampleLibrary } from './library';
import type { ExampleKey } from './library';
import {
  DEMO_AREAS,
  DEMO_SCOPES,
  HELLO,
  acceptInvite,
  backdatedAssignment,
  phoneKey,
  photoDays,
  putPhoto,
  sendClientMessage,
  simulatePhone,
} from './phone';
import type { Rpc, SimOptions, SimReport, SimStep } from './phone';
import { DEMO_LABEL, clearDemo, loadDemo, saveDemo } from './state';
import type { DemoState } from './state';

/**
 * „Podopieczny demonstracyjny”: telefon symulowany w przeglądarce prowadzącego. Prawdziwa współpraca
 * (zaproszenie „DEMO” przyjęte przez `invite_accept`, jak z telefonu), siedem tygodni danych w paczce,
 * zalecenia „z historią” sprzed czterech tygodni z odpowiedziami, dwie wiadomości i trzy zdjęcia
 * sylwetki. Potem „Symuluj telefon” odpowiada na to, co prowadzący wysłał.
 *
 * Klucz prywatny i token telefonu demo leżą w localStorage tej przeglądarki (`sztab-demo:<konto>`) —
 * to dane zmyślone, a bez nich nie da się grać roli telefonu. Na innym komputerze demo jest zwykłą
 * współpracą z etykietą „DEMO”, bez przycisków symulacji. „Usuń demo” kończy współpracę tak jak
 * prawdziwą (serwer kasuje paczkę, zalecenia, wiadomości i zdjęcia) i zapomina telefon.
 */

const ALIAS = 'Demo';
/** Zalecenia „z historią” przyszły tyle dni temu (zalecenie o śnie — w połowie). */
export const HISTORY_DAYS = 28;
const DAY_MS = 86_400_000;

/** RPC telefonu klientem Supabase zalogowanego prowadzącego (funkcje telefonu wolno wołać także zalogowanym). */
const rpc: Rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(errorCode(error));
  return data as T;
};

export interface DemoContext {
  coach: Pick<Coach, 'id' | 'display_name' | 'profession' | 'public_key'>;
  userId: string;
  /** Klucz prywatny prowadzącego z sejfu — szyfruje zalecenia „z historią”. */
  key: CryptoKey;
}

export type CreateStep = 'invite' | 'accept' | 'history' | 'phone' | 'messages' | 'photos';

export interface CreateOptions {
  now?: number;
  onStep?: (step: CreateStep) => void;
  /** Zdjęcia sylwetki; domyślnie rysowane w przeglądarce (`silhouettePhotos`). */
  photos?: (days: string[]) => Promise<Omit<PhotoV1, 'v' | 'id'>[]>;
  /** Do testów (`client_push` przyjmuje jedną paczkę na 30 s). */
  wait?: SimOptions['wait'];
  rpc?: Rpc;
}

/** Zalecenia „z historią”: z przykładowej biblioteki, w obszarze, w którym telefon je przyjmie. */
const HISTORY: { key: ExampleKey; area: Area; daysAgo: number }[] = [
  { key: 'form-intake', area: 'training', daysAgo: HISTORY_DAYS },
  { key: 'plan', area: 'training', daysAgo: HISTORY_DAYS },
  { key: 'targets', area: 'nutrition', daysAgo: HISTORY_DAYS },
  { key: 'habitsDaily', area: 'training', daysAgo: HISTORY_DAYS },
  { key: 'mealsCut', area: 'nutrition', daysAgo: HISTORY_DAYS - 1 },
  { key: 'form-checkin', area: 'training', daysAgo: HISTORY_DAYS - 1 },
  { key: 'sleep', area: 'training', daysAgo: 14 },
];

function historyBodies(): { body: AssignmentBody; area: Area; daysAgo: number }[] {
  const batch = exampleLibrary();
  const library = batch.map((x, i): LibraryItem => ({ id: `x${i}`, kind: x.body.kind, title: x.title, body: x.body, createdAt: '', updatedAt: '' }));
  return HISTORY.map((h) => {
    const item = batch.find((x) => x.key === h.key)!;
    return { body: toAssignment(item.body as SendableBody, library, ''), area: h.area, daysAgo: h.daysAgo };
  });
}

/**
 * Zakłada podopiecznego demo. Stan telefonu zapisuje zaraz po przyjęciu zaproszenia — gdyby coś dalej
 * zawiodło, demo i tak da się usunąć jednym przyciskiem.
 */
export async function createDemoClient(ctx: DemoContext, opts: CreateOptions = {}): Promise<DemoState> {
  const call = opts.rpc ?? rpc;
  const step = opts.onStep ?? (() => undefined);
  const now = opts.now ?? Date.now();
  const coachKey = cleanPublicJwk(ctx.coach.public_key);
  if (!coachKey) throw new Error('bad_key');

  step('invite');
  const invite = await createInvite(ctx.coach.id, { areas: DEMO_AREAS, scopes: DEMO_SCOPES, message: '', label: DEMO_LABEL, days: 1 });

  step('accept');
  const { phone, pseudonym, publicJwk } = await acceptInvite(call, { inviteId: invite.id, coachId: ctx.coach.id, areas: DEMO_AREAS, scopes: DEMO_SCOPES });
  const state: DemoState = { ...phone, pseudonym, createdAt: now };
  saveDemo(ctx.userId, state);
  saveAlias(ctx.userId, pseudonym, ALIAS);

  step('history');
  await sendHistory(ctx, phone.connectionId, phone.inviteId, publicJwk, now);

  step('phone');
  await simulatePhone(call, phone, coachKey, { now, lang: LANG, wait: opts.wait });

  step('messages');
  const key = await phoneKey(phone, coachKey);
  for (const text of HELLO[LANG]) await sendClientMessage(call, phone, key, text, now);

  step('photos');
  const days = photoDays(now);
  const photos = await (opts.photos ?? silhouettePhotos)(days).catch(() => []);
  for (const p of photos) await putPhoto(call, phone, key, p);

  return state;
}

async function sendHistory(ctx: DemoContext, connectionId: string, inviteId: string, clientKey: PublicJwk, now: number): Promise<void> {
  const key = await connectionKey(ctx.key, { id: connectionId, clientKey, inviteId });
  const from = { name: ctx.coach.display_name, profession: ctx.coach.profession };
  const rows = await Promise.all(historyBodies().map((h) => backdatedAssignment(key, connectionId, h.area, h.body, now - h.daysAgo * DAY_MS, from)));
  const { error } = await sb.from('assignments').insert(rows);
  if (error) throw new Error(errorCode(error));
}

/** „Symuluj telefon”: odbiór, potwierdzenia, odpowiedzi, odhaczenia, paczka, odpowiedź na wiadomość, rezerwacja. */
export async function simulateDemo(
  ctx: Pick<DemoContext, 'coach' | 'userId'>,
  opts: { now?: number; onStep?: (s: SimStep, detail?: number) => void; wait?: SimOptions['wait']; rpc?: Rpc } = {},
): Promise<SimReport> {
  const state = loadDemo(ctx.userId);
  const coachKey = cleanPublicJwk(ctx.coach.public_key);
  if (!state || !coachKey) throw new Error('no_demo');
  try {
    return await simulatePhone(opts.rpc ?? rpc, state, coachKey, { now: opts.now, lang: LANG, reply: true, book: true, onStep: opts.onStep, wait: opts.wait });
  } catch (e) {
    // Współpraca zakończona gdzie indziej (token skasowany) — telefon demo nie ma już czego symulować.
    if (e instanceof Error && e.message === 'bad_token') clearDemo(ctx.userId);
    throw e;
  }
}

/** „Usuń demo”: koniec współpracy jak każdej innej i zapomniany telefon. Skrót „Demo” zostaje przy zakończonej. */
export async function removeDemo(userId: string, end: (id: string) => Promise<void> = endConnection): Promise<void> {
  const state = loadDemo(userId);
  if (!state) return;
  const c = await getConnection(state.connectionId).catch(() => null);
  if (c && c.status === 'active') await end(state.connectionId);
  clearDemo(userId);
}

/* ── Zdjęcia sylwetki ─────────────────────────────────────────────────────────────── */

const W = 360;
const H = 480;

/**
 * Trzy zdjęcia „sylwetki” narysowane w przeglądarce: prosta postać na tle ściany, z tygodnia na tydzień
 * odrobinę węższa w pasie. JPEG w base64 — jak zdjęcie zmniejszone na telefonie (≤ 720 px). Bez canvasu
 * (stara przeglądarka, testy) — bez zdjęć.
 */
export async function silhouettePhotos(days: string[]): Promise<Omit<PhotoV1, 'v' | 'id'>[]> {
  const out: Omit<PhotoV1, 'v' | 'id'>[] = [];
  for (const [i, day] of days.entries()) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    if (!g) return [];
    drawSilhouette(g, 1 - i * 0.07, day);
    const url = canvas.toDataURL('image/jpeg', 0.82);
    const jpeg = url.slice(url.indexOf(',') + 1);
    if (jpeg && jpeg.length <= PHOTO_MAX_CHARS && /^[A-Za-z0-9+/]+=*$/.test(jpeg)) out.push({ day, w: W, h: H, jpeg });
  }
  return out;
}

function drawSilhouette(g: CanvasRenderingContext2D, waist: number, day: string): void {
  const wall = g.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#ece7df');
  wall.addColorStop(1, '#d9d2c6');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#c4baa9';
  g.fillRect(0, H * 0.82, W, H * 0.18);

  const cx = W / 2;
  g.fillStyle = '#4f5964';
  // Głowa i szyja.
  g.beginPath();
  g.arc(cx, 78, 30, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - 11, 102, 22, 20);
  // Tułów: barki → talia → biodra.
  const sh = 74;
  const wa = 50 * waist;
  const hi = 60 * (0.6 + 0.4 * waist);
  g.beginPath();
  g.moveTo(cx - sh, 132);
  g.quadraticCurveTo(cx - sh - 4, 122, cx - sh + 16, 118);
  g.lineTo(cx + sh - 16, 118);
  g.quadraticCurveTo(cx + sh + 4, 122, cx + sh, 132);
  g.quadraticCurveTo(cx + wa + 6, 200, cx + wa, 236);
  g.quadraticCurveTo(cx + hi + 4, 262, cx + hi, 288);
  g.lineTo(cx - hi, 288);
  g.quadraticCurveTo(cx - hi - 4, 262, cx - wa, 236);
  g.quadraticCurveTo(cx - wa - 6, 200, cx - sh, 132);
  g.fill();
  // Ręce.
  g.lineCap = 'round';
  g.strokeStyle = '#4f5964';
  g.lineWidth = 22;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * (sh - 6), 138);
    g.quadraticCurveTo(cx + s * (sh + 14), 210, cx + s * (sh + 8), 280);
    g.stroke();
  }
  // Nogi.
  g.lineWidth = 30;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * hi * 0.5, 282);
    g.lineTo(cx + s * hi * 0.55, 392);
    g.lineTo(cx + s * hi * 0.6, H * 0.86);
    g.stroke();
  }
  g.fillStyle = '#6b6357';
  g.font = '600 15px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(day, cx, H - 18);
}
