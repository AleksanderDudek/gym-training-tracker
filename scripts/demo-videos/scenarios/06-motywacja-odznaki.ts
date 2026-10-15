import { open, tab } from '../lib/app';
import type { Scenario } from '../lib/types';

export const scenario: Scenario = {
  slug: '06-motywacja-odznaki',
  title: 'Motivation you can see',
  titlePl: 'Motywacja, którą widać',
  needPl: 'Potrzebuję motywacji, żeby nie odpuścić',
  needEn: 'I need motivation not to give up',
  persona: 'Someone who keeps going when progress is visible — streaks, trophies, levels.',
  problem: 'Strength gains are slow and invisible week to week; without visible wins, motivation fades.',
  solution:
    'Everything you do earns experience and badges with real dates: a trophy shelf of materials from bronze to emerald, numbers in human terms, the badges nearest to unlock, and a gorilla character that levels up with you.',
  keyMessagePl: 'Każdy trening zostawia ślad, który widać.',
  keyMessageEn: 'Every workout leaves a mark you can see.',
  features: ['Dziś: level strip', 'Osiągnięcia: shelf, numbers, nearest badges, badge families', 'Profil: character and level'],
  clock: '2026-10-15T20:30:00+02:00',
  seed: 'full',
  hookPl: '7 tygodni. 166 ton.',
  hookEn: '7 weeks. 166 tonnes.',
  ctaPl: 'GYM TRACKER — postęp, który widać',
  ctaEn: 'GYM TRACKER — progress you can see',
  music: 'Epic-light orchestral pop around 105 BPM; build-up toward the character reveal.',
  async setup(page) {
    await open(page, '#/sesja');
  },
  async run(s) {
    const { page } = s;
    s.beat('level');
    await s.pause(2200);

    s.beat('shelf');
    await s.tap(tab(page, 'Osiągnięcia'), 'Osiągnięcia', { after: 3600 });

    s.beat('numbers');
    await s.reveal(page.getByRole('heading', { name: 'W liczbach' }), { block: 'start' });
    await s.pause(3700);

    s.beat('next');
    await s.reveal(page.getByRole('heading', { name: 'Najbliżej zdobycia' }), { block: 'start' });
    await s.pause(3200);

    s.beat('family');
    await s.tap(page.getByRole('button', { name: /^Szczyty / }), 'Szczyty', { after: 1800 });
    await s.scroll(420, { ms: 1100 });
    await s.pause(1900);

    s.beat('character');
    await s.tap(tab(page, 'Profil'), 'Profil', { after: 3800 });

    s.beat('history');
    await s.scroll(560, { ms: 1200 });
    await s.pause(3200);
  },
  beats: {
    level: {
      shows: 'Dziś: the level strip „poziom 16 · Srebrny grzbiet”, 760 XP to the next level.',
      captionPl: 'Poziom 16: Srebrny grzbiet',
      captionEn: 'Level 16: Silverback',
      voPl: 'Siedem tygodni. Poziom szesnasty.',
      voEn: 'Seven weeks. Level sixteen.',
      edit: 'Hook caption here; zoom on the level strip.',
    },
    shelf: {
      shows: 'Osiągnięcia: the trophy shelf — emerald, platinum and gold badges in front.',
      captionPl: 'Półka z trofeami',
      captionEn: 'The trophy shelf',
      voPl: 'Na półce najmocniejsze odznaki — od brązu po szmaragd.',
      voEn: 'The shelf shows the best badges — bronze up to emerald.',
      edit: 'Slow pan across the shelf.',
    },
    numbers: {
      shows: '„W liczbach”: 27 workouts, 5483 reps, 343 sets, 166.9 t — „Tonaż to mniej więcej 3 czołgi”.',
      captionPl: '166,9 tony = 3 czołgi',
      captionEn: '166.9 tonnes = 3 tanks',
      voPl: 'Sto sześćdziesiąt sześć ton. Mniej więcej trzy czołgi.',
      voEn: 'A hundred and sixty-six tonnes. Roughly three tanks.',
      edit: 'Zoom on the tank line — it’s the laugh.',
    },
    next: {
      shows: '„Najbliżej zdobycia”: five thresholds with progress bars („brakuje 5”, „brakuje 1 min”…).',
      captionPl: 'Co zdobędziesz najszybciej',
      captionEn: 'What you’ll unlock next',
      voPl: 'A tu: co da się zdobyć najszybciej. Czasem brakuje jednej minuty.',
      voEn: 'And here: what’s closest. Sometimes it’s one minute away.',
    },
    family: {
      shows: 'Badge family „Szczyty” opens: medals with tiers, dates and witty lines.',
      captionPl: '430 odznak w rodzinach',
      captionEn: '430 badges in families',
      voPl: 'Każda odznaka ma progi, daty i swoją puentę.',
      voEn: 'Every badge has tiers, dates and its own punchline.',
    },
    character: {
      shows: 'Profil: the gorilla character Gustaw, „Poziom 16 · Srebrny grzbiet”, XP sources.',
      captionPl: 'Postać rośnie razem z Tobą',
      captionEn: 'Your character grows with you',
      voPl: 'I postać, która rośnie razem ze mną.',
      voEn: 'And a character that grows with me.',
      edit: 'Zoom on the gorilla; hold.',
    },
    history: {
      shows: 'Profil numbers and the weight chart from 30 weigh-ins.',
      captionPl: 'Wszystko w jednym miejscu',
      captionEn: 'All in one place',
      voPl: 'Wszystko policzone w jednym miejscu — bez konta.',
      voEn: 'Everything counted in one place — no account needed.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
