// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { useUrlState } from './useUrlState';

interface S {
  q: string;
  p: string | null;
}

const read = (params: URLSearchParams): S => ({ q: params.get('q') ?? '', p: params.get('p') });
const write = (s: S): URLSearchParams => {
  const params = new URLSearchParams();
  if (s.q) params.set('q', s.q);
  if (s.p) params.set('p', s.p);
  return params;
};

const render = () => renderHook(() => useUrlState(read, write));

beforeEach(() => {
  window.history.replaceState(null, '', '#/produkty?q=skyr');
});

test('stan strony czyta się z zapytania w hashu', () => {
  const { result } = render();
  expect(result.current[0]).toEqual({ q: 'skyr', p: null });
});

test('zwykła zmiana podmienia wpis historii i zostaje w hashu, za ścieżką strony', () => {
  const { result } = render();
  const length = window.history.length;
  act(() => result.current[1]({ q: 'twaróg' }));
  expect(window.location.hash).toBe('#/produkty?q=twar%C3%B3g');
  expect(window.location.pathname).toBe('/');
  expect(window.location.search).toBe('');
  expect(window.history.length).toBe(length);
});

test('bez parametrów adres to sama ścieżka strony, bez pustego „?”', () => {
  const { result } = render();
  act(() => result.current[1]({ q: '' }));
  expect(window.location.hash).toBe('#/produkty');
});

test('otwarcie produktu dodaje wpis, a zamknięcie wraca nim — Wstecz zamyka szczegóły', async () => {
  const { result } = render();
  const length = window.history.length;
  act(() => result.current[1]({ p: '590' }, { push: true }));
  expect(window.location.hash).toBe('#/produkty?q=skyr&p=590');
  expect(window.history.length).toBe(length + 1);
  act(() => result.current[2]({ p: null }));
  await waitFor(() => expect(result.current[0]).toEqual({ q: 'skyr', p: null }));
  expect(window.location.hash).toBe('#/produkty?q=skyr');
});

test('szczegóły otwarte prosto z linku zamykają się na miejscu, bez wychodzenia ze strony', () => {
  window.history.replaceState(null, '', '#/produkty?q=skyr&p=590');
  const { result } = render();
  act(() => result.current[2]({ p: null }));
  expect(result.current[0]).toEqual({ q: 'skyr', p: null });
  expect(window.location.hash).toBe('#/produkty?q=skyr');
});

test('Wstecz i Dalej na tej samej stronie czytają stan z adresu na nowo', () => {
  const { result } = render();
  window.history.replaceState(null, '', '#/produkty?q=jajka');
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current[0]).toEqual({ q: 'jajka', p: null });
});

test('po przejściu na inną stronę niczego już nie zapisuje ani nie czyta', () => {
  const { result } = render();
  window.history.replaceState(null, '', '#/sesja');
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current[0]).toEqual({ q: 'skyr', p: null });
  act(() => result.current[1]({ q: 'kefir' }));
  expect(window.location.hash).toBe('#/sesja');
});
