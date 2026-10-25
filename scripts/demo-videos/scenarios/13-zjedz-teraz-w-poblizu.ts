import { open, section } from '../lib/app';
import type { Scenario } from '../lib/types';

const DISH = 'T.L.C.® Teriyaki';

export const scenario: Scenario = {
  slug: '13-zjedz-teraz-w-poblizu',
  title: 'Hungry in the city: what nearby fits my diet',
  titlePl: 'Głodny na mieście: co w pobliżu pasuje do diety',
  needPl: 'Jestem na mieście i głodny — gdzie zjem coś, co pasuje do mojej diety?',
  needEn: 'I’m out in the city and hungry — where can I eat something that fits my diet?',
  persona: 'Office worker on a cut, out in central Warsaw at lunchtime, hungry and short on time.',
  problem:
    'Near a busy station there are hundreds of places to eat; checking each menu against what is left of today’s calories and protein takes longer than the lunch break.',
  solution:
    '„Zjedz teraz” takes what is left of today’s target, finds the places around you (from the app’s own copy of OpenStreetMap) with menus of the chains they belong to, and ranks the dishes for this meal by fit and distance — on a map and a list. The place card shows every dish with its macros, the fit and the reason; „Zjadłem” logs it and the day’s balance moves.',
  keyMessagePl: 'Na mieście w minutę wiesz, gdzie i co zjeść pod swój cel.',
  keyMessageEn: 'Out in the city, in a minute you know where and what to eat for your goal.',
  features: [
    'Dziennik: „Zostało” balance and „Co teraz?” → „Poza domem? Zobacz, gdzie zjeść w pobliżu”',
    'W pobliżu → Zjedz teraz: „Na teraz” target for this meal and the best pick',
    'Map with pins coloured by fit, the top 3 numbered; pin popup',
    '„Najlepsze wybory na teraz”: ranked places with their best dish, distance, walk and opening hours',
    'Place card: dishes rated against the diet, reasons, „Prowadź”, „Zjadłem”',
  ],
  clock: '2026-10-15T13:00:00+02:00',
  seed: 'full',
  // Przy Złotych Tarasach / Warszawie Centralnej.
  geolocation: { latitude: 52.2297, longitude: 21.0032 },
  hookPl: 'Głodny na mieście — co zjeść?',
  hookEn: 'Hungry in town — what to eat?',
  ctaPl: 'GYM TRACKER — najlepszy obiad w pobliżu',
  ctaEn: 'GYM TRACKER — the best lunch nearby',
  music: 'Urban, light lo-fi hip-hop groove around 96 BPM, city ambience under the first seconds.',
  async setup(page) {
    await open(page, '#/jedzenie');
    // Dziś już bez ważenia — karta wagi nie zasłania bilansu.
    await page.getByRole('button', { name: 'Nie dziś' }).click();
    await page.getByRole('heading', { name: /^Zostało ok\./ }).waitFor();
    await page.waitForTimeout(2500);
  },
  async run(s) {
    const { page } = s;
    s.beat('left');
    await s.pause(3000);

    s.beat('link');
    await s.tap(page.getByRole('link', { name: 'Poza domem? Zobacz, gdzie zjeść w pobliżu' }), 'Poza domem? Gdzie zjeść w pobliżu', {
      after: 1400,
    });

    s.beat('answer');
    const now = page.getByRole('region', { name: 'Na teraz', exact: true });
    await now.getByRole('button', { name: /^Najlepiej:/ }).waitFor();
    await s.pause(1200);
    // „Na teraz” u góry, pod nim już mapa.
    await s.scroll(300, { ms: 900 });
    await s.pause(2600);

    s.beat('map');
    await s.tap(page.getByRole('region', { name: 'Mapa lokali w pobliżu' }).getByRole('button', { name: '1', exact: true }), 'pinezka 1', {
      after: 2800,
    });

    s.beat('list');
    const best = page.getByRole('region', { name: 'Najlepsze wybory na teraz' });
    await s.reveal(best.getByRole('heading', { name: 'Najlepsze wybory na teraz' }), { block: 'start', ms: 1000 });
    await s.pause(3000);

    s.beat('card');
    await s.tap(best.getByRole('button', { name: /^T\.L\.C\.® Teriyaki / }), DISH, {
      after: 3300,
    });

    s.beat('eat');
    await s.tap(page.getByRole('button', { name: `Zjadłem: ${DISH}` }), 'Zjadłem', { after: 3000 });

    s.beat('result');
    await s.tap(page.getByRole('dialog', { name: 'Subway' }).getByRole('button', { name: 'Zamknij' }), 'Zamknij', { after: 500 });
    await s.tap(section(page, 'Jedzenie', 'Dziennik'), 'Dziennik', { after: 1000 });
    await page.getByRole('heading', { name: /^Zostało ok\./ }).waitFor();
    await s.pause(3000);
  },
  beats: {
    left: {
      shows: 'Jedzenie → Dziennik at 13:00: „Zostało ok. 1650 kcal i 107 g białka”, protein 41 / 148 g, calories 651 / 2300 kcal.',
      captionPl: 'Zostało 1650 kcal i 107 g białka',
      captionEn: '1650 kcal and 107 g protein left',
      voPl: 'Trzynasta, centrum. Zostało tysiąc sześćset pięćdziesiąt kalorii.',
      voEn: 'One p.m., downtown. 1,650 calories left.',
      edit: 'Hook caption here; zoom on the „Zostało ok. 1650 kcal i 107 g białka” heading.',
    },
    link: {
      shows: 'Scroll down to „Co teraz?”; tap „Poza domem? Zobacz, gdzie zjeść w pobliżu”.',
      captionPl: 'Poza domem? Gdzie zjeść w pobliżu',
      captionEn: 'Out? Where to eat nearby',
      voPl: 'Gdzie zjeść w pobliżu?',
      voEn: 'Where can I eat nearby?',
      edit: 'Speed up the scroll ×1.5 if needed; highlight the link before the tap.',
    },
    answer: {
      shows: 'W pobliżu → Zjedz teraz: „W promieniu 1 km: 168 miejsc z menu”; „Na teraz: ok. 550 kcal i 36 g białka na ten posiłek — zostało 1650 kcal na 3 posiłki”; „Najlepiej: T.L.C.® Teriyaki · pasuje · Subway · 50 m · 1 min pieszo”.',
      captionPl: 'Na ten posiłek: 550 kcal, 36 g białka',
      captionEn: 'This meal: 550 kcal, 36 g protein',
      voPl: 'Od razu: ile na ten posiłek i co najlepsze — pięćdziesiąt metrów stąd.',
      voEn: 'At once: how much for this meal, and the best pick — fifty metres away.',
      edit: 'Zoom on the „Na teraz” sentence, then on the „Najlepiej” card.',
    },
    map: {
      shows: 'Map of the 1 km circle: pins coloured by fit (green, gold, red), the top three numbered; tap pin 1 — popup „Subway · 50 m · 1 min pieszo · otwarte do 22:00 · T.L.C.® Teriyaki · 542 kcal · pasuje”.',
      captionPl: 'Na mapie: co pasuje do diety',
      captionEn: 'On the map: what fits the diet',
      voPl: 'Na mapie zielone pasują. Numer jeden — Subway.',
      voEn: 'On the map, green fits. Number one — Subway.',
      edit: 'Highlight the numbered pins 1–3; zoom on the popup.',
    },
    list: {
      shows: '„Najlepsze wybory na teraz”, sort „Najlepsze”: 1 T.L.C.® Teriyaki (Subway, 50 m, 542 kcal · B 42), 2 Kanapka Rubena z pastrami (Galeria Wypieków Lubaszka, 280 m), 3 Rollo Greco – kurczak (Berlin Döner Kebap, 130 m), each „pasuje” with „uzupełnia białko”.',
      captionPl: 'Trzy najlepsze wybory obok',
      captionEn: 'The three best picks nearby',
      voPl: 'Trzy najlepsze wybory, z odległością i godzinami otwarcia.',
      voEn: 'The three best picks, with distance and opening hours.',
      edit: 'Highlight the sort chips (Najlepsze, Najwięcej białka, Najbliżej) and the „uzupełnia białko” lines.',
    },
    card: {
      shows: 'Tap the first pick — the Subway card: Złota 59 · 50 m, „Prowadź”, „Co tu zjesz”: T.L.C.® Teriyaki „pasuje”, 542 kcal · B 42 · 30 cm, „uzupełnia białko: 42 g z brakujących 107 g”; more dishes below.',
      captionPl: '42 g białka, 542 kcal — pasuje',
      captionEn: '42 g protein, 542 kcal — fits',
      voPl: 'Karta miejsca: czterdzieści dwa gramy białka. Pasuje.',
      voEn: 'The place card: forty-two grams of protein. It fits.',
      edit: 'Zoom on the first dish: the „pasuje” badge and the „uzupełnia białko” reason.',
    },
    eat: {
      shows: 'Tap „Zjadłem” — „Zapisane w dzienniku: T.L.C.® Teriyaki · 542 kcal. Lista liczy się już od nowa.”; the dishes re-rank for what is left.',
      captionPl: 'Zjadłem — zapisane w dzienniku',
      captionEn: 'Ate it — logged in the diary',
      voPl: 'Zjadłem. Zapisane — a lista liczy się od nowa.',
      voEn: 'Ate it. Logged — and the list recounts.',
      edit: 'Highlight the green „Zapisane w dzienniku” line.',
    },
    result: {
      shows: 'Close the card, back to Dziennik: „Zostało ok. 1110 kcal i 65 g białka”, protein 83 / 148 g, calories 1193 / 2300 kcal.',
      captionPl: 'Zostało 1110 kcal i 65 g białka',
      captionEn: '1110 kcal and 65 g protein left',
      voPl: 'Bilans dnia się zgadza: białko osiemdziesiąt trzy gramy.',
      voEn: 'The day still adds up: eighty-three grams of protein.',
      edit: 'Zoom on the protein bar 83 / 148 g; closing card over the last 2 s.',
    },
  },
};
