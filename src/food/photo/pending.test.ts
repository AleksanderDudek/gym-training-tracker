// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRun, clearRunOnLeave, interrupted, markCamera, markReading, pendingPhoto } from './pending';

/** The Cache API, as much of it as `pending.ts` uses (jsdom has none). */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    stores,
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const s = stores.get(name)!;
      return { put: async (k: string, r: Response) => void s.set(k, r), match: async (k: string) => s.get(k)?.clone() };
    },
    delete: async (name: string) => stores.delete(name),
  };
}

let fake: ReturnType<typeof fakeCaches>;

beforeEach(() => {
  localStorage.clear();
  fake = fakeCaches();
  vi.stubGlobal('caches', fake);
});

afterEach(() => vi.unstubAllGlobals());

describe('the marker a crash leaves behind', () => {
  it('nothing left: nothing to tell', () => {
    expect(interrupted()).toBeNull();
  });

  it('the camera was open: says so, with the tries carried over', () => {
    markCamera(1);
    expect(interrupted()).toEqual({ stage: 'camera', tries: 1 });
  });

  it('the photo was in the model: keeps it and counts the try', async () => {
    const photo = new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' });
    await markReading(photo, 1);
    expect(interrupted()).toEqual({ stage: 'reading', tries: 2 });
    const back = await pendingPhoto();
    expect(back?.size).toBe(2);
  });

  it('half an hour on, it is no news — and goes', () => {
    markCamera();
    expect(interrupted(Date.now() + 31 * 60 * 1000)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('a normal ending clears the marker and the kept photo', async () => {
    await markReading(new Blob([new Uint8Array([1])]));
    clearRun();
    expect(interrupted()).toBeNull();
    await vi.waitFor(() => expect(fake.stores.size).toBe(0));
  });

  it('a reload by hand is not a crash', () => {
    clearRunOnLeave();
    markCamera();
    dispatchEvent(new Event('pagehide'));
    expect(interrupted()).toBeNull();
  });

  it('a broken marker is ignored', () => {
    localStorage.setItem('gt-photo-run', '{"stage":"elsewhere"}');
    expect(interrupted()).toBeNull();
  });
});
