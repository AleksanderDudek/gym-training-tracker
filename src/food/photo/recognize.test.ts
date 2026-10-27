// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
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
const { modelSaved, recognize, release, saveModel, warmUp } = await import('./recognize');

afterEach(() => release());

describe('recognize', () => {
  it('maps the worker’s ranking to dishes and stops reporting progress once the photo is done', async () => {
    const progress = vi.fn();
    const result = recognize(new Blob(), progress);
    const w = FakeWorker.last;
    w.reply({ type: 'progress', step: 'read', share: null });
    w.reply({ type: 'result', id: 1, top: [{ id: 'pierogiRuskie', score: 0.7 }, { id: 'noSuchDish', score: 0.1 }] });
    const [first, ...rest] = await result;
    expect(first?.dish.id).toBe('pierogiRuskie');
    expect(rest).toEqual([]);
    expect(progress).toHaveBeenCalledTimes(1);
    // A warm-up for the next photo must not move the finished screen back to „Pobieram…”.
    warmUp();
    w.reply({ type: 'progress', step: 'load', share: 0.5 });
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('a worker error fails the photo it belongs to', async () => {
    const result = recognize(new Blob());
    const id = (FakeWorker.last.sent.at(-1) as { id: number }).id;
    FakeWorker.last.reply({ type: 'error', id, message: 'HTTP 404' });
    await expect(result).rejects.toThrow('HTTP 404');
  });
});

describe('saveModel', () => {
  const lastId = () => (FakeWorker.last.sent.at(-1) as { id: number }).id;

  it('ends the worker once the files are saved, and remembers that they are', async () => {
    expect(modelSaved()).toBe(false);
    const saving = saveModel();
    const w = FakeWorker.last;
    expect(w.sent.at(-1)).toMatchObject({ type: 'save' });
    w.reply({ type: 'saved', id: lastId(), saved: true });
    await expect(saving).resolves.toBe(true);
    expect(w.terminated).toBe(true);
    expect(modelSaved()).toBe(true);
  });

  it('leaves the worker to a photo screen that took it meanwhile', async () => {
    const saving = saveModel();
    const w = FakeWorker.last;
    const id = lastId();
    warmUp();
    w.reply({ type: 'saved', id, saved: true });
    await saving;
    expect(w.terminated).toBe(false);
  });

  it('rejects when the photo screen releases the worker first', async () => {
    const saving = saveModel();
    release();
    await expect(saving).rejects.toThrow('released');
  });
});
