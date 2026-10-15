import { open, section, tab } from '../lib/app';
import type { Scenario } from '../lib/types';

const WORKOUT = 'Góra — pchanie i ciągnięcie';

export const scenario: Scenario = {
  slug: '07-plan-pilnuje-terminow',
  title: 'A plan that keeps you on schedule',
  titlePl: 'Plan, który pilnuje terminów',
  needPl: 'Zawsze rzucam po dwóch tygodniach',
  needEn: 'I always quit after two weeks',
  persona: 'On-and-off trainee: starts strong every January, gone by February.',
  problem: 'Without dates, a plan is a wish. One missed day turns into a missed week, and the streak — and the habit — is gone.',
  solution:
    'The plan puts every session on a real date and keeps score: points, a rank, a streak, a journal of every session. A missed day is not a failure — the session waits and can be made up, marked „nadrobiony”.',
  keyMessagePl: 'Plan pilnuje terminów — i wybacza jeden gorszy dzień.',
  keyMessageEn: 'The plan keeps the dates — and forgives a bad day.',
  features: ['Dziś (today’s session)', 'Plan: weeks, points, rank, made-up sessions, journal'],
  clock: '2026-10-15T07:40:00+02:00',
  seed: 'full',
  hookPl: 'Tydzień 7. Zero opuszczonych.',
  hookEn: 'Week 7. Nothing missed.',
  ctaPl: 'GYM TRACKER — regularność bez spiny',
  ctaEn: 'GYM TRACKER — consistency without stress',
  music: 'Steady, motivating indie-electronic around 112 BPM; a lift when the week list expands.',
  async setup(page) {
    await open(page, '#/sesja');
  },
  async run(s) {
    const { page } = s;
    s.beat('today');
    await s.pause(3000);

    s.beat('plan');
    await s.tap(tab(page, 'Trening'), 'Trening', { after: 900 });
    await s.tap(section(page, 'Trening', 'Plan'), 'Plan', { after: 3400 });

    s.beat('points');
    await s.tap(page.getByText('Skąd te punkty', { exact: true }), 'Skąd te punkty', { after: 3200 });

    s.beat('weeks');
    await s.tap(page.getByRole('button', { name: /^Tydzień 4 / }), 'Tydzień 4', { after: 3600 });

    s.beat('journal');
    await s.reveal(page.getByRole('heading', { name: 'Dziennik', exact: true }), { block: 'start' });
    await s.pause(2400);
    await s.scroll(320, { ms: 1000 });
    await s.pause(1600);

    s.beat('go');
    await s.tap(tab(page, 'Dziś'), 'Dziś', { after: 1200 });
    await s.tap(page.getByRole('button', { name: `Zacznij: ${WORKOUT}` }), 'Zacznij trening', { after: 3000 });
  },
  beats: {
    today: {
      shows: 'Dziś, 7:40: „Dziś według planu — Góra — pchanie i ciągnięcie”, 170 points to take.',
      captionPl: 'Czwartek, 7:40. Dziś jest termin.',
      captionEn: 'Thursday, 7:40. Session day.',
      voPl: 'Czwartek rano. Dziś trening — sto siedemdziesiąt punktów.',
      voEn: 'Thursday morning. Workout today — 170 points.',
      edit: 'Hook caption here.',
    },
    plan: {
      shows: 'Trening → Plan: „Góra i dół — 60 dni”, week 7 of 9, 26 of 36 done, 100% adherence, rank „Etat na siłowni”, 4670 points.',
      captionPl: 'Tydzień 7 z 9 · realizacja 100%',
      captionEn: 'Week 7 of 9 · 100% on track',
      voPl: 'Siódmy tydzień z dziewięciu. Dwadzieścia sześć treningów, realizacja sto procent.',
      voEn: 'Week seven of nine. Twenty-six sessions, one hundred percent on track.',
      edit: 'Zoom on the header numbers and the rank.',
    },
    points: {
      shows: '„Skąd te punkty” opens: points for sessions on time, full weeks and badges.',
      captionPl: 'Punkty za regularność',
      captionEn: 'Points for consistency',
      voPl: 'Punkty są za regularność, nie za ciężar.',
      voEn: 'Points are for consistency, not for the weight.',
    },
    weeks: {
      shows: 'Week 4 opens: four sessions, one „nadrobiony 1 dzień po terminie ↺”.',
      captionPl: 'Gorszy dzień? Nadrobisz.',
      captionEn: 'Bad day? Make it up.',
      voPl: 'A gdy coś wypadnie, trening czeka. Ten tutaj nadrobiony dzień później.',
      voEn: 'When life gets in the way, the session waits. This one was made up a day later.',
      edit: 'Highlight „nadrobiony ↺”.',
    },
    journal: {
      shows: 'Journal: sessions „w terminie +100”, „Tydzień 6 zamknięty w komplecie +150”, badges with dates.',
      captionPl: 'Każdy termin zostawia ślad',
      captionEn: 'Every session leaves a trace',
      voPl: 'Każdy termin zostawia ślad w dzienniku.',
      voEn: 'Every session leaves a trace in the journal.',
    },
    go: {
      shows: 'Back to Dziś, tap „Zacznij” — today’s session opens.',
      captionPl: 'Do roboty',
      captionEn: 'Let’s go',
      voPl: 'No to do roboty.',
      voEn: 'Time to train.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
