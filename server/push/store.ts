import type { ReminderItem, SubRecord } from './schedule';

/**
 * Gdzie leżą subskrypcje. Interfejs, a nie od razu D1, bo test i serwer lokalny trzymają je
 * w pamięci, a gdyby kiedyś trzeba było przenieść serwer na inną platformę, zmienia się
 * tylko ten plik.
 */
export interface Store {
  all(): Promise<SubRecord[]>;
  /** Nowa lista przypomnień. Lista wysłanych zostaje — inaczej to samo przyszłoby dwa razy. */
  upsert(r: Omit<SubRecord, 'sent'>): Promise<void>;
  markSent(endpoint: string, sent: string[]): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

export function memoryStore(): Store {
  const m = new Map<string, SubRecord>();
  return {
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

export function d1Store(db: D1Database): Store {
  return {
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
