import type { Defer, Env, Send } from './api';
import { STALE_DAYS } from './schedule';
import type { DueNotify, LinkTarget, SendLimits, Store } from './store';
import { subscriptionOf, validTz } from './subscription';
import { pushRequest, sendWithin } from './webpush';
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
 *   subskrypcję (bez ruszania listy przypomnień) i wiąże z nią token. Najwyżej 30 na godzinę z jednego
 *   adresu IP (skrót z solą, trzymany godzinę), ponad to — 429.
 * - `POST /link/unregister {token}` — z aplikacji: token i jego kolejka znikają.
 * - `POST /link/notify {token, kind, at?, ref?}` — teraz (bez `at` albo `at` ≤ teraz) albo do kolejki
 *   na `at` (ms). `ended` kasuje token razem z kolejką — prowadzący po rozstaniu nie powiadomi.
 * - `POST /link/cancel {token, ref}` — odwołuje zaplanowane z tym `ref`.
 *
 * Sztab wysyła JSON bez nagłówka `Content-Type` (proste zapytanie CORS, bez preflightu, z `keepalive`),
 * telefon — z `application/json`; `readJson` czyta treść niezależnie od nagłówka, a CORS idzie po `Origin`.
 * - `linkTick` — w przebiegu crona: wysyła zaplanowane, którym wybiła godzina, sprawiedliwie i z odstępami
 *   po nieudanych próbach, żeby jedna zepsuta (albo złośliwa) subskrypcja nie zablokowała kolejki.
 *
 * Co wie serwer: skrót tokenu (SHA-256, sam token nie trafia do bazy), do której subskrypcji
 * należy, język, czasy rejestracji, rodzaje i czasy wysyłek z ostatniej godziny (do limitów)
 * i zaplanowane (rodzaj, czas, `ref`, próby). Ani nazwiska, ani treści, ani numeru współpracy — treść
 * powiadomienia jest ogólna, więc i podgląd na zablokowanym ekranie niczego nie zdradza.
 *
 * Co widzi usługa powiadomień (FCM, Apple…): adres subskrypcji, czas i nagłówki. Te są takie same dla
 * każdego rodzaju — temat `coach`, jeden czas życia dla natychmiastowych i jeden dla zaplanowanych,
 * treść dopełniona do stałej długości — więc z ruchu nie wyczyta, czy to wiadomość, czy wizyta.
 */

export const KINDS = ['message', 'assignment', 'withdrawn', 'visit', 'visit-cancel', 'visit-soon', 'ended'] as const;
export type Kind = (typeof KINDS)[number];
export type Lang = 'pl' | 'en';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Tokenów na jedną subskrypcję (telefon): tyle współprac naraz z dużym zapasem. Najstarsze wypadają. */
export const TOKENS_PER_ENDPOINT = 10;
/**
 * Wysyłek na token w ruchomej godzinie — natychmiastowych i z kolejki razem; liczy się każda próba, także
 * nieudana. Prowadzący nie zaleje telefonu, a zepsuta subskrypcja nie zje pracy crona.
 */
export const SENDS_PER_HOUR = 20;
/** Zaplanowanych na token. */
export const MAX_QUEUED = 200;
/** Ten sam rodzaj od tego samego tokenu w tym oknie — drugie powiadomienie nic nie wnosi. */
export const DUPLICATE_MS = MIN;
/** Najdalej w przyszłość — ponad rok z zapasem na wizytę umówioną z wyprzedzeniem. */
export const MAX_AHEAD_MS = 400 * 86_400_000;
/** Token bez rejestracji przez tyle dni znika — jak cicha subskrypcja przypomnień. */
export const LINK_TTL_MS = STALE_DAYS * 86_400_000;
/** Rejestracji tokenów na godzinę z jednego adresu IP. Telefon odświeża swoje co kilka dni. */
export const REGISTRATIONS_PER_HOUR = 30;

/**
 * Przebieg crona: najwyżej tyle wysyłek z kolejki. Skromnie — przypomnienia idą w tym samym przebiegu
 * (przed tymi), a darmowy plan Workers daje mu kilka milisekund procesora i 50 zapytań na zewnątrz.
 */
export const SENDS_PER_RUN = 10;
/** Z jednego tokenu najwyżej tyle zaplanowanych na przebieg — jeden nadawca nie weźmie całej puli. */
export const PER_TOKEN_PER_RUN = 3;
/** Z jednej subskrypcji (telefonu, do 10 tokenów) najwyżej tyle na przebieg. */
export const PER_ENDPOINT_PER_RUN = 5;
/** Kandydatów z bazy na przebieg — z zapasem na sklejone i odłożone, które nie zużywają wysyłki. */
export const DUE_PER_RUN = 40;
/** Po tylu nieudanych próbach zaplanowane przepada. */
export const MAX_ATTEMPTS = 3;
/**
 * Odstęp po nieudanej próbie: po pierwszej 5 minut, po drugiej 20. Po trzeciej zaplanowane przepada,
 * a reszta kolejki tej subskrypcji czeka godzinę.
 */
export const RETRY_AFTER_MS = [5 * MIN, 20 * MIN, HOUR] as const;
/**
 * Dzierżawa: wzięte do wysyłki nie wypada innym przebiegom przez tyle czasu. Przebieg trwa sekundy (najwyżej
 * `SENDS_PER_RUN` × 10 s limitu na wysyłkę); przerwany w trakcie — wzięte wrócą po tym czasie.
 */
export const CLAIM_MS = 5 * MIN;

/**
 * Temat dla usługi powiadomień — jeden dla wszystkich rodzajów, bo usługa widzi go otwartym tekstem
 * (`coach-visit-soon` mówiłby jej, kiedy ktoś ma wizytę). RFC 8030 §5.4: do 32 znaków base64url.
 * Skutek: telefon offline dostaje po powrocie tylko najnowsze powiadomienie od prowadzącego — wszystkie
 * i tak otwierają ten sam ekran współpracy.
 */
export const TOPIC = 'coach';
/**
 * Czas życia w usłudze powiadomień, gdy telefon jest offline — zależny od drogi, nie od rodzaju.
 * Natychmiastowe: doba (wiadomość z wieczora ma przyjść rano). Zaplanowane: dwie godziny, bo przypomnienie
 * „za dwie godziny wizyta” po czasie wprowadzałoby w błąd. To, że coś było zaplanowane, usługa i tak
 * widzi po godzinie wysyłki (przebieg crona co 5 minut), więc osobny czas niczego więcej nie zdradza.
 */
export const TTL_NOW_S = 24 * 3600;
export const TTL_QUEUED_S = 2 * 3600;
/** Treść dopełniona do tylu bajtów: każdy rodzaj w każdym języku ma ten sam rozmiar szyfrogramu. */
export const PAD_TO = 160;

const SEND_LIMITS: SendLimits = { max: SENDS_PER_HOUR, window: HOUR, duplicate: DUPLICATE_MS };

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
/** `ref` od klientów to dziś 32 znaki hex (HMAC numeru); wzorzec zostaje szerszy, zgodny wstecz. */
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
  // Znacznik jest w zaszyfrowanej treści — widzi go tylko telefon (ten sam rodzaj zastępuje poprzednie).
  tag: `coach-${kind}`,
});

/** Jak długo po czasie zaplanowane jeszcze ma sens (`expires` w kolejce). */
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

/**
 * Jedno powiadomienie, z limitem czasu. Martwa subskrypcja (404, 410) znika od razu razem ze swoimi
 * tokenami; każdy inny kłopot (inny kod, sieć, limit czasu, zły klucz) to `failed`.
 */
async function deliver(
  store: Store,
  target: Pick<LinkTarget, 'endpoint' | 'lang' | 'p256dh' | 'auth'>,
  kind: Kind,
  env: Env,
  send: Send,
  ttl: number,
): Promise<'sent' | 'gone' | 'failed'> {
  let res: Response;
  try {
    const req = await pushRequest(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      payloadOf(kind, target.lang),
      vapidOf(env),
      { ttl, urgency: 'normal', topic: TOPIC, padTo: PAD_TO },
    );
    res = await sendWithin(send, req);
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
  ipHash: () => Promise<string>,
): Promise<Response> {
  if (path === '/link/register') {
    const sub = subscriptionOf(data.subscription);
    const lang = data.lang;
    if (!validToken(data.token) || !sub || !validTz(data.tz) || (lang !== 'pl' && lang !== 'en'))
      return reply(400, 'zła rejestracja');
    // Limit z jednego adresu — sprawdzenie i zapis jednym krokiem. Telefon traktuje 429 jak brak sieci
    // i ponawia przy następnej synchronizacji.
    if (!(await store.reserveRegistration(await ipHash(), now, REGISTRATIONS_PER_HOUR, HOUR)))
      return reply(429, 'za dużo rejestracji');
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

    // Każde `at` w przyszłości — choćby o sekundę — do kolejki: zalecenie „pokaż od” staje się widoczne
    // dla telefonu dopiero o tym czasie, więc powiadomienie nie może przyjść przed nim. Cron i tak chodzi
    // co 5 minut.
    if (at !== null && at > now) {
      const when = Math.round(at);
      await store.queueNotify({ hash, kind, at: when, ref, expires: when + lateOf(kind) }, MAX_QUEUED);
      return reply(204);
    }

    // Natychmiastowe z numerem zastępuje zaplanowane tego samego rodzaju (np. zalecenie pokazane
    // jednak od razu); innych rodzajów z tym numerem nie rusza — „visit” nie skasuje „visit-soon”.
    if (ref !== null && kind !== 'ended') await store.unqueue(hash, ref, kind);
    // Rezerwacja miejsca w limicie — sprawdzenie i zapis jednym krokiem, więc sto równoległych zapytań
    // nie przejdzie jako sto wysyłek.
    const slot = await store.reserveSend(hash, kind, now, SEND_LIMITS);
    // Koniec współpracy: token znika razem z kolejką, także gdy samo powiadomienie zatrzyma limit —
    // były prowadzący nie powiadomi już niczym, zanim telefon zauważy koniec przy synchronizacji.
    if (kind === 'ended') await store.removeLink(hash);
    if (slot.result !== 'ok') return reply(204);
    // Wysyłka po odpowiedzi — przeglądarka prowadzącego nie czeka na usługę powiadomień.
    defer(deliver(store, target, kind, env, send, TTL_NOW_S).catch(() => undefined));
    return reply(204);
  }

  return reply(404);
}

/** Wynik przebiegu crona dla zaplanowanych — tak, jak trafia do dziennika Workera. */
export interface LinkTickResult {
  /** Wysłane (jedno powiadomienie może załatwić kilka zaplanowanych tego samego rodzaju). */
  sent: number;
  /** Nieudane próby (zostają z odstępem albo, po trzeciej, przepadają). */
  failed: number;
  /** Grupy odłożone, bo token wyczerpał godzinny limit — poczekają, aż się zwolni. */
  deferred: number;
  /** Skasowane bez wysyłki: po terminie, po trzech próbach, sklejone z właśnie wysłanym, osierocone. */
  dropped: number;
  /** Martwe subskrypcje (404/410) skasowane razem z tokenami. */
  removed: number;
  /** Tokeny bez rejestracji od 45 dni. */
  pruned: number;
}

/**
 * Przebieg crona dla zaplanowanych.
 *
 * 1. Sprząta: tokeny bez rejestracji od 45 dni, limity sprzed godziny, zaplanowane po terminie
 *    (zaplanowany koniec współpracy, który przepadł, i tak kasuje token).
 * 2. Wybiera sprawiedliwie (`Store.dueNotifies`): najwyżej 3 na token i 5 na subskrypcję, po kolei —
 *    najpierw pierwsze każdego tokenu — i najwyżej `SENDS_PER_RUN` wysyłek na przebieg.
 * 3. Każdą grupę (token + rodzaj) najpierw bierze w dzierżawę (równoległy przebieg jej nie weźmie,
 *    a przerwany jej nie zgubi), potem liczy do godzinnego limitu tokenu (wyczerpany — kolejka tokenu
 *    czeka, aż się zwolni, bez liczenia próby), dopiero potem wysyła. Udana kasuje wszystkie zaplanowane
 *    tego rodzaju dla tokenu, którym już wybiła godzina. Nieudana dolicza próbę (po trzeciej przepada)
 *    i odkłada całą kolejkę tej subskrypcji o odstęp: zepsuty telefon zabiera jedno miejsce na przebieg,
 *    a nie wszystkie.
 *
 * Każde zaplanowane wychodzi raz, poza jednym przypadkiem: przebieg przerwany między przyjęciem przez
 * usługę a skasowaniem z kolejki wyśle je ponownie po dzierżawie (ten sam temat i znacznik — na telefonie
 * zastępuje poprzednie, więc widać jedno).
 */
export async function linkTick(store: Store, env: Env, now: Date, send: Send = (r) => fetch(r)): Promise<LinkTickResult> {
  const t = now.getTime();
  const out: LinkTickResult = { sent: 0, failed: 0, deferred: 0, dropped: 0, removed: 0, pruned: await store.pruneLinks(t - LINK_TTL_MS) };
  await store.pruneLimits(t - HOUR);

  const expired = await store.expireNotifies(t);
  out.dropped += expired.length;
  for (const hash of new Set(expired.filter((e) => e.kind === 'ended').map((e) => e.hash))) await store.removeLink(hash);

  const groups = new Map<string, DueNotify[]>();
  for (const d of await store.dueNotifies(t, { perToken: PER_TOKEN_PER_RUN, perEndpoint: PER_ENDPOINT_PER_RUN, limit: DUE_PER_RUN })) {
    const key = `${d.hash}\u0000${d.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  // Tokeny i subskrypcje, których w tym przebiegu już nie ruszać: koniec współpracy, wyczerpany limit,
  // nieudana wysyłka, martwa subskrypcja.
  const skip = new Set<string>();
  let pushes = 0;
  for (const items of groups.values()) {
    if (pushes >= SENDS_PER_RUN) break;
    const { hash, kind, target } = items[0]!;
    const ids = items.map((i) => i.id);
    if (skip.has(hash) || (target && skip.has(target.endpoint))) continue;
    // Błąd jednej grupy (baza, klucze) nie przerywa przebiegu — reszta idzie dalej.
    try {
      if (!target || !isKind(kind)) {
        await store.doneNotifies(ids);
        out.dropped += ids.length;
        continue;
      }
      const finish = async () => {
        await store.settleNotifies(hash, kind, t);
        if (kind === 'ended') {
          await store.removeLink(hash);
          skip.add(hash);
        }
      };

      // Najpierw dzierżawa: równoległy przebieg, który wybrał to samo, dostanie pustą listę i pójdzie dalej.
      const claimed = await store.claimNotifies(ids, t, t + CLAIM_MS);
      if (!claimed.length) continue;

      const slot = await store.reserveSend(hash, kind, t, SEND_LIMITS);
      if (slot.result === 'budget') {
        // Limit tokenu wyczerpany (także przez natychmiastowe): cała jego kolejka czeka, aż się zwolni —
        // bez liczenia próby, więc nic nie przepada.
        await store.deferNotifies({ hash }, slot.until);
        out.deferred++;
        skip.add(hash);
        continue;
      }
      if (slot.result === 'duplicate') {
        // Ten sam rodzaj właśnie poszedł do tego telefonu — załatwia i te.
        await finish();
        out.dropped += claimed.length;
        continue;
      }

      pushes++;
      const r = await deliver(store, target, kind, env, send, TTL_QUEUED_S);
      if (r === 'gone') {
        // `remove` skasował subskrypcję, jej tokeny i kolejkę.
        skip.add(target.endpoint);
        out.removed++;
      } else if (r === 'sent') {
        await finish();
        out.sent++;
      } else {
        out.failed++;
        const attempt = Math.max(...items.filter((i) => claimed.includes(i.id)).map((i) => i.attempts)) + 1;
        const retry = t + RETRY_AFTER_MS[Math.min(attempt, RETRY_AFTER_MS.length) - 1]!;
        if (attempt >= MAX_ATTEMPTS) {
          await finish();
          out.dropped += claimed.length;
        } else await store.failNotifies(claimed, retry);
        // Ta subskrypcja nie przyjmuje: cała jej kolejka czeka tyle samo, więc zepsuty albo złośliwy
        // telefon zabiera najwyżej jedno miejsce na przebieg, a jego zaplanowane trafiają za cudze.
        await store.deferNotifies({ endpoint: target.endpoint }, retry);
        skip.add(target.endpoint);
      }
    } catch {
      out.failed++;
      skip.add(hash);
    }
  }
  return out;
}
