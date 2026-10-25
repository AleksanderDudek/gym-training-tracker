import { open, tab } from '../lib/app';
import type { Scenario } from '../lib/types';

const NAME = 'Niedzielne gotowanie';
/**
 * „Ułóż plan” draws its recipes with Math.random (a new seed per plan). The take fixes the draw, so
 * every recording shows the same plan — the one the copy below describes (Kurczak curry on Sunday).
 */
const PLAN_SEED = 1;

export const scenario: Scenario = {
  slug: '15-plan-z-zakupami',
  title: 'Sunday meal prep with a shopping list',
  titlePl: 'Plan z zakupami: gotuję w niedzielę na kilka dni',
  needPl: 'Chcę ugotować w niedzielę na kilka dni i wiedzieć dokładnie, co kupić.',
  needEn: 'I want to cook on Sunday for several days and know exactly what to buy.',
  persona: 'Busy person on a cut who preps lunch boxes on Sunday and does one shop a week at Biedronka.',
  problem:
    'Meal prep breaks down at the planning stage: which dishes, how much of each so every day lands on the calorie target, and a shopping list that forgets nothing.',
  solution:
    'The meal-prep planner builds a 7-day plan for one store’s basket and the day’s target: batch dishes cooked ahead (at most 4 days in the fridge), portions and sides tuned to the goal, a shopping list grouped by aisle. The named plan goes straight into the diary, where its days show the planned meals and what to cook.',
  keyMessagePl: 'Tydzień jedzenia pod Twój cel — z listą zakupów z jednego sklepu.',
  keyMessageEn: 'A week of food for your goal — with a shopping list from one store.',
  features: [
    'Jedzenie → Plan posiłków: „Plan z listą zakupów” form (start, store, name, goal)',
    'Plan view: summary, „Gotowanie na zapas” (boxes per session)',
    'Lista zakupów: one shop visit, grouped by aisle',
    'Dziennik: „Plan na ten dzień” with the plan’s name, „Dziś gotujesz”, planned meals',
  ],
  clock: '2026-10-15T19:30:00+02:00',
  seed: 'full',
  hookPl: 'Gotuję w niedzielę. Co kupić?',
  hookEn: 'Cooking on Sunday. What do I buy?',
  ctaPl: 'GYM TRACKER — plan posiłków z listą zakupów',
  ctaEn: 'GYM TRACKER — meal plans with a shopping list',
  music: 'Easy, upbeat kitchen funk around 100 BPM; light chops on each tap.',
  async setup(page) {
    await open(page, '#/jedzenie/plan');
    // The form waits for the product base; the plan is made from real products.
    await page.getByRole('button', { name: 'Ułóż plan' }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.evaluate((seed) => {
      let a = seed >>> 0;
      Math.random = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, PLAN_SEED);
  },
  async run(s) {
    const { page } = s;
    s.beat('form');
    await s.pause(1300);
    await s.choose(page.getByRole('combobox', { name: 'Od kiedy' }), 'niedz., 18 paź', 'Od kiedy: niedziela', { after: 800 });
    await s.choose(page.getByRole('combobox', { name: 'Sklep (jedna wizyta)' }), 'Biedronka', 'Sklep: Biedronka', {
      after: 1000,
    });

    s.beat('goal');
    await s.type(page.getByRole('textbox', { name: 'Nazwa planu (nieobowiązkowa)' }), NAME, { delay: 65, after: 500 });
    await s.reveal(page.getByRole('region', { name: 'Cel planu' }), { block: 'center' });
    await s.pause(1400);
    await s.tap(page.getByRole('button', { name: 'Ułóż plan' }), 'Ułóż plan', { after: 400 });

    s.beat('plan');
    await page.getByRole('region', { name: NAME }).waitFor();
    await s.pause(3000);

    s.beat('cook');
    await s.reveal(page.getByRole('heading', { name: 'Gotowanie na zapas' }), { block: 'start', ms: 1000 });
    await s.pause(3300);

    s.beat('list');
    await s.tap(page.getByRole('link', { name: /^Lista zakupów/ }), 'Lista zakupów', { after: 1700 });
    await s.scroll(420, { ms: 1000 });
    await s.pause(1200);
    await s.scroll(520, { ms: 1000 });
    await s.pause(800);

    s.beat('diary');
    await s.tap(tab(page, 'Jedzenie'), 'Jedzenie', { after: 900 });
    const next = page.getByRole('button', { name: 'Następny dzień' });
    for (let i = 0; i < 3; i++) await s.tap(next, 'Następny dzień', { before: 120, after: 350 });
    await s.pause(300);
    await s.reveal(page.getByRole('region', { name: /^Plan na ten dzień/ }), { block: 'start', ms: 900 });
    await s.pause(1900);
    await s.scroll(330, { ms: 900 });
    await s.pause(2400);
  },
  beats: {
    form: {
      shows:
        'Jedzenie → Plan posiłków on Thursday 19:30: the form „Plan z listą zakupów”; „Od kiedy” set to „niedz., 18 paź” (7 days), „Sklep (jedna wizyta)” set to Biedronka.',
      captionPl: 'Od niedzieli, zakupy w Biedronce',
      captionEn: 'From Sunday, shopping at Biedronka',
      voPl: 'Czwartek wieczór. Gotuję w niedzielę, zakupy robię tylko w Biedronce.',
      voEn: 'Thursday night. I cook on Sunday and shop only at Biedronka.',
      edit: 'Hook caption here; zoom on the two fields as they change.',
    },
    goal: {
      shows:
        'Type the plan name „Niedzielne gotowanie”; the goal box below: „Redukcja · −0,5 kg/tydz. · 2300 kcal dziennie · Sportowa · białko 148 g”; tap „Ułóż plan”.',
      captionPl: 'Pod Twój cel: 2300 kcal',
      captionEn: 'For your goal: 2300 kcal',
      voPl: 'Nazywam plan. Cel bierze z mojej redukcji: dwa tysiące trzysta kalorii.',
      voEn: 'I name the plan. The goal comes from my cut: 2,300 calories.',
      edit: 'Highlight the goal line „Redukcja · … 2300 kcal dziennie”.',
    },
    plan: {
      shows:
        'The plan „Niedzielne gotowanie”: 7 days, 18–24 paź · zakupy: Biedronka · 4 posiłki dziennie; „Średni dzień planu: 2294 kcal · B 188 · W 244 · T 60 g”; toast „Plan na 7 dni gotowy — lista zakupów czeka.”',
      captionPl: '7 dni, średnio 2294 kcal',
      captionEn: '7 days, 2294 kcal on average',
      voPl: 'Siedem dni gotowe — każdy blisko celu.',
      voEn: 'Seven days, done — each one close to the goal.',
      edit: 'Zoom on „Średni dzień planu: 2294 kcal · B 188”.',
    },
    cook: {
      shows:
        '„Gotowanie na zapas”: niedz., 18 paź — Kurczak curry na skyrze ze szpinakiem, 3 porcje, 4 pudełka po ¾ porcji + 125 g ryżu, niedz.–śr.; czw., 22 paź — Szaszłyki z indyka, 3 pudełka, czw.–sob.',
      captionPl: 'Niedziela: curry na 4 pudełka',
      captionEn: 'Sunday: curry for 4 boxes',
      voPl: 'W niedzielę curry na cztery pudełka, w czwartek drugie danie.',
      voEn: 'On Sunday, curry for four boxes; on Thursday, a second dish.',
      edit: 'Zoom on „4 pudełka po ¾ porcji … niedz.–śr.”.',
    },
    list: {
      shows:
        'Lista zakupów „Zakupy na 18–24 paź”, „Kupione 0 z 32”: „Biedronka — wizyta w sklepie” grouped by aisle (Warzywa i owoce, Pieczywo, Nabiał i jajka…), with amounts and packs.',
      captionPl: 'Lista zakupów według alejek',
      captionEn: 'Shopping list by aisle',
      voPl: 'I lista zakupów: trzydzieści dwie pozycje, po kolei, jak idę przez sklep.',
      voEn: 'And the shopping list: thirty-two items, in the order I walk the store.',
      edit: 'Zoom on „Kupione 0 z 32”, then follow the aisle headings while scrolling.',
    },
    diary: {
      shows:
        'Jedzenie → Dziennik, three taps on „Następny dzień” to Sunday 18 Oct: „Plan na ten dzień · Niedzielne gotowanie · dzień 1 z 7”, „Dziś gotujesz: Kurczak curry…: 3 porcje, 4 pudełka”, the four planned meals with „Zjedzone”, „Plan: 2287 kcal” against the day’s 2300 kcal.',
      captionPl: 'Niedziela już w dzienniku',
      captionEn: 'Sunday is already in the diary',
      voPl: 'A plan sam trafia do dziennika. W niedzielę wiem, co gotuję i co jem.',
      voEn: 'And the plan goes straight into the diary. On Sunday I know what I cook and what I eat.',
      edit: 'Highlight the plan name and „Dziś gotujesz”; closing card over the last 2 s.',
    },
  },
};
