import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

const PIZZA = 'Pizza Pepperoni 24 cm (Da Grasso)';
const BEER = 'Piwo Pilzner, dolnej fermentacji';

export const scenario: Scenario = {
  slug: '16-wiekszy-posilek',
  title: 'Pizza with friends tonight — planned, not regretted',
  titlePl: 'Pizza ze znajomymi — zaplanowana, nie żałowana',
  needPl: 'Wieczorem pizza ze znajomymi — czy to zepsuje mi redukcję?',
  needEn: 'Pizza with friends tonight — will it ruin my cut?',
  persona: 'Person on a cut with a social life, afraid that one evening out undoes the whole week.',
  problem:
    'A dinner out feels like breaking the diet: either you skip your friends, or you eat and feel guilty — with no idea what the evening really costs or what to do with the rest of the day.',
  solution:
    '„Większy posiłek” in the diary: pick the evening from the list (restaurant chains’ menus, products, favourites — several things in one meal), see before eating whether the day still fits the target (±100 kcal), what is left for the other meals and how the rest of the day could look, then plan it — the diary counts the rest of the day with it.',
  keyMessagePl: 'Pizza ze znajomymi mieści się w planie — wiesz to przed wyjściem.',
  keyMessageEn: 'Pizza with friends fits the plan — and you know it before you go.',
  features: [
    'Dziennik: „Większy posiłek” sheet',
    'From the list: chain menu + product in one meal',
    '„Co z tego wynika”: verdict, what is left, rest-of-day variants',
    '„Zaplanuj”: planned meal card, balance and „Co teraz?” count with it',
  ],
  clock: '2026-10-15T12:30:00+02:00',
  seed: 'full',
  hookPl: 'Pizza wieczorem? A redukcja?',
  hookEn: 'Pizza tonight? On a cut?',
  ctaPl: 'GYM TRACKER — wyjście bez wyrzutów sumienia',
  ctaEn: 'GYM TRACKER — nights out without guilt',
  music: 'Warm, playful indie-pop around 104 BPM; light and social, no tension.',
  async setup(page) {
    await open(page, '#/jedzenie');
    await page.getByRole('button', { name: 'Większy posiłek' }).waitFor();
    // Baza produktów (piwo) wczytuje się w tle — ma być gotowa, zanim ruszy kamera.
    await page.waitForTimeout(4000);
  },
  async run(s) {
    const { page } = s;
    s.beat('diary');
    await s.pause(2600);
    await s.tap(page.getByRole('button', { name: 'Większy posiłek' }), 'Większy posiłek', { after: 2200 });

    const sheet = page.getByRole('dialog', { name: 'Większy posiłek' });
    s.beat('name');
    await s.type(sheet.getByRole('textbox', { name: 'Co to będzie' }), 'Pizza ze znajomymi', { delay: 70, after: 900 });

    s.beat('pizza');
    const search = sheet.getByRole('searchbox', { name: 'Szukaj do większego posiłku' });
    await s.type(search, 'pepperoni 24', { delay: 110, after: 1300 });
    await s.tap(sheet.getByRole('button', { name: new RegExp(`^${PIZZA.replace(/[()]/g, '\\$&')} `) }), PIZZA, {
      after: 1800,
    });

    s.beat('beer');
    await s.type(search, 'pilzner', { delay: 110, after: 1200 });
    await s.tap(sheet.getByRole('button', { name: new RegExp(`^${BEER} `) }), BEER, { after: 600 });
    await s.reveal(sheet.getByText(/^Razem: /), { block: 'center' });
    await s.pause(2000);

    s.beat('verdict');
    const result = sheet.getByRole('region', { name: 'Co z tego wynika' });
    await s.reveal(result.getByRole('heading', { name: 'Co z tego wynika' }), { block: 'start', ms: 900 });
    await s.pause(3600);

    s.beat('variants');
    await s.reveal(result.getByRole('region', { name: 'Wariant 2' }), { block: 'end', ms: 900 });
    await s.pause(2600);

    s.beat('plan');
    await s.tap(sheet.getByRole('button', { name: 'Zaplanuj' }), 'Zaplanuj', { after: 1300 });
    // Pytanie o wagę zjeżdża z kadru: bilans dnia i karta zaplanowanego posiłku razem.
    await s.scroll(250, { ms: 900 });
    await s.pause(3000);

    s.beat('rest');
    await s.reveal(page.getByRole('heading', { name: 'Co teraz?' }), { block: 'start', ms: 1100 });
    await s.pause(3600);
  },
  beats: {
    diary: {
      shows: 'Jedzenie → Dziennik at 12:30: „Zostało ok. 1650 kcal i 107 g białka”, 651 / 2300 kcal; tap „Większy posiłek” under „Dodaj zjedzone”.',
      captionPl: 'Wieczorem pizza ze znajomymi',
      captionEn: 'Pizza with friends tonight',
      voPl: 'Wieczorem pizza ze znajomymi. Zamiast wyrzutów — plan.',
      voEn: 'Pizza with friends tonight. A plan instead of guilt.',
      edit: 'Hook caption here; highlight the „Większy posiłek” button before the tap.',
    },
    name: {
      shows: 'Sheet „Większy posiłek” („Z listy”): type „Pizza ze znajomymi” into „Co to będzie”.',
      captionPl: 'Większy posiłek — z góry',
      captionEn: 'A bigger meal — planned ahead',
      voPl: 'Większy posiłek, zaplanowany z góry.',
      voEn: 'A bigger meal, planned ahead.',
    },
    pizza: {
      shows: 'Search „pepperoni 24” → restaurant menu item „Pizza Pepperoni 24 cm (Da Grasso)” 829 kcal · B 32; tap — it lands in „W większym posiłku”.',
      captionPl: 'Pizza prosto z menu lokalu',
      captionEn: 'Pizza straight from the menu',
      voPl: 'Pizza prosto z menu lokalu — z prawdziwymi liczbami.',
      voEn: 'Pizza straight from the restaurant’s menu — with real numbers.',
      edit: 'Zoom on the Da Grasso row (829 kcal).',
    },
    beer: {
      shows: 'Search „pilzner” → „Piwo Pilzner” 500 ml, 215 kcal; tap — two items in one meal, „Razem: 1044 kcal · B 32 · W 110 · T 36”.',
      captionPl: 'Do tego piwo: razem 1044 kcal',
      captionEn: 'Plus a beer: 1044 kcal in all',
      voPl: 'Do tego piwo. Razem tysiąc czterdzieści cztery kalorie.',
      voEn: 'Plus a beer. One thousand forty-four calories in all.',
      edit: 'Highlight the „Razem” line.',
    },
    verdict: {
      shows: '„Co z tego wynika”: Cel na dziś 2300 · Zjedzone 651 · Większy posiłek 1044 · Razem 1695 kcal; „Mieści się: zostaje ok. 610 kcal na 2 posiłki — po ok. 300 kcal i 37 g białka.”; „Białka brakuje jeszcze 74 g…”.',
      captionPl: 'Mieści się: 610 kcal na resztę',
      captionEn: 'It fits: 610 kcal for the rest',
      voPl: 'Mieści się. Zostaje około sześćset dziesięć kalorii na dwa posiłki.',
      voEn: 'It fits. About six hundred ten calories left for two meals.',
      edit: 'Zoom on „Mieści się” and the per-meal numbers.',
    },
    variants: {
      shows: '„Tak może wyglądać reszta dnia”: Wariant 1 — Leniwe z chudego twarogu ze skyrem + Sernik na zimno bez cukru (643 kcal, 89 g białka); Wariant 2 — Pyry z gzikiem + Serek wiejski z bułką grahamką (688 kcal, 80 g).',
      captionPl: 'Reszta dnia — lekko i z białkiem',
      captionEn: 'The rest of the day — light, high-protein',
      voPl: 'A reszta dnia? Gotowe warianty, lekko i z białkiem.',
      voEn: 'And the rest of the day? Ready options, light and high in protein.',
    },
    plan: {
      shows: 'Tap „Zaplanuj” — back in the diary: „Zostało ok. 610 kcal i 74 g białka”, „Liczę już z zaplanowanym większym posiłkiem (1044 kcal)”, the card „Zaplanowany większy posiłek: Pizza ze znajomymi”.',
      captionPl: 'Zaplanowane — dziennik już wie',
      captionEn: 'Planned — the diary knows',
      voPl: 'Zaplanuj. Dziennik od razu liczy dzień razem z pizzą.',
      voEn: 'Plan it. The diary now counts the day with the pizza.',
      edit: 'Zoom on „Liczę już z zaplanowanym większym posiłkiem (1044 kcal)”, then on the planned-meal card.',
    },
    rest: {
      shows: '„Co teraz?”: „Zostało ok. 610 kcal i 74 g białka na 2 posiłki — po zaplanowanym większym posiłku”, rest-of-day variants with „Zjedzone” buttons.',
      captionPl: 'Pizza bez wyrzutów sumienia',
      captionEn: 'Pizza without the guilt',
      voPl: 'Lżej do wieczora — a pizza bez wyrzutów sumienia.',
      voEn: 'Lighter until the evening — and pizza without the guilt.',
      edit: 'Highlight „po zaplanowanym większym posiłku”; closing card over the last 2 s.',
    },
  },
};
