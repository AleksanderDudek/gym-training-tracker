# Garmin Watch Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garmin watch numbers (steps, rides, heart rate, stress, Body Battery, sleep) reach GYM TRACKER automatically, end-to-end encrypted through the existing Cloudflare Worker.

**Architecture:** A Connect IQ watch app seals a 7-day JSON snapshot with keys derived from a 256-bit secret, and POSTs it to `/garmin/push`. The Worker keeps only the newest blob per mailbox. The PWA pulls it on open, verifies and decrypts it, then merges it into `state.watch`. `cardioOf()` derives the effective cardio list from manual and watch entries (higher steps per day win), so calories, XP and badges keep working unchanged. Spec: `docs/superpowers/specs/2026-10-08-garmin-sync-design.md`.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest, Cloudflare Worker + D1, WebCrypto, Monkey C (Connect IQ ≥ 3.2).

**Conventions:** Code comments, UI text and commit subjects are in Polish, matching the repo. User-facing text avoids grammatical gender. Engine code (`src/engine/`) never imports React.

**Shared test vector** (computed independently with `node:crypto`):
- key `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f`, IV `a0a1a2a3a4a5a6a7a8a9aaabacadaeaf`, plaintext `{"v":1}`
- box `737a7eb70569826b3e8462ab4ac24904`
- blob `AaChoqOkpaanqKmqq6ytrq9nI0xALzFgri8DBZAN/yhxd7AY60ot2CVM9j2Gz9jgGIqwuDTJGghOUyekfekvvks=`

## File map

| File | Responsibility |
| --- | --- |
| `server/api/store.ts` (modify) | `BoxRecord`, `putBox/getBox/removeBox/recentBoxes/pruneBoxes` in memory and D1 |
| `server/api/schema.sql` (modify) | `garmin` table |
| `server/api/garmin.ts` (create) | Validation and the three `/garmin/*` endpoints |
| `server/api/api.ts` (modify) | Route `/garmin/*`, shared IP hash, endpoint list in the header comment |
| `server/api/worker.ts` (modify) | Cron also prunes silent boxes |
| `server/api/garmin.test.ts` (create) | Endpoint and store tests |
| `src/watchseal.ts` (create) | Key cleanup, key derivation, seal (watch reference), open |
| `src/watchseal.test.ts` (create) | Shared vector, round trip, tampering |
| `src/types.ts` (modify) | `WatchDay`, `WatchActivity`, `WatchHealth`, `WatchData`, `AppState.watch`, `Cardio.src` |
| `src/engine/watch.ts` (create) | Parse payload, merge, derived entries, restore from save |
| `src/engine/watch.test.ts` (create) | Engine tests |
| `src/engine/cardio.ts` (modify) | `manualOf`, effective `cardioOf`, `typedStepsOn` |
| `src/garmin.ts` (create) | Browser layer: key storage, pull, forget, `whenText` |
| `src/garmin.test.ts` (create) | `readPull`, `whenText` |
| `src/components/Garmin.tsx` (create) | Settings card |
| `src/components/views.tsx` (modify) | Render the card |
| `src/components/Cardio.tsx` (modify) | Watch rows, form notes, "Z zegarka" health days |
| `src/components/Health.tsx` (modify) | `WATCH_NOTE` |
| `src/App.tsx` (modify) | Restore, auto pull, apply payload, manual check |
| `src/styles.css` (modify) | Card styles |
| `garmin/**` (create) | Connect IQ app |
| `README.md`, `server/api/README.md`, `.github/workflows/deploy.yml` (modify) | Docs and build variable |

---

### Task 1: Worker store for watch mailboxes

**Files:**
- Modify: `server/api/store.ts`
- Modify: `server/api/schema.sql`

- [ ] **Step 1: Add the record type and Store methods** to `server/api/store.ts`, after `FeedbackSummary`:

```ts
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
```

Extend `interface Store`:

```ts
  /** Nowa paczka. Założenie i skrót adresu zostają z pierwszego zapisu skrzynki. */
  putBox(r: BoxRecord): Promise<void>;
  getBox(box: string): Promise<BoxRecord | null>;
  removeBox(box: string): Promise<void>;
  /** Ile skrzynek założono z tego skrótu adresu od `since` (ms). */
  recentBoxes(ipHash: string, since: number): Promise<number>;
  /** Kasuje skrzynki bez zapisu od `before` (ms); zwraca, ile ich było. */
  pruneBoxes(before: number): Promise<number>;
```

In `memoryStore()` add `const boxes = new Map<string, BoxRecord>();` and:

```ts
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
```

In `d1Store(db)` add (with `interface BoxRow { box: string; blob: string; updated: number; created: number; ip_hash: string }` next to `FeedbackRow`):

```ts
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
      const { results } = await db.prepare('DELETE FROM garmin WHERE updated < ? RETURNING box').bind(before).all<{ box: string }>();
      return results.length;
    },
```

- [ ] **Step 2: Append the table** to `server/api/schema.sql`:

```sql
-- Skrzynki zegarka Garmin: najnowsza zaszyfrowana paczka z zegarka. Klucza serwer nie ma —
-- zna go tylko zegarek i przeglądarka, więc kroki, tętno i sen są dla niego nieczytelne.
CREATE TABLE IF NOT EXISTS garmin (
  -- 32 znaki hex wyprowadzone z klucza.
  box     TEXT PRIMARY KEY,
  -- Koperta w base64: wersja, IV, AES-256-CBC, HMAC-SHA256.
  blob    TEXT NOT NULL,
  -- Ostatni zapis, ms. Po 7 dniach ciszy skrzynka znika.
  updated INTEGER NOT NULL,
  -- Założenie, ms, i skrót adresu IP — do limitu nowych skrzynek na godzinę.
  created INTEGER NOT NULL,
  ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS garmin_ip ON garmin (ip_hash, created);
CREATE INDEX IF NOT EXISTS garmin_updated ON garmin (updated);
```

- [ ] **Step 3: Typecheck.** Run `npm run typecheck`. Expected: no errors.

### Task 2: `/garmin/*` endpoints

**Files:**
- Create: `server/api/garmin.ts`, `server/api/garmin.test.ts`
- Modify: `server/api/api.ts`, `server/api/worker.ts`

- [ ] **Step 1: Write the failing tests** in `server/api/garmin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { handle } from './api';
import type { Env } from './api';
import { BOXES_PER_HOUR, BOX_TTL_MS, PUSH_GAP_MS } from './garmin';
import { memoryStore } from './store';

/**
 * Skrzynki zegarka: serwer przyjmuje od zegarka tylko kopertę w kształcie, który da się
 * otworzyć, oddaje ją aplikacji i nie da się zasypać skrzynkami. Treści nie ogląda — nie ma
 * czym: klucz zna tylko zegarek i przeglądarka.
 */

const ORIGIN = 'https://aleksanderdudek.github.io';
const env: Env = { VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_JWK: '{}', VAPID_SUBJECT: 'https://example.org/', ALLOWED_ORIGINS: ORIGIN };
// Wektor wspólny z src/watchseal.test.ts i testem na zegarku.
const BOX = '737a7eb70569826b3e8462ab4ac24904';
const BLOB = 'AaChoqOkpaanqKmqq6ytrq9nI0xALzFgri8DBZAN/yhxd7AY60ot2CVM9j2Gz9jgGIqwuDTJGghOUyekfekvvks=';
const T0 = Date.parse('2026-10-08T12:00:00Z');
const box = (i: number) => i.toString(16).padStart(32, '0');

// Zegarek nie wysyła nagłówka Origin — zapytanie wychodzi z aplikacji Garmin Connect na telefonie.
const fromWatch = (data: unknown, ip = '203.0.113.7') =>
  new Request('https://api.example.workers.dev/garmin/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(data),
  });
const fromApp = (path: string, data: unknown) =>
  new Request(`https://api.example.workers.dev${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(data),
  });

describe('skrzynka zegarka', () => {
  it('zegarek odkłada kopertę, a aplikacja ją odbiera z nagłówkiem CORS i bez pamięci podręcznej', async () => {
    const store = memoryStore();
    const put = await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ ok: true });
    const got = await handle(fromApp('/garmin/pull', { box: BOX }), env, store, T0 + 1000);
    expect(got.status).toBe(200);
    expect(got.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(got.headers.get('Cache-Control')).toBe('no-store');
    expect(await got.json()).toEqual({ blob: BLOB, updated: T0 });
  });

  it('nowsza paczka zastępuje starszą, a założenie skrzynki zostaje', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    const other = `${'B'.repeat(84)}AAA=`;
    expect((await handle(fromWatch({ box: BOX, blob: other }), env, store, T0 + PUSH_GAP_MS)).status).toBe(200);
    const r = await store.getBox(BOX);
    expect(r).toMatchObject({ blob: other, updated: T0 + PUSH_GAP_MS, created: T0 });
  });

  it('pusta skrzynka to 404', async () => {
    expect((await handle(fromApp('/garmin/pull', { box: BOX }), env, memoryStore(), T0)).status).toBe(404);
  });

  it('odrzuca zły identyfikator i coś, co nie jest kopertą', async () => {
    const store = memoryStore();
    const bad = [
      { box: 'abc', blob: BLOB },
      { box: BOX.toUpperCase(), blob: BLOB },
      { box: BOX, blob: 'krótkie' },
      { box: BOX, blob: `${BLOB.slice(0, -4)}!!!=` },
      { box: BOX, blob: 'A'.repeat(12_004) },
      { box: BOX },
    ];
    for (const b of bad) expect((await handle(fromWatch(b), env, store, T0)).status).toBe(400);
    expect((await handle(fromApp('/garmin/pull', { box: 'x' }), env, store, T0)).status).toBe(400);
    expect((await handle(fromApp('/garmin/forget', {}), env, store, T0)).status).toBe(400);
  });

  it('przyjmuje base64 zawinięty w linie i zapisuje go bez białych znaków', async () => {
    const store = memoryStore();
    const wrapped = `${BLOB.slice(0, 40)}\n${BLOB.slice(40)}`;
    expect((await handle(fromWatch({ box: BOX, blob: wrapped }), env, store, T0)).status).toBe(200);
    expect((await store.getBox(BOX))!.blob).toBe(BLOB);
  });

  it('ta sama skrzynka częściej niż raz na minutę dostaje 429', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    expect((await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0 + PUSH_GAP_MS - 1)).status).toBe(429);
  });

  it('jeden adres zakłada ograniczoną liczbę skrzynek na godzinę', async () => {
    const store = memoryStore();
    for (let i = 0; i < BOXES_PER_HOUR; i++)
      expect((await handle(fromWatch({ box: box(i), blob: BLOB }), env, store, T0 + i)).status).toBe(200);
    expect((await handle(fromWatch({ box: box(999), blob: BLOB }), env, store, T0 + 100)).status).toBe(429);
    // Inny adres — bez przeszkód; istniejąca skrzynka z tego samego adresu — też.
    expect((await handle(fromWatch({ box: box(999), blob: BLOB }, '198.51.100.1'), env, store, T0 + 100)).status).toBe(200);
    expect((await handle(fromWatch({ box: box(0), blob: BLOB }), env, store, T0 + PUSH_GAP_MS)).status).toBe(200);
    // Po godzinie limit się odnawia.
    expect((await handle(fromWatch({ box: box(1000), blob: BLOB }), env, store, T0 + 3_600_001)).status).toBe(200);
  });

  it('odłączenie kasuje skrzynkę', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    expect((await handle(fromApp('/garmin/forget', { box: BOX }), env, store, T0)).status).toBe(204);
    expect(await store.getBox(BOX)).toBeNull();
  });

  it('sprzątanie usuwa tylko skrzynki milczące dłużej niż tydzień', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: box(1), blob: BLOB }), env, store, T0);
    await handle(fromWatch({ box: box(2), blob: BLOB }), env, store, T0 + 3_600_000);
    expect(await store.pruneBoxes(T0 + 1)).toBe(1);
    expect(await store.getBox(box(1))).toBeNull();
    expect(await store.getBox(box(2))).not.toBeNull();
    expect(BOX_TTL_MS).toBe(7 * 24 * 3_600_000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run server/api/garmin.test.ts`. Expected: FAIL (`./garmin` does not exist).

- [ ] **Step 3: Create `server/api/garmin.ts`:**

```ts
import type { Store } from './store';

/**
 * Skrzynki zegarka Garmin: zegarek odkłada tu najnowszą paczkę danych, aplikacja ją odbiera.
 *
 * Paczka jest zaszyfrowana na zegarku kluczem, którego serwer nigdy nie widzi — zna go tylko
 * zegarek i przeglądarka, w której klucz powstał. Serwer przechowuje więc szyfrogram, czas
 * ostatniego zapisu i nic więcej: ani kroków, ani tętna, ani snu. Tętno, stres i sen to dane
 * o zdrowiu (RODO, art. 9), a tych serwer nie ma umieć odczytać.
 *
 * Skrzynkę wskazuje 32-znakowy identyfikator wyprowadzony z klucza. Kto go zna, może paczkę
 * nadpisać albo skasować, ale nie odczytać ani podrobić — aplikacja odrzuci wszystko, co nie
 * przejdzie HMAC.
 */

const BOX = /^[0-9a-f]{32}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** Najkrótsza koperta: wersja, IV, jeden blok i znacznik — 65 bajtów, w base64 88 znaków. */
export const BLOB_MIN = 88;
/** Tydzień danych z dużym zapasem — zegarek wysyła około 2 kB. */
export const BLOB_MAX = 12_000;
/** Zegarek budzi się co 30 minut; częściej to błąd albo ktoś, kto stuka w kółko. */
export const PUSH_GAP_MS = 60_000;
/** Nowe skrzynki z jednego adresu na godzinę. Jeden zegarek zakłada jedną. */
export const BOXES_PER_HOUR = 20;
/** Skrzynka bez zapisu przez tydzień znika — tyle dni zegarek i tak wysyła w każdej paczce. */
export const BOX_TTL_MS = 7 * 24 * 3_600_000;

export const validBox = (v: unknown): v is string => typeof v === 'string' && BOX.test(v);

/** Koperta bez białych znaków — base64 z zegarka bywa zawinięty w linie. `null`, gdy to nie koperta. */
export function cleanBlob(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > BLOB_MAX * 2) return null;
  const s = v.replace(/\s+/g, '');
  return s.length >= BLOB_MIN && s.length <= BLOB_MAX && s.length % 4 === 0 && BASE64.test(s) ? s : null;
}

export interface Replies {
  reply: (status: number, msg?: string) => Response;
  json: (status: number, data: unknown) => Response;
}

/** `POST /garmin/push` od zegarka, `/garmin/pull` i `/garmin/forget` od aplikacji. */
export async function garmin(
  path: string,
  data: Record<string, unknown>,
  ipHash: () => Promise<string>,
  store: Store,
  now: number,
  { reply, json }: Replies,
): Promise<Response> {
  if (path === '/garmin/push') {
    const blob = cleanBlob(data.blob);
    if (!validBox(data.box) || !blob) return reply(400, 'zła paczka');
    const old = await store.getBox(data.box);
    if (old && now - old.updated < PUSH_GAP_MS) return reply(429, 'za często');
    if (old) await store.putBox({ ...old, blob, updated: now });
    else {
      const ip = await ipHash();
      if ((await store.recentBoxes(ip, now - 3_600_000)) >= BOXES_PER_HOUR) return reply(429, 'za dużo nowych skrzynek');
      await store.putBox({ box: data.box, blob, updated: now, created: now, ipHash: ip });
    }
    // Odpowiedź z treścią, bo zegarek czeka na JSON — puste 204 bywa dla niego błędem.
    return json(200, { ok: true });
  }

  if (path === '/garmin/pull') {
    if (!validBox(data.box)) return reply(400, 'zła skrzynka');
    const r = await store.getBox(data.box);
    return r ? json(200, { blob: r.blob, updated: r.updated }) : reply(404);
  }

  if (path === '/garmin/forget') {
    if (!validBox(data.box)) return reply(400, 'zła skrzynka');
    await store.removeBox(data.box);
    return reply(204);
  }

  return reply(404);
}
```

- [ ] **Step 4: Route it in `server/api/api.ts`.**
  - Import: `import { garmin } from './garmin';`
  - Add to the header comment list:
    ```
     * - `POST /garmin/push` — zaszyfrowana paczka z zegarka Garmin (serwer nie ma klucza).
     * - `POST /garmin/pull`, `POST /garmin/forget` — odbiór paczki i odłączenie zegarka.
    ```
  - After `if (path === '/feedback') return feedback(...)` add:
    ```ts
    if (path.startsWith('/garmin/')) {
      const json = (status: number, d: unknown) => {
        const h = new Headers(headers);
        h.set('Content-Type', 'application/json');
        h.set('Cache-Control', 'no-store');
        return new Response(JSON.stringify(d), { status, headers: h });
      };
      return garmin(path, data, () => ipHashOf(req, env), store, now, { reply, json });
    }
    ```
  - Next to `sha256` add, and use it in `feedback` in place of the inline hash:
    ```ts
    /** Adres IP tylko jako skrót z solą — do limitów, nie do zapisania, kto pisał. */
    const ipHashOf = (req: Request, env: Env): Promise<string> =>
      sha256(`${req.headers.get('CF-Connecting-IP') ?? 'nieznany'}|${env.VAPID_SUBJECT}`);
    ```

- [ ] **Step 5: Prune in the cron** (`server/api/worker.ts`):

```ts
import { BOX_TTL_MS } from './garmin';
// …
  scheduled: (_event: unknown, env: Env, ctx: ExecutionContext): void => {
    const store = d1Store(env.DB);
    ctx.waitUntil(
      Promise.all([tick(store, env, new Date()), store.pruneBoxes(Date.now() - BOX_TTL_MS)]).then(([r, boxes]) =>
        console.log(JSON.stringify({ ...r, boxes })),
      ),
    );
  },
```
Update the doc comment: "zapytania aplikacji, zegarka i cron co pięć minut".

- [ ] **Step 6: Run the tests.** Run `npx vitest run server/api`. Expected: all pass (the new file plus the existing 28).

- [ ] **Step 7: Commit:** `git add server/api && git commit -m "feat: skrzynki zegarka Garmin na serwerze — tylko szyfrogram"`

### Task 3: Envelope crypto (`src/watchseal.ts`)

**Files:**
- Create: `src/watchseal.ts`, `src/watchseal.test.ts`

- [ ] **Step 1: Write the failing tests** in `src/watchseal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cleanKey, deriveKeys, hexBytes, newKey, open, seal } from './watchseal';

/**
 * Koperta danych z zegarka. Wektor policzony niezależnie przez `node:crypto` i powtórzony
 * w teście aplikacji na zegarek (garmin/source/SealTest.mc): jeśli któryś koniec się rozjedzie,
 * żadna paczka z zegarka się nie otworzy.
 */
const VECTOR = {
  key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  iv: 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
  box: '737a7eb70569826b3e8462ab4ac24904',
  blob: 'AaChoqOkpaanqKmqq6ytrq9nI0xALzFgri8DBZAN/yhxd7AY60ot2CVM9j2Gz9jgGIqwuDTJGghOUyekfekvvks=',
};

const flip = (b64: string, at: number): string => {
  const b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  b[at] = b[at]! ^ 1;
  return btoa(String.fromCharCode(...b));
};

describe('koperta zegarka', () => {
  it('wyprowadza skrzynkę i pieczętuje bajt w bajt jak zegarek', async () => {
    const keys = (await deriveKeys(VECTOR.key))!;
    expect(keys.box).toBe(VECTOR.box);
    expect(await seal(keys, '{"v":1}', hexBytes(VECTOR.iv)!)).toBe(VECTOR.blob);
    expect(await open(keys, VECTOR.blob)).toBe('{"v":1}');
  });

  it('otwiera to, co zapieczętował, także z polskimi znakami i dłuższą treścią', async () => {
    const keys = (await deriveKeys(newKey()))!;
    const text = JSON.stringify({ v: 1, note: 'zażółć gęślą jaźń', d: Array.from({ length: 40 }, (_, i) => i) });
    expect(await open(keys, await seal(keys, text))).toBe(text);
  });

  it('odrzuca zmieniony bajt, obcy klucz, złą wersję i śmieci', async () => {
    const keys = (await deriveKeys(VECTOR.key))!;
    const other = (await deriveKeys(newKey()))!;
    expect(await open(keys, flip(VECTOR.blob, 20))).toBeNull(); // szyfrogram
    expect(await open(keys, flip(VECTOR.blob, 60))).toBeNull(); // znacznik
    expect(await open(keys, flip(VECTOR.blob, 0))).toBeNull(); // wersja
    expect(await open(other, VECTOR.blob)).toBeNull();
    expect(await open(keys, 'nie-base64!')).toBeNull();
    expect(await open(keys, btoa('za krótkie'))).toBeNull();
  });

  it('klucz to 64 znaki hex — spacje, łączniki i wielkość liter bez znaczenia', () => {
    expect(cleanKey(`  ${VECTOR.key.toUpperCase().match(/.{8}/g)!.join(' ')}\n`)).toBe(VECTOR.key);
    expect(cleanKey('00010203 04050607-08090A0B 0C0D0E0F 10111213 14151617 18191A1B 1C1D1E1F')).toBe(VECTOR.key);
    expect(cleanKey(VECTOR.key.slice(2))).toBeNull();
    expect(cleanKey(`zz${VECTOR.key.slice(2)}`)).toBeNull();
    expect(cleanKey(`Klucz: ${VECTOR.key}`)).toBeNull();
  });

  it('nowy klucz jest losowy i od razu poprawny', async () => {
    const a = newKey();
    expect(cleanKey(a)).toBe(a);
    expect(a).not.toBe(newKey());
    expect(await deriveKeys('za-krótki')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run src/watchseal.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/watchseal.ts`:**

```ts
/**
 * Koperta danych z zegarka Garmin — wspólny format zegarka i aplikacji.
 *
 * Klucz (32 losowe bajty) powstaje w przeglądarce i trafia na zegarek przez schowek. Serwer
 * go nie zna. Z klucza wychodzą trzy klucze pochodne, jak w HKDF-Expand z jednym blokiem
 * (RFC 5869 pozwala pominąć Extract, gdy klucz jest już losowy, a Connect IQ ma HMAC, ale
 * nie ma HKDF):
 *
 * - skrzynka = pierwsze 16 bajtów HMAC(klucz, "gt-box" ‖ 0x01) — adres paczki na serwerze;
 * - szyfr    = HMAC(klucz, "gt-enc" ‖ 0x01) — AES-256;
 * - podpis   = HMAC(klucz, "gt-mac" ‖ 0x01) — HMAC-SHA256.
 *
 * Koperta: 0x01 ‖ IV(16) ‖ AES-256-CBC(PKCS#7) ‖ HMAC-SHA256(podpis, wszystko przed nim),
 * w base64. Najpierw szyfr, potem podpis, a przy otwieraniu odwrotnie: niepodpisany bajt nie
 * dochodzi do deszyfrowania. `seal` jest tu wzorcem tego, co robi zegarek (garmin/source/Seal.mc)
 * — aplikacja sama niczego nie pieczętuje.
 */

const VERSION = 1;
const TAG = 32;
const IV = 16;
const enc = new TextEncoder();

type Bytes = Uint8Array<ArrayBuffer>;

export interface WatchKeys {
  /** Identyfikator skrzynki na serwerze, 32 znaki hex. */
  box: string;
  enc: Bytes;
  mac: Bytes;
}

export function hexBytes(hex: string): Bytes | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

const bytesHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Klucz z pola albo ze schowka: 64 znaki hex. Spacje, łączniki, nowe linie i wielkość liter
 * nie mają znaczenia — tak samo czyta go zegarek. Inne znaki to nie klucz, tylko coś
 * wklejonego razem z nim.
 */
export function cleanKey(s: string): string | null {
  const k = s.replace(/[\s-]+/g, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(k) ? k : null;
}

export function newKey(): string {
  return bytesHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function hmac(key: Bytes, msg: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
}

const label = (s: string): Bytes => {
  const t = enc.encode(s);
  const out = new Uint8Array(t.length + 1);
  out.set(t);
  out[t.length] = 1;
  return out;
};

export async function deriveKeys(keyHex: string): Promise<WatchKeys | null> {
  const k = cleanKey(keyHex);
  const s = k ? hexBytes(k) : null;
  if (!s) return null;
  const [box, e, m] = await Promise.all([hmac(s, label('gt-box')), hmac(s, label('gt-enc')), hmac(s, label('gt-mac'))]);
  return { box: bytesHex(box.subarray(0, 16)), enc: e, mac: m };
}

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  parts.forEach((p) => {
    out.set(p, at);
    at += p.length;
  });
  return out;
};

const toB64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));

const fromB64 = (s: string): Bytes | null => {
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

/** Pieczętowanie jak na zegarku. IV podaje tylko test — inaczej losowy. */
export async function seal(keys: WatchKeys, text: string, iv: Bytes = crypto.getRandomValues(new Uint8Array(IV))): Promise<string> {
  const k = await crypto.subtle.importKey('raw', keys.enc, 'AES-CBC', false, ['encrypt']);
  // WebCrypto dopełnia PKCS#7 samo — zegarek robi to ręcznie, wynik jest ten sam.
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, k, enc.encode(text)));
  const head = concat(Uint8Array.of(VERSION), iv, ct);
  return toB64(concat(head, await hmac(keys.mac, head)));
}

/** Treść koperty albo `null`, gdy podpis się nie zgadza, wersja jest obca albo to nie koperta. */
export async function open(keys: WatchKeys, blob: string): Promise<string | null> {
  const env = fromB64(blob);
  if (!env || env.length < 1 + IV + 16 + TAG || env[0] !== VERSION || (env.length - 1 - IV - TAG) % 16 !== 0) return null;
  const head = env.subarray(0, env.length - TAG);
  const mk = await crypto.subtle.importKey('raw', keys.mac, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  // `verify` porównuje w stałym czasie — czas odpowiedzi nie zdradza, ile bajtów się zgadza.
  if (!(await crypto.subtle.verify('HMAC', mk, env.subarray(env.length - TAG), head))) return null;
  try {
    const k = await crypto.subtle.importKey('raw', keys.enc, 'AES-CBC', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: head.subarray(1, 1 + IV) }, k, head.subarray(1 + IV));
    return new TextDecoder('utf-8', { fatal: true }).decode(pt);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests.** Run `npx vitest run src/watchseal.test.ts`. Expected: PASS (5 tests).
- [ ] **Step 5: Typecheck and commit:** `npm run typecheck && git add src/watchseal.ts src/watchseal.test.ts && git commit -m "feat: koperta danych z zegarka — AES-256-CBC i HMAC-SHA256 jak na zegarku"`

### Task 4: Watch data model and engine (`src/engine/watch.ts`)

**Files:**
- Modify: `src/types.ts`
- Create: `src/engine/watch.ts`, `src/engine/watch.test.ts`

- [ ] **Step 1: Types.** In `src/types.ts` add `src?: 'watch'` to `Cardio` (doc: "Wpis wyprowadzony z danych zegarka — nie leży w zapisie i nie da się go usunąć"). Add the watch types after `BodyWeight`, and `watch?: WatchData` to `AppState` after `body` (doc: "Dane z zegarka Garmin: liczby, nie wpisy — wpisy ruchu wyprowadza z nich `cardioOf`"):

```ts
/** Dzień z krokomierza zegarka. */
export interface WatchDay {
  /** `yyyy-mm-dd` według zegara zegarka. */
  day: string;
  steps: number;
  /** Droga w metrach, jak liczy ją zegarek. */
  m: number | null;
  floors: number | null;
  /** Minuty intensywności z zegarka. */
  active: number | null;
}

/** Aktywność zapisana na zegarku. Connect IQ podaje tylko rodzaj, start, czas i drogę. */
export interface WatchActivity {
  /** Start, sekundy od 1970. Klucz aktywności. */
  start: number;
  /** `Activity.Sport` (numeracja FIT): 1 bieg, 2 rower, 11 marsz… */
  sport: number;
  sec: number;
  m: number | null;
}

/** Zdrowie z zegarka w jednym dniu. `null` — zegarek tego nie mierzy albo leżał na stole. */
export interface WatchHealth {
  day: string;
  /** Średnie tętno spoczynkowe z 7 dni, tak jak podaje je zegarek. */
  rhr: number | null;
  hrMin: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  /** Średni stres dnia, 0–100. */
  stress: number | null;
  /** Body Battery: najniżej i najwyżej w ciągu dnia, 0–100. */
  bbMin: number | null;
  bbMax: number | null;
  /** Wynik snu z ostatniej nocy, 0–100. */
  sleep: number | null;
}

export interface WatchData {
  /** Czas wysłania ostatniej przyjętej paczki, s od 1970. Starsza paczka nic nie zmienia. */
  t: number;
  /** Kiedy ta przeglądarka ją odebrała, ISO. */
  got: string;
  days: WatchDay[];
  acts: WatchActivity[];
  health: WatchHealth[];
}
```

- [ ] **Step 2: Write the failing tests** in `src/engine/watch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import { SPORT_CYCLING, mergeWatch, parsePayload, restoreWatch, watchEntries, watchStepsOn } from './watch';
import type { WatchPayload } from './watch';

/**
 * Dane z zegarka: paczka przesiana wiersz po wierszu, scalona po czasie wysłania, a z kroków
 * i przejazdów powstają wpisy ruchu — w locie, nie w zapisie.
 */

const NOW = Date.parse('2026-10-08T18:00:00Z');
const T = NOW / 1000 - 600;
// Południe czasu lokalnego — dzień przejazdu wychodzi ten sam w każdej strefie testu.
const noon = (day: string) => new Date(`${day}T12:00:00`).getTime() / 1000;

const payload = (over: Record<string, unknown> = {}) => ({
  v: 1,
  t: T,
  d: [
    ['2026-10-07', 11200, 8400, 9, 40],
    ['2026-10-08', 9120, 7340, null, 35],
  ],
  a: [
    [noon('2026-10-07'), SPORT_CYCLING, 3600, 22000],
    [noon('2026-10-08'), 1, 1800, 5000],
  ],
  h: [['2026-10-08', 52, 48, 71, 142, 31, 25, 88, 82]],
  ...over,
});

describe('paczka z zegarka', () => {
  it('czyta dni, aktywności i zdrowie', () => {
    const p = parsePayload(payload(), NOW)!;
    expect(p.t).toBe(T);
    expect(p.days).toEqual([
      { day: '2026-10-07', steps: 11200, m: 8400, floors: 9, active: 40 },
      { day: '2026-10-08', steps: 9120, m: 7340, floors: null, active: 35 },
    ]);
    expect(p.acts[0]).toEqual({ start: noon('2026-10-07'), sport: 2, sec: 3600, m: 22000 });
    expect(p.health[0]).toEqual({
      day: '2026-10-08', rhr: 52, hrMin: 48, hrAvg: 71, hrMax: 142, stress: 31, bbMin: 25, bbMax: 88, sleep: 82,
    });
  });

  it('zepsuty wiersz odpada, reszta zostaje', () => {
    const p = parsePayload(
      payload({
        d: [['2026-13-01', 5000], ['2026-10-08', -5], ['2026-10-08', 120_000], ['2026-10-06', 7000, 'x', 1e9]],
        a: [[100, 2, 3600, 1000], [noon('2026-10-08'), 2, 30, 1000], 'śmieci'],
        h: [['2026-10-08', 300, 10, null, null, 150, null, null, null], ['2026-10-07', null, null, null, null, null, null, null, null]],
      }),
      NOW,
    )!;
    expect(p.days).toEqual([{ day: '2026-10-06', steps: 7000, m: null, floors: null, active: null }]);
    expect(p.acts).toEqual([]);
    // Tętno spoza ludzkiego zakresu i stres ponad 100 to błąd czujnika; dzień bez jednej liczby odpada.
    expect(p.health).toEqual([]);
  });

  it('nie przyjmuje obcej wersji ani czasu z przyszłości', () => {
    expect(parsePayload(payload({ v: 2 }), NOW)).toBeNull();
    expect(parsePayload(payload({ t: NOW / 1000 + 2 * 86_400 }), NOW)).toBeNull();
    expect(parsePayload('tekst', NOW)).toBeNull();
    expect(parsePayload(null, NOW)).toBeNull();
  });
});

describe('scalanie', () => {
  const p = (t: number, d: unknown[]) => parsePayload(payload({ t, d, a: [], h: [] }), NOW)!;

  it('nowsza paczka zastępuje dzień, starsza nic nie zmienia, dni sprzed tygodnia zostają', () => {
    const s = freshState();
    expect(mergeWatch(s, p(T - 100, [['2026-09-20', 6000], ['2026-10-08', 5000]]), new Date(NOW))).toBe(true);
    expect(mergeWatch(s, p(T, [['2026-10-08', 9000]]), new Date(NOW))).toBe(true);
    expect(mergeWatch(s, p(T - 50, [['2026-10-08', 7000]]), new Date(NOW))).toBe(false);
    expect(mergeWatch(s, p(T, [['2026-10-08', 7000]]), new Date(NOW))).toBe(false);
    expect(s.watch!.days.map((d) => [d.day, d.steps])).toEqual([['2026-09-20', 6000], ['2026-10-08', 9000]]);
    expect(s.watch!.t).toBe(T);
    expect(s.watch!.got).toBe(new Date(NOW).toISOString());
    expect(watchStepsOn(s, '2026-10-08')).toBe(9000);
    expect(watchStepsOn(s, '2026-10-01')).toBeNull();
  });

  it('licznik dnia może spaść — zegarek wie lepiej', () => {
    const s = freshState();
    mergeWatch(s, p(T - 100, [['2026-10-08', 9000]]));
    mergeWatch(s, p(T, [['2026-10-08', 8000]]));
    expect(watchStepsOn(s, '2026-10-08')).toBe(8000);
  });

  it('aktywności po starcie i zdrowie po dniu, bez powtórzeń', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload({ t: T - 100 }), NOW)!);
    mergeWatch(s, parsePayload(payload(), NOW)!);
    expect(s.watch!.acts).toHaveLength(2);
    expect(s.watch!.health).toHaveLength(1);
  });
});

describe('wpisy z zegarka', () => {
  it('kroki dnia i przejazdy rowerem; bieg nie, bo jego kroki już są w krokach', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload(), NOW) as WatchPayload);
    const e = watchEntries(s.watch);
    expect(e.filter((c) => c.kind === 'steps').map((c) => c.day)).toEqual(['2026-10-07', '2026-10-08']);
    const rides = e.filter((c) => c.kind === 'bike');
    expect(rides).toEqual([
      { kind: 'bike', kmh: 22, min: 60, key: `watch-ride-${noon('2026-10-07')}`, day: '2026-10-07', at: new Date(noon('2026-10-07') * 1000).toISOString(), src: 'watch' },
    ]);
    expect(e.every((c) => c.src === 'watch')).toBe(true);
  });

  it('dzień z zerem kroków i rower bez drogi nie dają wpisu', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload({ d: [['2026-10-08', 0]], a: [[noon('2026-10-08'), 2, 3600, null]] }), NOW)!);
    expect(watchEntries(s.watch)).toEqual([]);
    expect(watchEntries(undefined)).toEqual([]);
  });
});

describe('zapis i import', () => {
  it('przesiewa dane z pliku tak samo jak paczkę', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload(), NOW)!, new Date(NOW));
    const back = restoreWatch(JSON.parse(JSON.stringify(s.watch)));
    expect(back).toEqual(s.watch);
    const broken = restoreWatch({ ...s.watch, days: [{ day: 'wczoraj', steps: 5 }, ...s.watch!.days] });
    expect(broken!.days).toEqual(s.watch!.days);
    expect(restoreWatch({ t: 'x' })).toBeUndefined();
    expect(restoreWatch(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail.** Run `npx vitest run src/engine/watch.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 4: Create `src/engine/watch.ts`:**

```ts
import type { AppState, Cardio, WatchActivity, WatchData, WatchDay, WatchHealth } from '../types';

/**
 * Dane z zegarka Garmin: co przyszło w paczce, jak to scalić z tym, co już jest, i jakie wpisy
 * ruchu z tego wynikają.
 *
 * Zegarek za każdym razem wysyła cały ostatni tydzień, więc nowsza paczka zastępuje starszą
 * dzień po dniu, a dni sprzed tygodnia zostają w zapisie — to historia, jak wpisy ręczne.
 * Z kroków i przejazdów rowerem powstają wpisy ruchu (`watchEntries`), ale tylko w locie:
 * w zapisie leżą liczby z zegarka, a kalorie, minuty i odznaki liczą się z nich przy każdym
 * otwarciu — tak jak z wpisów ręcznych.
 *
 * Biegi i marsze nie stają się osobnymi wpisami: ich kroki są już w krokach dnia, więc
 * policzyłyby się dwa razy. Tętno, stres, Body Battery i sen tylko się pokazuje — bez punktów.
 */

/** `Activity.SPORT_CYCLING` w Connect IQ — numeracja sportów z protokołu FIT. */
export const SPORT_CYCLING = 2;

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Wcześniejszy czas to nie dawna aktywność, tylko zegar liczony od innej epoki. */
const EPOCH_MIN = Date.parse('2015-01-01T00:00:00Z') / 1000;

/**
 * Zakresy liczb z zegarka. Poza nimi to błąd czujnika albo zepsuty zapis, a nie wynik:
 * sto tysięcy kroków to limit wpisu ręcznego, tętno spoza 25–250 nie jest ludzkie.
 */
export const WATCH_LIMITS = {
  steps: [0, 100_000],
  meters: [0, 300_000],
  floors: [0, 1_000],
  active: [0, 1_440],
  sport: [0, 255],
  sec: [60, 86_400],
  actMeters: [0, 1_000_000],
  hr: [25, 250],
  pct: [0, 100],
} as const;

const L = WATCH_LIMITS;

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;

const lim = (v: unknown, [min, max]: readonly [number, number]): number | null => num(v, min, max);

export interface WatchPayload {
  t: number;
  days: WatchDay[];
  acts: WatchActivity[];
  health: WatchHealth[];
}

function dayRow(r: unknown): WatchDay | null {
  if (!Array.isArray(r) || typeof r[0] !== 'string' || !DAY.test(r[0])) return null;
  const steps = lim(r[1], L.steps);
  if (steps === null) return null;
  return { day: r[0], steps, m: lim(r[2], L.meters), floors: lim(r[3], L.floors), active: lim(r[4], L.active) };
}

function actRow(r: unknown, t: number): WatchActivity | null {
  if (!Array.isArray(r)) return null;
  const start = num(r[0], EPOCH_MIN, t + 86_400);
  const sport = lim(r[1], L.sport);
  const sec = lim(r[2], L.sec);
  if (start === null || sport === null || sec === null) return null;
  return { start, sport, sec, m: lim(r[3], L.actMeters) };
}

function healthRow(r: unknown): WatchHealth | null {
  if (!Array.isArray(r) || typeof r[0] !== 'string' || !DAY.test(r[0])) return null;
  const h: WatchHealth = {
    day: r[0],
    rhr: lim(r[1], L.hr),
    hrMin: lim(r[2], L.hr),
    hrAvg: lim(r[3], L.hr),
    hrMax: lim(r[4], L.hr),
    stress: lim(r[5], L.pct),
    bbMin: lim(r[6], L.pct),
    bbMax: lim(r[7], L.pct),
    sleep: lim(r[8], L.pct),
  };
  // Dzień bez jednej liczby nic nie mówi — zegarek bez czujnika albo zdjęty z ręki.
  return Object.entries(h).some(([k, v]) => k !== 'day' && v !== null) ? h : null;
}

const rows = <T>(v: unknown, max: number, f: (r: unknown) => T | null): T[] =>
  (Array.isArray(v) ? v.slice(0, max) : []).map(f).filter((x): x is T => x !== null);

/**
 * Paczka z zegarka po odszyfrowaniu. Każdy wiersz sprawdzany osobno: zepsuty dzień odpada,
 * reszta wchodzi. `null`, gdy to nie jest paczka w znanej wersji albo jej czas wypada w
 * przyszłości (zegar zegarka może się spieszyć najwyżej o dobę).
 */
export function parsePayload(v: unknown, nowMs: number = Date.now()): WatchPayload | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const t = num(p.t, EPOCH_MIN, nowMs / 1000 + 86_400);
  if (p.v !== 1 || t === null) return null;
  return {
    t,
    days: rows(p.d, 31, dayRow),
    acts: rows(p.a, 50, (r) => actRow(r, t)),
    health: rows(p.h, 31, healthRow),
  };
}

const merged = <T, K>(old: T[], fresh: T[], key: (x: T) => K, order: (a: T, b: T) => number): T[] => {
  const m = new Map<K, T>();
  [...old, ...fresh].forEach((x) => m.set(key(x), x));
  return [...m.values()].sort(order);
};

const byDay = (a: { day: string }, b: { day: string }) => a.day.localeCompare(b.day);

/**
 * Dokłada paczkę do zapisu i mówi, czy coś się zmieniło. Starsza albo ta sama paczka nic nie
 * zmienia — przychodzi, gdy zegarek nie wysłał niczego od ostatniego otwarcia. W nowszej
 * każdy dzień zastępuje swój odpowiednik: licznik kroków w ciągu dnia tylko rośnie, a jeśli
 * spadł, to zegarek wiedział lepiej (reset, poprawka po synchronizacji).
 */
export function mergeWatch(state: AppState, p: WatchPayload, got: Date = new Date()): boolean {
  const w = state.watch;
  if (w && p.t <= w.t) return false;
  state.watch = {
    t: p.t,
    got: got.toISOString(),
    days: merged(w?.days ?? [], p.days, (d) => d.day, byDay),
    acts: merged(w?.acts ?? [], p.acts, (a) => a.start, (a, b) => a.start - b.start),
    health: merged(w?.health ?? [], p.health, (h) => h.day, byDay),
  };
  return true;
}

/** Dzień lokalny, jak na zegarku: przejazd o 23:30 należy do dnia, w którym się zaczął. */
const localDayOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Wpisy ruchu z zegarka: kroki dnia i przejazdy rowerem z drogą. Zakresów wpisu tu nie
 * sprawdzamy — robi to `cardioOf`, który dokłada je do wpisów ręcznych.
 */
export function watchEntries(w: WatchData | undefined): Cardio[] {
  if (!w) return [];
  const steps = w.days
    .filter((d) => d.steps > 0)
    .map((d): Cardio => ({ kind: 'steps', steps: d.steps, key: `watch-steps-${d.day}`, day: d.day, at: `${d.day}T23:59:59.000Z`, src: 'watch' }));
  const rides = w.acts
    .filter((a) => a.sport === SPORT_CYCLING && a.m !== null && a.m > 0)
    .map((a): Cardio => {
      const at = new Date(a.start * 1000);
      return {
        kind: 'bike',
        kmh: Math.round((a.m! / a.sec) * 36) / 10,
        min: Math.round(a.sec / 60),
        key: `watch-ride-${a.start}`,
        day: localDayOf(at),
        at: at.toISOString(),
        src: 'watch',
      };
    });
  return [...steps, ...rides];
}

/** Kroki dnia z zegarka albo `null`, gdy zegarek o tym dniu nic nie mówi. */
export const watchStepsOn = (state: AppState, day: string): number | null =>
  state.watch?.days.find((d) => d.day === day)?.steps ?? null;

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});

/** Dane z zegarka z zapisu albo importu — przesiane tymi samymi zakresami co paczka. */
export function restoreWatch(v: unknown): WatchData | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const w = v as Record<string, unknown>;
  const t = num(w.t, EPOCH_MIN, Number.MAX_SAFE_INTEGER);
  if (t === null || typeof w.got !== 'string' || Number.isNaN(Date.parse(w.got))) return undefined;
  const all = Number.MAX_SAFE_INTEGER;
  return {
    t,
    got: w.got,
    days: rows(w.days, all, (x) => {
      const d = obj(x);
      return dayRow([d.day, d.steps, d.m, d.floors, d.active]);
    }),
    acts: rows(w.acts, all, (x) => {
      const a = obj(x);
      return actRow([a.start, a.sport, a.sec, a.m], all);
    }),
    health: rows(w.health, all, (x) => {
      const h = obj(x);
      return healthRow([h.day, h.rhr, h.hrMin, h.hrAvg, h.hrMax, h.stress, h.bbMin, h.bbMax, h.sleep]);
    }),
  };
}
```

- [ ] **Step 5: Run the tests.** Run `npx vitest run src/engine/watch.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit:** `git add src/types.ts src/engine/watch.ts src/engine/watch.test.ts && git commit -m "feat: dane z zegarka w silniku — paczka, scalanie i wpisy w locie"`

### Task 5: Effective cardio list (higher steps win)

**Files:**
- Modify: `src/engine/cardio.ts`
- Test: `src/engine/watch.test.ts` (append)

- [ ] **Step 1: Append failing tests** to `src/engine/watch.test.ts` (extra imports: `addCardio, cardioOf, cardioStats, minutesByDay, removeCardio, stepsOn, typedStepsOn` from `./cardio`):

```ts
describe('ruch razem z zegarkiem', () => {
  const day = '2026-10-08';
  const withWatch = (steps: number) => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload({ d: [[day, steps]], a: [], h: [] }), NOW)!);
    return s;
  };

  it('wyższa liczba kroków wygrywa — zegarek albo wpis', () => {
    const s = withWatch(9000);
    addCardio(s, { kind: 'steps', steps: 6000 }, day);
    expect(stepsOn(s, day)).toBe(9000);
    expect(cardioOf(s).filter((c) => c.kind === 'steps' && c.day === day)).toHaveLength(1);
    addCardio(s, { kind: 'steps', steps: 12000 }, day);
    expect(stepsOn(s, day)).toBe(12000);
    expect(cardioOf(s).find((c) => c.day === day)!.src).toBeUndefined();
    expect(typedStepsOn(s, day)).toBe(12000);
  });

  it('przy remisie zostaje wpis ręczny — ten da się usunąć', () => {
    const s = withWatch(8000);
    addCardio(s, { kind: 'steps', steps: 8000 }, day);
    expect(cardioOf(s).find((c) => c.day === day)!.src).toBeUndefined();
  });

  it('wpisu z zegarka nie da się usunąć, a usunięcie ręcznego oddaje dzień zegarkowi', () => {
    const s = withWatch(9000);
    const { entry } = addCardio(s, { kind: 'steps', steps: 12000 }, day);
    expect(removeCardio(s, `watch-steps-${day}`)).toBe(false);
    expect(removeCardio(s, entry.key)).toBe(true);
    expect(stepsOn(s, day)).toBe(9000);
    expect(typedStepsOn(s, day)).toBe(0);
  });

  it('kroki z zegarka dają minuty ruchu i liczą się w statystykach odznak', () => {
    const s = withWatch(10000);
    expect(Math.round(minutesByDay(s)[day]!)).toBe(50);
    expect(cardioStats(s)).toMatchObject({ steps: 10000, bestDaySteps: 10000, goalDays: 1 });
  });

  it('bez zegarka lista to dokładnie wpisy ręczne', () => {
    const s = freshState();
    addCardio(s, { kind: 'steps', steps: 5000 }, day);
    expect(cardioOf(s)).toBe(s.cardio);
  });
});
```

(`minutesByDay` for 10 000 steps: (10 000 − 5 000) / 100 = 50.)

- [ ] **Step 2: Run them to verify they fail.** Run `npx vitest run src/engine/watch.test.ts`. Expected: FAIL (`typedStepsOn` missing; watch steps not counted).

- [ ] **Step 3: Implement in `src/engine/cardio.ts`.** Import `import { watchEntries } from './watch';` and replace `cardioOf`:

```ts
/** Wpisy wpisane ręcznie — tylko te da się usunąć. Zapisy starsze niż lista wczytują się jako pusta. */
export const manualOf = (state: AppState): Cardio[] => state.cardio ?? [];

/**
 * Cały ruch, z którego liczą się kalorie, minuty ruchu, doświadczenie i odznaki: wpisy ręczne
 * i to, co podał zegarek. Kroki mają jeden wpis na dzień, więc z dwóch liczb — wpisanej
 * i z zegarka — zostaje wyższa. Niższa nie przepada: czeka w zapisie i wraca, gdyby druga
 * zniknęła. Przy remisie zostaje wpis ręczny, bo ten da się usunąć.
 */
export function cardioOf(state: AppState): Cardio[] {
  const manual = manualOf(state);
  const watch = watchEntries(state.watch).filter((c) => inputProblem(c) === null);
  if (!watch.length) return manual;
  const watchSteps = new Map<string, number>();
  watch.forEach((c) => {
    if (c.kind === 'steps') watchSteps.set(c.day, c.steps);
  });
  const typedWins = new Set<string>();
  const out = manual.filter((c) => {
    if (c.kind !== 'steps') return true;
    const w = watchSteps.get(c.day);
    if (w !== undefined && w > c.steps) return false;
    typedWins.add(c.day);
    return true;
  });
  watch.forEach((c) => {
    if (c.kind !== 'steps' || !typedWins.has(c.day)) out.push(c);
  });
  return out;
}

/** Kroki wpisane ręcznie na dzień — zero, gdy wpisu nie ma. Zegarek tu się nie liczy. */
export const typedStepsOn = (state: AppState, day: string): number =>
  manualOf(state).find((c): c is Extract<Cardio, { kind: 'steps' }> => c.kind === 'steps' && c.day === day)?.steps ?? 0;
```

In `removeCardio` replace `const list = cardioOf(state);` with `const list = manualOf(state);`.

- [ ] **Step 4: Run the whole suite.** Run `npm test`. Expected: all pass (existing cardio, badge and XP tests unchanged).
- [ ] **Step 5: Commit:** `git add src/engine && git commit -m "feat: kroki z zegarka i wpisane — liczy się wyższa liczba"`

### Task 6: Browser layer (`src/garmin.ts`)

**Files:**
- Create: `src/garmin.ts`, `src/garmin.test.ts`

- [ ] **Step 1: Write the failing tests** in `src/garmin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readPull, whenText } from './garmin';
import { deriveKeys, newKey, seal } from './watchseal';

/** Odpowiedź serwera na odbiór paczki — bez sieci: koperta, jej treść i jej brak. */

const NOW = Date.parse('2026-10-08T18:00:00Z');
const PAYLOAD = { v: 1, t: NOW / 1000 - 60, d: [['2026-10-08', 9120]], a: [], h: [] };

describe('odbiór paczki', () => {
  it('otwiera kopertę i oddaje paczkę', async () => {
    const keys = (await deriveKeys(newKey()))!;
    const blob = await seal(keys, JSON.stringify(PAYLOAD));
    const r = await readPull(keys, 200, { blob, updated: NOW }, NOW);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.payload.days[0]!.steps).toBe(9120);
  });

  it('pusta skrzynka, awaria serwera, obcy klucz i nie-paczka', async () => {
    const keys = (await deriveKeys(newKey()))!;
    const other = (await deriveKeys(newKey()))!;
    expect((await readPull(keys, 404, null, NOW)).kind).toBe('empty');
    expect((await readPull(keys, 503, null, NOW)).kind).toBe('offline');
    expect((await readPull(keys, 200, { blob: await seal(other, JSON.stringify(PAYLOAD)) }, NOW)).kind).toBe('bad');
    expect((await readPull(keys, 200, { blob: await seal(keys, 'to nie JSON') }, NOW)).kind).toBe('bad');
    expect((await readPull(keys, 200, { blob: await seal(keys, '{"v":9}') }, NOW)).kind).toBe('bad');
    expect((await readPull(keys, 200, {}, NOW)).kind).toBe('bad');
  });
});

describe('kiedy przyszły dane', () => {
  const now = new Date(2026, 9, 8, 18, 0);
  it('dziś, wczoraj albo data', () => {
    expect(whenText(new Date(2026, 9, 8, 14, 5).toISOString(), now)).toBe('dziś 14:05');
    expect(whenText(new Date(2026, 9, 7, 7, 30).toISOString(), now)).toBe('wczoraj 7:30');
    expect(whenText(new Date(2026, 9, 1, 21, 40).toISOString(), now)).toBe('1.10 21:40');
  });
});
```

- [ ] **Step 2: Run them to verify they fail.** Run `npx vitest run src/garmin.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/garmin.ts`:**

```ts
import { API_URL, apiConfigured } from './api';
import { parsePayload } from './engine/watch';
import type { WatchPayload } from './engine/watch';
import { cleanKey, deriveKeys, open } from './watchseal';
import type { WatchKeys } from './watchseal';

/**
 * Zegarek Garmin — warstwa przeglądarki: klucz, odbiór paczki z serwera i odłączenie.
 *
 * Klucz powstaje w karcie zegarka i leży tylko w pamięci tej strony. Do zegarka trafia przez
 * schowek: ktoś wkleja go w ustawienia aplikacji GYM TRACKER na zegarku w Garmin Connect.
 * Do eksportu danych nie trafia — plik z kopią treningów nie ma otwierać danych o zdrowiu.
 *
 * Adres aplikacji w Connect IQ Store przychodzi z buildu (`VITE_GARMIN_APP_URL`). Bez niego
 * albo bez serwera karty zegarka nie ma, a aplikacja działa jak dotąd.
 */

export const GARMIN_APP_URL = String(import.meta.env.VITE_GARMIN_APP_URL ?? '');

export const garminConfigured = (): boolean => apiConfigured() && GARMIN_APP_URL !== '';

const KEY = 'gt-garmin-key';

export function garminKey(): string | null {
  try {
    return cleanKey(localStorage.getItem(KEY) ?? '');
  } catch {
    return null;
  }
}

export function saveGarminKey(raw: string): boolean {
  const k = cleanKey(raw);
  if (!k) return false;
  try {
    localStorage.setItem(KEY, k);
    return true;
  } catch {
    return false;
  }
}

/**
 * - `ok` — paczka odczytana;
 * - `empty` — skrzynka pusta: zegarek jeszcze nic nie wysłał;
 * - `bad` — paczka jest, ale nie otwiera się tym kluczem (na zegarku inny klucz);
 * - `offline` — sieć albo serwer;
 * - `skip` — za wcześnie od poprzedniego sprawdzenia;
 * - `off` — brak klucza albo serwera w buildzie.
 */
export type PullResult = { kind: 'ok'; payload: WatchPayload } | { kind: 'empty' | 'bad' | 'offline' | 'skip' | 'off' };

/** Odpowiedź `/garmin/pull` zamieniona na wynik — osobno od sieci, żeby dało się ją sprawdzić. */
export async function readPull(keys: WatchKeys, status: number, body: unknown, nowMs: number): Promise<PullResult> {
  if (status === 404) return { kind: 'empty' };
  if (status !== 200 || !body || typeof body !== 'object') return { kind: 'offline' };
  const blob = (body as { blob?: unknown }).blob;
  const text = typeof blob === 'string' ? await open(keys, blob) : null;
  if (text === null) return { kind: 'bad' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: 'bad' };
  }
  const payload = parsePayload(json, nowMs);
  return payload ? { kind: 'ok', payload } : { kind: 'bad' };
}

/** Zegarek wysyła co pół godziny — częściej niż raz na minutę nie ma po co pytać. */
export const PULL_GAP_MS = 60_000;
let lastPull = 0;
let lastKind: PullResult['kind'] | null = null;

/** Wynik ostatniego sprawdzenia w tej karcie przeglądarki — dla karty w ustawieniach. */
export const lastPullKind = (): PullResult['kind'] | null => lastKind;

export async function pullWatch(force = false): Promise<PullResult> {
  const hex = garminKey();
  if (!garminConfigured() || !hex) return { kind: 'off' };
  const now = Date.now();
  if (!force && now - lastPull < PULL_GAP_MS) return { kind: 'skip' };
  lastPull = now;
  const keys = await deriveKeys(hex);
  if (!keys) return { kind: 'off' };
  let r: PullResult;
  try {
    const res = await fetch(`${API_URL}/garmin/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ box: keys.box }),
      cache: 'no-store',
    });
    r = await readPull(keys, res.status, res.status === 200 ? await res.json() : null, now);
  } catch {
    r = { kind: 'offline' };
  }
  lastKind = r.kind;
  return r;
}

/** Odłącza zegarek: kasuje skrzynkę na serwerze i klucz w tej przeglądarce. Dane, które już przyszły, zostają. */
export async function forgetWatch(): Promise<void> {
  const hex = garminKey();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Bez pamięci strony klucza i tak nie było. */
  }
  lastKind = null;
  const keys = hex ? await deriveKeys(hex) : null;
  if (!keys || !apiConfigured()) return;
  await fetch(`${API_URL}/garmin/forget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ box: keys.box }),
  }).catch(() => undefined);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** „dziś 14:05”, „wczoraj 7:30”, „1.10 21:40” — według zegara telefonu. */
export function whenText(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = `${d.getHours()}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `dziś ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `wczoraj ${time}`;
  return `${d.getDate()}.${pad(d.getMonth() + 1)} ${time}`;
}
```

- [ ] **Step 4: Run the tests.** Run `npx vitest run src/garmin.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit:** `git add src/garmin.ts src/garmin.test.ts && git commit -m "feat: odbiór paczki z zegarka w przeglądarce"`

### Task 7: UI and app wiring

**Files:**
- Create: `src/components/Garmin.tsx`
- Modify: `src/components/views.tsx`, `src/components/Cardio.tsx`, `src/components/Health.tsx`, `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: `WATCH_NOTE` in `src/components/Health.tsx`:**

```ts
/**
 * Pod liczbami zdrowia z zegarka. Pokazujemy je bez oceny — „za wysokie” albo „w normie”
 * mówi lekarz, nie aplikacja.
 */
export const WATCH_NOTE =
  'Liczby z czujników zegarka, pokazane bez oceny: tętno spoczynkowe to średnia z ostatnich 7 dni, stres i Body Battery w skali 0–100, sen — wynik snu z zegarka. Pomiar na nadgarstku bywa niedokładny. Jeśli coś cię niepokoi, porozmawiaj z lekarzem.';
```

- [ ] **Step 2: Create `src/components/Garmin.tsx`:**

```tsx
import { useState } from 'react';
import { GARMIN_APP_URL, forgetWatch, garminConfigured, garminKey, lastPullKind, saveGarminKey, whenText } from '../garmin';
import type { PullResult } from '../garmin';
import { cleanKey, newKey } from '../watchseal';
import type { AppState } from '../types';

/**
 * Karta zegarka w ustawieniach: połączenie, klucz do wklejenia, stan i odłączenie.
 *
 * Połączenie to jeden klucz, który znają tylko ta przeglądarka i zegarek. Wkleja się go raz,
 * w ustawieniach aplikacji GYM TRACKER na zegarku — w Garmin Connect na telefonie jest
 * klawiatura i schowek, a na zegarku nie ma ani jednego, ani drugiego.
 */

/** Klucz w grupach po osiem znaków — łatwiej porównać na dwóch ekranach. Zegarek spacje pomija. */
const grouped = (k: string): string => k.match(/.{1,8}/g)!.join(' ');

const SAID: Partial<Record<PullResult['kind'], string>> = {
  empty:
    'Zegarek jeszcze nic nie przysłał. Dane przychodzą kilka minut po otwarciu aplikacji na zegarku, gdy telefon jest w pobliżu.',
  bad: 'Paczka z zegarka nie otwiera się tym kluczem — na zegarku jest pewnie inny. Wklej klucz z tej karty jeszcze raz.',
  offline: 'Serwer nie odpowiada albo nie ma sieci. Spróbuję znów przy następnym otwarciu aplikacji.',
};

export function GarminCard({
  state,
  onSync,
  onToast,
}: {
  state: AppState;
  onSync: () => Promise<PullResult>;
  onToast: (m: string) => void;
}) {
  const [key, setKey] = useState<string | null>(() => garminKey());
  const [showKey, setShowKey] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [kind, setKind] = useState<PullResult['kind'] | null>(() => lastPullKind());
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  if (!garminConfigured()) return null;

  const got = state.watch?.got;

  const connect = (raw: string) => {
    if (!saveGarminKey(raw)) {
      onToast('Nie udało się zapisać klucza w tej przeglądarce.');
      return;
    }
    setKey(garminKey());
    setShowKey(true);
    setPaste(null);
    setKind(null);
  };

  const check = async () => {
    setBusy(true);
    try {
      const r = await onSync();
      setKind(r.kind);
      onToast(r.kind === 'ok' ? 'Dane z zegarka sprawdzone.' : (SAID[r.kind] ?? 'Spróbuj za chwilę.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key!);
      onToast('Klucz skopiowany — wklej go w ustawieniach aplikacji na zegarku.');
    } catch {
      onToast('Nie udało się skopiować — zaznacz klucz w polu i skopiuj go ręcznie.');
    }
  };

  const disconnect = async () => {
    if (!sure) {
      setSure(true);
      return;
    }
    setBusy(true);
    await forgetWatch();
    setBusy(false);
    setSure(false);
    setKey(null);
    setShowKey(false);
    setKind(null);
    onToast('Zegarek odłączony. Dane, które już przyszły, zostają w historii. Klucz usuń też z ustawień aplikacji na zegarku.');
  };

  return (
    <div className="grp">
      <h2>Zegarek Garmin</h2>
      {!key ? (
        <>
          <p className="tight">
            Kroki, przejazdy rowerem, tętno, stres, Body Battery i sen przyjdą z zegarka same — bez
            przepisywania. Potrzebna jest mała aplikacja GYM TRACKER na zegarku i jeden klucz wklejony
            w jej ustawienia.
          </p>
          {paste === null ? (
            <div className="watch-actions">
              <button className="btn" onClick={() => connect(newKey())}>
                Połącz zegarek
              </button>
              <button className="btn ghost sm" onClick={() => setPaste('')}>
                Mam już klucz z innego urządzenia
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cleanKey(paste)) connect(paste);
                else onToast('Klucz to 64 znaki: cyfry i litery od a do f.');
              }}
            >
              <label className="fld">
                <span>klucz z drugiego urządzenia</span>
                <textarea
                  className="watch-key"
                  rows={3}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
              </label>
              <div className="watch-actions">
                <button className="btn sm" type="submit">
                  Zapisz klucz
                </button>
                <button className="btn ghost sm" type="button" onClick={() => setPaste(null)}>
                  Anuluj
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          <p className="tight">{got ? `Ostatnie dane z zegarka: ${whenText(got)}.` : 'Zegarek jeszcze nic nie przysłał.'}</p>
          {kind === 'bad' && <p className="tight cardio-note warn">{SAID.bad}</p>}
          {(!got || showKey) && (
            <ol className="watch-steps">
              <li>
                Zainstaluj na zegarku aplikację GYM TRACKER z{' '}
                <a href={GARMIN_APP_URL} target="_blank" rel="noopener noreferrer">
                  Connect IQ Store
                </a>
                .
              </li>
              <li>
                W aplikacji Garmin Connect na telefonie otwórz ustawienia GYM TRACKER: zegarek →
                Aktywności i aplikacje → GYM TRACKER → Ustawienia.
              </li>
              <li>
                Wklej tam ten klucz:
                <textarea
                  readOnly
                  className="watch-key"
                  rows={2}
                  value={grouped(key)}
                  aria-label="Klucz do zegarka"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn sm" onClick={() => void copy()}>
                  Kopiuj klucz
                </button>
              </li>
              <li>
                Otwórz raz GYM TRACKER na zegarku. Pierwsze dane przyjdą po chwili, potem co pół godziny,
                gdy telefon jest w pobliżu.
              </li>
            </ol>
          )}
          <div className="watch-actions">
            <button className="btn sm" disabled={busy} onClick={() => void check()}>
              Sprawdź teraz
            </button>
            {got && (
              <button className="btn ghost sm" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Schowaj klucz' : 'Pokaż klucz'}
              </button>
            )}
            <button className="btn ghost sm" disabled={busy} onClick={() => void disconnect()}>
              {sure ? 'Na pewno odłączyć?' : 'Odłącz zegarek'}
            </button>
          </div>
        </>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        Zegarek szyfruje dane tym kluczem, zanim wyjdą z telefonu. Serwer przechowuje tylko ostatnią
        zaszyfrowaną paczkę, najwyżej przez tydzień, i nie zna klucza — otworzy ją wyłącznie
        przeglądarka, w której klucz jest zapisany. Klucz nie trafia do eksportu danych; na drugim
        urządzeniu wklej go przez „Mam już klucz”.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Settings.** In `src/components/views.tsx`: import `GarminCard` and `type PullResult` (from `../garmin`). Add the prop `onWatchSync: () => Promise<PullResult>` to `SettingsView`, and render `<GarminCard state={state} onSync={onWatchSync} onToast={onToast} />` right after `<RemindersCard …/>`.

- [ ] **Step 4: Cardio UI** (`src/components/Cardio.tsx`):
  - Imports: add `typedStepsOn` to the `../engine/cardio` import; `import { watchStepsOn } from '../engine/watch';`; `import { WATCH_NOTE } from './Health';`; add `WatchHealth` to the type import.
  - `CardioItem`: watch rows get the suffix and no delete button:
    ```tsx
    const watch = c.src === 'watch';
    // …
      <span className="cardio-name">
        {cardioLabel(c)}
        {watch && <small className="watch-src"> · z zegarka</small>}
      </span>
      …
      {watch ? (
        <span aria-hidden="true" />
      ) : (
        <button className="snack-del" …>×</button>
      )}
    ```
  - Form: replace `const prevSteps = kind === 'steps' && dayOk ? stepsOn(state, day) : 0;` with:
    ```ts
    // Wpis ręczny zastępuje się nowym; liczba z zegarka zostaje i wygrywa, jeśli jest wyższa.
    const prevSteps = kind === 'steps' && dayOk ? typedStepsOn(state, day) : 0;
    const watchSteps = kind === 'steps' && dayOk ? watchStepsOn(state, day) : null;
    const watchRides = kind === 'bike' && dayOk ? cardioOn(state, day).filter((c) => c.src === 'watch') : [];
    ```
    and after the existing `prevSteps > 0` note add:
    ```tsx
        {watchSteps !== null && watchSteps > 0 && (
          <p className="tight cardio-note">
            Zegarek podał na ten dzień {stepsText(watchSteps)}. Liczy się wyższa z dwóch liczb, więc
            niższy wpis niczego nie zmieni.
          </p>
        )}
        {watchRides.length > 0 && (
          <p className="tight cardio-note">
            Zegarek podał już przejazd z tego dnia: {watchRides.map((c) => cardioLabel(c)).join(', ')}.
            Wpisz tylko inny — ten sam policzyłby się dwa razy.
          </p>
        )}
    ```
  - Health days: add a component and render `<WatchHealthDays state={state} today={today} />` after the "Ostatnie siedem dni" group in `CardioPage`:
    ```tsx
    /** Zdrowie z zegarka: siedem dni, najnowszy na górze. Same liczby, bez oceny — ta należy do lekarza. */
    function WatchHealthDays({ state, today }: { state: AppState; today: string }) {
      const rows = Array.from({ length: 7 }, (_, i) => addDays(today, -i))
        .map((d) => state.watch?.health.find((h) => h.day === d))
        .filter((h): h is WatchHealth => !!h);
      if (!rows.length) return null;
      const range = (a: number | null, b: number | null): string =>
        a === null || b === null ? String(a ?? b) : a === b ? String(a) : `${a}–${b}`;
      return (
        <>
          <div className="sect-label">Z zegarka</div>
          {rows.map((h) => (
            <div className="h-item" key={h.day}>
              <div className="h-date">{dm(h.day)}</div>
              <div className="h-detail">
                {[
                  h.rhr !== null ? `tętno spoczynkowe ${h.rhr}` : null,
                  h.hrMin !== null || h.hrMax !== null
                    ? `tętno ${range(h.hrMin, h.hrMax)}${h.hrAvg !== null ? `, średnio ${h.hrAvg}` : ''}`
                    : null,
                  h.stress !== null ? `stres ${h.stress}` : null,
                  h.bbMin !== null || h.bbMax !== null ? `Body Battery ${range(h.bbMin, h.bbMax)}` : null,
                  h.sleep !== null ? `sen ${h.sleep}/100` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="streak" />
            </div>
          ))}
          <div className="wrap">
            <p className="hint" style={{ marginTop: 8 }}>
              {WATCH_NOTE}
            </p>
          </div>
        </>
      );
    }
    ```

- [ ] **Step 5: App wiring** (`src/App.tsx`):
  - Imports: `mergeWatch, restoreWatch, watchStepsOn` and `type WatchPayload` from `./engine/watch`; `garminConfigured, pullWatch` and `type PullResult` from `./garmin`.
  - `restoreExtras`: after the `body` restore add
    ```ts
      // Dane z zegarka: przesiane jak paczka — zepsuty dzień odpada, reszta zostaje.
      const watch = restoreWatch(saved.watch);
      if (watch) next.watch = watch;
    ```
  - Before `if (!state) return …` add:
    ```ts
      // Dane z zegarka: przy otwarciu i po powrocie do aplikacji, nie częściej niż raz na minutę
      // (pilnuje tego `pullWatch`). Nigdy w trakcie treningu — nowe odznaki i awans wyskakują
      // w oknie, a okno w środku serii to ostatnie, czego ktoś potrzebuje.
      const onWatch = useRef<(p: WatchPayload) => void>(() => undefined);
      const ready = !!state;
      const training = !!state?.session;
      useEffect(() => {
        if (!ready || training || !garminConfigured()) return;
        const pull = () =>
          void pullWatch().then((r) => {
            if (r.kind === 'ok') onWatch.current(r.payload);
          });
        const t = window.setTimeout(pull, 1500);
        const back = () => {
          if (document.visibilityState === 'visible') pull();
        };
        document.addEventListener('visibilitychange', back);
        return () => {
          window.clearTimeout(t);
          document.removeEventListener('visibilitychange', back);
        };
      }, [ready, training]);
    ```
  - In the cardio handlers section add:
    ```ts
      /**
       * Paczka z zegarka. Kroki i przejazdy liczą się jak wpisy: dają kalorie, minuty ruchu,
       * doświadczenie i odznaki. Nowa paczka może też obniżyć kroki dnia (zegarek poprawił
       * licznik), więc progi, których historia już nie uzasadnia, wracają — jak przy poprawce wpisu.
       */
      const applyWatch = (payload: WatchPayload) => {
        const before = levelNow(state);
        const next = clone(state);
        if (!mergeWatch(next, payload)) return;
        revokeUnmet(next, badgeCtx(next), (d) => d.group === 'cardio');
        const fresh = syncBadges(next, badgeCtx(next));
        commit(next);
        void (async () => {
          if (fresh.length) await sayBadges(fresh, metrics(next), 'Z danymi z zegarka');
          await sayLevel(before, next);
        })();
      };
      onWatch.current = applyWatch;

      const checkWatch = async (): Promise<PullResult> => {
        const r = await pullWatch(true);
        if (r.kind === 'ok') onWatch.current(r.payload);
        return r;
      };
    ```
  - In `logCardio`'s toast, after the `replaced` part add:
    ```ts
            (entry.kind === 'steps' && (watchStepsOn(next, day) ?? 0) > entry.steps
              ? ` Zegarek podał więcej (${watchStepsOn(next, day)!.toLocaleString('pl-PL')}) — liczy się jego liczba.`
              : '') +
    ```
  - Pass `onWatchSync={checkWatch}` to `<SettingsView …>`.

- [ ] **Step 6: Styles** (`src/styles.css`, next to the `.cardio-*` rules):

```css
  .watch-key{display:block;width:100%;margin:6px 0 8px;padding:10px;font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
    letter-spacing:.02em;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:3px;resize:none}
  .watch-steps{margin:10px 0 0;padding-left:22px}
  .watch-steps li{margin:0 0 10px}
  .watch-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .watch-src{color:var(--ink-soft);font-weight:400}
```

- [ ] **Step 7: Verify.** Run `npm run typecheck && npm test`. Expected: no type errors, all tests pass (including `styles.contrast.test.ts`).
- [ ] **Step 8: Commit:** `git add src && git commit -m "feat: karta zegarka Garmin, kroki i przejazdy z zegarka, zdrowie na ekranie ruchu"`

### Task 8: Connect IQ watch app

**Files:** create under `garmin/`: `manifest.xml`, `monkey.jungle`, `resources/strings/strings.xml`, `resources/drawables/drawables.xml`, `resources/drawables/launcher_icon.png`, `resources/settings/properties.xml`, `resources/settings/settings.xml`, `source/GymTrackerApp.mc`, `source/SyncService.mc`, `source/Sync.mc`, `source/Seal.mc`, `source/Collect.mc`, `source/Status.mc`, `source/MainView.mc`, `source/SyncGlance.mc`, `source/SealTest.mc`, `README.md`.

- [ ] **Step 1: Manifest and resources.** App id `be917461ce72434087a9d8225b2948c4`, `type="watch-app"`, `minApiLevel="3.2.0"`, permissions Background/Communications/SensorHistory/UserProfile, languages pol + eng, products fenix6, fenix7, epix2, fr255, fr265, fr955, fr965, venu2, venu3, vivoactive4, vivoactive5. The `key` property is user-visible (`alphaNumeric` setting); the `api` property is hidden and holds the Worker URL. The launcher icon is `public/icons/icon-192.png` resized to 70×70 with `sips`.
- [ ] **Step 2: Sources**, in the shapes below; all background code is `(:background)`, and `Status` + `SyncGlance` are `(:glance)`:
  - `Seal` — `keyBytes` (strip whitespace and `-`, lowercase, exactly 64 hex), `fromHex`, `toHex` (lowercased), `bytes`, `hmac`, `derive(secret, label)` = HMAC(secret, label ‖ 0x01), `box`, `seal(secret, text, iv)` with manual PKCS#7.
  - `Collect` — `days()` (history + today last; distance cm→m; `has` checks for floors and active minutes), `acts(now)` (14 days, ≤ 20, guarded by `UserProfile has :getUserActivityHistory`), `health(now)` (folds HR/stress/BB samples since `seen` into per-day buckets in `Storage`; resting HR from `averageRestingHeartRate`; sleep score via guarded Complications; keeps 8 days).
  - `Sync` — `EVERY = 1800`, `NO_KEY = -1000`, `payload(now)`, `run(done)` (POST JSON to `api + "/garmin/push"`), inner class `Reply`.
  - `SyncService` — `onTemporalEvent` → `Sync.run` → `Background.exit(code)`.
  - `GymTrackerApp` — registers the 30-min temporal event in `getInitialView`; `onBackgroundData` → `Status.save`.
  - `Status` — `save(code)`, `text()` (Polish status line; −1000 → bad key, 200 → "Wysłane HH:MM", 429, negative → no phone).
  - `MainView`/`MainDelegate` — status screen; SELECT/tap sends immediately.
  - `SyncGlance` — two lines: name and status.
  - `SealTest` — the shared vector and key normalization.
- [ ] **Step 3: README** `garmin/README.md`: SDK install, set `api`, build, run tests in the simulator (`monkeydo … /t`), sideload, publish, and a checklist of what to verify on a device (epoch of `UserActivity.startTime`, sleep score availability, background access to `ActivityMonitor`, Polish glyphs).
- [ ] **Step 4: Commit:** `git add garmin && git commit -m "feat: aplikacja GYM TRACKER na zegarek Garmin (Connect IQ)"`

### Task 9: Docs and build variable

- [ ] **Step 1:** `.github/workflows/deploy.yml` — add `VITE_GARMIN_APP_URL: ${{ vars.GARMIN_APP_URL }}` to the build env and extend the comment.
- [ ] **Step 2:** `server/api/README.md` — third task (zegarek), endpoints, re-running `schema.sql`, the `GARMIN_APP_URL` variable, D1 write budget.
- [ ] **Step 3:** `README.md` — new section "Zegarek Garmin" (why a watch app; privacy; what comes in and how it counts; health without points; setup), a pointer from "Kroki, cardio i kalorie", the `watch` list in "Zapis danych", new files in the file map, the updated test count.
- [ ] **Step 4: Commit:** `git add -A && git commit -m "docs: zegarek Garmin w README, wdrożeniu serwera i buildzie"`

### Task 10: Final verification

- [ ] Run `npm run typecheck`. Expected: clean.
- [ ] Run `npm test`. Expected: all pass; note the new total.
- [ ] Run `npm run build`. Expected: builds `dist/` and precache runs.
- [ ] Run `VITE_API_URL=http://localhost:8787 VITE_GARMIN_APP_URL=https://apps.garmin.com/ npm run build` to confirm the card's code path compiles into the bundle (grep `dist` for "Zegarek Garmin").
- [ ] Review `git diff main --stat`; request a code review of the branch.
