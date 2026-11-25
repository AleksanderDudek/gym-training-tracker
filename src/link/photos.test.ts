import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret, parsePhoto, PHOTO_SIDE } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { addPhoto, forgetPhotos } from '../silhouette';
import type { PhotoMeta } from '../silhouette';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { acceptInvite } from './accept';
import { encodePhoto, syncPhotos, UPLOADS_PER_RUN, wantedPhotos } from './photos';
import type { PhotoDeps } from './photos';
import { invitePreview } from './rpc';
import { clearLink, connectionOf, linkState } from './store';
import type { LinkConnection } from './store';
import { changeScopes, forgetKeys, syncAll } from './sync';

/**
 * Zdjęcia sylwetki u prowadzącego: zaszyfrowane kopie najnowszych zdjęć, kasowanie usuniętych,
 * najwyżej osiem wysyłek na synchronizację, cisza bez zgody.
 */

let server: FakeSztab;
let conn: LinkConnection;
const state = freshState();

/** „Sylwetka” w pamięci: lista i pełne zdjęcia, z licznikiem czytań pełnych. */
function fakePhotos(list: PhotoMeta[]) {
  const reads: string[] = [];
  const encoded: number[] = [];
  const deps: Partial<PhotoDeps> = {
    list: async () => list.map((p) => ({ ...p })),
    full: async (id) => {
      reads.push(id);
      return list.some((p) => p.id === id) ? new Blob([`jpeg-${id}`], { type: 'image/jpeg' }) : null;
    },
    encode: async (blob, maxChars) => {
      encoded.push(maxChars);
      return { w: 540, h: 720, jpeg: btoa(await blob.text()) };
    },
    now: () => 1_000,
  };
  return { list, reads, encoded, deps };
}

const photo = (i: number, day: string, at = i): PhotoMeta => ({ id: `p${i}`, day, at, w: 810, h: 1080 });
const days = (n: number) => Array.from({ length: n }, (_, i) => photo(i, `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`));

const current = () => connectionOf(linkState(), conn.id)!;
const onServer = () => [...server.connections.get(conn.id)!.photos.keys()];
const puts = () => server.calls.filter((c) => c.name === 'client_photo_put').length;

beforeEach(async () => {
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  const inv = await server.invite(['training'], ['training', 'body', 'photos']);
  const r = await acceptInvite({
    preview: (await invitePreview(inv.id))!,
    fingerprint: inv.fingerprint,
    chosen: ['training'],
    replace: [],
    scopes: ['training', 'body', 'photos'],
    secret: newIdSecret(),
  });
  if (!r.ok) throw new Error(r.reason);
  conn = r.connection;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('wantedPhotos', () => {
  it('najnowsze najpierw: dzień, potem chwila dodania; najwyżej limit', () => {
    const list = [photo(1, '2026-10-01', 5), photo(2, '2026-11-01', 1), photo(3, '2026-11-01', 9), photo(4, '2026-09-01')];
    expect(wantedPhotos(list).map((p) => p.id)).toEqual(['p3', 'p2', 'p1', 'p4']);
    expect(wantedPhotos(list, 2).map((p) => p.id)).toEqual(['p3', 'p2']);
  });
});

describe('syncPhotos', () => {
  it('wysyła zaszyfrowane kopie, które prowadzący otwiera swoim kluczem', async () => {
    const f = fakePhotos([photo(1, '2026-10-01'), photo(2, '2026-11-20')]);
    expect(await syncPhotos(current(), f.deps)).toBe('ok');
    const ids = onServer();
    expect(ids).toHaveLength(2);
    const opened = await Promise.all(ids.map((id) => server.readPhoto(conn.id, id).then(parsePhoto)));
    expect(opened.map((p) => p?.day).sort()).toEqual(['2026-10-01', '2026-11-20']);
    for (const p of opened) {
      expect(p).toMatchObject({ v: 1, w: 540, h: 720 });
      expect(ids).toContain(p!.id);
    }
    expect(atob(opened.find((p) => p?.day === '2026-11-20')!.jpeg)).toBe('jpeg-p2');
    // Szyfrogram na serwerze nie zdradza zdjęcia.
    expect(server.connections.get(conn.id)!.photos.get(ids[0]!)).toMatch(/^v1\./);
    // Mapa numerów zapisana na telefonie.
    expect(Object.keys(current().photos!).sort()).toEqual(['p1|2026-10-01', 'p2|2026-11-20']);
    expect(Object.values(current().photos!).sort()).toEqual([...ids].sort());
  });

  it('drugi przebieg niczego nie wysyła i nie czyta zdjęć', async () => {
    const f = fakePhotos([photo(1, '2026-10-01'), photo(2, '2026-11-20')]);
    await syncPhotos(current(), f.deps);
    const before = { puts: puts(), reads: f.reads.length };
    expect(await syncPhotos(current(), f.deps)).toBe('ok');
    expect(puts()).toBe(before.puts);
    expect(f.reads).toHaveLength(before.reads);
    expect(onServer()).toHaveLength(2);
  });

  it('zdjęcie usunięte na telefonie znika u prowadzącego', async () => {
    const f = fakePhotos([photo(1, '2026-10-01'), photo(2, '2026-11-20')]);
    await syncPhotos(current(), f.deps);
    const gone = current().photos!['p1|2026-10-01']!;
    f.list.splice(0, 1);
    expect(await syncPhotos(current(), f.deps)).toBe('ok');
    expect(onServer()).toEqual([current().photos!['p2|2026-11-20']]);
    expect(onServer()).not.toContain(gone);
    expect(Object.keys(current().photos!)).toEqual(['p2|2026-11-20']);
  });

  it('poprawiony dzień zdjęcia: nowa kopia z nowym dniem, stara znika', async () => {
    const f = fakePhotos([photo(1, '2026-11-20')]);
    await syncPhotos(current(), f.deps);
    const old = onServer()[0]!;
    f.list[0]!.day = '2026-11-02';
    await syncPhotos(current(), f.deps);
    const now = onServer();
    expect(now).toHaveLength(1);
    expect(now[0]).not.toBe(old);
    expect(parsePhoto(await server.readPhoto(conn.id, now[0]!))?.day).toBe('2026-11-02');
  });

  it('najwyżej osiem wysyłek na raz, od najnowszego; reszta przy następnej synchronizacji', async () => {
    const f = fakePhotos(days(12));
    await syncPhotos(current(), f.deps);
    expect(onServer()).toHaveLength(UPLOADS_PER_RUN);
    expect(f.reads).toEqual(['p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4']);
    await syncPhotos(current(), f.deps);
    expect(onServer()).toHaveLength(12);
    expect(f.reads.slice(8)).toEqual(['p3', 'p2', 'p1', 'p0']);
  });

  it('u prowadzącego tylko ostatnie 60: starsze nie idą, a te, które wypadły z okna, są kasowane', async () => {
    const f = fakePhotos(days(60));
    for (let i = 0; i < 8; i++) await syncPhotos(current(), f.deps);
    expect(onServer()).toHaveLength(60);
    const oldest = current().photos!['p0|2026-01-01']!;
    // Nowe zdjęcie: najstarsze wypada z okna i znika z serwera, zanim pójdzie nowe.
    f.list.push(photo(60, '2026-12-01', 60));
    await syncPhotos(current(), f.deps);
    expect(onServer()).toHaveLength(60);
    expect(onServer()).not.toContain(oldest);
    expect(current().photos!['p60|2026-12-01']).toBeDefined();
    expect(current().photos!['p0|2026-01-01']).toBeUndefined();
  });

  it('kończy wysyłki, gdy synchronizacja trwa za długo', async () => {
    const f = fakePhotos(days(5));
    let t = 0;
    await syncPhotos(current(), { ...f.deps, now: () => (t += 9_000) });
    expect(onServer().length).toBeLessThan(5);
    expect(onServer().length).toBeGreaterThan(0);
  });

  it('bez zgody na serwerze (`no_scope`) — po cichu „ok”, nic nie wysłane', async () => {
    server.connections.get(conn.id)!.scopes = ['training'];
    const f = fakePhotos([photo(1, '2026-10-01'), photo(2, '2026-11-20')]);
    expect(await syncPhotos(current(), f.deps)).toBe('ok');
    expect(onServer()).toEqual([]);
    expect(puts()).toBe(1);
  });

  it('bez sieci — „offline”, po zakończeniu przez prowadzącego — „ended”', async () => {
    const f = fakePhotos([photo(1, '2026-10-01')]);
    server.setOffline(true);
    expect(await syncPhotos(current(), f.deps)).toBe('offline');
    server.setOffline(false);
    server.endByCoach(conn.id);
    expect(await syncPhotos(current(), f.deps)).toBe('ended');
  });

  it('zdjęcia, którego nie da się zmniejszyć, pomija, a resztę wysyła', async () => {
    const f = fakePhotos([photo(1, '2026-10-01'), photo(2, '2026-11-20')]);
    const encode = f.deps.encode!;
    await syncPhotos(current(), { ...f.deps, encode: async (b, max) => ((await b.text()) === 'jpeg-p2' ? null : encode(b, max)) });
    expect(onServer()).toHaveLength(1);
    expect(Object.keys(current().photos!)).toEqual(['p1|2026-10-01']);
  });

  it('nic nie czyta, gdy baza zdjęć się nie otwiera — i niczego nie kasuje', async () => {
    const f = fakePhotos([photo(1, '2026-10-01')]);
    await syncPhotos(current(), f.deps);
    expect(await syncPhotos(current(), { ...f.deps, list: () => Promise.reject(new Error('idb')) })).toBe('ok');
    expect(onServer()).toHaveLength(1);
  });
});

describe('zgoda na zdjęcia', () => {
  it('zabrana zgoda kasuje zdjęcia na serwerze i mapę na telefonie', async () => {
    const f = fakePhotos([photo(1, '2026-10-01')]);
    await syncPhotos(current(), f.deps);
    expect(current().photos).toBeDefined();
    expect(await changeScopes(conn.id, ['training', 'body'], state)).toBe('ok');
    expect(onServer()).toEqual([]);
    expect(current().photos).toBeUndefined();
  });

  it('syncAll wysyła zdjęcia z „Sylwetki” tylko przy zgodzie', async () => {
    await forgetPhotos();
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1080, height: 1440, close: () => undefined }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage: () => undefined, imageSmoothingQuality: 'low' };
        }
        async convertToBlob() {
          return new Blob([new Uint8Array(300).fill(9)], { type: 'image/jpeg' });
        }
      },
    );
    await addPhoto({ day: '2026-11-20', full: new Blob([new Uint8Array(500)]), thumb: new Blob([new Uint8Array(20)]), w: 1080, h: 1440 });
    await syncAll(() => state);
    const ids = onServer();
    expect(ids).toHaveLength(1);
    expect(parsePhoto(await server.readPhoto(conn.id, ids[0]!))).toMatchObject({ day: '2026-11-20', w: 540, h: 720 });

    // Bez zgody synchronizacja zdjęć w ogóle nie pyta serwera.
    await changeScopes(conn.id, ['training'], state);
    const before = server.calls.filter((c) => c.name.startsWith('client_photo')).length;
    await syncAll(() => state);
    expect(server.calls.filter((c) => c.name.startsWith('client_photo')).length).toBe(before);
    await forgetPhotos();
  });
});

describe('encodePhoto', () => {
  it('dłuższy bok do 720 px, a za duży JPEG — jeszcze raz mniejszy i słabszy', async () => {
    const asked: { w: number; h: number; quality: number }[] = [];
    vi.stubGlobal('createImageBitmap', async () => ({ width: 3000, height: 4000, close: () => undefined }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage: () => undefined, imageSmoothingQuality: 'low' };
        }
        async convertToBlob(o: { quality: number }) {
          asked.push({ w: this.width, h: this.height, quality: o.quality });
          // Rozmiar rośnie z jakością: pierwsza próba za duża.
          return new Blob([new Uint8Array(Math.round(o.quality * 1000))]);
        }
      },
    );
    const out = await encodePhoto(new Blob([new Uint8Array(10)]), 1000);
    expect(asked[0]).toEqual({ w: 540, h: PHOTO_SIDE, quality: 0.82 });
    expect(asked.length).toBeGreaterThan(1);
    expect(out).not.toBeNull();
    expect(out!.jpeg.length).toBeLessThanOrEqual(1000);
    expect(out!.jpeg).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(await encodePhoto(new Blob([new Uint8Array(10)]), 10)).toBeNull();
  });

  it('zdjęcie, którego przeglądarka nie odczyta — null', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('bad');
    });
    vi.stubGlobal('Image', class {
      src = '';
      decode() {
        return Promise.reject(new Error('bad'));
      }
    });
    expect(await encodePhoto(new Blob([new Uint8Array(10)]))).toBeNull();
  });
});
