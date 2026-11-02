/**
 * Zdjęcia sylwetki — osobna baza IndexedDB `gt-sylwetka`, nie dziennik jedzenia i nie zapis
 * treningów. Zdjęcie waży setki kilobajtów, więc nie pasuje ani do `localStorage`, ani do kopii
 * zapasowej w jednym pliku JSON: zostaje na tym telefonie, a „Pobierz” przy każdym zdjęciu
 * daje kopię do galerii. Nic stąd nie wychodzi do sieci.
 *
 * Dwa magazyny: `photos` (dzień, chwila, wymiary i miniatura) i `full` (pełne zdjęcie po
 * identyfikatorze). Lista czyta tylko miniatury — kilkanaście kilobajtów sztuka — a pełne
 * zdjęcie idzie do pamięci dopiero przy oglądaniu, porównaniu albo pobraniu.
 *
 * Bajty leżą jako `ArrayBuffer`, nie `Blob`: tak samo czyta je każda przeglądarka (starsze
 * Safari miały kłopot z Blobami w IndexedDB) i testy na fake-indexeddb.
 */

export const PHOTO_DB = 'gt-sylwetka';
const VERSION = 1;
const PHOTOS = 'photos';
const FULL = 'full';

/** Klucz w pamięci karty: aparat telefonu był otwarty — patrz `markCamera`. */
export const CAMERA_MARK = 'gt-sylwetka-camera';

export interface PhotoMeta {
  id: string;
  /** `yyyy-mm-dd` — dzień zdjęcia; dla zdjęć z galerii do poprawienia ręcznie. */
  day: string;
  /** Chwila dodania (ms) — kolejność zdjęć z tego samego dnia. */
  at: number;
  w: number;
  h: number;
}

export interface PhotoThumb extends PhotoMeta {
  thumb: ArrayBuffer;
}

interface FullRow {
  id: string;
  bytes: ArrayBuffer;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Czy ta przeglądarka ma IndexedDB (prywatne okna starszych Firefoksów i część osadzeń nie mają). */
export const photosSupported = (): boolean => typeof indexedDB !== 'undefined';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(FULL)) db.createObjectStore(FULL, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Inna karta kasuje bazę („Usuń wszystkie dane”): to połączenie ustępuje, następne otworzy nową.
      db.onversionchange = () => {
        db.close();
        if (opening === p) opening = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('indexedDB'));
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
  opening = p;
  p.catch(() => {
    if (opening === p) opening = null;
  });
  return p;
}

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB abort'));
  });

const result = <V>(req: IDBRequest<V>): Promise<V> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB'));
  });

const byDate = (a: PhotoMeta, b: PhotoMeta): number => a.day.localeCompare(b.day) || a.at - b.at;

/** Wszystkie zdjęcia z miniaturami, od najstarszego. */
export async function listPhotos(): Promise<PhotoThumb[]> {
  const db = await open();
  const rows = await result(db.transaction(PHOTOS).objectStore(PHOTOS).getAll() as IDBRequest<PhotoThumb[]>);
  return rows.filter((r) => typeof r?.id === 'string' && DAY.test(r.day)).sort(byDate);
}

/** Ile zdjęć jest w bazie — do pytania „Usunąć wszystkie dane?”. Bez bazy albo bez IndexedDB: 0. */
export async function countPhotos(): Promise<number> {
  if (!photosSupported()) return 0;
  try {
    const db = await open();
    return await result(db.transaction(PHOTOS).objectStore(PHOTOS).count());
  } catch {
    return 0;
  }
}

const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Zapisuje zdjęcie (pełne i miniaturę) jedną transakcją: albo oba, albo nic. */
export async function addPhoto(input: { day: string; full: Blob; thumb: Blob; w: number; h: number; at?: number }): Promise<PhotoMeta> {
  // Bajty przed transakcją: transakcja IndexedDB zamyka się sama, gdy czeka na cokolwiek innego.
  const [full, thumb] = await Promise.all([input.full.arrayBuffer(), input.thumb.arrayBuffer()]);
  const meta: PhotoMeta = { id: newId(), day: input.day, at: input.at ?? Date.now(), w: input.w, h: input.h };
  const db = await open();
  const tx = db.transaction([PHOTOS, FULL], 'readwrite');
  tx.objectStore(PHOTOS).put({ ...meta, thumb } satisfies PhotoThumb);
  tx.objectStore(FULL).put({ id: meta.id, bytes: full } satisfies FullRow);
  await done(tx);
  return meta;
}

/** Pełne zdjęcie jako JPEG; `null`, gdy go nie ma. */
export async function photoFull(id: string): Promise<Blob | null> {
  const db = await open();
  const row = await result(db.transaction(FULL).objectStore(FULL).get(id) as IDBRequest<FullRow | undefined>);
  return row ? new Blob([row.bytes], { type: 'image/jpeg' }) : null;
}

/** Poprawia dzień zdjęcia (zdjęcie z galerii bywa starsze niż dzień dodania). */
export async function setPhotoDay(id: string, day: string): Promise<void> {
  if (!DAY.test(day)) return;
  const db = await open();
  const tx = db.transaction(PHOTOS, 'readwrite');
  const store = tx.objectStore(PHOTOS);
  const row = await result(store.get(id) as IDBRequest<PhotoThumb | undefined>);
  if (row) store.put({ ...row, day });
  await done(tx);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction([PHOTOS, FULL], 'readwrite');
  tx.objectStore(PHOTOS).delete(id);
  tx.objectStore(FULL).delete(id);
  await done(tx);
}

/**
 * „Usuń wszystkie dane”: cała baza zdjęć znika. Własne połączenie zamyka się najpierw, inaczej
 * usunięcie czekałoby na nie w nieskończoność; połączenia z innych kart ustępują same
 * (`onversionchange`). Nigdy nie odrzuca — reset nie może stanąć na zdjęciach.
 */
export async function forgetPhotos(): Promise<void> {
  try {
    window.sessionStorage.removeItem(CAMERA_MARK);
  } catch {
    // Zablokowana pamięć karty: nie ma czego czyścić.
  }
  if (!photosSupported()) return;
  const pending = opening;
  opening = null;
  if (pending) {
    try {
      (await pending).close();
    } catch {
      // Baza się nie otworzyła — nie ma czego zamykać.
    }
  }
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(PHOTO_DB);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      // Inna karta trzyma bazę: usunięcie i tak dojdzie do skutku, gdy ją zamknie.
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ---------- aparat telefonu a zamknięta karta ---------- */

/** Jak długo znacznik aparatu coś znaczy: po kwadransie to już inna wizyta. */
const MARK_MS = 15 * 60_000;

/**
 * Aparat telefonu (pole pliku z `capture`) wysyła przeglądarkę w tło, a telefon z małą ilością
 * pamięci potrafi ją wtedy zamknąć — zdjęcie przepada razem z kartą. Przed otwarciem aparatu
 * zostaje znacznik w pamięci karty; zwykły powrót go zdejmuje (`clearCamera`), a gdy strona
 * wczyta się od nowa ze znacznikiem, karta mówi, że zdjęcie czeka w galerii.
 */
export function markCamera(now = Date.now()): void {
  try {
    window.sessionStorage.setItem(CAMERA_MARK, String(now));
  } catch {
    // Bez pamięci karty nie ma znacznika — i tyle.
  }
}

export function clearCamera(): void {
  try {
    window.sessionStorage.removeItem(CAMERA_MARK);
  } catch {
    // Jak wyżej.
  }
}

/** Czy poprzednia strona zamknęła się z otwartym aparatem. Odczyt zdejmuje znacznik. */
export function cameraWasKilled(now = Date.now()): boolean {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(CAMERA_MARK);
  } catch {
    return false;
  }
  clearCamera();
  const at = Number(raw);
  return raw !== null && Number.isFinite(at) && now - at >= 0 && now - at < MARK_MS;
}
