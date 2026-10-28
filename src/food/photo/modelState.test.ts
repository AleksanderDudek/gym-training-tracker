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
  it('without a service worker the model cannot be kept', async () => {
    controlled('none');
    vi.stubGlobal('caches', { match: async () => undefined });
    await checkModel();
    expect(modelState()).toEqual({ kind: 'unsupported' });
  });

  it('the first visit, before the service worker takes over: not there yet', async () => {
    controlled(false);
    vi.stubGlobal('caches', { match: async () => undefined });
    await checkModel();
    expect(modelState()).toEqual({ kind: 'missing', wait: null });
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
