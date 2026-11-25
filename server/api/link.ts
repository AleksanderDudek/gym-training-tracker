import type { Defer, Env, Send } from './api';
import { STALE_DAYS } from './schedule';
import type { DueNotify, LinkTarget, Store } from './store';
import { subscriptionOf, validTz } from './subscription';
import { pushRequest } from './webpush';
import type { Vapid } from './webpush';

/**
 * Powiadomienia od prowadzącego (GYM TRACKER Sztab) — spec 2026-11-25 „powiadomienia”.
 *
 * Telefon losuje dla każdej współpracy token (32 bajty, base64url) i rejestruje go tutaj razem ze
 * swoją subskrypcją Web Push (tą samą co przypomnienia — przeglądarka ma jedną na klucz VAPID).
 * Ten sam token dostaje prowadzący. Po swojej akcji — wiadomość, zalecenie, wizyta — przeglądarka
 * prowadzącego woła `/link/notify` tokenem i samym rodzajem zdarzenia; telefon tak samo planuje sobie
 * przypomnienie o wizycie.
 *
 * - `POST /link/register {token, subscription, tz, lang}` — z aplikacji: zakłada albo odświeża
 *   subskrypcję (bez ruszania listy przypomnień) i wiąże z nią token.
 * - `POST /link/unregister {token}` — z aplikacji: token i jego kolejka znikają.
 * - `POST /link/notify {token, kind, at?, ref?}` — teraz albo do kolejki na `at` (ms). `ended` czyści
 *   kolejkę tokenu.
 * - `POST /link/cancel {token, ref}` — odwołuje zaplanowane z tym `ref`.
 *
 * Sztab wysyła JSON bez nagłówka `Content-Type` (proste zapytanie CORS, bez preflightu, z `keepalive`),
 * telefon — z `application/json`; `readJson` czyta treść niezależnie od nagłówka, a CORS idzie po `Origin`.
 * - `linkTick` — w przebiegu crona: wysyła zaplanowane, którym wybiła godzina.
 *
 * Co wie serwer: skrót tokenu (SHA-256, sam token nie trafia do bazy), do której subskrypcji
 * należy, język, czasy rejestracji, rodzaje i czasy wysyłek z ostatniej godziny (do limitów)
 * i zaplanowane (rodzaj, czas, `ref`). Ani nazwiska, ani treści, ani numeru współpracy — treść
 * powiadomienia jest ogólna, więc i podgląd na zablokowanym ekranie niczego nie zdradza.
 */

export const KINDS = ['message', 'assignment', 'withdrawn', 'visit', 'visit-cancel', 'visit-soon', 'ended'] as const;
export type Kind = (typeof KINDS)[number];
export type Lang = 'pl' | 'en';

/** Tokenów na jedną subskrypcję (telefon): tyle współprac naraz z dużym zapasem. Najstarsze wypadają. */
export const TOKENS_PER_ENDPOINT = 10;
/** Natychmiastowych wysyłek na token w ruchomej godzinie — prowadzący nie zaleje telefonu. */
export const SENDS_PER_HOUR = 20;
/** Zaplanowanych na token. */
export const MAX_QUEUED = 200;
/** Ten sam rodzaj od tego samego tokenu w tym oknie — drugie powiadomienie nic nie wnosi. */
export const DUPLICATE_MS = 60_000;
/** `at` dalej w przyszłości — do kolejki; bliżej — od razu (cron i tak chodzi co 5 minut). */
export const QUEUE_AFTER_MS = 60_000;
/** Najdalej w przyszłość — ponad rok z zapasem na wizytę umówioną z wyprzedzeniem. */
export const MAX_AHEAD_MS = 400 * 86_400_000;
/** Token bez rejestracji przez tyle dni znika — jak cicha subskrypcja przypomnień. */
export const LINK_TTL_MS = STALE_DAYS * 86_400_000;
/** Zaplanowanych na jeden przebieg crona; reszta w następnym. */
export const DUE_PER_RUN = 50;

const HOUR = 3_600_000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const REF = /^[\w-]{1,64}$/;

const validToken = (v: unknown): v is string => typeof v === 'string' && TOKEN.test(v);
const validRef = (v: unknown): v is string => typeof v === 'string' && REF.test(v);
const isKind = (v: unknown): v is Kind => typeof v === 'string' && (KINDS as readonly string[]).includes(v);

const TEXTS: Record<Lang, Record<Kind, string>> = {
  pl: {
    message: 'Nowa wiadomość od prowadzącego',
    assignment: 'Nowe zalecenie od prowadzącego',
    withdrawn: 'Prowadzący wycofał zalecenie',
    visit: 'Prowadzący zapisał cię na wizytę',
    'visit-cancel': 'Prowadzący odwołał wizytę',
    'visit-soon': 'Za dwie godziny wizyta u prowadzącego',
    ended: 'Prowadzący zakończył współpracę',
  },
  en: {
    message: 'New message from your coach',
    assignment: 'Something new from your coach',
    withdrawn: 'Your coach withdrew something they sent',
    visit: 'Your coach booked you an appointment',
    'visit-cancel': 'Your coach cancelled an appointment',
    'visit-soon': 'Appointment with your coach in two hours',
    ended: 'Your coach ended the collaboration',
  },
};

/** Treść powiadomienia — w kształcie, który pokazuje service worker aplikacji (`src/sw.ts`). */
export const payloadOf = (kind: Kind, lang: Lang) => ({
  title: 'GYM TRACKER',
  body: TEXTS[lang][kind],
  url: '#/wspolpraca',
  tag: `coach-${kind}`,
});

/** Ile usługa powiadomień trzyma wiadomość dla telefonu offline. Wizyta za dwie godziny — tyle. */
const ttlOf = (kind: Kind): number => (kind === 'visit-soon' ? 2 * 3600 : 24 * 3600);
/** Jak długo po czasie zaplanowane jeszcze ma sens, gdy usługa powiadomień nie przyjęła go od razu. */
const lateOf = (kind: Kind): number => (kind === 'visit-soon' ? HOUR : 24 * HOUR);

/** SHA-256 tokenu, hex — w bazie leży tylko to, więc jej wyciek nie pozwala wysyłać. */
export async function hashToken(token: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const vapidOf = (env: Env): Vapid => ({
  publicKey: env.VAPID_PUBLIC_KEY,
  privateJwk: env.VAPID_PRIVATE_JWK,
  subject: env.VAPID_SUBJECT,
});

/** Jedno powiadomienie. Martwa subskrypcja (404, 410) znika od razu razem ze swoimi tokenami. */
async function deliver(
  store: Store,
  target: Pick<LinkTarget, 'endpoint' | 'lang' | 'p256dh' | 'auth'>,
  kind: Kind,
  env: Env,
  send: Send,
): Promise<'sent' | 'gone' | 'failed'> {
  const req = await pushRequest(
    { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
    payloadOf(kind, target.lang),
    vapidOf(env),
    // Temat: nowsze tego rodzaju zastępuje niedostarczone starsze — treść i tak ta sama.
    { ttl: ttlOf(kind), urgency: 'normal', topic: `coach-${kind}` },
  );
  let res: Response;
  try {
    res = await send(req);
  } catch {
    return 'failed';
  }
  if (res.status === 404 || res.status === 410) {
    await store.remove(target.endpoint);
    return 'gone';
  }
  return res.ok ? 'sent' : 'failed';
}

/** Trasy `/link/…`. Odpowiedź nie zdradza, czy token istnieje: dobrze zbudowane zapytanie — zawsze 204. */
export async function link(
  path: string,
  data: Record<string, unknown>,
  env: Env,
  store: Store,
  now: number,
  reply: (status: number, msg?: string) => Response,
  defer: Defer,
  send: Send,
): Promise<Response> {
  if (path === '/link/register') {
    const sub = subscriptionOf(data.subscription);
    const lang = data.lang;
    if (!validToken(data.token) || !sub || !validTz(data.tz) || (lang !== 'pl' && lang !== 'en'))
      return reply(400, 'zła rejestracja');
    // Najpierw subskrypcja (istniejąca lista przypomnień zostaje), potem token przy niej.
    await store.touchSub({ ...sub, tz: data.tz, updated: now });
    await store.putLink(
      { hash: await hashToken(data.token), endpoint: sub.endpoint, lang, created: now, updated: now },
      TOKENS_PER_ENDPOINT,
    );
    return reply(204);
  }

  if (path === '/link/unregister') {
    if (!validToken(data.token)) return reply(400, 'zły token');
    await store.removeLink(await hashToken(data.token));
    return reply(204);
  }

  if (path === '/link/cancel') {
    if (!validToken(data.token) || !validRef(data.ref)) return reply(400, 'zły token albo numer');
    await store.unqueue(await hashToken(data.token), data.ref);
    return reply(204);
  }

  if (path === '/link/notify') {
    const { token, kind } = data;
    const at = data.at ?? null;
    const ref = data.ref ?? null;
    // `at` w przeszłości (dowolnie dawnej) to po prostu „teraz”; za daleko naprzód — błąd.
    if (
      !validToken(token) ||
      !isKind(kind) ||
      (at !== null && (typeof at !== 'number' || !Number.isFinite(at) || at - now > MAX_AHEAD_MS)) ||
      (ref !== null && !validRef(ref))
    )
      return reply(400, 'złe powiadomienie');

    const hash = await hashToken(token);
    const target = await store.linkTarget(hash);
    // Nieznany token (albo subskrypcji już nie ma): ta sama odpowiedź, nic nie idzie i nic nie czeka.
    if (!target) return reply(204);

    if (at !== null && at - now > QUEUE_AFTER_MS) {
      await store.queueNotify({ hash, kind, at: Math.round(at), ref }, MAX_QUEUED);
      return reply(204);
    }

    // Koniec współpracy: zaplanowane od tego prowadzącego nie mają już sensu (Sztab odwołuje swoje
    // numery osobno, ale nie musi zdążyć). Także wtedy, gdy samo powiadomienie zatrzyma limit.
    if (kind === 'ended') await store.clearQueue(hash);
    // Natychmiastowe z numerem zastępuje zaplanowane tego samego rodzaju (np. zalecenie pokazane
    // jednak od razu); innych rodzajów z tym numerem nie rusza — „visit” nie skasuje „visit-soon”.
    else if (ref !== null) await store.unqueue(hash, ref, kind);
    const recent = target.recent.filter(([t]) => t > now - HOUR);
    if (recent.length >= SENDS_PER_HOUR) return reply(204);
    if (recent.some(([t, k]) => k === kind && t > now - DUPLICATE_MS)) return reply(204);
    // Zapis przed wysyłką: równoległa powtórka już go zobaczy.
    await store.setLinkRecent(hash, [...recent, [now, kind]]);
    // Wysyłka po odpowiedzi — przeglądarka prowadzącego nie czeka na usługę powiadomień.
    defer(deliver(store, target, kind, env, send).catch(() => undefined));
    return reply(204);
  }

  return reply(404);
}

/**
 * Przebieg crona dla zaplanowanych: wysyła te, którym wybiła godzina, i kasuje je zaraz po wysłaniu
 * — postęp zapisuje się po każdym, więc przebieg przerwany limitem procesora nie wyśle niczego dwa
 * razy. Przy okazji sprząta tokeny, których telefon dawno nie odświeżył.
 */
export async function linkTick(
  store: Store,
  env: Env,
  now: Date,
  send: Send = (r) => fetch(r),
): Promise<{ sent: number; dropped: number; removed: number; failed: number; pruned: number }> {
  const t = now.getTime();
  const out = { sent: 0, dropped: 0, removed: 0, failed: 0, pruned: await store.pruneLinks(t - LINK_TTL_MS) };

  // Ten sam token i rodzaj w jednym przebiegu — jedno powiadomienie (na telefonie i tak by się zastąpiły).
  const groups = new Map<string, DueNotify[]>();
  for (const d of await store.dueNotifies(t, DUE_PER_RUN)) {
    const key = `${d.hash}\u0000${d.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  const gone = new Set<string>();
  const ended = new Set<string>();
  for (const items of groups.values()) {
    const ids = items.map((i) => i.id);
    const { hash, kind, target } = items[0]!;
    // Bez tokenu albo subskrypcji, po końcu współpracy, rodzaj spoza listy, albo wszystko dawno po
    // czasie — do kosza.
    if (
      !target ||
      gone.has(target.endpoint) ||
      ended.has(hash) ||
      !isKind(kind) ||
      items.every((i) => t - i.at > lateOf(kind))
    ) {
      await store.doneNotifies(ids);
      out.dropped += ids.length;
      continue;
    }
    const r = await deliver(store, target, kind, env, send);
    if (r === 'gone') {
      // `remove` skasował subskrypcję, jej tokeny i kolejkę.
      gone.add(target.endpoint);
      out.removed++;
    } else if (r === 'sent') {
      await store.doneNotifies(ids);
      out.sent++;
      // Zaplanowany koniec współpracy zabiera resztę kolejki tokenu, jak natychmiastowy.
      if (kind === 'ended') {
        await store.clearQueue(hash);
        ended.add(hash);
      }
    } else out.failed++;
  }
  return out;
}
