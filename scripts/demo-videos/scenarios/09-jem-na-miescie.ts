import { open, section, tab } from '../lib/app';
import type { Scenario } from '../lib/types';

const BOWL = 'Poke Bowl Sweetest Chilli z ryżem i stripsami';

export const scenario: Scenario = {
  slug: '09-jem-na-miescie',
  title: 'Eating out without wrecking the diet',
  titlePl: 'Jem na mieście — i trzymam dietę',
  needPl: 'Jem na mieście, np. w KFC',
  needEn: 'I eat out — at KFC, for example',
  persona: 'Busy person who eats out with friends or at work and does not want to give up on the plan.',
  problem: 'Fast food menus hide their numbers in PDFs; guessing a meal’s calories and protein usually means guessing wrong.',
  solution:
    'Menus of 18 chains with numbers from their own nutrition tables (source and date shown), sorted by most protein, each item marked against your diet — „pasuje”, „może być”, „nie pasuje” — and logged to the diary in one tap.',
  keyMessagePl: 'W lokalu też wiesz, co pasuje do Twojej diety.',
  keyMessageEn: 'Even eating out, you know what fits your diet.',
  features: ['Produkty → Lokale (18 chains)', 'KFC menu: most protein, categories, diet fit', 'Menu item sheet → add to diary'],
  clock: '2026-10-15T13:05:00+02:00',
  seed: 'full',
  hookPl: 'Lunch w KFC na redukcji?',
  hookEn: 'Lunch at KFC on a cut?',
  ctaPl: 'GYM TRACKER — menu 18 sieci w kieszeni',
  ctaEn: 'GYM TRACKER — 18 chains’ menus in your pocket',
  music: 'Funky, upbeat groove around 112 BPM.',
  async setup(page) {
    await open(page, '#/produkty');
  },
  async run(s) {
    const { page } = s;
    s.beat('tile');
    await s.pause(1600);
    await s.tap(page.getByRole('link', { name: /^Lokale i sieci gastronomiczne/ }), 'Lokale i sieci gastronomiczne', {
      after: 1800,
    });

    s.beat('chains');
    await s.scroll(380, { ms: 1100 });
    await s.pause(1400);

    s.beat('chain');
    await s.tap(page.getByRole('link', { name: /^KFC / }), 'KFC', { after: 1400 });
    await s.pause(2000);

    s.beat('protein');
    await s.reveal(page.getByRole('heading', { name: 'Najwięcej białka' }), { block: 'start' });
    await s.pause(2800);

    s.beat('bowls');
    await s.tap(page.getByRole('button', { name: 'Sałatki i bowle' }), 'Sałatki i bowle', { after: 1800 });

    s.beat('item');
    await s.tap(page.getByRole('button', { name: new RegExp(`^${BOWL}`) }), BOWL, { after: 3200 });

    s.beat('add');
    await s.tap(page.getByRole('button', { name: /^Dodaj do dziennika/ }), 'Dodaj do dziennika', { after: 2600 });

    s.beat('diary');
    await s.tap(tab(page, 'Jedzenie'), 'Jedzenie', { after: 900 });
    await s.tap(section(page, 'Jedzenie', 'Dziennik'), 'Dziennik', { after: 1200 });
    await s.reveal(page.getByRole('heading', { name: /^Zjedzone/ }), { block: 'start' });
    await s.pause(3200);
  },
  beats: {
    tile: {
      shows: 'Jedzenie → Produkty; tap the tile „Lokale i sieci gastronomiczne”.',
      captionPl: 'Lokale i sieci gastronomiczne',
      captionEn: 'Restaurants and chains',
      voPl: 'Lunch na mieście. Zamiast zgadywać — lokale.',
      voEn: 'Lunch out. Instead of guessing — the restaurants.',
      edit: 'Hook caption here.',
    },
    chains: {
      shows: 'Chains grouped by kind: fast food (Burger King, KFC, McDonald’s, Subway…), cafés (Costa, Starbucks…), pizzerias.',
      captionPl: '18 sieci gastronomicznych',
      captionEn: '18 restaurant chains',
      voPl: 'Fast food, kawiarnie, pizzerie — osiemnaście sieci.',
      voEn: 'Fast food, cafés, pizza — eighteen chains.',
    },
    chain: {
      shows: 'Tap KFC — 80 items, source: KFC Polska nutrition table PDF, checked 12 Oct 2026.',
      captionPl: 'Oficjalne tabele sieci',
      captionEn: 'The chains’ own tables',
      voPl: 'Liczby z oficjalnych tabel sieci — ze źródłem i datą.',
      voEn: 'Numbers from the chain’s own tables — with source and date.',
      edit: 'Zoom on the source line.',
    },
    protein: {
      shows: '„Najwięcej białka”: items with at least 15 g of protein, rated against the diet („może być”, „nie pasuje”).',
      captionPl: 'Najwięcej białka na kalorię',
      captionEn: 'Most protein per calorie',
      voPl: 'Od razu widać białko — i co pasuje.',
      voEn: 'Protein first — and what fits my diet.',
      edit: 'Highlight the fit labels.',
    },
    bowls: {
      shows: 'Category „Sałatki i bowle”: the list narrows.',
      captionPl: 'Kategoria: sałatki i bowle',
      captionEn: 'Category: salads and bowls',
      voPl: 'Dziś coś lżejszego.',
      voEn: 'Something lighter today.',
    },
    item: {
      shows: 'Item sheet: Poke Bowl — 23 g protein · 435 kcal, „pasuje — Sportowa: białko i węglowodany razem”, nutrition table per portion and per 100 g.',
      captionPl: '„Pasuje” do mojej diety',
      captionEn: '„Fits” my diet',
      voPl: 'Poke bowl: czterysta trzydzieści pięć kalorii, dwadzieścia trzy gramy białka. Pasuje.',
      voEn: 'Poke bowl: four hundred thirty-five calories, twenty-three grams of protein. It fits.',
      edit: 'Zoom on „pasuje” and the protein/kcal line.',
    },
    add: {
      shows: 'Tap „Dodaj do dziennika (dziś)” — logged; confirmation shown.',
      captionPl: 'Do dziennika jednym stuknięciem',
      captionEn: 'Into the diary in one tap',
      voPl: 'I jednym stuknięciem w dzienniku.',
      voEn: 'And one tap puts it in the diary.',
    },
    diary: {
      shows: 'Jedzenie → Dziennik: the poke bowl is in „Zjedzone” with the time; the day’s balance moved.',
      captionPl: 'W dzienniku, z godziną',
      captionEn: 'In the diary, with the time',
      voPl: 'Jest w dzienniku — bilans dnia się zgadza.',
      voEn: 'It’s in the diary — the day still adds up.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
