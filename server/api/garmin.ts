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
    // Zegarkowi zawsze JSON, także przy błędzie: zamówił odpowiedź JSON, a każdą inną Connect IQ
    // zgłasza jako -400 zamiast prawdziwego kodu — zegarek nie odróżniłby 429 od braku telefonu.
    const blob = cleanBlob(data.blob);
    if (!validBox(data.box) || !blob) return json(400, { error: 'zła paczka' });
    const old = await store.getBox(data.box);
    if (old && now - old.updated < PUSH_GAP_MS) return json(429, { error: 'za często' });
    if (old) await store.putBox({ ...old, blob, updated: now });
    else {
      const ip = await ipHash();
      if ((await store.recentBoxes(ip, now - 3_600_000)) >= BOXES_PER_HOUR)
        return json(429, { error: 'za dużo nowych skrzynek' });
      await store.putBox({ box: data.box, blob, updated: now, created: now, ipHash: ip });
    }
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
