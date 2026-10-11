// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { registerSW } from 'virtual:pwa-register';

/**
 * Service worker od strony aplikacji — bez service workera: `registerSW` z wtyczki zastępuje
 * atrapa, a `navigator.serviceWorker` (jsdom go nie ma) — mała imitacja. Moduł trzyma stan na
 * poziomie modułu (rejestracja raz na życie strony), więc każdy test wczytuje go od nowa.
 */

type Options = Parameters<typeof registerSW>[0] & {};

const pwa = () => import('./pwa');

/** Atrapa `registerSW`: zapamiętuje opcje i oddaje funkcję „Odśwież”. */
function fakeRegister() {
  const update = vi.fn(async (_reload?: boolean) => undefined);
  const calls: Options[] = [];
  const register = vi.fn((options?: Options) => {
    calls.push(options ?? {});
    return update;
  }) as unknown as typeof registerSW;
  return { register, update, calls };
}

/** Wersja service workera: stan i zdarzenie `statechange` jak w przeglądarce. */
class FakeWorker extends EventTarget {
  postMessage = vi.fn();
  constructor(public state: ServiceWorkerState) {
    super();
  }
  become(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

/** `navigator.serviceWorker` z jedną rejestracją (albo bez niej). */
function installServiceWorker(registration: Partial<ServiceWorkerRegistration> | undefined) {
  const container = Object.assign(new EventTarget(), {
    getRegistration: vi.fn(async () => registration),
  });
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
  return container;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('rejestracja i nowa wersja', () => {
  it('rejestruje raz, po wczytaniu strony', async () => {
    const { startPwa } = await pwa();
    const { register, calls } = fakeRegister();
    startPwa(register);
    startPwa(register);
    expect(register).toHaveBeenCalledTimes(1);
    expect(calls[0]?.immediate).toBe(false);
  });

  it('„nowa wersja czeka” trafia do subskrybentów, a „Odśwież” wpuszcza ją z przeładowaniem', async () => {
    const { startPwa, subscribe, needRefresh, applyUpdate } = await pwa();
    const { register, update, calls } = fakeRegister();
    const listener = vi.fn();
    const off = subscribe(listener);
    startPwa(register);
    expect(needRefresh()).toBe(false);

    calls[0]?.onNeedRefresh?.();
    expect(needRefresh()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    off();
    calls[0]?.onNeedRefresh?.();
    expect(listener).toHaveBeenCalledTimes(1);

    await applyUpdate();
    expect(update).toHaveBeenCalledWith(true);
  });

  it('„Odśwież” przed rejestracją niczego nie psuje', async () => {
    const { applyUpdate, needRefresh } = await pwa();
    await expect(applyUpdate()).resolves.toBeUndefined();
    expect(needRefresh()).toBe(false);
  });

  it('pyta o nową wersję co godzinę i po powrocie — tylko z siecią', async () => {
    vi.useFakeTimers();
    const { startPwa } = await pwa();
    const { register, calls } = fakeRegister();
    startPwa(register);
    const update = vi.fn(async () => undefined);
    calls[0]?.onRegisteredSW?.('sw.js', { update } as unknown as ServiceWorkerRegistration);

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(2);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.advanceTimersByTime(60 * 60 * 1000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('nieudane pytanie o nową wersję nie wychodzi poza moduł', async () => {
    vi.useFakeTimers();
    const { startPwa } = await pwa();
    const { register, calls } = fakeRegister();
    startPwa(register);
    const update = vi.fn(() => Promise.reject(new Error('offline')));
    calls[0]?.onRegisteredSW?.('sw.js', { update } as unknown as ServiceWorkerRegistration);
    vi.advanceTimersByTime(60 * 60 * 1000);
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('ekran awarii', () => {
  it('bez service workera „Odśwież” to zwykłe przeładowanie', async () => {
    const { reloadFresh } = await pwa();
    const reload = vi.fn();
    await reloadFresh(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('bez czekającej wersji — zwykłe przeładowanie', async () => {
    installServiceWorker({ waiting: null, installing: null });
    const { reloadFresh } = await pwa();
    const reload = vi.fn();
    await reloadFresh(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('czekająca wersja dostaje SKIP_WAITING, a strona przeładowuje się, gdy ta przejmie kontrolę', async () => {
    vi.useFakeTimers();
    const waiting = new FakeWorker('installed');
    const container = installServiceWorker({ waiting: waiting as unknown as ServiceWorker, installing: null });
    const { reloadFresh } = await pwa();
    const reload = vi.fn();
    await reloadFresh(reload);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();

    container.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
    // Zapasowy zegar nie przeładowuje drugi raz.
    vi.advanceTimersByTime(10_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('gdy nowa wersja nie przejmie kontroli, strona przeładowuje się po chwili i tak', async () => {
    vi.useFakeTimers();
    const waiting = new FakeWorker('installed');
    installServiceWorker({ waiting: waiting as unknown as ServiceWorker, installing: null });
    const { reloadFresh } = await pwa();
    const reload = vi.fn();
    await reloadFresh(reload, 4000);
    vi.advanceTimersByTime(3999);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('wersja w trakcie instalacji dostaje SKIP_WAITING, kiedy skończy', async () => {
    vi.useFakeTimers();
    const installing = new FakeWorker('installing');
    installServiceWorker({ waiting: null, installing: installing as unknown as ServiceWorker });
    const { reloadFresh } = await pwa();
    const reload = vi.fn();
    const done = reloadFresh(reload);
    await Promise.resolve();
    await Promise.resolve();
    expect(installing.postMessage).not.toHaveBeenCalled();
    installing.become('installed');
    await done;
    expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('wersja, która odpadła przy instalacji — zwykłe przeładowanie', async () => {
    const installing = new FakeWorker('installing');
    installServiceWorker({ waiting: null, installing: installing as unknown as ServiceWorker });
    const { reloadFresh } = await pwa();
    const reload = vi.fn();
    const done = reloadFresh(reload);
    await Promise.resolve();
    installing.become('redundant');
    await done;
    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ekran awarii pyta o poprawkę — tylko z siecią', async () => {
    const update = vi.fn(async () => undefined);
    const container = installServiceWorker({ update } as unknown as ServiceWorkerRegistration);
    const { lookForFix } = await pwa();
    lookForFix();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    lookForFix();
    expect(container.getRegistration).toHaveBeenCalledTimes(1);
  });
});
