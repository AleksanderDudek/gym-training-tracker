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
  terminate() {}
  reply(data: Reply) {
    this.onmessage?.({ data });
  }
}

vi.stubGlobal('Worker', FakeWorker);
const { recognize, release, warmUp } = await import('./recognize');

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
