import { AAD, importPrivate, isAssignmentKind, linkKey, localDay, openJson, parseAssignment, parseMessage, sealJson } from '@gymtracker/link';
import type { AnswerValue, Area, MessageRef, MessageV1, ReceiptV1, Scope } from '@gymtracker/link';
import type { AppState } from '../types';
import {
  clientEnd,
  clientMessage,
  clientMessages,
  clientPull,
  clientPush,
  clientRead,
  clientReceipt,
  clientSlots,
  clientStatus,
  clientUpdate,
  isRpcError,
} from './rpc';
import { linkConfigured } from './config';
import { syncPhotos } from './photos';
import { buildSnapshot, coachingFor, readExtras, sealSnapshot } from './snapshot';
import { activeConnections, connectionOf, linkState, updateLink } from './store';
import type { LinkConnection, LocalStatus, StoredAssignment, StoredMessage } from './store';

/**
 * Rozmowa ze Sztabem dla każdej trwającej współpracy — po cichu, w tle: przy otwarciu aplikacji,
 * po powrocie do niej i po zamkniętym treningu. Bez sieci nic się nie dzieje; następne otwarcie
 * spróbuje jeszcze raz.
 *
 * 1. Zaległe zmiany (zakończenie, mniej obszarów), które przy pierwszej próbie nie doszły.
 * 2. Odbiór: obszary i zakres z serwera, nowe zalecenia (odszyfrowane i sprawdzone), wycofane.
 *    `bad_token` znaczy, że tokenu już nie ma — pytamy o stan i, gdy współpraca jest zakończona,
 *    zapisujemy to u siebie razem z uwagą na ekranie.
 * 3. Paczka danych, gdy ostatnia jest starsza niż `PUSH_EVERY_MS` (albo na żądanie) — razem
 *    z częścią `coaching`: odpowiedziami na formularze i odhaczeniami nawyków i posiłków.
 * 4. Wiadomości od prowadzącego i zdjęcia sylwetki (gdy jest na nie zgoda).
 * 5. Potwierdzenia zaleceń i nasze wiadomości, które czekały na sieć.
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
    // Nie ma już komu potwierdzać ani czego aktualizować — inaczej kolejka potwierdzeń stałaby na nich.
    for (const a of s.assignments) if (a.connectionId === id) a.sent = a.status;
    s.unsupported = s.unsupported.filter((u) => u.connectionId !== id);
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
  // Zakres sprzed zapytania: równoległa zmiana zgody (`changeScopes`) wygrywa z odpowiedzią sprzed niej.
  const scopesBefore = JSON.stringify(connectionOf(linkState(), c.id)?.scopes ?? c.scopes);
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
  // Rodzaj nieznany wcześniej, a znany tej wersji, przychodzi jeszcze raz — po aktualizacji aplikacji.
  // „Zepsute” też: starsza wersja odrzucała rodzaje i pola, których nie znała, i liczyła je jako zepsute.
  const stillUnknown = linkState().unsupported.filter((u) => !isAssignmentKind(u.kind));
  const wasBroken = new Set(linkState().broken.map((b) => b.id));
  const have = new Set([...linkState().assignments.map((a) => a.id), ...stillUnknown.map((u) => u.id)]);
  const fresh: StoredAssignment[] = [];
  const broken: { id: string; connectionId: string }[] = [];
  const unknown: { id: string; connectionId: string; kind: string }[] = [];
  const fresher = reply.assignments.filter((a) => !have.has(a.id) && !a.withdrawnAt);
  if (fresher.length) {
    const key = await keyFor(c).catch(() => null);
    for (const x of fresher) {
      // Rodzaj z jawnej kolumny: nowszy niż ta wersja aplikacji — nie „zepsute”, tylko „zaktualizuj”.
      if (!isAssignmentKind(x.kind)) {
        unknown.push({ id: x.id, connectionId: c.id, kind: x.kind.slice(0, 20) });
        continue;
      }
      const raw = key ? await openJson(key, AAD.assignment(c.id, x.id), x.ciphertext) : null;
      const opened = raw === null ? null : parseAssignment(raw);
      const innerId = raw && typeof raw === 'object' ? String((raw as { id?: unknown }).id ?? '').toLowerCase() : '';
      // Numer w środku musi być tym z serwera: inaczej ktoś przełożył szyfrogram pod inny wiersz.
      if (raw === null || innerId !== x.id) {
        if (!wasBroken.has(x.id)) broken.push({ id: x.id, connectionId: c.id });
      } else if (!opened) {
        // Otwiera się, ale nie przechodzi sprawdzenia tej wersji (nowe pole, nowy rodzaj pytania) —
        // „zaktualizuj aplikację”, a nie „klucz się nie zgadza”.
        unknown.push({ id: x.id, connectionId: c.id, kind: x.kind.slice(0, 20) });
      } else fresh.push({ id: x.id, connectionId: c.id, a: opened, receivedAt: now, status: 'new', ticked: [], sent: 'new' });
    }
  }
  const withdrawn = new Set(reply.assignments.filter((a) => a.withdrawnAt).map((a) => a.id));
  updateLink((s) => {
    const x = s.connections.find((y) => y.id === c.id);
    if (!x) return;
    // Obszary mogą tylko ubywać i zmienia je tylko telefon — ale prawdą jest serwer.
    if (reply.areas.length) x.areas = reply.areas;
    // Zakres serwer może tylko zwęzić, nigdy poszerzyć: zgodę daje telefon. Przejęta baza nie włączy
    // w ten sposób wysyłki zdjęć ani innych danych.
    if (!x.pending && JSON.stringify(x.scopes) === scopesBefore) x.scopes = x.scopes.filter((sc) => reply.scopes.includes(sc));
    x.lastPullAt = now;
    s.assignments.push(...fresh);
    const opened = new Set(fresh.map((f) => f.id));
    s.broken = [...s.broken.filter((b) => !opened.has(b.id) && !unknown.some((u) => u.id === b.id)), ...broken];
    s.unsupported = [...s.unsupported.filter((u) => !isAssignmentKind(u.kind) && !withdrawn.has(u.id)), ...unknown];
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
  // Zakres z chwili składania, nie z chwili wywołania: właśnie cofnięta zgoda nie może pojechać.
  const scopes = connectionOf(linkState(), c.id)?.scopes ?? c.scopes;
  const sealedAt = Date.now();
  let sealed;
  try {
    const key = await keyFor(c);
    const extras = await readExtras(scopes, now);
    sealed = await sealSnapshot(key, c.id, (days) => ({
      ...buildSnapshot(state, scopes, extras, now, days),
      coaching: coachingFor(linkState(), c.id, now, days),
    }));
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
      // Odhaczenie w trakcie składania tej paczki jej nie ma — jego prośba zostaje.
      if (!(x.pushDueAt && x.pushDueAt > sealedAt)) {
        delete x.pushDue;
        delete x.pushDueAt;
      }
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
    if (!x) return;
    x.scopes = scopes;
    // Bez zgody na zdjęcia serwer skasował je od razu — mapa wysłanych też idzie do kosza.
    if (!scopes.includes('photos')) delete x.photos;
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
        const fresh = connectionOf(linkState(), c0.id);
        if (fresh?.status === 'active') {
          if ((await pullMessages(fresh)) === 'offline') return;
          if ((await refreshVisits(fresh, opts.now)) === 'offline') return;
          if (fresh.scopes.includes('photos') && (await syncPhotos(fresh)) === 'offline') return;
        }
      }
      const live = new Set(activeConnections(linkState()).map((x) => x.id));
      for (const a of linkState().assignments.filter((x) => x.status !== x.sent && x.status !== 'new' && live.has(x.connectionId))) {
        if (!(await sendReceipt(a))) break;
      }
      await flushOutbox();
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Na potrzeby testów: zapomina policzone klucze. */
export const forgetKeys = (): void => {
  keys.clear();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  pushFor.clear();
};

/* ── Wiadomości ────────────────────────────────────────────────────────────────────── */

/**
 * Nowe wiadomości jednej współpracy (od ostatniej pobranej). Każda otwierana kluczem współpracy
 * z AAD `message|<współpraca>|<numer>`; numer w środku musi być numerem wiersza. Zepsuta — pomijana.
 */
export async function pullMessages(c: LinkConnection): Promise<'ok' | 'offline' | 'ended'> {
  if (!c.token || c.status !== 'active') return 'ended';
  let reply;
  // Kursor z zakładką: `created_at` to początek transakcji, więc wiadomość z dłuższej transakcji może mieć
  // czas sprzed ostatniej pobranej. Powtórki odsiewa numer.
  const since = c.messagesSince && Number.isFinite(Date.parse(c.messagesSince)) ? new Date(Date.parse(c.messagesSince) - 5000).toISOString() : null;
  try {
    reply = await clientMessages(c.id, c.token, since);
  } catch (e) {
    if (isRpcError(e, 'bad_token')) return (await checkEnded(c)) ? 'ended' : 'offline';
    return 'offline';
  }
  const have = new Set(linkState().messages.filter((m) => m.connectionId === c.id).map((m) => m.id));
  const fresh: StoredMessage[] = [];
  const confirmed = new Map<string, string>();
  if (reply.messages.length) {
    const key = await keyFor(c).catch(() => null);
    for (const x of reply.messages) {
      if (have.has(x.id)) {
        confirmed.set(x.id, x.createdAt);
        continue;
      }
      const opened = key ? parseMessage(await openJson(key, AAD.message(c.id, x.id, x.author), x.ciphertext)) : null;
      if (!opened || opened.id.toLowerCase() !== x.id) continue;
      fresh.push({
        id: x.id,
        connectionId: c.id,
        author: x.author,
        text: opened.text,
        ref: opened.ref,
        at: opened.at,
        serverAt: x.createdAt,
        readAt: null,
      });
    }
  }
  const latest = (a: string | null | undefined, b: string | null | undefined) =>
    !a ? (b ?? null) : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b;
  const last = latest(reply.messages.at(-1)?.createdAt, c.messagesSince);
  updateLink((s) => {
    const x = s.connections.find((y) => y.id === c.id);
    if (x) {
      x.messagesSince = last;
      x.readUpTo = reply.readUpTo;
    }
    for (const m of s.messages) {
      const at = confirmed.get(m.id);
      if (at && m.connectionId === c.id) m.serverAt = at;
    }
    // Dwa pobrania naraz (synchronizacja przy powrocie na kartę i otwarta rozmowa) przynoszą te same.
    const known = new Set(s.messages.map((m) => m.id));
    s.messages.push(...fresh.filter((m) => !known.has(m.id)));
    // Najwyżej 500 wiadomości na współpracę na telefonie — starsze zostają u prowadzącego. Liczy czas
    // serwera (zegar telefonu bywa przestawiony), a niewysłanych nie rusza nigdy.
    const mine = s.messages.filter((m) => m.connectionId === c.id && m.serverAt);
    if (mine.length > 500) {
      const drop = new Set(
        mine
          .sort((a, b) => Date.parse(a.serverAt!) - Date.parse(b.serverAt!))
          .slice(0, mine.length - 500)
          .map((m) => m.id),
      );
      s.messages = s.messages.filter((m) => !drop.has(m.id));
    }
  });
  await flushRead(c.id);
  return 'ok';
}

/** „Przeczytane” dla prowadzącego, które nie doszło (brak sieci przy otwarciu rozmowy) — ponawiane. */
async function flushRead(connectionId: string): Promise<void> {
  const c = connectionOf(linkState(), connectionId);
  if (!c?.token || c.status !== 'active' || !linkConfigured()) return;
  const upTo = linkState()
    .messages.filter((m) => m.connectionId === connectionId && m.author === 'coach' && m.readAt !== null && m.serverAt)
    .map((m) => m.serverAt!)
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1);
  if (!upTo || (c.readSent && Date.parse(c.readSent) >= Date.parse(upTo))) return;
  try {
    await clientRead(c.id, c.token, upTo);
    updateLink((s) => {
      const x = s.connections.find((y) => y.id === connectionId);
      if (x) x.readSent = upTo;
    });
  } catch {
    // Bez sieci — przy następnym pobraniu wiadomości.
  }
}

async function sendOne(m: StoredMessage): Promise<'sent' | 'offline' | 'gone'> {
  const c = connectionOf(linkState(), m.connectionId);
  if (!c?.token || c.status !== 'active') return 'gone';
  const env: MessageV1 = { v: 1, id: m.id, at: m.at, text: m.text, ref: m.ref };
  try {
    const key = await keyFor(c);
    const serverAt = await clientMessage(c.id, c.token, m.id, await sealJson(key, AAD.message(c.id, m.id, 'client'), env));
    updateLink((s) => {
      const x = s.messages.find((y) => y.id === m.id);
      if (x) x.serverAt = serverAt;
    });
    return 'sent';
  } catch (e) {
    if (isRpcError(e, 'ended') || isRpcError(e, 'bad_token')) {
      await checkEnded(c);
      return 'gone';
    }
    return 'offline';
  }
}

/** Nasze wiadomości, które czekały na sieć. */
async function flushOutbox(): Promise<void> {
  for (const m of linkState().messages.filter((x) => x.author === 'client' && x.serverAt === null)) {
    if ((await sendOne(m)) === 'offline') return;
  }
}

/**
 * Nowa wiadomość do prowadzącego: od razu na ekranie, w tle do serwera. Bez sieci czeka
 * i idzie przy następnej synchronizacji. Zwraca, czy już doszła.
 */
export async function sendMessage(connectionId: string, text: string, ref: MessageRef | null = null): Promise<'sent' | 'later' | 'gone'> {
  const clean = text.trim().slice(0, 4000);
  if (!clean) return 'gone';
  const m: StoredMessage = {
    id: crypto.randomUUID(),
    connectionId,
    author: 'client',
    text: clean,
    ref,
    at: Date.now(),
    serverAt: null,
    readAt: null,
  };
  updateLink((s) => {
    s.messages.push(m);
  });
  if (!linkConfigured()) return 'later';
  const r = await sendOne(m);
  return r === 'offline' ? 'later' : r;
}

/** Rozmowa otwarta: wiadomości prowadzącego przeczytane — u siebie od razu, na serwerze gdy jest sieć. */
export async function markMessagesRead(connectionId: string, now: number = Date.now()): Promise<void> {
  const unread = linkState().messages.filter((m) => m.connectionId === connectionId && m.author === 'coach' && m.readAt === null);
  if (unread.length) {
    updateLink((s) => {
      for (const m of s.messages) if (m.connectionId === connectionId && m.author === 'coach' && m.readAt === null) m.readAt = now;
    });
  }
  // Także bez nowych: „przeczytane” mogło nie dojść poprzednim razem.
  await flushRead(connectionId);
}

/** Otwarta rozmowa: pobierz nowe i wyślij zaległe — bez reszty synchronizacji. */
export async function refreshMessages(connectionId: string): Promise<'ok' | 'offline' | 'ended'> {
  const c = connectionOf(linkState(), connectionId);
  if (!c || !linkConfigured()) return 'offline';
  const r = await pullMessages(c);
  if (r === 'ok') await flushOutbox();
  return r;
}

/* ── Odpowiedzi i odhaczenia (część `coaching` paczki) ─────────────────────────────── */

let pushTimer: ReturnType<typeof setTimeout> | null = null;
const pushFor = new Set<string>();
let pushState: (() => AppState | null) | null = null;

/**
 * Coś dla prowadzącego się zmieniło (odpowiedź, odhaczenie) — paczka idzie zaraz, a nie po
 * kwadransie. Kilka odhaczeń pod rząd składa się w jedną wysyłkę (2,5 s). Serwer i tak przyjmuje
 * jedną paczkę na 30 s; za wcześnie — idzie przy następnej synchronizacji (`pushDue`).
 */
export function pushSoon(connectionId: string, getState: () => AppState | null, delay = 2500): void {
  pushFor.add(connectionId);
  pushState = getState;
  updateLink((s) => {
    const x = s.connections.find((y) => y.id === connectionId);
    if (x) {
      x.pushDue = true;
      x.pushDueAt = Date.now();
    }
  });
  schedulePush(delay);
}

/** Serwer przyjmuje jedną paczkę na 30 s (`client_push`). */
export const PUSH_GAP_MS = 30_000;

function schedulePush(delay: number): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void runPushes(), delay);
}

async function runPushes(): Promise<void> {
  pushTimer = null;
  const ids = [...pushFor];
  pushFor.clear();
  const state = pushState?.();
  if (!state || !linkConfigured()) return;
  let again = 0;
  for (const id of ids) {
    const c = connectionOf(linkState(), id);
    if (c?.status !== 'active') continue;
    // Wcześniej niż 30 s po poprzedniej serwer i tak odmówi — nie czytamy jedzenia ani nie szyfrujemy
    // pół roku na darmo, tylko czekamy na swoją kolej.
    const since = c.lastPushAt === null ? Infinity : Date.now() - c.lastPushAt;
    if (since < PUSH_GAP_MS) {
      pushFor.add(id);
      again = Math.max(again, PUSH_GAP_MS - since + 500);
      continue;
    }
    if ((await pushOne(c, state, { force: true })) === 'wait') {
      pushFor.add(id);
      again = Math.max(again, PUSH_GAP_MS + 500);
    }
  }
  if (pushFor.size && again) schedulePush(again);
}

/** Odhaczenia i odpowiedzi starsze niż okno paczki z zapasem — telefon ich już nie wysyła. Wywiad (`once`) zostaje. */
const KEEP_DAYS = 210;

function pruneCoaching(s: { answers: { period: string; at: number }[]; ticks: Record<string, Record<string, number[]>> }, now: number): void {
  const fromMs = now - KEEP_DAYS * 86_400_000;
  const from = localDay(fromMs);
  s.answers = s.answers.filter((a) => a.period === 'once' || a.at >= fromMs);
  for (const days of Object.values(s.ticks)) for (const day of Object.keys(days)) if (day < from) delete days[day];
}

/** Odpowiedź na formularz za dany okres (`formPeriod`) — nowsza zastępuje starszą z tego okresu. */
export function saveAnswer(
  a: Pick<StoredAssignment, 'id' | 'connectionId'>,
  period: string,
  values: Record<string, AnswerValue>,
  getState: () => AppState | null,
  now: number = Date.now(),
): void {
  updateLink((s) => {
    s.answers = [...s.answers.filter((x) => !(x.assignmentId === a.id && x.period === period)), { assignmentId: a.id, period, at: now, values }];
    pruneCoaching(s, now);
  });
  pushSoon(a.connectionId, getState);
}

/** Odhaczenia nawyków albo posiłków w jednym dniu. */
export function setDayTicks(
  a: Pick<StoredAssignment, 'id' | 'connectionId'>,
  day: string,
  ticked: number[],
  getState: () => AppState | null,
): void {
  updateLink((s) => {
    const days = { ...(s.ticks[a.id] ?? {}) };
    if (ticked.length) days[day] = [...new Set(ticked)].sort((x, y) => x - y);
    else delete days[day];
    s.ticks[a.id] = days;
    pruneCoaching(s, Date.now());
  });
  pushSoon(a.connectionId, getState);
}

/* ── Wizyty ────────────────────────────────────────────────────────────────────────── */

/** Jak długo zapamiętane rezerwacje wystarczą linii „Wizyta jutro…” na ekranie Dziś. */
export const VISITS_STALE_MS = 3 * 3_600_000;

/**
 * Zapamiętane rezerwacje odświeżane w tle — tylko gdy podopieczny kiedyś otworzył wizyty (jest
 * zapis) i ten zapis ma ponad 3 godziny. Bez tego uwaga na ekranie Dziś znałaby tylko stan z chwili
 * ostatniego wejścia na stronę wizyt (a prowadzący mógł w międzyczasie odwołać termin).
 */
async function refreshVisits(c: LinkConnection, now: number = Date.now()): Promise<'ok' | 'offline' | 'ended'> {
  if (!c.token || !c.visits || now - c.visits.at < VISITS_STALE_MS) return 'ok';
  try {
    const r = await clientSlots(c.id, c.token);
    updateLink((s) => {
      const x = s.connections.find((y) => y.id === c.id);
      if (x) x.visits = { at: now, bookings: r.bookings };
    });
    return 'ok';
  } catch (e) {
    if (isRpcError(e, 'ended') || isRpcError(e, 'bad_token')) return (await checkEnded(c)) ? 'ended' : 'offline';
    return 'offline';
  }
}
