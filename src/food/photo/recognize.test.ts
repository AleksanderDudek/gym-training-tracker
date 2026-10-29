// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { modelState, resetModelState, setModelState } from './modelState';
import type { Reply } from './recognize.worker';

/** A stand-in worker: records what the page sends and lets the test answer. */
class FakeWorker {
  static last: FakeWorker;
  sent: unknown[] = [];
  onmessage: ((e: { data: Reply }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(m: unknown) {
    this.sent.push(m);
  }
  terminated = false;
  terminate() {
    this.terminated = true;
  }
  reply(data: Reply) {
    this.onmessage?.({ data });
  }
}

vi.stubGlobal('Worker', FakeWorker);
const { failureOf, preload, prepare, recognize, release, restartDownload, saveModel } = await import('./recognize');

const lastId = () => (FakeWorker.last.sent.at(-1) as { id: number }).id;

afterEach(() => {
  release();
  resetModelState();
});

describe('recognize', () => {
  it('maps the worker’s ranking to dishes and stops reporting progress once the photo is done', async () => {
    const progress = vi.fn();
    const result = recognize(new Blob(), progress);
    const w = FakeWorker.last;
    w.reply({ type: 'progress', step: 'read', share: null });
    w.reply({ type: 'result', id: 1, top: [{ id: 'pierogiRuskie', score: 0.7, cos: 0.17 }, { id: 'noSuchDish', score: 0.1, cos: 0.12 }] });
    const [first, ...rest] = await result;
    expect(first).toMatchObject({ score: 0.7, cos: 0.17 });
    expect(first?.dish.id).toBe('pierogiRuskie');
    expect(rest).toEqual([]);
    expect(progress).toHaveBeenCalledTimes(1);
    // A download after the photo must not move the finished screen back to „Pobieram…”.
    void saveModel().catch(() => undefined);
    w.reply({ type: 'progress', step: 'load', share: 0.5, source: 'network' });
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('a worker error fails the photo it belongs to', async () => {
    const result = recognize(new Blob());
    FakeWorker.last.reply({ type: 'error', id: lastId(), message: 'HTTP 404' });
    await expect(result).rejects.toThrow('HTTP 404');
  });

  it('a photo that downloads the model itself shows the download, then the copy decides', async () => {
    const inCopy = vi.fn(async () => new Response(''));
    vi.stubGlobal('caches', { match: inCopy });
    const result = recognize(new Blob());
    const w = FakeWorker.last;
    const id = lastId();
    w.reply({ type: 'progress', step: 'load', share: 0.25, source: 'network' });
    expect(modelState()).toEqual({ kind: 'downloading', share: 0.25 });
    w.reply({ type: 'result', id, top: [] });
    await result;
    await vi.waitFor(() => expect(modelState()).toEqual({ kind: 'ready' }));
    // The page looked itself: nothing more was asked of the worker.
    expect(w.sent.at(-1)).toMatchObject({ type: 'read' });
    vi.unstubAllGlobals();
    vi.stubGlobal('Worker', FakeWorker);
  });

  it('the model failing after its download (memory) is not a failed download', async () => {
    vi.stubGlobal('caches', { match: async () => new Response('') });
    const result = recognize(new Blob());
    FakeWorker.last.reply({ type: 'progress', step: 'load', share: 1, source: 'network' });
    FakeWorker.last.reply({ type: 'error', id: lastId(), message: 'could not allocate memory' });
    await expect(result).rejects.toThrow('memory');
    await vi.waitFor(() => expect(modelState()).toEqual({ kind: 'ready' }));
    vi.unstubAllGlobals();
    vi.stubGlobal('Worker', FakeWorker);
  });

  it('closing the sheet while the photo downloads the model: „not yet”, not „failed”', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('caches', { match: async () => undefined });
    const result = recognize(new Blob()).catch((e: Error) => e.message);
    FakeWorker.last.reply({ type: 'progress', step: 'load', share: 0.5, source: 'network' });
    release();
    await expect(result).resolves.toBe('released');
    await vi.advanceTimersByTimeAsync(6000);
    expect(modelState()).toEqual({ kind: 'missing', wait: null });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.stubGlobal('Worker', FakeWorker);
  });

  it('reading the model from the phone is not a download', async () => {
    setModelState({ kind: 'ready' });
    void recognize(new Blob()).catch(() => undefined);
    FakeWorker.last.reply({ type: 'progress', step: 'load', share: 0.5, source: 'copy' });
    expect(modelState()).toEqual({ kind: 'ready' });
  });
});

describe('saveModel', () => {
  it('ends the worker once the files are saved, and the model counts as on the phone', async () => {
    setModelState({ kind: 'missing', wait: null });
    const saving = saveModel();
    const w = FakeWorker.last;
    expect(modelState()).toEqual({ kind: 'downloading', share: null });
    expect(w.sent.at(-1)).toMatchObject({ type: 'save' });
    w.reply({ type: 'saved', id: lastId(), saved: true });
    await expect(saving).resolves.toBe(true);
    expect(w.terminated).toBe(true);
    expect(modelState()).toEqual({ kind: 'ready' });
  });

  it('a look without fetching that finds nothing says „not yet”', async () => {
    const looking = saveModel(false);
    FakeWorker.last.reply({ type: 'saved', id: lastId(), saved: false });
    await expect(looking).resolves.toBe(false);
    expect(modelState()).toEqual({ kind: 'missing', wait: null });
  });

  it('a failed download shows as failed, offline when the network is gone', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const saving = saveModel();
    FakeWorker.last.reply({ type: 'error', id: lastId(), message: 'Failed to fetch' });
    await expect(saving).rejects.toThrow('Failed to fetch');
    expect(modelState()).toEqual({ kind: 'failed', reason: 'offline' });
    online.mockRestore();
  });

  it('leaves the worker to a photo screen that took it meanwhile', async () => {
    const saving = saveModel();
    const w = FakeWorker.last;
    const id = lastId();
    void recognize(new Blob()).catch(() => undefined);
    w.reply({ type: 'saved', id, saved: true });
    await saving;
    expect(w.terminated).toBe(false);
  });

  it('a save that ends first leaves the worker to another request still waiting on it', async () => {
    const first = saveModel();
    const w = FakeWorker.last;
    const firstId = lastId();
    const look = saveModel(false);
    const lookId = lastId();
    w.reply({ type: 'saved', id: firstId, saved: true });
    await first;
    expect(w.terminated).toBe(false);
    w.reply({ type: 'saved', id: lookId, saved: true });
    await look;
    expect(w.terminated).toBe(true);
  });

  it('closing the photo screen does not throw away a download in progress', async () => {
    const saving = saveModel();
    const w = FakeWorker.last;
    const id = lastId();
    release();
    expect(w.terminated).toBe(false);
    w.reply({ type: 'saved', id, saved: true });
    await expect(saving).resolves.toBe(true);
    expect(w.terminated).toBe(true);
  });

  it('rejects when the photo screen releases a worker that holds the model', async () => {
    const saving = saveModel();
    void recognize(new Blob()).catch(() => undefined);
    release();
    await expect(saving).rejects.toThrow('released');
  });
});

describe('prepare', () => {
  it('starts the download when the model is not on the phone, and nothing when it is', () => {
    setModelState({ kind: 'ready' });
    const before = FakeWorker.last;
    prepare();
    expect(FakeWorker.last).toBe(before);
    setModelState({ kind: 'missing', wait: 'saver' });
    prepare();
    expect(FakeWorker.last.sent.at(-1)).toMatchObject({ type: 'save', fetchMissing: true });
    // The camera is open: nothing may load the model now.
    expect(FakeWorker.last.sent.some((m) => (m as { type: string }).type === 'read')).toBe(false);
  });
});

describe('failureOf', () => {
  it('names memory, offline without the model, and the rest', () => {
    expect(failureOf(new RangeError('WebAssembly.Memory(): could not allocate memory'))).toBe('memory');
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(failureOf(new Error('Failed to fetch'))).toBe('offline');
    setModelState({ kind: 'ready' });
    expect(failureOf(new Error('Failed to fetch'))).toBe('error');
    online.mockRestore();
  });
});

describe('restartDownload', () => {
  it('ends a stalled download and starts again; the ended one changes nothing any more', async () => {
    setModelState({ kind: 'missing', wait: null });
    const stalled = saveModel().catch((e: Error) => e.message);
    const old = FakeWorker.last;
    const again = restartDownload();
    expect(old.terminated).toBe(true);
    await expect(stalled).resolves.toBe('released');
    expect(modelState()).toEqual({ kind: 'downloading', share: null });
    expect(FakeWorker.last).not.toBe(old);
    FakeWorker.last.reply({ type: 'saved', id: lastId(), saved: true });
    await expect(again).resolves.toBe(true);
    expect(modelState()).toEqual({ kind: 'ready' });
  });
});

describe('preload', () => {
  it('a load that fails (the copy gone, the network too) does not leave the card on "downloading"', async () => {
    vi.stubGlobal('caches', { match: async () => undefined });
    preload();
    const w = FakeWorker.last;
    expect(w.sent.at(-1)).toMatchObject({ type: 'warm' });
    w.reply({ type: 'progress', step: 'load', share: 0.2, source: 'network' });
    expect(modelState()).toEqual({ kind: 'downloading', share: 0.2 });
    w.reply({ type: 'error', id: lastId(), message: 'Failed to fetch' });
    await vi.waitFor(() => expect(modelState()).toMatchObject({ kind: 'failed' }), { timeout: 8000 });
    vi.unstubAllGlobals();
    vi.stubGlobal('Worker', FakeWorker);
    // settleModel looks in the copy for up to 5 s before it gives up.
  }, 10_000);
});

