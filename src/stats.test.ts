// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ API_URL: 'https://api.test', apiConfigured: () => true }));

import { consent, daily, flush, resetStatsForTests, setConsent, statsAvailable, statsScreen, track, weekOf } from './stats';
import { STATS_EVENTS } from './statsCatalog';
import { freshState } from './engine/plan';

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
const sent = (): [string, string][] =>
  fetchMock.mock.calls.flatMap((c) => (JSON.parse((c as unknown as [string, RequestInit])[1].body as string) as { e: [string, string][] }).e);

beforeEach(() => {
  localStorage.clear();
  resetStatsForTests();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: undefined, configurable: true });
});

describe('zgoda', () => {
  it('bez zgody nic nie wychodzi', () => {
    expect(consent()).toBeNull();
    track('open', 'web');
    flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('po zgodzie wychodzi sama lista par, jako text/plain, bez ciasteczek', () => {
    setConsent('on');
    track('screen', 'diet-labs');
    track('workout_finish', 'guided');
    flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/stats');
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain');
    expect(Object.keys(JSON.parse(init.body as string))).toEqual(['e']);
    expect(sent()).toEqual([
      ['screen', 'diet-labs'],
      ['workout_finish', 'guided'],
    ]);
  });

  it('Global Privacy Control wyłącza wszystko, także pytanie', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    setConsent('on');
    expect(statsAvailable()).toBe(false);
    track('open', 'web');
    flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wyłączenie czyści kolejkę i listę dni', () => {
    setConsent('on');
    daily(freshState(), new Date('2026-11-05T10:00:00'));
    expect(localStorage.getItem('gt:stats-days')).not.toBeNull();
    setConsent('off');
    flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('gt:stats-days')).toBeNull();
  });
});

describe('raz dziennie', () => {
  it('liczy otwarcie raz na dzień, a w nowym tygodniu przedział dni z poprzedniego', () => {
    setConsent('on');
    const s = freshState();
    for (const d of ['2026-11-02', '2026-11-03', '2026-11-05']) {
      daily(s, new Date(`${d}T10:00:00`));
      daily(s, new Date(`${d}T18:00:00`));
    }
    flush();
    expect(sent().filter(([e]) => e === 'open')).toHaveLength(3);
    expect(sent().some(([e]) => e === 'week')).toBe(false);
    fetchMock.mockClear();
    daily(s, new Date('2026-11-10T09:00:00'));
    flush();
    expect(sent()).toContainEqual(['week', '3-4']);
  });

  it('funkcje w użyciu: tak/nie, bez szczegółów', () => {
    setConsent('on');
    const s = freshState();
    s.plan = { id: 'x' } as never;
    daily(s, new Date('2026-11-05T10:00:00'));
    flush();
    expect(sent()).toContainEqual(['uses', 'plan']);
    expect(JSON.stringify(sent())).not.toContain('"x"');
  });

  it('tydzień od poniedziałku', () => {
    expect(weekOf('2026-11-05')).toBe('2026-11-02');
    expect(weekOf('2026-11-09')).toBe('2026-11-09');
    expect(weekOf('2026-11-08')).toBe('2026-11-02');
  });
});

describe('ekrany', () => {
  it('rodzaj ekranu bez identyfikatorów', () => {
    expect(statsScreen({ kind: 'exercise', id: 'kat-0025' })).toBe('exercise-catalog');
    expect(statsScreen({ kind: 'exercise', id: 'swing2' })).toBe('exercise-library');
    expect(statsScreen({ kind: 'food', section: 'nearby' })).toBe('food-nearby');
    expect(statsScreen({ kind: 'restaurants', chain: 'kfc' })).toBe('restaurants');
    expect(statsScreen({ kind: 'linkConnection', id: 'abc' })).toBe('linkConnection');
  });

  it('każda wartość z katalogu to krótki identyfikator, nie tekst', () => {
    for (const values of Object.values(STATS_EVENTS)) for (const v of values) expect(v).toMatch(/^[a-zA-Z0-9-]{1,24}$/);
  });
});
