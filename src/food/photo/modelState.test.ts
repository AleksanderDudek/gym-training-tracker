// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkModel, modelState, resetModelState, setModelState } from './modelState';

const controlled = (yes: boolean | 'none') =>
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => (yes === 'none' ? undefined : { controller: yes ? {} : null }) });

afterEach(() => {
  resetModelState();
  vi.unstubAllGlobals();
});

describe('checkModel', () => {
  it('without the Cache API the model cannot be kept', async () => {
    vi.stubGlobal('caches', undefined);
    await checkModel();
    expect(modelState()).toEqual({ kind: 'unsupported' });
  });

  it('before the service worker takes over (the first start) it still looks in the copy the photo worker fills', async () => {
    controlled(false);
    vi.stubGlobal('caches', { match: async () => new Response('') });
    await checkModel();
    expect(modelState()).toEqual({ kind: 'ready' });
  });

  it('looks for the model file in the service worker’s copy', async () => {
    controlled(true);
    const match = vi.fn(async (url: string) => (url.endsWith('/vision.onnx') ? new Response('') : undefined));
    vi.stubGlobal('caches', { match });
    await checkModel();
    expect(modelState()).toEqual({ kind: 'ready' });
    expect(match.mock.calls[0]![0]).toMatch(/models\/siglip2-[\w-]+\/vision\.onnx$/);
  });

  it('not in the copy: not there yet; a download already reported wins', async () => {
    controlled(true);
    vi.stubGlobal('caches', { match: async () => undefined });
    await checkModel();
    expect(modelState()).toEqual({ kind: 'missing', wait: null });
    setModelState({ kind: 'downloading', share: 0.1 });
    await checkModel();
    expect(modelState()).toEqual({ kind: 'downloading', share: 0.1 });
  });
});
