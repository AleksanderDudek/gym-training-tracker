// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Router w przeglądarce: zdarzenia `hashchange`, pamięć sekcji i jej kopia w `sessionStorage`.
 * Moduł trasy trzyma stan na poziomie modułu (stos tras, przewinięcia, sekcje), więc każdy test
 * wczytuje go od nowa.
 */

const routing = () => import('./routing');

/** Zmiana hasha i czekanie, aż przeglądarka (jsdom) wyśle `hashchange`. */
async function navigate(hash: string): Promise<void> {
  await act(async () => {
    window.location.hash = hash;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.resetModules();
  window.history.replaceState(null, '', '#/sesja');
  window.sessionStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => vi.restoreAllMocks());

describe('router w przeglądarce', () => {
  it('zmiana samego zapytania nie jest przejściem: ta sama trasa, bez stosu i bez przewijania', async () => {
    window.history.replaceState(null, '', '#/produkty');
    const { goBack, useRoute } = await routing();
    const { result } = renderHook(() => useRoute());
    const before = result.current;
    expect(before).toEqual({ kind: 'food', section: 'products' });
    // Otwarcie i zamknięcie karty produktu w obie strony przez `hashchange`.
    await navigate('#/produkty?q=skyr&p=590');
    await navigate('#/produkty?q=skyr');
    // Ta sama trasa, nawet nie nowy obiekt — App nie renderuje się od nowa.
    expect(result.current).toBe(before);
    expect(window.scrollTo).not.toHaveBeenCalled();
    // Stos tras ma dalej jeden wpis: „wstecz” z paska nie cofa przez zapytania, tylko idzie do rodzica.
    const back = vi.spyOn(window.history, 'back');
    await act(async () => {
      goBack('#/sesja');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/sesja');
    expect(result.current).toEqual({ kind: 'tab', tab: 'train' });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('z produktów do przepisów i z powrotem — wyszukiwanie czeka w przełączniku sekcji', async () => {
    window.history.replaceState(null, '', '#/produkty');
    const { sectionHref, useRoute } = await routing();
    renderHook(() => useRoute());
    window.history.replaceState(null, '', '#/produkty?q=skyr&ns=a');
    await navigate(sectionHref('#/przepisy'));
    expect(window.location.hash).toBe('#/przepisy');
    expect(sectionHref('#/produkty')).toBe('#/produkty?q=skyr&ns=a');
    window.history.replaceState(null, '', '#/przepisy?czas=15');
    await navigate(sectionHref('#/produkty'));
    expect(window.location.hash).toBe('#/produkty?q=skyr&ns=a');
    expect(sectionHref('#/przepisy')).toBe('#/przepisy?czas=15');
  });

  it('zakładka wraca do sekcji ze stanem, z jakim ktoś z niej wyszedł', async () => {
    window.history.replaceState(null, '', '#/produkty');
    const { useRoute, tabHref } = await routing();
    renderHook(() => useRoute());
    // Strona jedzenia pisze stan do adresu bez `hashchange`.
    window.history.replaceState(null, '', '#/produkty?q=mleko');
    await navigate('#/cwiczenia');
    expect(tabHref('food', { hasPlan: false })).toBe('#/produkty?q=mleko');
    expect(tabHref('work', { hasPlan: false })).toBe('#/cwiczenia');
    await navigate('#/cwiczenia/swing2');
    expect(tabHref('work', { hasPlan: false })).toBe('#/cwiczenia');
  });

  it('pamięć sekcji przetrwa przeładowanie strony w tej samej karcie', async () => {
    window.history.replaceState(null, '', '#/w-poblizu');
    const first = await routing();
    renderHook(() => first.useRoute());
    await navigate('#/plan');
    vi.resetModules();
    const second = await routing();
    expect(second.tabHref('food', { hasPlan: false })).toBe('#/w-poblizu');
    expect(second.tabHref('work', { hasPlan: false })).toBe('#/plan');
  });

  it('zepsuty albo cudzy zapis pamięci sekcji nie przenosi nikogo gdzie indziej', async () => {
    window.sessionStorage.setItem(
      'gt:sections',
      JSON.stringify({
        tabs: { food: '#/cwiczenia', work: '#/plan' },
        hashes: { '#/produkty': '#/przepisy?q=x', '#/plan': '#/plan?a=1', '#/plany': '#/plany' },
      }),
    );
    const { sectionHref, tabHref } = await routing();
    expect(tabHref('food', { hasPlan: false })).toBe('#/jedzenie');
    expect(tabHref('work', { hasPlan: false })).toBe('#/plan?a=1');
    expect(sectionHref('#/produkty')).toBe('#/produkty');
    vi.resetModules();
    window.sessionStorage.setItem('gt:sections', '{nie json');
    expect((await routing()).tabHref('work', { hasPlan: true })).toBe('#/plan');
  });
});
