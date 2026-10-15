import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

const RECIPE = 'Krewetki czosnkowe z cukinią';

export const scenario: Scenario = {
  slug: '10-przepisy-z-jednego-sklepu',
  title: 'High-protein recipes from the shop you go to',
  titlePl: 'Białkowe przepisy z jednego sklepu',
  needPl: 'Robię zakupy w jednym sklepie — co z tego ugotuję?',
  needEn: 'I shop at one store — what high-protein meal can I make from it?',
  persona: 'Shops at Biedronka after work; wants high-protein dinners without hunting for ingredients across town.',
  problem: 'Protein recipes online call for products your shop does not sell; you find out at the shelf.',
  solution:
    'Recipes are resolved against real products from Polish shops: filter by your store, see „Wszystko kupisz w: Biedronka” with the actual products, swap an ingredient for another product from the same shop and watch the macros recalculate — or group recipes into shopping plans by store.',
  keyMessagePl: 'Przepis z produktów, które naprawdę są na półce.',
  keyMessageEn: 'Recipes built from products that are really on the shelf.',
  features: ['Jedzenie → Przepisy: store, type and time filters', 'Recipe card: macros, rule, ingredients as real products', 'Ingredient swap', '„Według sklepów” shopping plans'],
  clock: '2026-10-15T17:30:00+02:00',
  seed: 'full',
  hookPl: 'Obiad z Biedronki. 39 g białka.',
  hookEn: 'Dinner from Biedronka. 39 g of protein.',
  ctaPl: 'GYM TRACKER — przepisy pod Twój sklep',
  ctaEn: 'GYM TRACKER — recipes for your store',
  music: 'Warm kitchen-vibe acoustic groove around 96 BPM.',
  async setup(page) {
    await open(page, '#/przepisy');
    await page.getByRole('region', { name: 'Przepisy białkowe' }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
  },
  async run(s) {
    const { page } = s;
    s.beat('rule');
    await s.pause(3400);

    s.beat('store');
    await s.tap(page.getByRole('group', { name: 'Sklep', exact: true }).getByRole('button', { name: /^Biedronka/ }), 'Biedronka', {
      after: 1200,
    });
    await s.tap(page.getByRole('group', { name: 'Rodzaj', exact: true }).getByRole('button', { name: 'Obiad' }), 'Obiad', {
      after: 1400,
    });

    s.beat('card');
    await s.reveal(page.getByRole('heading', { name: RECIPE }), { block: 'start' });
    await s.pause(3000);
    await s.scroll(330, { ms: 1000 });
    await s.pause(2000);

    s.beat('swap');
    await s.tap(page.getByRole('button', { name: 'Zamień: Krewetki (mrożone, obrane)' }), 'Zamień: Krewetki', { after: 1400 });
    await s.tap(page.getByRole('radio', { name: /^Krewetki Białe Całe Gotowane/ }), 'Krewetki gotowane 21 g białka', {
      after: 2400,
    });
    await s.tap(page.getByRole('button', { name: 'Gotowe' }), 'Gotowe', { after: 1600 });

    s.beat('byStore');
    await s.tap(page.getByRole('group', { name: 'Rodzaj', exact: true }).getByRole('button', { name: 'Wszystkie' }), 'Rodzaj: Wszystkie', {
      after: 800,
    });
    await s.tap(page.getByRole('button', { name: 'Według sklepów' }), 'Według sklepów', { after: 1200 });
    await s.reveal(page.getByRole('heading', { name: 'Przepisy białkowe' }), { block: 'start' });
    await s.pause(3000);
    await s.scroll(300, { ms: 900 });
    await s.pause(1400);
  },
  beats: {
    rule: {
      shows: 'Jedzenie → Przepisy: the rule — more protein than carbs and more protein than fat in every portion; ready meals with at least 15 g.',
      captionPl: 'Zasada: białko wygrywa',
      captionEn: 'The rule: protein wins',
      voPl: 'Każdy przepis: białka więcej niż węglowodanów i tłuszczu.',
      voEn: 'Every recipe: more protein than carbs or fat.',
      edit: 'Hook caption here; zoom on the bold rule.',
    },
    store: {
      shows: 'Store chip „Biedronka (49)”, then the type „Obiad”.',
      captionPl: 'Mój sklep: Biedronka',
      captionEn: 'My store: Biedronka',
      voPl: 'Wybieram swój sklep i obiad.',
      voEn: 'I pick my store, and dinner.',
    },
    card: {
      shows: '„Krewetki czosnkowe z cukinią”: 12 min, 39 g protein, 311 kcal, „Wszystko kupisz w: Biedronka”, ingredients as real products (Marinero shrimps, Komagra oil, Biedronka parmesan).',
      captionPl: 'Wszystko kupisz w jednym sklepie',
      captionEn: 'Everything from one store',
      voPl: 'Krewetki czosnkowe z cukinią: dwanaście minut, trzydzieści dziewięć gramów białka — i wszystko kupię w jednym sklepie.',
      voEn: 'Garlic shrimp with zucchini: twelve minutes, thirty-nine grams of protein — and it’s all in one store.',
      edit: 'Zoom on „Wszystko kupisz w: Biedronka”, then on the product lines.',
    },
    swap: {
      shows: '„Zamień” on the shrimps: products from Biedronka; pick the cooked ones (21 g protein/100 g) — the status line recalculates the portion; „Gotowe”.',
      captionPl: 'Zamiana — makro przelicza się samo',
      captionEn: 'Swap — macros recalculate',
      voPl: 'Nie ma tych krewetek? Zamieniam na inne z tej samej półki — przepis przelicza się od razu.',
      voEn: 'Those shrimps sold out? Swap for others on the same shelf — the recipe recalculates instantly.',
      edit: 'Zoom on the status line „Porcja: … g białka … zasada spełniona”.',
    },
    byStore: {
      shows: 'Type filter back to „Wszystkie”, layout „Według sklepów”: Biedronka’s 49 recipes in 3 shopping plans — the first „Biedronka + GuiltFree: 47 przepisów · wizyta w sklepie i zamówienie przez internet”.',
      captionPl: 'Plany zakupów według sklepów',
      captionEn: 'Shopping plans by store',
      voPl: 'A widok według sklepów układa przepisy w plany zakupów.',
      voEn: 'And the by-store view turns recipes into shopping plans.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
