import { describe, expect, it } from 'vitest';
import { KB_COLORS, kbInkIsLight } from './data/exercises';
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
    for (const accent of ['c-orange-ink', 'c-blue-ink', 'c-green-ink', 'c-gold-ink']) {
      for (const bd of BACKDROPS) {
        expect(ratio(token(accent), token(bd)), `${accent} na --${bd}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('czyste akcenty nie nadają się na tekst — i dlatego mają wersje ink (jasny wygląd)', () => {
    // Gdyby któryś kiedyś przeskoczył próg, podział na dwa tokeny przestaje mieć sens
    // i trzeba go usunąć, a nie zostawiać jako zabobon.
    const pure = ['c-orange', 'c-blue', 'c-gold'].map((t) => ratio(token(t), token('surface')));
    expect(Math.max(...pure)).toBeLessThan(4.5);
  });

  it('krawędź kontrolki odcina się od każdego tła', () => {
    for (const bd of BACKDROPS) {
      expect(ratio(token('edge'), token(bd)), `--edge na --${bd}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('biały napis na przycisku kawy jest czytelny', () => {
    // Przycisk „Postaw espresso” jest złoty — w dużym banerze i w pasku wsparcia.
    expect(ratio('#ffffff', token('c-gold-ink'))).toBeGreaterThanOrEqual(4.5);
  });

  it('tekst i wezwanie na złotym tle wsparcia są czytelne', () => {
    expect(ratio(token('ink'), token('c-gold-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token('c-gold-ink'), token('c-gold-bg'))).toBeGreaterThanOrEqual(4.5);
    // Ramka paska odcina go od jasnego tła, bo samo złote wypełnienie różni się od niego o włos.
    expect(ratio(token('c-gold-ink'), token('surface'))).toBeGreaterThanOrEqual(3);
  });

  it('pasek „dodaj do ekranu początkowego” na niebieskim tle jest czytelny', () => {
    expect(ratio(token('ink'), token('c-blue-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token('c-blue-ink'), token('c-blue-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#ffffff', token('c-blue-ink'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token('c-blue-ink'), token('surface'))).toBeGreaterThanOrEqual(3);
  });

  it('tekst drugiego planu i stany czytają się na każdym tle', () => {
    // Te trzy tusze wygaszają treść: podpisy, „zrobione” i ostrzeżenia. Wygaszony
    // nie znaczy nieczytelny — 4,5:1 obowiązuje je tak samo jak zwykły tekst.
    for (const name of ['ink-soft', 'ok', 'warn']) {
      for (const bd of BACKDROPS) {
        expect(ratio(token(name), token(bd)), `${name} na --${bd}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('kropka stanu połączenia odcina się od każdego tła', () => {
    // Kropka tylko podpowiada (zdanie obok mówi wszystko), ale jako element graficzny i tak ma
    // trzymać 3:1 — czysty akcent (np. --c-gold) zniknąłby na jasnej karcie.
    const rules = css.match(/[^{}]*\.dev-dot\{[^}]*\}/g) ?? [];
    const used = new Set(rules.flatMap((r) => [...r.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]!)));
    expect(used.size).toBeGreaterThanOrEqual(5);
    for (const name of used) {
      for (const bd of BACKDROPS) {
        expect(ratio(token(name), token(bd)), `--${name} na --${bd}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('numer na kafelku ciężaru trzyma się koloru kettlebla', () => {
    // Kolor kettlebla jest kodem zawodowym i zostaje, więc dopasowuje się napis:
    // biel na ciemnych odważnikach, `--ink` na jasnych.
    for (const [w, hex] of Object.entries(KB_COLORS)) {
      const light = kbInkIsLight(Number(w));
      const fg = light ? '#ffffff' : token('ink');
      expect(ratio(fg, hex), `${w} kg (${light ? 'biały' : 'ink'} na ${hex})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tło baneru wsparcia nie udaje granicy', () => {
    // Wypełnienie jest za blisko teł strony, żeby cokolwiek wyznaczać — dlatego baner
    // ma ramkę. Test pilnuje, żeby nikt ramki nie skasował jako „zbędnej”.
    expect(ratio(token('c-gold-bg'), token('surface'))).toBeLessThan(3);
    expect(css).toMatch(/\.mbanner\{[^}]*border:1px solid var\(--c-gold-ink\)/);
    // Pasek wsparcia pod paskiem aplikacji tak samo: odcina go ramka, nie wypełnienie.
    expect(css).toMatch(/\.strip\{[^}]*border-bottom:1px solid var\(--c-gold-ink\)/);
  });
});

/*
 * Ciemny wygląd: te same nazwy tokenów, inne wartości. Blok stoi w arkuszu dwa razy — pod
 * zapytaniem o system („Automatycznie”) i pod `data-theme="dark"` (wybór z ustawień) — i obie
 * kopie muszą być takie same, bo inaczej wygląd zależałby od tego, jak się go wybrało.
 */

/** Treść bloku zaczynającego się od selektora — bez komentarzy, ze ściśniętymi odstępami. */
const block = (selector: string): string => {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`Brak bloku ${selector} w styles.css`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css
    .slice(open + 1, close)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const DARK = block(':root[data-theme=dark]');
const DARK_AUTO = block(':root:not([data-theme=light])');
const LIGHT = block(':root,');

const valuesOf = (body: string): Map<string, string> =>
  new Map([...body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

const darkValues = valuesOf(DARK);

/** Token w ciemnym: wartość z ciemnego bloku, a gdy jej tam nie ma — ta sama co w jasnym. */
const darkToken = (name: string): string => {
  const v = darkValues.get(name) ?? token(name);
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`--${name} w ciemnym to nie kolor: ${v}`);
  return v;
};

const THEMES = [
  ['jasny', token],
  ['ciemny', darkToken],
] as const;

describe('ciemny wygląd', () => {
  it('blok „za systemem” i blok „wybrany ciemny” są identyczne', () => {
    expect(DARK_AUTO).toBe(DARK);
    expect(css).toMatch(/@media \(prefers-color-scheme:dark\)\{\s*:root:not\(\[data-theme=light\]\)\{/);
  });

  it('każdy kolor interfejsu ma ciemną wersję', () => {
    // Czyste akcenty, neutralne palety i kolory obsady to wypełnienia i rysunki — zostają.
    const kept = new Set(['c-orange', 'c-blue', 'c-green', 'c-gold', 'c-dark', 'c-light', 'c-mid', 'c-sand']);
    const themed = [...valuesOf(LIGHT).entries()]
      .filter(([name, v]) => /^#[0-9a-fA-F]{6}$/.test(v) && !kept.has(name) && !/^(fur|hide|muzzle|silver)/.test(name))
      .map(([name]) => name);
    expect(themed.length).toBeGreaterThanOrEqual(18);
    for (const name of themed) expect(darkValues.has(name), `--${name}`).toBe(true);
    expect(DARK).toContain('color-scheme:dark');
    expect(LIGHT).toContain('color-scheme:light');
  });

  it('obsada, sceny, manekin i kafelki kettlebli dostają jasną paletę w obu wyglądach', () => {
    // Ten sam blok co `:root`, więc rysunek wygląda tak samo jak na jasnym ekranie i na obrazku
    // do udostępnienia — sierść, kamizelka i kolory odważników to postać, nie interfejs.
    expect(css.startsWith(':root,')).toBe(true);
    const selector = css.slice(0, css.indexOf('{')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
    expect(selector).toBe(':root,.gorilla,.scene-art,.mq,.chip');
  });

  it('kafelki mapy przyciemnia filtr tylko w ciemnym, a znaczniki zostają', () => {
    expect(valuesOf(LIGHT).get('map-tiles')).toBe('none');
    expect(darkValues.get('map-tiles')).toMatch(/invert\(1\)/);
  });
});

describe('kontrast w obu wyglądach', () => {
  for (const [name, tk] of THEMES) {
    describe(name, () => {
      it('tekst, tekst drugiego planu, stany, stal i tusze akcentów: ≥ 4,5:1 na każdym tle', () => {
        const inks = ['ink', 'ink-soft', 'ok', 'warn', 'steel', 'c-orange-ink', 'c-blue-ink', 'c-green-ink', 'c-gold-ink'];
        for (const fg of inks) {
          for (const bd of BACKDROPS) {
            expect(ratio(tk(fg), tk(bd)), `${fg} na --${bd}`).toBeGreaterThanOrEqual(4.5);
          }
        }
        expect(ratio(tk('ink'), tk('field')), 'tekst w polu').toBeGreaterThanOrEqual(4.5);
      });

      it('krawędź kontrolki ≥ 3:1 na każdym tle i na polu', () => {
        for (const bd of [...BACKDROPS, 'field']) {
          expect(ratio(tk('edge'), tk(bd)), `--edge na --${bd}`).toBeGreaterThanOrEqual(3);
        }
      });

      it('napis na mocnym wypełnieniu (przyciski, wybrane segmenty, odhaczenie, kawa) ≥ 4,5:1', () => {
        for (const fill of ['steel', 'c-gold-ink', 'c-blue-ink', 'c-green-ink', 'ok', 'ink']) {
          expect(ratio(tk('on-strong'), tk(fill)), `--on-strong na --${fill}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it('tekst na tłach akcentów (wsparcie, instalacja, aktywna zakładka) ≥ 4,5:1', () => {
        for (const [fg, bg] of [
          ['ink', 'c-gold-bg'],
          ['c-gold-ink', 'c-gold-bg'],
          ['ink', 'c-blue-bg'],
          ['c-blue-ink', 'c-blue-bg'],
          ['c-orange-ink', 'c-orange-bg'],
        ] as const) {
          expect(ratio(tk(fg), tk(bg)), `--${fg} na --${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        // Ramki pasków odcinają je od karty — wypełnienie samo tego nie robi.
        expect(ratio(tk('c-gold-ink'), tk('surface'))).toBeGreaterThanOrEqual(3);
        expect(ratio(tk('c-blue-ink'), tk('surface'))).toBeGreaterThanOrEqual(3);
        expect(ratio(tk('c-gold-bg'), tk('surface'))).toBeLessThan(3);
      });

      it('kropki stanu połączenia ≥ 3:1 na każdym tle', () => {
        for (const dot of ['ok', 'warn', 'c-orange-ink', 'c-blue-ink', 'ink-soft']) {
          for (const bd of BACKDROPS) {
            expect(ratio(tk(dot), tk(bd)), `--${dot} na --${bd}`).toBeGreaterThanOrEqual(3);
          }
        }
      });
    });
  }
});
