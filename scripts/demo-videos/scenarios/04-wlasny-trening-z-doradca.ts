import type { Locator } from 'playwright';
import { open } from '../lib/app';
import type { Scene } from '../lib/scene';
import type { Scenario } from '../lib/types';

/** Types into „dodaj ćwiczenie” and picks the exercise from the list. */
async function add(s: Scene, typed: string, option: RegExp, label: string) {
  const field: Locator = s.page.getByRole('combobox', { name: 'dodaj ćwiczenie' });
  await s.type(field, typed, { delay: 85, after: 450 });
  await s.tap(s.page.getByRole('option', { name: option }).first(), label, { after: 900 });
}

export const scenario: Scenario = {
  slug: '04-wlasny-trening-z-doradca',
  title: 'Your own workout, checked as you build it',
  titlePl: 'Własny trening z doradcą',
  needPl: 'Chcę własny trening, ale czy on ma sens?',
  needEn: 'I want my own workout — but does it make sense?',
  persona: 'Experienced lifter who likes control and builds sessions by hand.',
  problem:
    'Home-made routines often overload one muscle, skip another or put isolation before the heavy lifts — and nobody tells you.',
  solution:
    'The workout creator counts sets per muscle group live, estimates time, and an advisor flags problems in plain words — like the wrong order — and fixes it with one tap.',
  keyMessagePl: 'Układasz po swojemu — doradca pilnuje zasad.',
  keyMessageEn: 'Build it your way — the advisor keeps it sound.',
  features: ['Treningi (workout library)', 'Workout creator: exercise search, sets per muscle, advisor, order by the rules'],
  clock: '2026-10-15T20:45:00+02:00',
  seed: 'full',
  hookPl: 'Twój trening. Ma sens?',
  hookEn: 'Your workout. Does it add up?',
  ctaPl: 'GYM TRACKER — trening po swojemu, z głową',
  ctaEn: 'GYM TRACKER — your way, done right',
  music: 'Minimal tech/house groove around 118 BPM; a click on each exercise added.',
  async setup(page) {
    await open(page, '#/treningi');
  },
  async run(s) {
    const { page } = s;
    s.beat('library');
    await s.pause(1800);
    await s.tap(page.getByRole('button', { name: 'Ułóż własny trening' }), 'Ułóż własny trening', { after: 1200 });

    s.beat('name');
    await s.type(page.getByRole('textbox', { name: 'nazwa' }), 'Klatka — sobota', { delay: 80, after: 300 });
    await s.choose(page.getByRole('combobox', { name: 'rodzaj' }), 'Klatka', 'rodzaj: Klatka');

    s.beat('add');
    await add(s, 'rozpi', /^Rozpiętki na wyciągach/, 'Rozpiętki na wyciągach');
    await add(s, 'wyciskanie le', /^Wyciskanie leżąc/, 'Wyciskanie leżąc');
    await add(s, 'skos', /^Wyciskanie na skosie/, 'Wyciskanie na skosie');

    s.beat('advisor');
    await s.reveal(page.getByRole('heading', { name: /^Doradca/ }), { block: 'start' });
    await s.pause(3600);

    s.beat('order');
    await s.tap(page.getByRole('button', { name: 'Ułóż kolejność według zasad' }), 'Ułóż kolejność według zasad', {
      after: 900,
    });
    await s.reveal(page.getByRole('group', { name: 'Jak robić ćwiczenia' }), { block: 'start' });
    await s.pause(1800);
    await s.reveal(page.getByRole('heading', { name: /^Doradca/ }), { block: 'start' });
    await s.pause(2400);

    s.beat('save');
    await s.tap(page.getByRole('button', { name: 'Zapisz trening' }), 'Zapisz trening', { after: 2800 });
  },
  beats: {
    library: {
      shows: 'Workout library; tap „Ułóż własny trening”.',
      captionPl: 'Własny trening od zera',
      captionEn: 'Your own workout from scratch',
      voPl: 'Gotowe treningi są — ale dziś układam własny.',
      voEn: 'There are ready workouts — but today I build my own.',
      edit: 'Hook caption here.',
    },
    name: {
      shows: 'Name „Klatka — sobota”, type of workout „Klatka”. The advisor waits for the first exercise.',
      captionPl: 'Nazwa i rodzaj treningu',
      captionEn: 'Name and type',
      voPl: 'Nazwa, rodzaj: klatka.',
      voEn: 'A name, and the type: chest.',
      edit: 'Can be sped up 1.5× (typing).',
    },
    add: {
      shows: 'Three exercises added by typing a few letters: Rozpiętki na wyciągach, Wyciskanie leżąc, Wyciskanie na skosie.',
      captionPl: 'Kilka liter — i jest',
      captionEn: 'A few letters — found',
      voPl: 'Rozpiętki, wyciskanie leżąc, wyciskanie na skosie.',
      voEn: 'Cable flyes, bench press, incline press.',
      edit: 'Can be sped up 1.5× (typing).',
    },
    advisor: {
      shows: 'Advisor: sets and minutes, „Kolejność do poprawki” with the reason and a proposed order; per-muscle set bars.',
      captionPl: 'Doradca: kolejność do poprawki',
      captionEn: 'Advisor: fix the order',
      voPl: 'Doradca liczy serie na partie i mówi wprost: izolacja nie na początek.',
      voEn: 'The advisor counts sets per muscle and says it: isolation doesn’t go first.',
      edit: 'Zoom on „Kolejność do poprawki”, then on the bars.',
    },
    order: {
      shows: 'Tap „Ułóż kolejność według zasad”: the list reorders (Wyciskanie leżąc first, flyes last); the advisor turns to „Trening trzyma się zasad”.',
      captionPl: 'Jedno stuknięcie — poprawione',
      captionEn: 'One tap — fixed',
      voPl: 'Jedno stuknięcie i kolejność jest według zasad.',
      voEn: 'One tap, and the order follows the rules.',
      edit: 'Highlight the new first exercise.',
    },
    save: {
      shows: 'Tap „Zapisz trening”: the workout is saved among „Twoje”.',
      captionPl: 'Zapisane w Twoich treningach',
      captionEn: 'Saved to your workouts',
      voPl: 'Zapisane. Silnik progresji poprowadzi go dalej jak każdy inny.',
      voEn: 'Saved. The progression engine runs it like any other.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
