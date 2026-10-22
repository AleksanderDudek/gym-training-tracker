import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GeocodeUnavailable, NOMINATIM_URL, geocode } from './geocode';

// The module keeps the time of its last request across calls; every test starts a minute later on
// this clock, so no test waits for the one before.
let clock = 1_000_000;
beforeEach(() => {
  clock += 60_000;
});
const now = () => clock;

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });

function fakeFetch(respond: (init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond(init);
  }) as typeof fetch;
  return { impl, calls };
}

/** A request that never answers, until its signal fires (at once if it already has, as `fetch` does). */
const hanging = (init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(signal.reason);
    signal?.addEventListener('abort', () => reject(signal.reason));
  });

const options = (fetchImpl: typeof fetch, sleep = vi.fn(async (_ms: number) => {})) => ({ fetchImpl, now, sleep });

const NOMINATIM = [
  {
    place_id: 1,
    lat: '52.2317641',
    lon: '21.0057996',
    display_name:
      'Pałac Kultury i Nauki, 1, plac Defilad, Śródmieście Północne, Śródmieście, Warszawa, województwo mazowieckie, 00-901, Polska',
  },
  // The same place again (the building around the node): within the rounding, dropped.
  { place_id: 2, lat: '52.23179', lon: '21.00582', display_name: 'Pałac Kultury i Nauki, plac Defilad, Warszawa, Polska' },
  { place_id: 3, lat: 52.2297, lon: 21.0122, display_name: 'Warszawa Centralna,  Aleje Jerozolimskie ,, Warszawa, Polska' },
  { place_id: 4, lat: 'abc', lon: '21', display_name: 'Not a number' },
  { place_id: 5, lat: '52.1', lon: '21.1' },
  { place_id: 6, lat: '', lon: '21.1', display_name: 'Empty latitude' },
  { place_id: 7, lat: '95', lon: '21.1', display_name: 'Off the globe' },
  { place_id: 8, lat: '52.3', lon: '21.3', display_name: ' , ' },
  null,
  'garbage',
];

describe('request', () => {
  test('a GET to Nominatim with the trimmed query, five results, in the app’s language', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    await geocode('  plac   Defilad 1, Warszawa  ', options(impl));
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(`${url.origin}${url.pathname}`).toBe(NOMINATIM_URL);
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('q')).toBe('plac Defilad 1, Warszawa');
    expect(url.searchParams.get('accept-language')).toBe('pl');
  });

  test('no custom headers and no method: a simple CORS request', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    await geocode('Nowy Świat 1', options(impl));
    const init = calls[0]!.init!;
    expect(init.headers).toBeUndefined();
    expect(init.method).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test('the language can be chosen', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    await geocode('Krakowskie Przedmieście', { ...options(impl), lang: 'en' });
    expect(new URL(calls[0]!.url).searchParams.get('accept-language')).toBe('en');
  });

  test('an empty or too short query asks nothing', async () => {
    const { impl, calls } = fakeFetch(() => json(NOMINATIM));
    const sleep = vi.fn(async () => {});
    for (const query of ['', '   ', 'ab', '  ab  ']) {
      expect(await geocode(query, options(impl, sleep))).toEqual([]);
    }
    expect(calls).toHaveLength(0);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('answer', () => {
  test('valid places with short labels, one per position', async () => {
    const { impl } = fakeFetch(() => json(NOMINATIM));
    expect(await geocode('Pałac Kultury', options(impl))).toEqual([
      { label: 'Pałac Kultury i Nauki, 1, plac Defilad', lat: 52.2317641, lon: 21.0057996 },
      { label: 'Warszawa Centralna, Aleje Jerozolimskie, Warszawa', lat: 52.2297, lon: 21.0122 },
    ]);
  });

  test('a label with fewer than three parts stays whole', async () => {
    const { impl } = fakeFetch(() => json([{ lat: '50.06', lon: '19.94', display_name: 'Kraków, Polska' }]));
    expect(await geocode('Kraków', options(impl))).toEqual([{ label: 'Kraków, Polska', lat: 50.06, lon: 19.94 }]);
  });

  test('nothing found is an empty list, not an error', async () => {
    const { impl } = fakeFetch(() => json([]));
    expect(await geocode('Qwertyuiop 999', options(impl))).toEqual([]);
  });
});

describe('cache', () => {
  test('the same search again is answered from memory', async () => {
    const { impl, calls } = fakeFetch(() => json(NOMINATIM));
    const first = await geocode('Marszałkowska 10', options(impl));
    const again = await geocode('  marszałkowska   10 ', options(impl));
    expect(again).toEqual(first);
    expect(calls).toHaveLength(1);
  });

  test('another language is another search', async () => {
    const { impl, calls } = fakeFetch(() => json(NOMINATIM));
    await geocode('Złota 44', options(impl));
    await geocode('Złota 44', { ...options(impl), lang: 'en' });
    expect(calls).toHaveLength(2);
  });

  test('a failed search is not remembered', async () => {
    let status = 503;
    const { impl, calls } = fakeFetch(() => json([{ lat: '52.2', lon: '21.0', display_name: 'Wilcza' }], { status }));
    await expect(geocode('Wilcza 1', options(impl))).rejects.toBeInstanceOf(GeocodeUnavailable);
    status = 200;
    expect(await geocode('Wilcza 1', options(impl))).toEqual([{ label: 'Wilcza', lat: 52.2, lon: 21.0 }]);
    expect(calls).toHaveLength(2);
  });
});

describe('errors', () => {
  const unavailable = 'Wyszukiwarka adresów (OpenStreetMap) nie odpowiada.';

  test.each([
    ['an error status', () => new Response('<html>busy</html>', { status: 503, headers: { 'content-type': 'text/html' } })],
    ['a refusal as JSON', () => json({ error: 'Too many requests' }, { status: 429 })],
    ['not JSON', () => new Response('<html>busy</html>', { status: 200, headers: { 'content-type': 'text/html' } })],
    ['JSON that is not a list', () => json({ error: 'Unable to geocode' })],
  ])('%s: GeocodeUnavailable', async (name, respond) => {
    const { impl } = fakeFetch(respond);
    const result = geocode(`Hoża ${name}`, options(impl));
    await expect(result).rejects.toBeInstanceOf(GeocodeUnavailable);
    await expect(result).rejects.toThrow(unavailable);
  });

  test('a network error: GeocodeUnavailable', async () => {
    const { impl } = fakeFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(geocode('Piękna 20', options(impl))).rejects.toMatchObject({ name: 'GeocodeUnavailable', message: unavailable });
  });

  describe('timeout', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test('a server that never answers: GeocodeUnavailable after 15 s', async () => {
      vi.useFakeTimers();
      const { impl } = fakeFetch(hanging);
      const result = geocode('Mokotowska 1', options(impl));
      const check = expect(result).rejects.toBeInstanceOf(GeocodeUnavailable);
      await vi.advanceTimersByTimeAsync(15_000);
      await check;
    });
  });
});

describe('abort', () => {
  test('the caller’s abort during the request comes back as it is', async () => {
    const { impl, calls } = fakeFetch(hanging);
    const controller = new AbortController();
    const result = geocode('Chmielna 5', { ...options(impl), signal: controller.signal });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await expect(result).rejects.not.toBeInstanceOf(GeocodeUnavailable);
  });

  test('an already aborted signal asks nothing', async () => {
    const { impl, calls } = fakeFetch(() => json(NOMINATIM));
    const controller = new AbortController();
    controller.abort();
    await expect(geocode('Bracka 3', { ...options(impl), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });

  test('an abort while waiting for the gap ends at once and asks nothing', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    await geocode('Szpitalna 1', options(impl));
    const controller = new AbortController();
    const never = vi.fn(() => new Promise<void>(() => {}));
    const result = geocode('Szpitalna 2', { ...options(impl, never), signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(never).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(1);
  });
});

describe('one request a second', () => {
  test('a search within a second of the last one waits out the rest', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    const sleep = vi.fn(async (_ms: number) => {});
    await geocode('Świętokrzyska 1', options(impl, sleep));
    expect(sleep).not.toHaveBeenCalled();

    clock += 300;
    await geocode('Świętokrzyska 2', options(impl, sleep));
    expect(sleep.mock.calls).toEqual([[700]]);

    clock += 5000;
    await geocode('Świętokrzyska 3', options(impl, sleep));
    expect(sleep).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(3);
  });

  test('searches started together go out a second apart', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    const sleep = vi.fn(async (_ms: number) => {});
    await Promise.all(['Emilii Plater 1', 'Emilii Plater 2', 'Emilii Plater 3'].map((q) => geocode(q, options(impl, sleep))));
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
    expect(calls).toHaveLength(3);
  });

  test('a cached answer and a short query do not count', async () => {
    const { impl } = fakeFetch(() => json([]));
    const sleep = vi.fn(async (_ms: number) => {});
    await geocode('Bagno 2', options(impl, sleep));
    clock += 1000;
    await geocode('Bagno 2', options(impl, sleep));
    await geocode('ab', options(impl, sleep));
    await geocode('Bagno 3', options(impl, sleep));
    expect(sleep).not.toHaveBeenCalled();
  });
});
