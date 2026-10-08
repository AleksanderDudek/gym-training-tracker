import type { ReminderItem, SubRecord } from './schedule';

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

export interface Store {
  all(): Promise<SubRecord[]>;
  /** Nowa lista przypomnień. Lista wysłanych zostaje — inaczej to samo przyszłoby dwa razy. */
  upsert(r: Omit<SubRecord, 'sent'>): Promise<void>;
  markSent(endpoint: string, sent: string[]): Promise<void>;
  remove(endpoint: string): Promise<void>;
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
}

const summary = ({ screenshot, ipHash: _ip, ...f }: FeedbackRecord): FeedbackSummary => ({ ...f, hasShot: !!screenshot });

export function memoryStore(): Store {
  const m = new Map<string, SubRecord>();
  const fb: FeedbackRecord[] = [];
  const boxes = new Map<string, BoxRecord>();
  return {
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

interface BoxRow {
  box: string;
  blob: string;
  updated: number;
  created: number;
  ip_hash: string;
}

export function d1Store(db: D1Database): Store {
  return {
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
      await db.prepare('DELETE FROM subs WHERE endpoint = ?').bind(endpoint).run();
    },
  };
}
