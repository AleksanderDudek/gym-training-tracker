import type { ReminderItem, SubRecord } from './schedule';
import type { StatsCount } from './stats';

/**
 * Gdzie leżą subskrypcje. Interfejs, a nie od razu D1, bo test i serwer lokalny trzymają je
 * w pamięci, a gdyby kiedyś trzeba było przenieść serwer na inną platformę, zmienia się
 * tylko ten plik.
 */
/** Wiadomość od użytkownika. Adresu IP nie ma — tylko jego skrót do limitu wiadomości na godzinę. */
export interface FeedbackRecord {
  id: string;
  /** ms */
  created: number;
  email: string | null;
  text: string;
  /** Ekran, z którego przyszła wiadomość. */
  view: string;
  /** Ślad wizyty i dane techniczne jako JSON. */
  context: string;
  /** Zrzut ekranu jako `data:` URL. */
  screenshot: string | null;
  ipHash: string;
}

export type FeedbackSummary = Omit<FeedbackRecord, 'screenshot' | 'ipHash'> & { hasShot: boolean };

/**
 * Skrzynka zegarka: najnowsza zaszyfrowana paczka z zegarka Garmin. Serwer nie ma klucza —
 * widzi tylko szyfrogram, czas zapisu i skrót adresu, z którego skrzynkę założono.
 */
export interface BoxRecord {
  /** 32 znaki hex wyprowadzone z klucza, którego serwer nie zna. */
  box: string;
  /** Koperta w base64: wersja, IV, szyfrogram, znacznik HMAC. */
  blob: string;
  /** Ostatni zapis, ms. Po tygodniu ciszy skrzynka znika. */
  updated: number;
  /** Założenie skrzynki, ms — do limitu nowych skrzynek z jednego adresu. */
  created: number;
  ipHash: string;
}

/**
 * Token powiadomień jednej współpracy z prowadzącym (`link.ts`), przypięty do subskrypcji telefonu.
 * Samego tokenu serwer nie zna — tylko jego skrót.
 */
export interface LinkRecord {
  /** SHA-256 tokenu, hex. */
  hash: string;
  /** Subskrypcja telefonu (wiersz w `subs`), na którą idą powiadomienia. */
  endpoint: string;
  lang: 'pl' | 'en';
  /** ms */
  created: number;
  /** Ostatnia rejestracja z telefonu, ms. Po 45 dniach ciszy token znika. */
  updated: number;
}

/** Token razem z kluczami subskrypcji — tyle, ile trzeba do wysłania. */
export interface LinkTarget extends LinkRecord {
  p256dh: string;
  auth: string;
}

/** Zaplanowane powiadomienie od prowadzącego. */
export interface QueuedNotify {
  hash: string;
  kind: string;
  /** Kiedy wysłać, ms. */
  at: number;
  /** Numer od prowadzącego, po którym da się je podmienić albo odwołać. */
  ref: string | null;
  /** Po tym czasie (ms) wysyłka nie ma już sensu — przepada bez próby. */
  expires: number;
}

/** Zaplanowane, któremu wybiła godzina; `target` — `null`, gdy tokenu albo subskrypcji już nie ma. */
export interface DueNotify extends QueuedNotify {
  id: number;
  /** Nieudane próby wysyłki do tej pory. */
  attempts: number;
  /** Najwcześniej następna próba, ms. */
  nextTry: number;
  target: Pick<LinkTarget, 'endpoint' | 'lang' | 'p256dh' | 'auth'> | null;
}

/** Ile zaplanowanych wybrać na przebieg crona: najwyżej tyle na token i na subskrypcję, razem `limit`. */
export interface DueLimits {
  perToken: number;
  perEndpoint: number;
  limit: number;
}

/** Limit wysyłek tokenu: `max` w oknie `window` ms, ten sam rodzaj najwyżej raz na `duplicate` ms. */
export interface SendLimits {
  max: number;
  window: number;
  duplicate: number;
}

/**
 * Wynik rezerwacji wysyłki: `ok` — miejsce zajęte, można wysyłać; `duplicate` — ten sam rodzaj właśnie
 * wyszedł; `budget` — limit wyczerpany do `until` (ms).
 */
export type SendSlot = { result: 'ok' } | { result: 'duplicate' } | { result: 'budget'; until: number };

export interface Store {
  all(): Promise<SubRecord[]>;
  /** Nowa lista przypomnień. Lista wysłanych zostaje — inaczej to samo przyszłoby dwa razy. */
  upsert(r: Omit<SubRecord, 'sent'>): Promise<void>;
  /**
   * Subskrypcja dla powiadomień od prowadzącego: zakłada ją z pustą listą przypomnień, a istniejącej
   * odświeża tylko klucze, strefę i czas — lista przypomnień i wysłanych zostaje.
   */
  touchSub(r: Omit<SubRecord, 'items' | 'sent'>): Promise<void>;
  markSent(endpoint: string, sent: string[]): Promise<void>;
  /** Kasuje subskrypcję razem z jej tokenami współpracy i ich kolejką. */
  remove(endpoint: string): Promise<void>;
  /**
   * Zapisuje token (albo odświeża adres, język i czas; założenie zostaje). Przy subskrypcji zostaje
   * najwyżej `max` najświeższych tokenów — starsze znikają razem ze swoją kolejką.
   */
  putLink(r: LinkRecord, max: number): Promise<void>;
  /** Kasuje token, jego kolejkę i wysyłki z ostatniej godziny. */
  removeLink(hash: string): Promise<void>;
  /** Token z kluczami subskrypcji albo `null` (nie ma tokenu albo subskrypcji). */
  linkTarget(hash: string): Promise<LinkTarget | null>;
  /** Kasuje tokeny bez rejestracji od `before` (ms) razem z kolejką; zwraca, ile ich było. */
  pruneLinks(before: number): Promise<number>;
  /**
   * Rezerwuje wysyłkę dla tokenu — sprawdzenie limitu i zapis w jednym kroku (w D1 jednym zapytaniem),
   * więc równoległe zapytania nie przeskoczą ani limitu, ani sklejania powtórek.
   */
  reserveSend(hash: string, kind: string, now: number, limits: SendLimits): Promise<SendSlot>;
  /** Rezerwuje rejestrację z tego skrótu adresu: `false`, gdy w oknie `window` ms było już `max`. Też w jednym kroku. */
  reserveRegistration(ipHash: string, now: number, max: number, window: number): Promise<boolean>;
  /** Kasuje wysyłki i rejestracje sprzed `before` (ms) — potrzebne są tylko z ostatniej godziny. */
  pruneLimits(before: number): Promise<void>;
  /**
   * Do kolejki (`attempts` 0, pierwsza próba o `at`). Ten sam `ref` podmienia wcześniejsze; nowe ponad
   * `max` zaplanowanych dla tokenu przepada bez słowa.
   */
  queueNotify(q: QueuedNotify, max: number): Promise<void>;
  /** Kasuje zaplanowane z tym `ref` (tylko danego rodzaju, gdy podany). */
  unqueue(hash: string, ref: string, kind?: string): Promise<void>;
  /**
   * Zaplanowane z następną próbą ≤ `now`, sprawiedliwie: z każdego tokenu najwyżej `perToken` (najdawniej
   * czekające), z każdej subskrypcji najwyżej `perEndpoint`, razem `limit` — po kolei, najpierw pierwsze
   * każdego tokenu, potem drugie… (w obrębie kolejki — najdawniej czekające).
   */
  dueNotifies(now: number, limits: DueLimits): Promise<DueNotify[]>;
  /**
   * Bierze zaplanowane do wysyłki (dzierżawa): przesuwa następną próbę na `until` — tylko tym, którym
   * wciąż wypada (`next_try ≤ now`), więc dwa przebiegi naraz nie wezmą tego samego, a przerwany przebieg
   * nie gubi wziętych (wrócą po `until`). Zwraca wzięte.
   */
  claimNotifies(ids: number[], now: number, until: number): Promise<number[]>;
  /** Nieudana próba: dolicza ją i wyznacza następną na `nextTry`. */
  failNotifies(ids: number[], nextTry: number): Promise<void>;
  /** Odkłada zaplanowane tokenu albo wszystkich tokenów subskrypcji: następna próba najwcześniej `until`. */
  deferNotifies(where: { hash: string } | { endpoint: string }, until: number): Promise<void>;
  /** Kasuje zaplanowane tokenu tego rodzaju z `at` ≤ `upTo` — jedno powiadomienie załatwia je wszystkie. */
  settleNotifies(hash: string, kind: string, upTo: number): Promise<void>;
  /** Kasuje z kolejki (osierocone albo w złym kształcie). */
  doneNotifies(ids: number[]): Promise<void>;
  /** Kasuje zaplanowane po terminie (`expires` < `now`); zwraca skasowane. */
  expireNotifies(now: number): Promise<{ hash: string; kind: string }[]>;
  addFeedback(f: FeedbackRecord): Promise<void>;
  /** Najnowsze najpierw. */
  listFeedback(limit: number): Promise<FeedbackSummary[]>;
  feedbackShot(id: string): Promise<string | null>;
  /** Ile wiadomości przyszło z tego skrótu adresu od `since` (ms). */
  recentFeedback(ipHash: string, since: number): Promise<number>;
  /** Nowa paczka. Założenie i skrót adresu zostają z pierwszego zapisu skrzynki. */
  putBox(r: BoxRecord): Promise<void>;
  getBox(box: string): Promise<BoxRecord | null>;
  removeBox(box: string): Promise<void>;
  /** Ile skrzynek założono z tego skrótu adresu od `since` (ms). */
  recentBoxes(ipHash: string, since: number): Promise<number>;
  /** Kasuje skrzynki bez zapisu od `before` (ms); zwraca, ile ich było. */
  pruneBoxes(before: number): Promise<number>;
  /** Dolicza liczniki dnia: klucz `zdarzenie\0wartość` → ile razy. */
  addStats(day: string, counts: Map<string, number>): Promise<void>;
  /** Liczniki od dnia `from` (włącznie). */
  listStats(from: string): Promise<StatsCount[]>;
}

const summary = ({ screenshot, ipHash: _ip, ...f }: FeedbackRecord): FeedbackSummary => ({ ...f, hasShot: !!screenshot });

export function memoryStore(): Store {
  const m = new Map<string, SubRecord>();
  const fb: FeedbackRecord[] = [];
  const boxes = new Map<string, BoxRecord>();
  const stats = new Map<string, number>();
  const links = new Map<string, LinkRecord>();
  type Queued = QueuedNotify & { id: number; attempts: number; nextTry: number };
  let queue: Queued[] = [];
  let nextId = 1;
  let sends: { hash: string; at: number; kind: string }[] = [];
  let registrations: { ipHash: string; at: number }[] = [];
  /** Zostawia tokeny, które przechodzą `keep`; kolejka i wysyłki znikają razem z tokenem. */
  const keepLinks = (keep: (l: LinkRecord) => boolean) => {
    const dropped = new Set<string>();
    for (const [h, l] of links)
      if (!keep(l)) {
        links.delete(h);
        dropped.add(h);
      }
    queue = queue.filter((q) => !dropped.has(q.hash));
    sends = sends.filter((x) => !dropped.has(x.hash));
  };
  const targetOf = (hash: string) => {
    const l = links.get(hash);
    const sub = l && m.get(l.endpoint);
    return l && sub ? { l, sub } : null;
  };
  return {
    touchSub: async (r) => {
      const old = m.get(r.endpoint);
      m.set(r.endpoint, old ? { ...old, p256dh: r.p256dh, auth: r.auth, tz: r.tz, updated: r.updated } : { ...r, items: [], sent: [] });
    },
    putLink: async (r, max) => {
      const old = links.get(r.hash);
      links.set(r.hash, { ...r, created: old?.created ?? r.created });
      const fresh = new Set(
        [...links.values()]
          .filter((l) => l.endpoint === r.endpoint)
          .sort((a, b) => b.updated - a.updated || (a.hash < b.hash ? 1 : -1))
          .slice(0, max)
          .map((l) => l.hash),
      );
      keepLinks((l) => l.endpoint !== r.endpoint || fresh.has(l.hash));
    },
    removeLink: async (hash) => keepLinks((l) => l.hash !== hash),
    linkTarget: async (hash) => {
      const t = targetOf(hash);
      return t ? structuredClone({ ...t.l, p256dh: t.sub.p256dh, auth: t.sub.auth }) : null;
    },
    pruneLinks: async (before) => {
      const n = links.size;
      keepLinks((l) => l.updated >= before);
      return n - links.size;
    },
    // Bez `await` między sprawdzeniem a zapisem — w jednym kroku, jak jedno zapytanie w D1.
    reserveSend: async (hash, kind, now, { max, window, duplicate }) => {
      const recent = sends.filter((x) => x.hash === hash && x.at > now - window);
      if (recent.some((x) => x.kind === kind && x.at > now - duplicate)) return { result: 'duplicate' };
      if (recent.length >= max) return { result: 'budget', until: Math.min(...recent.map((x) => x.at)) + window };
      sends.push({ hash, at: now, kind });
      return { result: 'ok' };
    },
    reserveRegistration: async (ipHash, now, max, window) => {
      if (registrations.filter((r) => r.ipHash === ipHash && r.at > now - window).length >= max) return false;
      registrations.push({ ipHash, at: now });
      return true;
    },
    pruneLimits: async (before) => {
      sends = sends.filter((x) => x.at > before);
      registrations = registrations.filter((r) => r.at > before);
    },
    queueNotify: async (q, max) => {
      if (q.ref !== null) queue = queue.filter((x) => !(x.hash === q.hash && x.ref === q.ref));
      if (queue.filter((x) => x.hash === q.hash).length < max) queue.push({ ...q, id: nextId++, attempts: 0, nextTry: q.at });
    },
    unqueue: async (hash, ref, kind) => {
      queue = queue.filter((x) => !(x.hash === hash && x.ref === ref && (kind === undefined || x.kind === kind)));
    },
    dueNotifies: async (now, { perToken, perEndpoint, limit }) => {
      // To samo co zapytanie D1: numer w obrębie tokenu (najdawniej czekające pierwsze), potem w obrębie
      // subskrypcji (po numerze w tokenie), na koniec kolejność „pierwsze każdego tokenu, potem drugie…”.
      const inToken = new Map<string, number>();
      const rows = queue
        .filter((q) => q.nextTry <= now)
        .sort((a, b) => a.nextTry - b.nextTry || a.id - b.id)
        .map((q) => {
          const n = (inToken.get(q.hash) ?? 0) + 1;
          inToken.set(q.hash, n);
          const t = targetOf(q.hash);
          return { q, n, t };
        })
        .filter((r) => r.n <= perToken)
        .sort((a, b) => a.n - b.n || a.q.nextTry - b.q.nextTry || a.q.id - b.q.id);
      const inEndpoint = new Map<string, number>();
      return rows
        .filter(({ q }) => {
          // Osierocone (bez tokenu) — każde osobno, jak `COALESCE(endpoint, hash)` w D1.
          const key = links.get(q.hash)?.endpoint ?? q.hash;
          const n = (inEndpoint.get(key) ?? 0) + 1;
          inEndpoint.set(key, n);
          return n <= perEndpoint;
        })
        .slice(0, limit)
        .map(({ q, t }) => ({
          ...q,
          target: t ? { endpoint: t.l.endpoint, lang: t.l.lang, p256dh: t.sub.p256dh, auth: t.sub.auth } : null,
        }));
    },
    claimNotifies: async (ids, now, until) => {
      const out: number[] = [];
      for (const q of queue)
        if (ids.includes(q.id) && q.nextTry <= now) {
          q.nextTry = until;
          out.push(q.id);
        }
      return out;
    },
    failNotifies: async (ids, nextTry) => {
      for (const q of queue)
        if (ids.includes(q.id)) {
          q.attempts++;
          q.nextTry = nextTry;
        }
    },
    deferNotifies: async (where, until) => {
      for (const q of queue) {
        const hit = 'hash' in where ? q.hash === where.hash : links.get(q.hash)?.endpoint === where.endpoint;
        if (hit && q.nextTry < until) q.nextTry = until;
      }
    },
    settleNotifies: async (hash, kind, upTo) => {
      queue = queue.filter((q) => !(q.hash === hash && q.kind === kind && q.at <= upTo));
    },
    doneNotifies: async (ids) => {
      queue = queue.filter((q) => !ids.includes(q.id));
    },
    expireNotifies: async (now) => {
      const gone = queue.filter((q) => q.expires < now);
      queue = queue.filter((q) => !gone.includes(q));
      return gone.map(({ hash, kind }) => ({ hash, kind }));
    },
    addStats: async (day, counts) => {
      for (const [k, n] of counts) stats.set(`${day}\u0000${k}`, (stats.get(`${day}\u0000${k}`) ?? 0) + n);
    },
    listStats: async (from) =>
      [...stats].flatMap(([k, n]) => {
        const [day, event, value] = k.split('\u0000') as [string, string, string];
        return day >= from ? [{ day, event, value, n }] : [];
      }),
    putBox: async (r) => {
      const old = boxes.get(r.box);
      boxes.set(r.box, old ? { ...old, blob: r.blob, updated: r.updated } : { ...r });
    },
    getBox: async (box) => {
      const r = boxes.get(box);
      return r ? { ...r } : null;
    },
    removeBox: async (box) => {
      boxes.delete(box);
    },
    recentBoxes: async (ipHash, since) =>
      [...boxes.values()].filter((b) => b.ipHash === ipHash && b.created >= since).length,
    pruneBoxes: async (before) => {
      let n = 0;
      for (const [k, b] of boxes)
        if (b.updated < before) {
          boxes.delete(k);
          n++;
        }
      return n;
    },
    addFeedback: async (f) => {
      fb.push(structuredClone(f));
    },
    listFeedback: async (limit) => [...fb].sort((a, b) => b.created - a.created).slice(0, limit).map(summary),
    feedbackShot: async (id) => fb.find((f) => f.id === id)?.screenshot ?? null,
    recentFeedback: async (ipHash, since) => fb.filter((f) => f.ipHash === ipHash && f.created >= since).length,
    all: async () => [...m.values()].map((r) => structuredClone(r)),
    upsert: async (r) => {
      m.set(r.endpoint, { ...structuredClone(r), sent: m.get(r.endpoint)?.sent ?? [] });
    },
    markSent: async (endpoint, sent) => {
      const r = m.get(endpoint);
      if (r) r.sent = [...sent];
    },
    remove: async (endpoint) => {
      m.delete(endpoint);
      keepLinks((l) => l.endpoint !== endpoint);
    },
  };
}

/* ---------------- Cloudflare D1 ---------------- */

/** Tyle z API D1, ile tu potrzeba — bez paczki z typami Cloudflare w całym repozytorium. */
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface D1Database {
  prepare(sql: string): D1Statement;
  /** Kilka zapytań w jednej podróży do bazy (i w jednej transakcji). */
  batch?(statements: D1Statement[]): Promise<unknown>;
}

interface Row {
  endpoint: string;
  p256dh: string;
  auth: string;
  tz: string;
  items: string;
  sent: string;
  updated: number;
}

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

interface FeedbackRow {
  id: string;
  created: number;
  email: string | null;
  text: string;
  view: string;
  context: string;
  has_shot: number;
}

interface LinkRow {
  hash: string;
  endpoint: string;
  lang: string;
  created: number;
  updated: number;
  p256dh: string;
  auth: string;
}

interface DueRow {
  id: number;
  hash: string;
  kind: string;
  at: number;
  ref: string | null;
  attempts: number;
  next_try: number;
  expires: number;
  endpoint: string | null;
  lang: string | null;
  p256dh: string | null;
  auth: string | null;
}

const langOf = (s: string | null): 'pl' | 'en' => (s === 'en' ? 'en' : 'pl');

/** Kilka zapytań naraz: w D1 jedną transakcją, w zastępczej bazie po kolei. */
async function runAll(db: D1Database, stmts: D1Statement[]): Promise<void> {
  if (db.batch) await db.batch(stmts);
  else for (const s of stmts) await s.run();
}

/**
 * Tokeny subskrypcji ponad limit: najdawniej odświeżane. Remis rozstrzyga skrót, żeby oba zapytania
 * w `putLink` (kolejka i tokeny) wskazały te same.
 */
const OVER_LIMIT = 'SELECT hash FROM link_tokens WHERE endpoint = ? ORDER BY updated DESC, hash DESC LIMIT -1 OFFSET ?';

/**
 * Zaplanowane do przebiegu crona, sprawiedliwie (patrz `Store.dueNotifies`): `per_token` numeruje czekające
 * w obrębie tokenu od najdawniej czekającego, `per_endpoint` — w obrębie subskrypcji telefonu (osierocone,
 * bez tokenu, każde osobno). Kolejność wyniku: najpierw pierwsze każdego tokenu, potem drugie…
 * Parametry: teraz, na token, na subskrypcję, razem.
 */
const DUE = `
  WITH due AS (
    SELECT q.id, q.hash, q.kind, q.at, q.ref, q.attempts, q.next_try, q.expires, l.endpoint AS token_endpoint,
           s.endpoint, l.lang, s.p256dh, s.auth,
           ROW_NUMBER() OVER (PARTITION BY q.hash ORDER BY q.next_try, q.id) AS per_token
    FROM link_queue q
    LEFT JOIN link_tokens l ON l.hash = q.hash
    LEFT JOIN subs s ON s.endpoint = l.endpoint
    WHERE q.next_try <= ?
  ), fair AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY COALESCE(token_endpoint, hash) ORDER BY per_token, next_try, id) AS per_endpoint
    FROM due WHERE per_token <= ?
  )
  SELECT id, hash, kind, at, ref, attempts, next_try, expires, endpoint, lang, p256dh, auth
  FROM fair WHERE per_endpoint <= ?
  ORDER BY per_token, next_try, id
  LIMIT ?`;

/** `?, ?, …` na listę identyfikatorów. */
const marks = (ids: unknown[]): string => ids.map(() => '?').join(', ');

interface BoxRow {
  box: string;
  blob: string;
  updated: number;
  created: number;
  ip_hash: string;
}

export function d1Store(db: D1Database): Store {
  return {
    touchSub: async (r) => {
      await db
        .prepare(
          `INSERT INTO subs (endpoint, p256dh, auth, tz, items, sent, updated) VALUES (?, ?, ?, ?, '[]', '[]', ?)
           ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz,
             updated = excluded.updated`,
        )
        .bind(r.endpoint, r.p256dh, r.auth, r.tz, r.updated)
        .run();
    },
    putLink: async (r, max) => {
      await runAll(db, [
        db
          .prepare(
            `INSERT INTO link_tokens (hash, endpoint, lang, created, updated) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(hash) DO UPDATE SET endpoint = excluded.endpoint, lang = excluded.lang, updated = excluded.updated`,
          )
          .bind(r.hash, r.endpoint, r.lang, r.created, r.updated),
        db.prepare(`DELETE FROM link_queue WHERE hash IN (${OVER_LIMIT})`).bind(r.endpoint, max),
        db.prepare(`DELETE FROM link_sends WHERE hash IN (${OVER_LIMIT})`).bind(r.endpoint, max),
        db.prepare(`DELETE FROM link_tokens WHERE hash IN (${OVER_LIMIT})`).bind(r.endpoint, max),
      ]);
    },
    removeLink: async (hash) => {
      await runAll(db, [
        db.prepare('DELETE FROM link_queue WHERE hash = ?').bind(hash),
        db.prepare('DELETE FROM link_sends WHERE hash = ?').bind(hash),
        db.prepare('DELETE FROM link_tokens WHERE hash = ?').bind(hash),
      ]);
    },
    linkTarget: async (hash) => {
      const { results } = await db
        .prepare(
          `SELECT l.hash, l.endpoint, l.lang, l.created, l.updated, s.p256dh, s.auth
           FROM link_tokens l JOIN subs s ON s.endpoint = l.endpoint WHERE l.hash = ?`,
        )
        .bind(hash)
        .all<LinkRow>();
      const r = results[0];
      return r ? { ...r, lang: langOf(r.lang) } : null;
    },
    pruneLinks: async (before) => {
      await runAll(db, [
        db.prepare('DELETE FROM link_queue WHERE hash IN (SELECT hash FROM link_tokens WHERE updated < ?)').bind(before),
        db.prepare('DELETE FROM link_sends WHERE hash IN (SELECT hash FROM link_tokens WHERE updated < ?)').bind(before),
      ]);
      const { results } = await db
        .prepare('DELETE FROM link_tokens WHERE updated < ? RETURNING hash')
        .bind(before)
        .all<{ hash: string }>();
      return results.length;
    },
    reserveSend: async (hash, kind, now, { max, window, duplicate }) => {
      // Sprawdzenie i zapis jednym zapytaniem: D1 wykonuje zapytania po kolei, więc dwa równoległe
      // `notify` nie zobaczą obu tego samego stanu (odczyt, a potem osobny zapis — zobaczyłyby).
      const { results } = await db
        .prepare(
          `INSERT INTO link_sends (hash, at, kind) SELECT ?, ?, ?
           WHERE NOT EXISTS (SELECT 1 FROM link_sends WHERE hash = ? AND kind = ? AND at > ?)
             AND (SELECT COUNT(*) FROM link_sends WHERE hash = ? AND at > ?) < ?
           RETURNING at`,
        )
        .bind(hash, now, kind, hash, kind, now - duplicate, hash, now - window, max)
        .all<{ at: number }>();
      if (results.length) return { result: 'ok' };
      // Odmowa — drugie zapytanie tylko po to, żeby wiedzieć dlaczego (sklejenie czy limit) i do kiedy czekać.
      const { results: why } = await db
        .prepare('SELECT MAX(kind = ? AND at > ?) AS dup, MIN(at) AS first FROM link_sends WHERE hash = ? AND at > ?')
        .bind(kind, now - duplicate, hash, now - window)
        .all<{ dup: number | null; first: number | null }>();
      const w = why[0];
      if (w?.dup) return { result: 'duplicate' };
      return { result: 'budget', until: w?.first != null ? w.first + window : now };
    },
    reserveRegistration: async (ipHash, now, max, window) => {
      const { results } = await db
        .prepare(
          `INSERT INTO link_registrations (ip_hash, at) SELECT ?, ?
           WHERE (SELECT COUNT(*) FROM link_registrations WHERE ip_hash = ? AND at > ?) < ?
           RETURNING at`,
        )
        .bind(ipHash, now, ipHash, now - window, max)
        .all<{ at: number }>();
      return results.length > 0;
    },
    pruneLimits: async (before) => {
      await runAll(db, [
        db.prepare('DELETE FROM link_sends WHERE at <= ?').bind(before),
        db.prepare('DELETE FROM link_registrations WHERE at <= ?').bind(before),
      ]);
    },
    queueNotify: async (q, max) => {
      await runAll(db, [
        ...(q.ref !== null ? [db.prepare('DELETE FROM link_queue WHERE hash = ? AND ref = ?').bind(q.hash, q.ref)] : []),
        db
          .prepare(
            `INSERT INTO link_queue (hash, kind, at, ref, attempts, next_try, expires) SELECT ?, ?, ?, ?, 0, ?, ?
             WHERE (SELECT COUNT(*) FROM link_queue WHERE hash = ?) < ?`,
          )
          .bind(q.hash, q.kind, q.at, q.ref, q.at, q.expires, q.hash, max),
      ]);
    },
    unqueue: async (hash, ref, kind) => {
      await (kind === undefined
        ? db.prepare('DELETE FROM link_queue WHERE hash = ? AND ref = ?').bind(hash, ref)
        : db.prepare('DELETE FROM link_queue WHERE hash = ? AND ref = ? AND kind = ?').bind(hash, ref, kind)
      ).run();
    },
    dueNotifies: async (now, { perToken, perEndpoint, limit }) => {
      const { results } = await db.prepare(DUE).bind(now, perToken, perEndpoint, limit).all<DueRow>();
      return results.map(({ endpoint, lang, p256dh, auth, next_try, ...q }) => ({
        ...q,
        nextTry: next_try,
        target: endpoint && p256dh && auth ? { endpoint, lang: langOf(lang), p256dh, auth } : null,
      }));
    },
    claimNotifies: async (ids, now, until) => {
      if (!ids.length) return [];
      // Jedno zapytanie: warunek `next_try <= ?` i przesunięcie razem — drugi przebieg dostanie pustą listę.
      const { results } = await db
        .prepare(`UPDATE link_queue SET next_try = ? WHERE next_try <= ? AND id IN (${marks(ids)}) RETURNING id`)
        .bind(until, now, ...ids)
        .all<{ id: number }>();
      return results.map((r) => r.id);
    },
    failNotifies: async (ids, nextTry) => {
      if (!ids.length) return;
      await db
        .prepare(`UPDATE link_queue SET attempts = attempts + 1, next_try = ? WHERE id IN (${marks(ids)})`)
        .bind(nextTry, ...ids)
        .run();
    },
    deferNotifies: async (where, until) => {
      await ('hash' in where
        ? db.prepare('UPDATE link_queue SET next_try = ? WHERE next_try < ? AND hash = ?').bind(until, until, where.hash)
        : db
            .prepare('UPDATE link_queue SET next_try = ? WHERE next_try < ? AND hash IN (SELECT hash FROM link_tokens WHERE endpoint = ?)')
            .bind(until, until, where.endpoint)
      ).run();
    },
    settleNotifies: async (hash, kind, upTo) => {
      await db.prepare('DELETE FROM link_queue WHERE hash = ? AND kind = ? AND at <= ?').bind(hash, kind, upTo).run();
    },
    doneNotifies: async (ids) => {
      if (!ids.length) return;
      await db
        .prepare(`DELETE FROM link_queue WHERE id IN (${marks(ids)})`)
        .bind(...ids)
        .run();
    },
    expireNotifies: async (now) => {
      const { results } = await db
        .prepare('DELETE FROM link_queue WHERE expires < ? RETURNING hash, kind')
        .bind(now)
        .all<{ hash: string; kind: string }>();
      return results;
    },
    addStats: async (day, counts) => {
      const stmts = [...counts].map(([k, n]) => {
        const [event, value] = k.split('\u0000');
        return db
          .prepare(
            `INSERT INTO stats (day, event, value, n) VALUES (?, ?, ?, ?)
             ON CONFLICT(day, event, value) DO UPDATE SET n = n + excluded.n`,
          )
          .bind(day, event, value, n);
      });
      if (db.batch) await db.batch(stmts);
      else for (const s of stmts) await s.run();
    },
    listStats: async (from) => {
      const { results } = await db
        .prepare('SELECT day, event, value, n FROM stats WHERE day >= ? ORDER BY day DESC')
        .bind(from)
        .all<StatsCount>();
      return results;
    },
    putBox: async (r) => {
      await db
        .prepare(
          `INSERT INTO garmin (box, blob, updated, created, ip_hash) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(box) DO UPDATE SET blob = excluded.blob, updated = excluded.updated`,
        )
        .bind(r.box, r.blob, r.updated, r.created, r.ipHash)
        .run();
    },
    getBox: async (box) => {
      const { results } = await db
        .prepare('SELECT box, blob, updated, created, ip_hash FROM garmin WHERE box = ?')
        .bind(box)
        .all<BoxRow>();
      const r = results[0];
      return r ? { box: r.box, blob: r.blob, updated: r.updated, created: r.created, ipHash: r.ip_hash } : null;
    },
    removeBox: async (box) => {
      await db.prepare('DELETE FROM garmin WHERE box = ?').bind(box).run();
    },
    recentBoxes: async (ipHash, since) => {
      const { results } = await db
        .prepare('SELECT COUNT(*) AS n FROM garmin WHERE ip_hash = ? AND created >= ?')
        .bind(ipHash, since)
        .all<{ n: number }>();
      return results[0]?.n ?? 0;
    },
    pruneBoxes: async (before) => {
      const { results } = await db
        .prepare('DELETE FROM garmin WHERE updated < ? RETURNING box')
        .bind(before)
        .all<{ box: string }>();
      return results.length;
    },
    addFeedback: async (f) => {
      await db
        .prepare('INSERT INTO feedback (id, created, email, text, view, context, screenshot, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(f.id, f.created, f.email, f.text, f.view, f.context, f.screenshot, f.ipHash)
        .run();
    },
    listFeedback: async (limit) => {
      const { results } = await db
        .prepare(
          'SELECT id, created, email, text, view, context, screenshot IS NOT NULL AS has_shot FROM feedback ORDER BY created DESC LIMIT ?',
        )
        .bind(limit)
        .all<FeedbackRow>();
      return results.map(({ has_shot, ...r }) => ({ ...r, hasShot: !!has_shot }));
    },
    feedbackShot: async (id) => {
      const { results } = await db.prepare('SELECT screenshot FROM feedback WHERE id = ?').bind(id).all<{ screenshot: string | null }>();
      return results[0]?.screenshot ?? null;
    },
    recentFeedback: async (ipHash, since) => {
      const { results } = await db
        .prepare('SELECT COUNT(*) AS n FROM feedback WHERE ip_hash = ? AND created >= ?')
        .bind(ipHash, since)
        .all<{ n: number }>();
      return results[0]?.n ?? 0;
    },
    all: async () => {
      const { results } = await db.prepare('SELECT * FROM subs').all<Row>();
      return results.map((r) => ({
        ...r,
        items: parse<ReminderItem[]>(r.items, []),
        sent: parse<string[]>(r.sent, []),
      }));
    },
    upsert: async (r) => {
      await db
        .prepare(
          `INSERT INTO subs (endpoint, p256dh, auth, tz, items, sent, updated) VALUES (?, ?, ?, ?, ?, '[]', ?)
           ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz,
             items = excluded.items, updated = excluded.updated`,
        )
        .bind(r.endpoint, r.p256dh, r.auth, r.tz, JSON.stringify(r.items), r.updated)
        .run();
    },
    markSent: async (endpoint, sent) => {
      await db.prepare('UPDATE subs SET sent = ? WHERE endpoint = ?').bind(JSON.stringify(sent), endpoint).run();
    },
    remove: async (endpoint) => {
      await runAll(db, [
        db.prepare('DELETE FROM link_queue WHERE hash IN (SELECT hash FROM link_tokens WHERE endpoint = ?)').bind(endpoint),
        db.prepare('DELETE FROM link_sends WHERE hash IN (SELECT hash FROM link_tokens WHERE endpoint = ?)').bind(endpoint),
        db.prepare('DELETE FROM link_tokens WHERE endpoint = ?').bind(endpoint),
        db.prepare('DELETE FROM subs WHERE endpoint = ?').bind(endpoint),
      ]);
    },
  };
}
