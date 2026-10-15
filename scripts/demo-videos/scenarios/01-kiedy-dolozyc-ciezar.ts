import { open, progress } from '../lib/app';
import type { Scenario } from '../lib/types';

const WORKOUT = 'Góra — pchanie i ciągnięcie';

export const scenario: Scenario = {
  slug: '01-kiedy-dolozyc-ciezar',
  title: 'When to add weight — the app decides',
  titlePl: 'Kiedy dołożyć ciężaru — decyduje aplikacja',
  needPl: 'Nie wiem, kiedy dołożyć ciężaru',
  needEn: "I never know when it's time to go heavier",
  persona: 'Gym regular, 7 weeks into a plan, stuck at the same weights for months before.',
  problem:
    'Most people repeat the same weights for months: going heavier too early hurts, too late wastes the work. Spreadsheets and memory do not tell you when.',
  solution:
    'Every set comes pre-filled with today’s target. After the last set the app asks how much was left in the tank and decides: more reps, or a heavier weight — first in one set only, so the jump is safe.',
  keyMessagePl: 'Robisz serie. Aplikacja decyduje, kiedy ciężej.',
  keyMessageEn: 'You do the sets. The app decides when to go heavier.',
  features: ['Dziś (today’s planned session)', 'Guided session: set, rest timer, effort question', 'Session summary'],
  clock: '2026-10-15T18:20:00+02:00',
  seed: 'full',
  // The bench is at the top of its rep range (3 × 10 at 60 kg): a solid session moves it up.
  patch: (state) => {
    const p = progress(state, 'bench');
    Object.assign(p, { target: 10, weight: 60, trans: null, stalls: 0, probe: false });
    const hist = p.hist as { d: string; w: number | null; reps: number[]; eff: string; e1rm: number | null }[];
    hist[hist.length - 1] = { d: '2026-10-12', w: 60, reps: [10, 10, 9], eff: 'solid', e1rm: 79.2 };
  },
  hookPl: 'Kiedy dołożyć ciężaru?',
  hookEn: 'When should you go heavier?',
  ctaPl: 'GYM TRACKER — progres bez zgadywania',
  ctaEn: 'GYM TRACKER — progress without guesswork',
  music: 'Driving, confident electronic beat around 110 BPM; a short riser under the summary at the end.',
  async setup(page) {
    await open(page, '#/sesja');
  },
  async run(s) {
    const { page } = s;
    s.beat('today');
    await s.pause(2600);

    s.beat('start');
    await s.tap(page.getByRole('button', { name: `Zacznij: ${WORKOUT}` }), 'Zacznij trening', { after: 2600 });
    await s.tap(page.getByRole('button', { name: 'Zaczynam' }), 'Zaczynam', { after: 900 });

    s.beat('set');
    await s.pause(2900);
    await s.tap(page.getByRole('button', { name: 'Zrobione' }), 'Zrobione — seria 1');

    s.beat('rest');
    await s.pause(2000);
    // Cięcie czasu: przerwa mija w sekundę zamiast dwóch minut.
    await page.clock.fastForward('01:48');
    await s.pause(1300);
    await s.tap(page.getByRole('button', { name: 'Pomiń przerwę' }), 'Pomiń przerwę', { after: 600 });

    s.beat('sets');
    await s.tap(page.getByRole('button', { name: 'Zrobione' }), 'Zrobione — seria 2', { after: 500 });
    await page.clock.fastForward('01:55');
    await s.tap(page.getByRole('button', { name: 'Pomiń przerwę' }), 'Pomiń przerwę', { after: 500 });
    await s.tap(page.getByRole('button', { name: 'Zrobione' }), 'Zrobione — seria 3', { after: 900 });

    s.beat('effort');
    await s.pause(1500);
    await s.tap(page.getByRole('button', { name: /^Solidnie/ }), 'Solidnie — zostały 1–2', { after: 900 });

    s.beat('close');
    await page.clock.fastForward('02:10');
    await s.tap(page.getByRole('button', { name: 'Zamknij trening' }), 'Zamknij trening', { after: 1200 });
    await s.tap(page.getByRole('button', { name: 'Zamknij i przelicz' }), 'Zamknij i przelicz', { after: 400 });

    s.beat('result');
    await page.getByText(/wchodzi do pierwszej serii/).waitFor();
    await s.pause(6000);
  },
  beats: {
    today: {
      shows: 'Dziś screen: today’s session from the plan, „Góra — pchanie i ciągnięcie”, with its exercises and points.',
      captionPl: 'Plan wie, co dziś trenujesz',
      captionEn: 'Your plan knows today’s workout',
      voPl: 'Osiemnasta. Plan ma dziś górę.',
      voEn: 'Six p.m. Upper body today.',
      edit: 'Hook caption over this beat. Slow push-in on the „Dziś według planu” card.',
    },
    start: {
      shows: 'Tap „Zacznij”, then the pre-session screen (what to prepare, warm-up), tap „Zaczynam”.',
      captionPl: 'Jedno stuknięcie i start',
      captionEn: 'One tap to start',
      voPl: 'Jedno stuknięcie — i aplikacja prowadzi przez trening.',
      voEn: 'One tap, and the app walks you through it.',
    },
    set: {
      shows: 'First set of the bench press, already filled in: 10 reps at 60 kg. Tap „Zrobione”.',
      captionPl: 'Cel serii jest już wpisany',
      captionEn: 'Each set comes pre-filled',
      voPl: 'Każda seria ma gotowy cel: dziesięć powtórzeń, sześćdziesiąt kilo.',
      voEn: 'Every set has its target filled in: ten reps, sixty kilos.',
      edit: 'Zoom to the set card (reps + weight) for ~1.5 s.',
    },
    rest: {
      shows: 'Rest countdown with its bar, „+30 s” and „Pomiń przerwę”. The clock jumps ~1:48 (time cut), then the rest is skipped.',
      captionPl: 'Przerwa odlicza się sama',
      captionEn: 'Rest is timed for you',
      voPl: 'Przerwa odlicza się sama, telefon zapika na koniec.',
      voEn: 'The rest counts down by itself and beeps when it’s over.',
      edit: 'TIME CUT inside this beat: add a quick fast-forward cue (⏩ 2:00) where the timer jumps.',
    },
    sets: {
      shows: 'Sets two and three logged with „Zrobione”; the rest between them is skipped (another time cut).',
      captionPl: 'Seria po serii',
      captionEn: 'Set after set',
      voPl: 'Druga seria, trzecia.',
      voEn: 'Second set, third.',
      edit: 'Can be sped up 1.5× if the edit runs long.',
    },
    effort: {
      shows: 'Effort question after the last set: „Łatwo / Solidnie / Na maksa” — tap „Solidnie (zostały 1–2)”.',
      captionPl: 'Ile zostało w zapasie?',
      captionEn: 'How much was left in the tank?',
      voPl: 'Na koniec jedno pytanie: ile zostało w zapasie?',
      voEn: 'Then one question: how much was left in the tank?',
      edit: 'Highlight the three answers; pulse on „Solidnie”.',
    },
    close: {
      shows: 'Tap „Zamknij trening”, confirm „Zamknij i przelicz”.',
      captionPl: 'Zamknij i przelicz',
      captionEn: 'Close and recalculate',
      voPl: 'Zamykam trening.',
      voEn: 'Close the session.',
    },
    result: {
      shows: 'Summary: „Zmiany na kolejną sesję — Wyciskanie leżąc: 70 kg wchodzi do pierwszej serii…”, time, XP and kcal.',
      captionPl: 'Następnym razem: 70 kg',
      captionEn: 'Next time: 70 kg',
      voPl: 'I decyzja: siedemdziesiąt kilo wchodzi do pierwszej serii. Bez zgadywania.',
      voEn: 'And the call: seventy kilos goes into the first set. No guesswork.',
      edit: 'Zoom on the „Zmiany na kolejną sesję” line, hold; closing card over the last 2 s.',
    },
  },
};
