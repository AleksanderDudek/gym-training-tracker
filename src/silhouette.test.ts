// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CAMERA_MARK,
  PHOTO_DB,
  addPhoto,
  cameraWasKilled,
  clearCamera,
  countPhotos,
  deletePhoto,
  forgetPhotos,
  listPhotos,
  markCamera,
  photoFull,
  setPhotoDay,
} from './silhouette';

const jpeg = (n: number) => new Blob([new Uint8Array(n).fill(7)], { type: 'image/jpeg' });

/** Nazwy baz w tej przeglądarce (fake-indexeddb zna `databases()`). */
const dbNames = async () => (await indexedDB.databases()).map((d) => d.name);

beforeEach(async () => {
  await forgetPhotos();
});

describe('zdjęcia sylwetki — baza gt-sylwetka', () => {
  it('zapis, lista od najstarszego z miniaturą, pełne zdjęcie osobno', async () => {
    await addPhoto({ day: '2026-10-12', full: jpeg(900), thumb: jpeg(30), w: 810, h: 1080, at: 2 });
    await addPhoto({ day: '2026-09-01', full: jpeg(800), thumb: jpeg(20), w: 1080, h: 810, at: 1 });
    const list = await listPhotos();
    expect(list.map((p) => p.day)).toEqual(['2026-09-01', '2026-10-12']);
    expect(list[0]!.thumb.byteLength).toBe(20);
    // Lista nie niesie pełnych zdjęć — tylko miniatury.
    expect(Object.keys(list[0]!).sort()).toEqual(['at', 'day', 'h', 'id', 'thumb', 'w']);
    const full = await photoFull(list[1]!.id);
    expect(full?.type).toBe('image/jpeg');
    expect((await full!.arrayBuffer()).byteLength).toBe(900);
    expect(await countPhotos()).toBe(2);
    expect(await dbNames()).toContain(PHOTO_DB);
  });

  it('poprawka dnia i usunięcie (miniatura i pełne zdjęcie razem)', async () => {
    const a = await addPhoto({ day: '2026-10-12', full: jpeg(10), thumb: jpeg(5), w: 1, h: 1 });
    await setPhotoDay(a.id, '2026-08-30');
    await setPhotoDay(a.id, 'wczoraj');
    expect((await listPhotos())[0]!.day).toBe('2026-08-30');
    await deletePhoto(a.id);
    expect(await listPhotos()).toEqual([]);
    expect(await photoFull(a.id)).toBeNull();
  });

  it('„Usuń wszystkie dane” kasuje całą bazę, także przy otwartym połączeniu; potem da się zacząć od nowa', async () => {
    await addPhoto({ day: '2026-10-12', full: jpeg(10), thumb: jpeg(5), w: 1, h: 1 });
    expect(await countPhotos()).toBe(1);
    await forgetPhotos();
    expect(await dbNames()).not.toContain(PHOTO_DB);
    expect(await listPhotos()).toEqual([]);
  });
});

describe('aparat telefonu a zamknięta karta', () => {
  it('znacznik z ostatniego kwadransa mówi, że karta zamknęła się przy aparacie; odczyt go zdejmuje', () => {
    const now = 1_800_000_000_000;
    markCamera(now - 60_000);
    expect(cameraWasKilled(now)).toBe(true);
    expect(cameraWasKilled(now)).toBe(false);
    markCamera(now - 20 * 60_000);
    expect(cameraWasKilled(now)).toBe(false);
  });

  it('zwykły powrót z aparatu i reset zdejmują znacznik', async () => {
    markCamera();
    clearCamera();
    expect(window.sessionStorage.getItem(CAMERA_MARK)).toBeNull();
    markCamera();
    await forgetPhotos();
    expect(window.sessionStorage.getItem(CAMERA_MARK)).toBeNull();
  });
});
