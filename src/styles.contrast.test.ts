import { describe, expect, it } from 'vitest';
// Arkusz wczytany jako tekst przez Vite (`?raw`), a nie przez `node:fs` — projekt nie
// ciągnie typów node'a, a test i tak interesuje sama treść pliku.
import css from './styles.css?raw';

/**
 * Kontrast tokenów, pilnowany testem zamiast pamięcią.
 *
 * Kolor dobiera się na oko, a potem ktoś go „tylko trochę” rozjaśnia i napis przestaje
 * być czytelny na jednym z trzech teł — bez alarmu, bo nic się nie psuje. Tutaj psuje się
 * test. Liczymy po WCAG 2.1: 4,5:1 dla tekstu, 3:1 dla granicy kontrolki.
 */

const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`Brak tokenu --${name} w styles.css`);
  return m[1]!;
};

const lum = (hex: string): number => {
  const ch = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};

const ratio = (a: string, b: string): number => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Trzy tła, na których cokolwiek w tej aplikacji może stanąć. */
const BACKDROPS = ['bg', 'surface', 'surface-2'] as const;

describe('kontrast tokenów', () => {
  it('przyciemnione akcenty nadają się na tekst na każdym tle', () => {
    for (const accent of ['c-orange-ink', 'c-blue-ink', 'c-green-ink']) {
      for (const bd of BACKDROPS) {
        expect(ratio(token(accent), token(bd)), `${accent} na --${bd}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('czyste akcenty nie nadają się na tekst — i dlatego mają wersje ink', () => {
    // Gdyby któryś kiedyś przeskoczył próg, podział na dwa tokeny przestaje mieć sens
    // i trzeba go usunąć, a nie zostawiać jako zabobon.
    const pure = ['c-orange', 'c-blue'].map((t) => ratio(token(t), token('surface')));
    expect(Math.max(...pure)).toBeLessThan(4.5);
  });

  it('krawędź kontrolki odcina się od każdego tła', () => {
    for (const bd of BACKDROPS) {
      expect(ratio(token('edge'), token(bd)), `--edge na --${bd}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('biały napis na przycisku kawy jest czytelny', () => {
    expect(ratio('#ffffff', token('c-orange-ink'))).toBeGreaterThanOrEqual(4.5);
  });

  it('tło baneru wsparcia nie udaje granicy', () => {
    // Wypełnienie jest za blisko teł strony, żeby cokolwiek wyznaczać — dlatego baner
    // ma ramkę. Test pilnuje, żeby nikt ramki nie skasował jako „zbędnej”.
    expect(ratio(token('c-orange-bg'), token('surface'))).toBeLessThan(3);
    expect(css).toMatch(/\.supportbanner\{[^}]*border:1px solid var\(--c-orange-ink\)/);
  });
});
