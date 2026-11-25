import { AAD, isUuid, PHOTO_LIMIT, PHOTO_MAX_CHARS, PHOTO_SIDE, sealJson } from '@gymtracker/link';
import type { PhotoV1 } from '@gymtracker/link';
import { listPhotos, photoFull, photosSupported } from '../silhouette';
import type { PhotoMeta } from '../silhouette';
import { clientPhotoDelete, clientPhotoIds, clientPhotoPut, isRpcError } from './rpc';
import { updateLink } from './store';
import type { LinkConnection } from './store';
import { keyFor } from './sync';

/**
 * Zdjęcia sylwetki dla prowadzącego (zakres `photos`): telefon wysyła zaszyfrowane, zmniejszone
 * kopie najnowszych `PHOTO_LIMIT` zdjęć z „Sylwetki” i kasuje te, których już nie ma. Wołane
 * z `syncAll` tylko przy zgodzie — i nigdy w trakcie treningu, bo wtedy synchronizacja nie biegnie.
 *
 * - Kopia: dłuższy bok do `PHOTO_SIDE`, JPEG ok. 0,82; za duża — mniejsza i słabsza jakość.
 *   Szyfrowana kluczem współpracy z AAD `photo|<współpraca>|<numer>`; numer (UUID) nadaje telefon.
 * - `c.photos`: `<numer na telefonie>|<dzień>` → numer na serwerze. Dzień jest w kluczu, bo
 *   „Sylwetka” pozwala go poprawić: poprawione zdjęcie idzie jako nowa kopia, a stara znika.
 * - Najpierw kasowanie (zdjęcia usunięte na telefonie i starsze niż ostatnie 60), potem najwyżej
 *   `UPLOADS_PER_RUN` wysyłek, od najnowszego — reszta przy następnej synchronizacji.
 * - Pełne zdjęcia czytane są tylko wtedy, gdy jest co wysłać.
 */

/** Ile zdjęć najwyżej idzie w jednej synchronizacji — żeby trwała krótko. */
export const UPLOADS_PER_RUN = 8;
/** Po tylu milisekundach nowe wysyłki czekają na następną synchronizację. */
export const RUN_BUDGET_MS = 20_000;
/** Limit szyfrogramu w bazie (`photos.ciphertext`). */
export const PHOTO_SEALED_MAX = 600_000;

export interface EncodedPhoto {
  w: number;
  h: number;
  /** JPEG w base64 (bez `data:`). */
  jpeg: string;
}

export interface PhotoDeps {
  /** Zdjęcia z „Sylwetki” (bez pełnych bajtów). */
  list: () => Promise<PhotoMeta[]>;
  full: (id: string) => Promise<Blob | null>;
  /** Kopia dla prowadzącego, której base64 mieści się w `maxChars`; `null` — nie da się. */
  encode: (blob: Blob, maxChars: number) => Promise<EncodedPhoto | null>;
  now: () => number;
}

const defaults: PhotoDeps = {
  list: async () => (photosSupported() ? listPhotos() : []),
  full: photoFull,
  encode: encodePhoto,
  now: () => Date.now(),
};

const keyOf = (p: Pick<PhotoMeta, 'id' | 'day'>): string => `${p.id}|${p.day}`;

/** Najnowsze zdjęcia (dzień, potem chwila dodania) — te, które prowadzący ma mieć. */
export function wantedPhotos<P extends Pick<PhotoMeta, 'day' | 'at'>>(list: readonly P[], limit = PHOTO_LIMIT): P[] {
  return [...list].sort((a, b) => b.day.localeCompare(a.day) || b.at - a.at).slice(0, limit);
}

type Failure = 'offline' | 'ended' | 'no_scope' | 'photo_limit' | 'bad_id';

function failure(e: unknown): Failure {
  if (isRpcError(e, 'bad_token') || isRpcError(e, 'ended')) return 'ended';
  if (isRpcError(e, 'no_scope')) return 'no_scope';
  if (isRpcError(e, 'photo_limit')) return 'photo_limit';
  if (isRpcError(e, 'bad_id')) return 'bad_id';
  return 'offline';
}

export async function syncPhotos(c: LinkConnection, deps: Partial<PhotoDeps> = {}): Promise<'ok' | 'offline' | 'ended'> {
  const d: PhotoDeps = { ...defaults, ...deps };
  if (!c.token || c.status !== 'active') return 'ended';
  if (!c.scopes.includes('photos')) return 'ok';
  const token = c.token;
  const started = d.now();

  let local: PhotoMeta[];
  try {
    local = await d.list();
  } catch {
    // Baza zdjęć się nie otworzyła: nie wiadomo, co jest na telefonie — niczego nie kasujemy.
    return 'ok';
  }
  const wanted = wantedPhotos(local);

  let remote: Set<string>;
  try {
    remote = new Set(await clientPhotoIds(c.id, token));
  } catch (e) {
    return failure(e) === 'ended' ? 'ended' : 'offline';
  }

  // Mapa tylko z poprawnymi numerami i tylko dla zdjęć, które nadal mają być u prowadzącego.
  const map: Record<string, string> = {};
  const was = c.photos && typeof c.photos === 'object' ? c.photos : {};
  const wantedKeys = new Set(wanted.map(keyOf));
  for (const [k, v] of Object.entries(was)) if (wantedKeys.has(k) && isUuid(v)) map[k] = v.toLowerCase();
  // Mapa tylko wtedy, gdy zgoda wciąż jest: cofnięcie w trakcie wysyłki (`changeScopes`) skasowało ją
  // razem ze zdjęciami na serwerze — nie przywracamy jej.
  const save = () =>
    updateLink((s) => {
      const x = s.connections.find((y) => y.id === c.id);
      if (x && x.scopes.includes('photos')) x.photos = { ...map };
    });

  // Kasowanie: wszystko na serwerze, czego nie ma w mapie — usunięte na telefonie, starsze niż
  // ostatnie 60, poprawiony dzień albo kopia, której numer przepadł.
  const keep = new Set(Object.values(map));
  for (const id of remote) {
    if (keep.has(id)) continue;
    try {
      await clientPhotoDelete(c.id, token, id);
      remote.delete(id);
    } catch (e) {
      save();
      return failure(e) === 'ended' ? 'ended' : 'offline';
    }
  }

  const todo = wanted.filter((p) => {
    const id = map[keyOf(p)];
    return !id || !remote.has(id);
  });
  if (!todo.length) {
    save();
    return 'ok';
  }

  let key: CryptoKey;
  try {
    key = await keyFor(c);
  } catch {
    save();
    return 'offline';
  }

  let sent = 0;
  for (const p of todo) {
    if (sent >= UPLOADS_PER_RUN || d.now() - started > RUN_BUDGET_MS) break;
    const sealed = await sealPhoto(c.id, key, p, map[keyOf(p)] ?? crypto.randomUUID(), d);
    if (!sealed) continue;
    try {
      await clientPhotoPut(c.id, token, sealed.id, sealed.ciphertext);
    } catch (e) {
      const f = failure(e);
      if (f === 'bad_id') {
        // Numer zajęty gdzie indziej (nie powinno się zdarzyć przy UUID) — następnym razem nowy.
        delete map[keyOf(p)];
        continue;
      }
      save();
      // Zgodę zabrano w międzyczasie — serwer już skasował zdjęcia; nic tu po nas.
      if (f === 'no_scope' || f === 'photo_limit') return 'ok';
      return f === 'ended' ? 'ended' : 'offline';
    }
    map[keyOf(p)] = sealed.id;
    sent += 1;
    // Zapis po każdej wysyłce: przerwana synchronizacja nie wyśle tego samego drugi raz.
    save();
  }
  save();
  return 'ok';
}

async function sealPhoto(
  connectionId: string,
  key: CryptoKey,
  p: PhotoMeta,
  id: string,
  d: PhotoDeps,
): Promise<{ id: string; ciphertext: string } | null> {
  let blob: Blob | null;
  try {
    blob = await d.full(p.id);
  } catch {
    return null;
  }
  if (!blob) return null;
  let budget = PHOTO_MAX_CHARS;
  // Szyfrogram to base64 spakowanego JSON-a z base64 w środku — zwykle tyle co JPEG, ale limit
  // bazy jest twardy: za duży — jeszcze raz, mniejszy.
  for (let attempt = 0; attempt < 2; attempt++) {
    let enc: EncodedPhoto | null;
    try {
      enc = await d.encode(blob, budget);
    } catch {
      return null;
    }
    if (!enc || enc.jpeg.length > PHOTO_MAX_CHARS) return null;
    const env: PhotoV1 = { v: 1, id, day: p.day, w: enc.w, h: enc.h, jpeg: enc.jpeg };
    const ciphertext = await sealJson(key, AAD.photo(connectionId, id), env);
    if (ciphertext.length <= PHOTO_SEALED_MAX) return { id, ciphertext };
    budget = Math.floor(enc.jpeg.length * 0.7);
  }
  return null;
}

/* ── Kopia dla prowadzącego ────────────────────────────────────────────────────────── */

/** Kolejne próby: dłuższy bok i jakość JPEG. */
const STEPS: readonly (readonly [number, number])[] = [
  [PHOTO_SIDE, 0.82],
  [PHOTO_SIDE, 0.7],
  [600, 0.62],
  [480, 0.55],
];

type Source = { image: CanvasImageSource; w: number; h: number; close: () => void };

async function decode(blob: Blob): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, w: bitmap.width, h: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Spróbuj przez <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { image: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

async function draw(src: Source, side: number, quality: number): Promise<{ blob: Blob; w: number; h: number } | null> {
  const f = Math.min(1, side / Math.max(src.w, src.h));
  const w = Math.max(1, Math.round(src.w * f));
  const h = Math.max(1, Math.round(src.h * f));
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src.image, 0, 0, w, h);
      try {
        return { blob: await canvas.convertToBlob({ type: 'image/jpeg', quality }), w, h };
      } finally {
        // Płótno oddaje pamięć od razu, a nie przy sprzątaniu.
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.image, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  canvas.width = 0;
  canvas.height = 0;
  return blob ? { blob, w, h } : null;
}

/** Bajty → base64 kawałkami (`String.fromCharCode` z całym zdjęciem przekroczyłby stos). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Zmniejszona kopia zdjęcia: dłuższy bok do `PHOTO_SIDE`, JPEG ok. 0,82; gdy base64 nie mieści
 * się w `maxChars` — mniejsza i słabsza. `null`, gdy przeglądarka nie odczyta zdjęcia.
 */
export async function encodePhoto(blob: Blob, maxChars: number = PHOTO_MAX_CHARS): Promise<EncodedPhoto | null> {
  let src: Source;
  try {
    src = await decode(blob);
  } catch {
    return null;
  }
  try {
    if (!src.w || !src.h) return null;
    for (const [side, quality] of STEPS) {
      const out = await draw(src, side, quality);
      if (!out) return null;
      const jpeg = toBase64(new Uint8Array(await out.blob.arrayBuffer()));
      if (jpeg.length <= maxChars) return { w: out.w, h: out.h, jpeg };
    }
    return null;
  } finally {
    src.close();
  }
}
