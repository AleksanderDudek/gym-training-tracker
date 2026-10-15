import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

const SKYR = 'Jogurt typu islandzkiego SKYR Naturalny 0% tłuszczu';

export const scenario: Scenario = {
  slug: '11-ktory-skyr-ma-najwiecej-bialka',
  title: 'Which skyr has the most protein?',
  titlePl: 'Który skyr ma najwięcej białka?',
  needPl: 'Który skyr ma najwięcej białka?',
  needEn: 'Which skyr has the most protein?',
  persona: 'Label reader in the dairy aisle, comparing ten nearly identical tubs.',
  problem: 'Comparing labels in the shop is slow: tiny print, different pack sizes, no way to sort.',
  solution:
    'Over 32,000 products sold in Poland: search, sort by protein, compare in a table, filter by Nutri-Score, and open a product for its full label, price and the shops that sell it — and star it.',
  keyMessagePl: '32 tysiące produktów — porównane w sekundę.',
  keyMessageEn: '32,000 products — compared in a second.',
  features: ['Jedzenie → Produkty: search, sort, table view', 'Filter sheet with counts (Nutri-Score)', 'Product detail: label, scores, price, shops, star'],
  clock: '2026-10-15T16:10:00+02:00',
  seed: 'full',
  hookPl: '175 skyrów. Który wziąć?',
  hookEn: '175 skyrs. Which one?',
  ctaPl: 'GYM TRACKER — etykiety bez lupy',
  ctaEn: 'GYM TRACKER — labels without a magnifier',
  music: 'Light, curious electronic pluck around 104 BPM.',
  async setup(page) {
    await open(page, '#/produkty');
    await page.getByRole('list', { name: 'Lista produktów' }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
  },
  async run(s) {
    const { page } = s;
    s.beat('search');
    await s.pause(1200);
    await s.type(page.getByRole('searchbox', { name: 'Szukaj produktu' }), 'skyr', { delay: 120, after: 1900 });

    s.beat('sort');
    await s.choose(page.getByRole('combobox', { name: 'Sortowanie' }), 'Białko: najwięcej', 'Sortowanie: Białko', {
      after: 2500,
    });

    s.beat('table');
    await s.tap(page.getByRole('button', { name: 'Tabela' }), 'Tabela', { after: 3400 });
    await s.tap(page.getByRole('button', { name: 'Karty' }), 'Karty', { after: 800 });

    s.beat('filter');
    await s.tap(page.getByRole('button', { name: /^Filtry/ }), 'Filtry', { after: 1200 });
    await s.tap(page.getByRole('button', { name: /^Nutri-Score A \(/ }), 'Nutri-Score A', { after: 1000 });
    await s.tap(page.getByRole('button', { name: /^Pokaż \d+ produkt/ }), 'Pokaż produkty', { after: 1600 });

    s.beat('detail');
    await s.tap(page.getByRole('button', { name: SKYR }).first(), SKYR, { after: 3000 });
    await s.scroll(420, { ms: 1100, within: page.getByRole('dialog', { name: SKYR }) });
    await s.pause(2000);

    s.beat('star');
    await s.reveal(page.getByRole('button', { name: `Ulubione: ${SKYR}` }));
    await s.tap(page.getByRole('button', { name: `Ulubione: ${SKYR}` }), 'Ulubione (gwiazdka)', { after: 2800 });
  },
  beats: {
    search: {
      shows: 'Jedzenie → Produkty (32 289 products); type „skyr” — 175 results with photos, kcal and macros per 100 g, Nutri-Score, NOVA and price.',
      captionPl: '32 tysiące produktów',
      captionEn: '32,000 products',
      voPl: 'Trzydzieści dwa tysiące produktów ze sklepów w Polsce. Wpisuję: skyr.',
      voEn: 'Thirty-two thousand products from Polish shops. I type: skyr.',
      edit: 'Hook caption here.',
    },
    sort: {
      shows: 'Sort „Białko: najwięcej” — the most protein first.',
      captionPl: 'Sortuj: najwięcej białka',
      captionEn: 'Sort: most protein',
      voPl: 'Sortuję po białku.',
      voEn: 'Sort by protein.',
    },
    table: {
      shows: 'Table view: name, kcal, protein, fat, carbs side by side; back to cards.',
      captionPl: 'Porównanie w tabeli',
      captionEn: 'Side by side in a table',
      voPl: 'W tabeli porównanie jest jeszcze szybsze.',
      voEn: 'In the table it’s even quicker to compare.',
      edit: 'Zoom on the protein column.',
    },
    filter: {
      shows: 'Filter sheet with counts per option; tap Nutri-Score A, then „Pokaż N produktów”.',
      captionPl: 'Tylko Nutri-Score A',
      captionEn: 'Only Nutri-Score A',
      voPl: 'Filtr: tylko Nutri-Score A — liczby przy każdej opcji mówią, ile zostanie.',
      voEn: 'Filter: Nutri-Score A only — the counts tell you what’s left.',
    },
    detail: {
      shows: 'Product sheet: photo, Nutri-Score A, NOVA 1, Eco-Score A, 2,19 zł (Biedronka), nutrition per 100 g, ingredients, allergens, shops.',
      captionPl: 'Cała etykieta, cena i sklep',
      captionEn: 'Full label, price and shop',
      voPl: 'Cała etykieta, cena i sklep, w którym go kupię.',
      voEn: 'The full label, the price, and the shop that sells it.',
      edit: 'Zoom on the score badges and the price.',
    },
    star: {
      shows: 'Tap the star — the product joins „Ulubione” for quick logging.',
      captionPl: 'Gwiazdka — do ulubionych',
      captionEn: 'Star it — into favourites',
      voPl: 'Gwiazdka — i ląduje w ulubionych.',
      voEn: 'A star — and it’s in my favourites.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
