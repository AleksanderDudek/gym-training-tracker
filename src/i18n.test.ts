import { describe, expect, it } from 'vitest';
import { LANG, LOCALE, detectLang, num, pluralEn, say, text } from './i18n';

describe('język', () => {
  it('pierwszy obsługiwany z języków przeglądarki; inny niż polski i angielski — angielski', () => {
    expect(detectLang(['pl-PL', 'en-US'])).toBe('pl');
    expect(detectLang(['de-DE', 'en-GB', 'pl'])).toBe('en');
    expect(detectLang(['de-DE', 'PL'])).toBe('pl');
    expect(detectLang(['de-DE'])).toBe('en');
    expect(detectLang([])).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });

  it('testy biegną po polsku: katalog daje polską połowę, liczby polski format', () => {
    expect(LANG).toBe('pl');
    expect(LOCALE).toBe('pl-PL');
    const T = text({ pl: { save: 'Zapisz', n: (k: number) => `${k} kg` }, en: { save: 'Save', n: (k: number) => `${k} kg` } });
    expect(T.save).toBe('Zapisz');
    expect(say('tak', 'yes')).toBe('tak');
    expect(num(1234.5, 1).replace(/\s/g, ' ')).toBe('1234,5');
    expect(num(12345).replace(/\s/g, ' ')).toBe('12 345');
  });

  it('angielska liczba mnoga', () => {
    expect(pluralEn(1, 'step', 'steps')).toBe('step');
    expect(pluralEn(0, 'step', 'steps')).toBe('steps');
    expect(pluralEn(2, 'step', 'steps')).toBe('steps');
  });
});
