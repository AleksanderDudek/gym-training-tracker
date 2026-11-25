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
  /** Natychmiastowe wysyłki z ostatniej godziny: `[ms, rodzaj]` — do limitu i sklejania powtórek. */
  recent: [number, string][];
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
}

/** Zaplanowane, któremu wybiła godzina; `target` — `null`, gdy tokenu albo subskrypcji już nie ma. */
export interface DueNotify extends QueuedNotify {
  id: number;
  target: Pick<LinkTarget, 'endpoint' | 'lang' | 'p256dh' | 'auth'> | null;
}

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
  putLink(r: Omit<LinkRecord, 'recent'>, max: number): Promise<void>;
  /** Kasuje token i jego kolejkę. */
  removeLink(hash: string): Promise<void>;
  /** Token z kluczami subskrypcji albo `null` (nie ma tokenu albo subskrypcji). */
  linkTarget(hash: string): Promise<LinkTarget | null>;
  setLinkRecent(hash: string, recent: [number, string][]): Promise<void>;
  /** Kasuje tokeny bez rejestracji od `before` (ms) razem z kolejką; zwraca, ile ich było. */
  pruneLinks(before: number): Promise<number>;
  /**
   * Do kolejki. Ten sam `ref` podmienia wcześniejsze; nowe ponad `max` zaplanowanych dla tokenu
   * przepada bez słowa.
   */
  queueNotify(q: QueuedNotify, max: number): Promise<void>;
  /** Kasuje zaplanowane z tym `ref` (tylko danego rodzaju, gdy podany). */
  unqueue(hash: string, ref: string, kind?: string): Promise<void>;
  /** Kasuje całą kolejkę tokenu (koniec współpracy). */
  clearQueue(hash: string): Promise<void>;
  /** Zaplanowane z `at` ≤ `now`, najstarsze najpierw, najwyżej `limit`. */
  dueNotifies(now: number, limit: number): Promise<DueNotify[]>;
  /** Kasuje z kolejki (po wysłaniu albo jako przeterminowane). */
  doneNotifies(ids: number[]): Promise<void>;
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
  let queue: (QueuedNotify & { id: number })[] = [];
  let nextId = 1;
  /** Zostawia tokeny, które przechodzą `keep`; kolejka znika razem z tokenem. */
  const keepLinks = (keep: (l: LinkRecord) => boolean) => {
    const dropped = new Set<string>();
    for (const [h, l] of links)
      if (!keep(l)) {
        links.delete(h);
        dropped.add(h);
      }
    queue = queue.filter((q) => !dropped.has(q.hash));
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
      links.set(r.hash, { ...r, created: old?.created ?? r.created, recent: old?.recent ?? [] });
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
    setLinkRecent: async (hash, recent) => {
      const l = links.get(hash);
      if (l) l.recent = structuredClone(recent);
    },
    pruneLinks: async (before) => {
      const n = links.size;
      keepLinks((l) => l.updated >= before);
      return n - links.size;
    },
    queueNotify: async (q, max) => {
      if (q.ref !== null) queue = queue.filter((x) => !(x.hash === q.hash && x.ref === q.ref));
      if (queue.filter((x) => x.hash === q.hash).length < max) queue.push({ ...q, id: nextId++ });
    },
    unqueue: async (hash, ref, kind) => {
      queue = queue.filter((x) => !(x.hash === hash && x.ref === ref && (kind === undefined || x.kind === kind)));
    },
    clearQueue: async (hash) => {
      queue = queue.filter((x) => x.hash !== hash);
    },
    dueNotifies: async (now, limit) =>
      queue
        .filter((q) => q.at <= now)
        .sort((a, b) => a.at - b.at || a.id - b.id)
        .slice(0, limit)
        .map((q) => {
          const t = targetOf(q.hash);
          return { ...q, target: t ? { endpoint: t.l.endpoint, lang: t.l.lang, p256dh: t.sub.p256dh, auth: t.sub.auth } : null };
        }),
    doneNotifies: async (ids) => {
      queue = queue.filter((q) => !ids.includes(q.id));
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
  recent: string;
  p256dh: string;
  auth: string;
}

interface DueRow {
  id: number;
  hash: string;
  kind: string;
  at: number;
  ref: string | null;
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
            `INSERT INTO link_tokens (hash, endpoint, lang, created, updated, recent) VALUES (?, ?, ?, ?, ?, '[]')
             ON CONFLICT(hash) DO UPDATE SET endpoint = excluded.endpoint, lang = excluded.lang, updated = excluded.updated`,
          )
          .bind(r.hash, r.endpoint, r.lang, r.created, r.updated),
        db.prepare(`DELETE FROM link_queue WHERE hash IN (${OVER_LIMIT})`).bind(r.endpoint, max),
        db.prepare(`DELETE FROM link_tokens WHERE hash IN (${OVER_LIMIT})`).bind(r.endpoint, max),
      ]);
    },
    removeLink: async (hash) => {
      await runAll(db, [
        db.prepare('DELETE FROM link_queue WHERE hash = ?').bind(hash),
        db.prepare('DELETE FROM link_tokens WHERE hash = ?').bind(hash),
      ]);
    },
    linkTarget: async (hash) => {
      const { results } = await db
        .prepare(
          `SELECT l.hash, l.endpoint, l.lang, l.created, l.updated, l.recent, s.p256dh, s.auth
           FROM link_tokens l JOIN subs s ON s.endpoint = l.endpoint WHERE l.hash = ?`,
        )
        .bind(hash)
        .all<LinkRow>();
      const r = results[0];
      return r ? { ...r, lang: langOf(r.lang), recent: parse<[number, string][]>(r.recent, []) } : null;
    },
    setLinkRecent: async (hash, recent) => {
      await db.prepare('UPDATE link_tokens SET recent = ? WHERE hash = ?').bind(JSON.stringify(recent), hash).run();
    },
    pruneLinks: async (before) => {
      await db.prepare('DELETE FROM link_queue WHERE hash IN (SELECT hash FROM link_tokens WHERE updated < ?)').bind(before).run();
      const { results } = await db
        .prepare('DELETE FROM link_tokens WHERE updated < ? RETURNING hash')
        .bind(before)
        .all<{ hash: string }>();
      return results.length;
    },
    queueNotify: async (q, max) => {
      await runAll(db, [
        ...(q.ref !== null ? [db.prepare('DELETE FROM link_queue WHERE hash = ? AND ref = ?').bind(q.hash, q.ref)] : []),
        db
          .prepare(
            `INSERT INTO link_queue (hash, kind, at, ref) SELECT ?, ?, ?, ?
             WHERE (SELECT COUNT(*) FROM link_queue WHERE hash = ?) < ?`,
          )
          .bind(q.hash, q.kind, q.at, q.ref, q.hash, max),
      ]);
    },
    unqueue: async (hash, ref, kind) => {
      await (kind === undefined
        ? db.prepare('DELETE FROM link_queue WHERE hash = ? AND ref = ?').bind(hash, ref)
        : db.prepare('DELETE FROM link_queue WHERE hash = ? AND ref = ? AND kind = ?').bind(hash, ref, kind)
      ).run();
    },
    clearQueue: async (hash) => {
      await db.prepare('DELETE FROM link_queue WHERE hash = ?').bind(hash).run();
    },
    dueNotifies: async (now, limit) => {
      const { results } = await db
        .prepare(
          `SELECT q.id, q.hash, q.kind, q.at, q.ref, l.endpoint, l.lang, s.p256dh, s.auth
           FROM link_queue q LEFT JOIN link_tokens l ON l.hash = q.hash LEFT JOIN subs s ON s.endpoint = l.endpoint
           WHERE q.at <= ? ORDER BY q.at, q.id LIMIT ?`,
        )
        .bind(now, limit)
        .all<DueRow>();
      return results.map(({ endpoint, lang, p256dh, auth, ...q }) => ({
        ...q,
        target: endpoint && p256dh && auth ? { endpoint, lang: langOf(lang), p256dh, auth } : null,
      }));
    },
    doneNotifies: async (ids) => {
      if (!ids.length) return;
      await db
        .prepare(`DELETE FROM link_queue WHERE id IN (${ids.map(() => '?').join(', ')})`)
        .bind(...ids)
        .run();
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
        db.prepare('DELETE FROM link_tokens WHERE endpoint = ?').bind(endpoint),
        db.prepare('DELETE FROM subs WHERE endpoint = ?').bind(endpoint),
      ]);
    },
  };
}
