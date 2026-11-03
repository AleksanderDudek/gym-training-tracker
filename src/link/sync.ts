import { AAD, importPrivate, linkKey, openJson, parseAssignment, sealJson } from '@gymtracker/link';
import type { Area, ReceiptV1, Scope } from '@gymtracker/link';
import type { AppState } from '../types';
import { clientEnd, clientPull, clientPush, clientReceipt, clientStatus, clientUpdate, isRpcError } from './rpc';
import { linkConfigured } from './config';
import { buildSnapshot, readExtras, sealSnapshot } from './snapshot';
import { activeConnections, connectionOf, linkState, updateLink } from './store';
import type { LinkConnection, LocalStatus, StoredAssignment } from './store';

/**
 * Rozmowa ze Sztabem dla każdej trwającej współpracy — po cichu, w tle: przy otwarciu aplikacji,
 * po powrocie do niej i po zamkniętym treningu. Bez sieci nic się nie dzieje; następne otwarcie
 * spróbuje jeszcze raz.
 *
 * 1. Zaległe zmiany (zakończenie, mniej obszarów), które przy pierwszej próbie nie doszły.
 * 2. Odbiór: obszary i zakres z serwera, nowe zalecenia (odszyfrowane i sprawdzone), wycofane.
 *    `bad_token` znaczy, że tokenu już nie ma — pytamy o stan i, gdy współpraca jest zakończona,
 *    zapisujemy to u siebie razem z uwagą na ekranie.
 * 3. Paczka danych, gdy ostatnia jest starsza niż `PUSH_EVERY_MS` (albo na żądanie).
 * 4. Potwierdzenia zaleceń, które czekały na sieć.
 */

export const PUSH_EVERY_MS = 15 * 60_000;

const keys = new Map<string, Promise<CryptoKey>>();

/** Klucz współpracy (AES-GCM) — liczony raz na wizytę. */
export function keyFor(c: LinkConnection): Promise<CryptoKey> {
  const cached = keys.get(c.id);
  if (cached) return cached;
  if (!c.privateJwk) return Promise.reject(new Error('link: no key'));
  const k = importPrivate(c.privateJwk).then((priv) => linkKey(priv, c.coachKey, c.inviteId));
  keys.set(c.id, k);
  k.catch(() => keys.delete(c.id));
  return k;
}

/** Zapisuje u siebie koniec współpracy: bez tokenu i klucza, z tym, kto zakończył. */
export function markEnded(id: string, by: 'client' | 'coach', at: number = Date.now()): void {
  keys.delete(id);
  updateLink((s) => {
    const c = s.connections.find((x) => x.id === id);
    if (!c) return;
    c.status = 'ended';
    c.endedBy = by;
    c.endedAt = c.endedAt ?? at;
    c.token = null;
    c.privateJwk = null;
    delete c.pending;
    if (by === 'coach') c.endNotice = true;
  });
}

/** Po `bad_token`: czy współpraca naprawdę się skończyła. Nie wiadomo (sieć) — `false`, nic nie zmieniamy. */
async function checkEnded(c: LinkConnection): Promise<boolean> {
  try {
    const st = await clientStatus(c.id);
    if (st && st.status === 'active') return false;
    // `null`: wiersza nie ma — prowadzący usunął konto, a z nim wszystkie współprace.
    markEnded(c.id, st?.endedBy ?? 'coach', st?.endedAt ? Date.parse(st.endedAt) || Date.now() : Date.now());
    return true;
  } catch {
    return false;
  }
}

/* ── Zaległe zmiany ────────────────────────────────────────────────────────────────── */

async function applyPending(c: LinkConnection): Promise<'done' | 'offline' | 'ended'> {
  const p = c.pending;
  if (!p || !c.token) return 'done';
  try {
    if (p.kind === 'end') {
      await clientEnd(c.id, c.token);
      markEnded(c.id, 'client');
      return 'ended';
    }
    await clientUpdate(c.id, c.token, p.areas, c.scopes);
    updateLink((s) => {
      const x = s.connections.find((y) => y.id === c.id);
      if (x) delete x.pending;
    });
    return 'done';
  } catch (e) {
    if (isRpcError(e, 'bad_token') || isRpcError(e, 'ended')) {
      // Prowadzący zakończył w międzyczasie — na jedno wychodzi.
      if (p.kind === 'end') markEnded(c.id, 'client');
      else await checkEnded(c);
      return 'ended';
    }
    return 'offline';
  }
}

/* ── Odbiór ────────────────────────────────────────────────────────────────────────── */

export async function pullOne(c: LinkConnection, now: number = Date.now()): Promise<'ok' | 'offline' | 'ended'> {
  if (!c.token) return 'ended';
  let reply;
  try {
    reply = await clientPull(c.id, c.token);
  } catch (e) {
    if (isRpcError(e, 'bad_token')) return (await checkEnded(c)) ? 'ended' : 'offline';
    return 'offline';
  }
  if (reply.status === 'ended') {
    await checkEnded(c);
    return 'ended';
  }
  const have = new Set([...linkState().assignments.map((a) => a.id), ...linkState().broken.map((b) => b.id)]);
  const fresh: StoredAssignment[] = [];
  const broken: { id: string; connectionId: string }[] = [];
  const fresher = reply.assignments.filter((a) => !have.has(a.id) && !a.withdrawnAt);
  if (fresher.length) {
    const key = await keyFor(c).catch(() => null);
    for (const x of fresher) {
      const opened = key ? parseAssignment(await openJson(key, AAD.assignment(c.id, x.id), x.ciphertext)) : null;
      // Numer w środku musi być tym z serwera: inaczej ktoś przełożył szyfrogram pod inny wiersz.
      if (!opened || opened.id.toLowerCase() !== x.id) broken.push({ id: x.id, connectionId: c.id });
      else fresh.push({ id: x.id, connectionId: c.id, a: opened, receivedAt: now, status: 'new', ticked: [], sent: 'new' });
    }
  }
  const withdrawn = new Set(reply.assignments.filter((a) => a.withdrawnAt).map((a) => a.id));
  updateLink((s) => {
    const x = s.connections.find((y) => y.id === c.id);
    if (!x) return;
    // Obszary mogą tylko ubywać i zmienia je tylko telefon — ale prawdą jest serwer.
    if (reply.areas.length) x.areas = reply.areas;
    if (!x.pending) x.scopes = reply.scopes;
    x.lastPullAt = now;
    s.assignments.push(...fresh);
    s.broken.push(...broken);
    for (const a of s.assignments) if (withdrawn.has(a.id)) a.withdrawn = true;
  });
  return 'ok';
}

/* ── Paczka danych ─────────────────────────────────────────────────────────────────── */

export type PushResult = 'sent' | 'skip' | 'offline' | 'ended' | 'too_big' | 'wait';

export async function pushOne(
  c: LinkConnection,
  state: AppState,
  opts: { force?: boolean; now?: number } = {},
): Promise<PushResult> {
  const now = opts.now ?? Date.now();
  if (!c.token) return 'ended';
  if (!opts.force && !c.pushDue && c.lastPushAt !== null && now - c.lastPushAt < PUSH_EVERY_MS) return 'skip';
  let sealed;
  try {
    const key = await keyFor(c);
    const extras = await readExtras(c.scopes, now);
    sealed = await sealSnapshot(key, c.id, (days) => buildSnapshot(state, c.scopes, extras, now, days));
  } catch {
    return 'offline';
  }
  if (!sealed) return 'too_big';
  try {
    const r = await clientPush(c.id, c.token, sealed.ciphertext, sealed.bytes);
    if (r.ended) {
      await checkEnded(c);
      return 'ended';
    }
    if (!r.ok) {
      // Serwer przyjmuje jedną paczkę na pół minuty. Ta, o którą proszono, idzie przy następnej
      // synchronizacji, a nie dopiero po kwadransie — po węższym zakresie prowadzący nie ma teraz żadnej.
      updateLink((s) => {
        const x = s.connections.find((y) => y.id === c.id);
        if (x) x.pushDue = true;
      });
      return 'wait';
    }
  } catch (e) {
    if (isRpcError(e, 'bad_token')) return (await checkEnded(c)) ? 'ended' : 'offline';
    return 'offline';
  }
  updateLink((s) => {
    const x = s.connections.find((y) => y.id === c.id);
    if (x) {
      x.lastPushAt = now;
      delete x.pushDue;
    }
  });
  return 'sent';
}

/* ── Potwierdzenia ─────────────────────────────────────────────────────────────────── */

async function sendReceipt(a: StoredAssignment): Promise<boolean> {
  const c = connectionOf(linkState(), a.connectionId);
  if (!c?.token || c.status !== 'active' || a.status === 'new' || a.status === a.sent) return false;
  const receipt: ReceiptV1 = { v: 1, assignmentId: a.id, status: a.status, at: Date.now(), ticked: [...a.ticked], comment: '' };
  try {
    const key = await keyFor(c);
    await clientReceipt(c.id, c.token, a.id, await sealJson(key, AAD.receipt(c.id, a.id), receipt));
  } catch (e) {
    // Zalecenie wycofane albo usunięte po stronie prowadzącego — nie ma już komu potwierdzać.
    if (!isRpcError(e, 'assignment_missing')) return false;
  }
  const sent = a.status;
  updateLink((s) => {
    const x = s.assignments.find((y) => y.id === a.id);
    if (x) x.sent = sent;
  });
  return true;
}

/**
 * Zmiana stanu zalecenia na tym telefonie (zobaczone, rozpoczęte, zrobione, odrzucone) i — gdy
 * jest sieć — potwierdzenie dla prowadzącego. „Zobaczone” nie cofa niczego dalszego.
 */
export async function setAssignmentStatus(id: string, status: LocalStatus, patch?: Partial<Pick<StoredAssignment, 'ticked' | 'made'>>): Promise<void> {
  const ORDER: LocalStatus[] = ['new', 'seen', 'started', 'done', 'declined'];
  const next = updateLink((s) => {
    const a = s.assignments.find((x) => x.id === id);
    if (!a) return;
    if (!(status === 'seen' && ORDER.indexOf(a.status) > ORDER.indexOf('seen'))) a.status = status;
    if (patch?.ticked) {
      a.ticked = patch.ticked;
      // Nowe odhaczenia też idą do prowadzącego: potwierdzenie z tym samym stanem wysyła się od nowa.
      a.sent = 'new';
    }
    if (patch?.made) a.made = { ...a.made, ...patch.made };
  });
  const a = next.assignments.find((x) => x.id === id);
  if (a && linkConfigured()) await sendReceipt(a);
}

/* ── Zmiany od podopiecznego ───────────────────────────────────────────────────────── */

/** Zakończenie przez podopiecznego. Bez sieci: zapisane u siebie, serwer dowie się przy następnej synchronizacji. */
export async function endConnection(id: string): Promise<'ended' | 'later'> {
  const c = connectionOf(linkState(), id);
  if (!c || c.status !== 'active') return 'ended';
  if (!c.token) {
    markEnded(id, 'client');
    return 'ended';
  }
  try {
    await clientEnd(id, c.token);
  } catch (e) {
    if (!isRpcError(e, 'bad_token')) {
      // Na ekranie zakończona od razu — to decyzja podopiecznego — a token zostaje na ponowienie.
      updateLink((s) => {
        const x = s.connections.find((y) => y.id === id);
        if (!x) return;
        x.pending = { kind: 'end' };
        x.status = 'ended';
        x.endedBy = 'client';
        x.endedAt = Date.now();
      });
      return 'later';
    }
  }
  markEnded(id, 'client');
  return 'ended';
}

/** Nowy zakres danych: najpierw serwer (węższy kasuje tam paczkę od razu), potem świeża paczka. */
export async function changeScopes(id: string, scopes: Scope[], state: AppState): Promise<'ok' | 'offline' | 'ended'> {
  const c = connectionOf(linkState(), id);
  if (!c?.token || c.status !== 'active') return 'ended';
  try {
    await clientUpdate(id, c.token, c.areas, scopes);
  } catch (e) {
    if (isRpcError(e, 'bad_token') || isRpcError(e, 'ended')) return (await checkEnded(c)) ? 'ended' : 'offline';
    return 'offline';
  }
  const next = updateLink((s) => {
    const x = s.connections.find((y) => y.id === id);
    if (x) x.scopes = scopes;
  });
  const fresh = connectionOf(next, id);
  if (fresh) await pushOne(fresh, state, { force: true });
  return 'ok';
}

/** Mniej obszarów dla współpracy (zamiana prowadzącego). Bez sieci — zaległa zmiana. */
export async function shrinkAreas(id: string, areas: Area[]): Promise<void> {
  const c = connectionOf(linkState(), id);
  if (!c?.token) return;
  updateLink((s) => {
    const x = s.connections.find((y) => y.id === id);
    if (x) {
      x.areas = areas;
      x.pending = { kind: 'areas', areas };
    }
  });
  const fresh = connectionOf(linkState(), id);
  if (fresh) await applyPending(fresh);
}

/* ── Całość ────────────────────────────────────────────────────────────────────────── */

let running: Promise<void> | null = null;

/**
 * Jedna synchronizacja wszystkich współprac naraz — druga, zawołana w trakcie, czeka na pierwszą.
 * `force` wysyła paczkę bez względu na to, kiedy szła poprzednia (po zamkniętym treningu).
 */
export function syncAll(getState: () => AppState | null, opts: { force?: boolean; now?: number } = {}): Promise<void> {
  if (!linkConfigured()) return Promise.resolve();
  if (running) return running.then(() => syncAll(getState, opts));
  running = (async () => {
    try {
      const pendingOnes = linkState().connections.filter((c) => c.pending && c.token);
      for (const c of pendingOnes) if ((await applyPending(c)) === 'offline') return;
      for (const c0 of activeConnections(linkState())) {
        const pulled = await pullOne(c0, opts.now);
        if (pulled === 'offline') return;
        if (pulled === 'ended') continue;
        const c = connectionOf(linkState(), c0.id);
        const state = getState();
        if (c && state) {
          const pushed = await pushOne(c, state, opts);
          if (pushed === 'offline') return;
        }
      }
      for (const a of linkState().assignments.filter((x) => x.status !== x.sent && x.status !== 'new')) {
        if (!(await sendReceipt(a))) break;
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Na potrzeby testów: zapomina policzone klucze. */
export const forgetKeys = (): void => keys.clear();
