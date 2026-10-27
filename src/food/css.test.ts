import { describe, expect, it } from 'vitest';
// Arkusze jako tekst przez Vite (`?raw`), jak w teście kontrastu — bez `node:fs`.
import appCss from '../styles.css?raw';

/**
 * Klasy jedzenia nie mogą się zderzać między obszarami.
 *
 * Każdy obszar (produkty, przepisy, sklepy, dieta, lokale, plan z zakupami, badania) ma własny arkusz,
 * ładowany z leniwą paczką — a raz wczytany arkusz zostaje na stronie do końca wizyty. Ta sama
 * klasa zdefiniowana w dwóch obszarach działała więc różnie w zależności od tego, który ekran
 * otwarto pierwszy: siatka produktów traciła marginesy po wizycie w dzienniku. Wspólne klasy
 * mieszkają w `common.css` i `food.css`, klasy aplikacji w `styles.css`; każda inna klasa należy
 * do jednego obszaru.
 */

const AREAS = import.meta.glob('./components/*/*.css', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
const SHARED = import.meta.glob(['./food.css', './components/common/*.css'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Klasy z selektorów arkusza — bez komentarzy i bez treści deklaracji. */
function classesOf(css: string): Set<string> {
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g) ?? [];
  const out = new Set<string>();
  selectors.forEach((sel) => {
    for (const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]!);
  });
  return out;
}

const shared = new Set([...Object.values(SHARED).flatMap((css) => [...classesOf(css)]), ...classesOf(appCss)]);
const areas = Object.entries(AREAS)
  .filter(([path]) => !path.includes('/common/'))
  .map(([path, css]) => ({ path, own: [...classesOf(css)].filter((c) => !shared.has(c) && !c.startsWith('leaflet-')) }));

describe('arkusze jedzenia', () => {
  it('jest siedem obszarów z własnymi klasami', () => {
    expect(areas.map((a) => a.path.split('/')[2]).sort()).toEqual([
      'diet',
      'labs',
      'nearby',
      'prep',
      'products',
      'recipes',
      'restaurants',
    ]);
    areas.forEach((a) => expect(a.own.length, a.path).toBeGreaterThan(0));
  });

  it('żadna klasa obszaru nie pojawia się w arkuszu innego obszaru', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    areas.forEach(({ path, own }) =>
      own.forEach((c) => {
        const first = owner.get(c);
        if (first && first !== path) clashes.push(`.${c}: ${first} i ${path}`);
        else owner.set(c, path);
      }),
    );
    expect(clashes).toEqual([]);
  });

  it('klasy obszarów mają przedrostek jedzenia', () => {
    const bare = areas.flatMap(({ path, own }) => own.filter((c) => !c.startsWith('fd-')).map((c) => `${path}: .${c}`));
    expect(bare).toEqual([]);
  });
});
