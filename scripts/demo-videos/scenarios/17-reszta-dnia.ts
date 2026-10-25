import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

const LUNCH = 'Obiad: kurczak, ryż i warzywa';
/**
 * „Inne warianty” before the camera rolls: the variants are drawn from the date's seed and this many
 * rerolls, so the take always opens on the same three — the first lands 1 kcal from what is left.
 */
const ROLLS = 8;

export const scenario: Scenario = {
  slug: '17-reszta-dnia',
  title: 'The rest of the day, solved at once',
  titlePl: 'Reszta dnia w jednym rzucie',
  needPl: 'Zostało mi 1650 kcal i 100 g białka — nie mam pomysłu, co zjeść do końca dnia',
  needEn: 'I have 1650 kcal and 100 g of protein left — no idea what to eat for the rest of the day',
  persona: 'Logs every meal, but by mid-afternoon is tired of deciding — one more „what now?” is one too many.',
  problem:
    'A counter says what is left, not how to spend it. Picking one meal at a time leaves dinner to chance: the evening either runs out of calories or ends far short on protein.',
  solution:
    '„Co teraz?” in the diary shows „Reszta dnia”: whole rest-of-day variants — lunch, dinner and a snack from what you have at home, your own meals and the shop nearby — each with its sum against what is left. Mark a meal „Zjedzone”, the day’s bars move and the rest is laid out again, still adding up.',
  keyMessagePl: 'Cała reszta dnia rozpisana — i zawsze się domyka.',
  keyMessageEn: 'The whole rest of the day laid out — and it always adds up.',
  features: [
    'Jedzenie → Dziennik: Bilans dnia',
    '„Co teraz?” → „Reszta dnia (3 posiłki)”: variants with sums',
    '„Zjedzone” on a meal of a variant',
    'Rest of the day recalculated after a meal',
  ],
  clock: '2026-10-15T14:30:00+02:00',
  seed: 'full',
  hookPl: 'Zostało 1650 kcal. Co zjeść?',
  hookEn: '1650 kcal left. What do I eat?',
  ctaPl: 'GYM TRACKER — reszta dnia bez zgadywania',
  ctaEn: 'GYM TRACKER — the rest of the day, no guessing',
  music: 'Calm, warm lo-fi pop around 96 BPM; a soft click when a meal is marked eaten.',
  async setup(page) {
    await open(page, '#/jedzenie');
    await page.getByRole('region', { name: 'Bilans dnia' }).waitFor();
    const reroll = page.getByRole('button', { name: 'Inne warianty' });
    await reroll.waitFor();
    // Warianty liczą się z bazy produktów — dopiero gdy wczytana, zestawy są te, co na próbach.
    await page.getByText('Wczytuję bazę produktów').waitFor({ state: 'hidden', timeout: 20_000 });
    await page.waitForTimeout(1500);
    for (let i = 0; i < ROLLS; i++) {
      await reroll.click();
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
  },
  async run(s) {
    const { page } = s;
    const now = page.getByRole('region', { name: 'Co teraz?' });

    s.beat('gap');
    await s.pause(3800);

    s.beat('rest');
    await s.reveal(page.getByRole('heading', { name: 'Co teraz?' }), { block: 'start', ms: 1300 });
    await s.pause(3000);

    s.beat('first');
    // Wariant 1 jest już widoczny pod przełącznikiem — przesunięcie stawia go w środku ekranu.
    await s.scroll(190, { ms: 900 });
    await s.pause(3200);

    s.beat('second');
    await s.reveal(now.getByRole('region', { name: 'Wariant 2' }), { block: 'start', ms: 900 });
    await s.pause(3400);

    s.beat('eat');
    await s.reveal(now.getByRole('region', { name: 'Wariant 1' }), { block: 'start', ms: 900 });
    await s.pause(900);
    await s.tap(now.getByRole('region', { name: 'Wariant 1' }).getByRole('button', { name: `Zjedzone: ${LUNCH}` }), 'Zjedzone', {
      after: 1300,
    });

    s.beat('bars');
    await s.reveal(page.getByRole('region', { name: 'Bilans dnia' }), { block: 'start', ms: 1100 });
    await s.pause(3400);

    s.beat('fits');
    await s.reveal(page.getByRole('heading', { name: 'Co teraz?' }), { block: 'start', ms: 1300 });
    await s.pause(4600);
  },
  beats: {
    gap: {
      shows: 'Jedzenie → Dziennik at 14:30: „Zostało ok. 1650 kcal i 107 g białka” — Białko 41 z 148 g, Kalorie 651 z 2300 kcal.',
      captionPl: 'Zostało 1650 kcal i 107 g białka',
      captionEn: '1650 kcal and 107 g protein left',
      voPl: 'Wpół do trzeciej. Przede mną jeszcze pół dnia jedzenia.',
      voEn: 'Half past two. Half a day of eating still ahead.',
      edit: 'Hook caption here; zoom on the heading „Zostało ok. 1650 kcal i 107 g białka”.',
    },
    rest: {
      shows: '„Co teraz?”: „Zostało ok. 1650 kcal i 107 g białka na 3 posiłki”; the switch „Reszta dnia (3 posiłki)” is on, „Jeden posiłek” beside it.',
      captionPl: 'Nie jeden posiłek — cała reszta dnia',
      captionEn: 'Not one meal — the whole rest of the day',
      voPl: 'Co teraz? Nie jeden posiłek, tylko cała reszta dnia.',
      voEn: 'What now? Not one meal — the whole rest of the day.',
      edit: 'Highlight the pressed „Reszta dnia (3 posiłki)”.',
    },
    first: {
      shows: '„Wariant 1 · 1648 kcal z 1649 kcal · 135 g białka (z 107)”: Obiad — kurczak, ryż i warzywa (masz w domu), Kolacja — makaron z indykiem w pomidorach (masz w domu), Przekąska — napój proteinowy i banan (Lidl).',
      captionPl: '1648 z 1649 kcal, 135 g białka',
      captionEn: '1648 of 1649 kcal, 135 g protein',
      voPl: 'Obiad, kolacja, przekąska — i suma prawie co do kalorii.',
      voEn: 'Lunch, dinner, a snack — and the sum hits the calories almost exactly.',
      edit: 'Zoom on the variant’s sum line; underline „masz w domu” on the first two meals.',
    },
    second: {
      shows: '„Wariant 2 · 1671 kcal z 1649 kcal · 158 g białka (z 107)”: twaróg z chlebem i szynką, leniwe ze skyrem, kefir z grahamką, napój proteinowy z bananem.',
      captionPl: 'Wariant 2: więcej białka',
      captionEn: 'Option 2: more protein',
      voPl: 'Drugi wariant: więcej białka, jedna pozycja więcej.',
      voEn: 'Option two: more protein, one more item.',
      edit: 'Split-compare with Wariant 1: 135 g vs 158 g of protein.',
    },
    eat: {
      shows: 'Back at Wariant 1; tap „Zjedzone” on „Obiad: kurczak, ryż i warzywa” — logged, a confirmation slides in.',
      captionPl: 'Obiad zjedzony — jedno stuknięcie',
      captionEn: 'Lunch eaten — one tap',
      voPl: 'Biorę pierwszy. Obiad z domu — zjedzone.',
      voEn: 'I take the first. Lunch from home — eaten.',
      edit: 'Zoom on the „Zjedzone” button as it is tapped.',
    },
    bars: {
      shows: 'Bilans dnia: „Zostało ok. 1010 kcal i 55 g białka” — Białko 93 z 148 g, Kalorie 1291 z 2300 kcal.',
      captionPl: 'Paski w górę: zostało 1010 kcal',
      captionEn: 'Bars up: 1010 kcal left',
      voPl: 'Paski w górę. Zostało tysiąc dziesięć kalorii.',
      voEn: 'The bars go up. 1010 calories left.',
      edit: 'Before/after: freeze 651 → 1291 kcal and 41 → 93 g for a split second.',
    },
    fits: {
      shows: '„Co teraz?” recalculated: „Zostało ok. 1010 kcal i 55 g białka”; „Wariant 1 · 1023 kcal z 1009 kcal · 105 g białka (z 55)” — twaróg z chlebem i szynką, nocna owsianka białkowa, jogurt proteinowy z borówkami.',
      captionPl: 'Reszta przeliczona — dalej się domyka',
      captionEn: 'The rest recalculated — still adds up',
      voPl: 'A reszta dnia przeliczona od nowa — i dalej się domyka.',
      voEn: 'And the rest of the day is laid out again — still adding up.',
      edit: 'Zoom on „1023 kcal z 1009 kcal”; closing card over the last 2 s.',
    },
  },
};
