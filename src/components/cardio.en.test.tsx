// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { freshState } from '../engine/plan';
import { addCardio, inputProblem } from '../engine/cardio';
import { addSnack } from '../engine/snacks';
import { setBodyWeight } from '../engine/body';
import { mergeWatch, parsePayload } from '../engine/watch';
import { mergePhone, parsePhonePayload } from '../engine/phone';
import { addDays, dayKey } from '../engine/schedule';
import { reminderItems } from '../engine/reminders';
import { ACHIEVEMENTS, GROUP_LABEL, GROUP_NOTE, achCtx, achievementById, formatTier, syncBadges } from '../engine/badges';
import { EX_DEFS, EX_QUIPS, KIND_NOW, KIND_TITLE } from '../engine/exbadges';
import { LEVEL_TITLES, levelFor } from '../engine/xp';
import { profileOf } from '../engine/energy';
import { ALL } from '../data/exercises';
import { BodyCard, CardioCard, CardioEntry, CardioPage, CardioSummary, cardioLabel, stepsDetail, stepsText } from './Cardio';
import { SnackCard, SnackEntry, SnacksPage } from './Snacks';
import { WeighCard } from './Weigh';
import { Achievements } from './Achievements';
import type { AppState, CardioInput, LogEntry } from '../types';

/**
 * Kroki i cardio, przekąski ruchowe, ważenie i odznaki po angielsku. Nazwy ćwiczeń, notki
 * o zdrowiu i żarty tłumaczą inne części aplikacji, więc test sprawdza konkretne angielskie
 * zdania tych ekranów i brak ich polskich odpowiedników, a nie całą stronę bez polskich liter.
 */

const POLISH = /[ąćęłńóśźż]/i;
const now = Date.now();
const today = dayKey(now);

const entry = (date: string, id = 'swing2', reps = 10, w = 16): LogEntry => ({
  date: `${date}T18:00:00.000Z`,
  workout: 'A',
  ready: 'ok',
  items: [{ id, sets: [{ reps, w }, { reps, w }], effort: 'solid' }],
});

function richState(): AppState {
  const s = freshState();
  s.cfg.height = 180;
  setBodyWeight(s, 82.4, addDays(today, -14));
  setBodyWeight(s, 82, addDays(today, -9));
  setBodyWeight(s, 81.6, addDays(today, -5));
  setBodyWeight(s, 81.2, addDays(today, -2));
  addCardio(s, { kind: 'steps', steps: 9421 }, addDays(today, -1), now - 86_400_000);
  addCardio(s, { kind: 'treadmill', kmh: 6.5, min: 30, grade: 3 }, today, now - 3_600_000);
  addCardio(s, { kind: 'bike', kmh: 22, min: 45 }, addDays(today, -2), now - 2 * 86_400_000);
  addCardio(s, { kind: 'ergo', watts: 140, min: 40 }, addDays(today, -3), now - 3 * 86_400_000);
  addCardio(s, { kind: 'dance', style: 'pair', mix: 'half', min: 60 }, addDays(today, -4), now - 4 * 86_400_000);
  addCardio(s, { kind: 'steps', steps: 3000 }, today, now - 1_800_000);
  const t = Math.floor(now / 1000) - 60;
  mergeWatch(
    s,
    parsePayload(
      {
        v: 1,
        t,
        d: [[addDays(today, -5), 12000, 9800, 10, 60]],
        a: [],
        h: [[addDays(today, -1), 52, 48, 71, 142, 30, 20, 80, 75]],
      },
      now,
    )!,
    new Date(now),
  );
  mergePhone(
    s,
    parsePhonePayload(
      {
        v: 1,
        k: 'phone',
        os: 'ios',
        t,
        d: [{ day: addDays(today, -6), steps: 10000, rhr: 55, hrMin: 50, hrAvg: 70, hrMax: 130, sleep: 420, kg: 81.9 }],
        a: [],
      },
      now,
    )!,
    new Date(now),
  );
  addSnack(s, 'squat_air', 15, null, now - 60_000);
  addSnack(s, 'squat_air', 20, null, now - 30_000);
  addSnack(s, 'plank', 45, null, now - 2 * 86_400_000);
  s.log = [entry(addDays(today, -6)), entry(addDays(today, -4), 'squat_air', 20, 0), entry(addDays(today, -2))];
  syncBadges(s, achCtx(s, null, null, today));
  return s;
}

describe('steps & cardio in English', () => {
  it('the steps & cardio screen: today, the week and how we count', () => {
    render(<CardioPage state={richState()} onDelete={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Log' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Last seven days')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.getByText(/^This week: \d+ (of the 150 movement minutes the WHO recommends|movement minutes — WHO guideline)/)).toBeInTheDocument();
    expect(screen.getByText('Treadmill 6.5 km/h · 30 min · 3%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete entry: Treadmill 6.5 km/h · 30 min · 3%' })).toBeInTheDocument();
    expect(screen.getByText('From your watch')).toBeInTheDocument();
    expect(screen.getByText(/^resting heart rate 52 · heart rate 48–142, average 71 · stress 30/)).toBeInTheDocument();
    expect(screen.getByText('From your phone')).toBeInTheDocument();
    expect(screen.getByText('resting heart rate 55 · heart rate 50–130, average 70 · sleep 7 h · weight 81.9 kg')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Calories from movement in the last seven days' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How we count calories and movement minutes' })).toBeInTheDocument();
    expect(screen.getByText(/the Compendium of Physical Activities 2024 table \(codes 01018–01060\)/)).toBeInTheDocument();
    expect(screen.getByText(/partner dancing 4\.8 MET \(salsa, code 03090\)/)).toBeInTheDocument();
    expect(screen.getByText(/The WHO recommends 150–300 minutes of moderate activity/)).toBeInTheDocument();
    expect(screen.getByText(/the surplus above 5,000 counts/)).toBeInTheDocument();
    for (const pl of ['Jak liczymy kalorie i minuty ruchu', 'Ostatnie siedem dni', 'Wcześniej', 'Z zegarka', 'Z telefonu', 'Wpisz']) {
      expect(screen.queryByText(pl)).not.toBeInTheDocument();
    }
    // Notki o zdrowiu pod liczbami należą do ekranu zdrowia — tu tylko zdania tego ekranu.
    expect(document.body.textContent).not.toMatch(/Bieżnia|Rower|Kalorie|minut ruchu|średnio |tętno \d|sen \d/);
  });

  it('the cardio form: labels, live preview and validation toasts', async () => {
    const user = userEvent.setup();
    const onToast = vi.fn();
    render(<CardioEntry state={freshState()} sport="dance" onLog={vi.fn()} onToast={onToast} />);
    expect(screen.getByRole('group', { name: 'Kind of movement' })).toHaveTextContent('StepsTreadmillBikeDance');
    expect(screen.getByRole('group', { name: 'How much of the class is dancing and how much is instruction' })).toHaveTextContent(
      'Dancing throughout80–90% dancingHalf and halfhalf dancingLots of instruction20–30% dancing',
    );
    expect(screen.getByRole('group', { name: 'Day' })).toHaveTextContent('TodayYesterdayAnother day');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onToast).toHaveBeenLastCalledWith('Enter how long the class was.');
    await user.type(screen.getByLabelText('length of the whole class, min'), '60');
    expect(screen.getByText('I’ll show calories once you enter your weight. I’ll save the movement without it, too.')).toBeInTheDocument();
    expect(screen.getByText(/^about 30 min of dancing, the rest is listening · 3\.2 MET on average$/)).toBeInTheDocument();
    expect(screen.getByText('30 movement min — only the dancing counts, not the instruction')).toBeInTheDocument();
    await user.type(screen.getByLabelText('your weight, kg — calories are worked out from it'), '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onToast).toHaveBeenLastCalledWith('Weight from 30 to 300 kg — check the number.');
  });

  it('the treadmill form says what the treadmill shows', async () => {
    const user = userEvent.setup();
    render(<CardioEntry state={richState()} sport="treadmill" onLog={vi.fn()} onToast={vi.fn()} />);
    expect(screen.getByText(/^Average speed and time from the treadmill display/)).toBeInTheDocument();
    expect(screen.getByLabelText('average speed, km/h')).toHaveAttribute('placeholder', 'last time 6.5');
    await user.type(screen.getByLabelText('average speed, km/h'), '6');
    await user.type(screen.getByLabelText('time, min'), '30');
    expect(screen.getByText(/^above resting · ≈ \d+ kcal including resting — the number the treadmill usually shows$/)).toBeInTheDocument();
    expect(screen.getByText(/^3\.0 km · brisk walk or jog · \d\.\d MET$/)).toBeInTheDocument();
  });

  it('the watch link on the steps screen and form, and what a chosen model lacks', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    try {
      const { CardioPage: Page, CardioEntry: Entry } = await import('./Cardio');
      const page = render(<Page state={freshState()} onDelete={vi.fn()} />);
      expect(screen.getByRole('link', { name: 'Got a watch? Check whether your steps can arrive by themselves →' })).toHaveAttribute(
        'href',
        '#/zegarek',
      );
      expect(screen.getByRole('button', { name: 'Don’t show again' })).toBeInTheDocument();
      page.unmount();
      const entry = render(<Entry state={freshState()} sport="steps" onLog={vi.fn()} onToast={vi.fn()} />);
      expect(screen.getByRole('link', { name: /^Got a watch\?/ })).toBeInTheDocument();
      entry.unmount();
      localStorage.setItem('gt-garmin-key', 'ab'.repeat(32));
      localStorage.setItem('gt-garmin-model', JSON.stringify({ key: 'd2air', name: 'D2™ Air', v: 'part', lacks: ['stress', 'bodyBattery', 'rides'] }));
      render(<Page state={freshState()} onDelete={vi.fn()} />);
      expect(
        screen.getByText('D2™ Air doesn’t share stress, Body Battery or bike rides with apps — that’s why they’re missing here.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Got a watch\?/ })).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
      localStorage.clear();
    }
  });

  it('the card on Today, the profile summary and the weight card', () => {
    const s = richState();
    const { unmount } = render(<CardioCard state={s} />);
    expect(screen.getByText('Steps & cardio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Today 3,000 steps · ≈ \d+ kcal$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Steps from your phone, today 3,000 steps\. Log it\.$/ })).toBeInTheDocument();
    expect(screen.getByText('Steps & cardio — today, this week and history →')).toBeInTheDocument();
    unmount();
    render(<CardioSummary state={s} />);
    expect(screen.getByText(/^Last 7 days: [\d,]+ steps, ≈ [\d,]+ kcal from steps, treadmill, bike and dance\. This week: \d+ movement minutes — the WHO recommends 150\. Entries so far: \d+\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steps & cardio — today and history' })).toBeInTheDocument();
  });

  it('weight and height in the profile', async () => {
    const user = userEvent.setup();
    const onToast = vi.fn();
    render(<BodyCard state={richState()} onWeight={vi.fn()} onHeight={vi.fn()} onDeleteWeight={vi.fn()} onToast={onToast} />);
    expect(screen.getByRole('heading', { name: 'Weight and height' })).toBeInTheDocument();
    expect(screen.getByText(/^Last weigh-in: 81\.2 kg, \d\d\/\d\d\. 7-day average: [\d.]+ kg\. Calories use your weight/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Weight from the last 4 weigh-ins, kg: / })).toBeInTheDocument();
    expect(screen.getByLabelText('Recent weigh-ins')).toBeInTheDocument();
    await user.type(screen.getByLabelText('height, cm — for stride length (optional)'), '0');
    await user.click(screen.getByRole('button', { name: 'Save height' }));
    expect(onToast).toHaveBeenLastCalledWith('Height from 120 to 230 cm.');
    await user.type(screen.getByLabelText('weight today, kg'), '5');
    await user.click(screen.getByRole('button', { name: 'Save weight' }));
    expect(onToast).toHaveBeenLastCalledWith('Weight from 30 to 300 kg.');
  });

  it('labels, step detail and validation come out in English', () => {
    expect(stepsText(1)).toBe('1 step');
    expect(stepsText(12345)).toBe('12,345 steps');
    const inputs: CardioInput[] = [
      { kind: 'steps', steps: 8421 },
      { kind: 'treadmill', kmh: 6, min: 30, grade: 2.5 },
      { kind: 'bike', kmh: 21.5, min: 45 },
      { kind: 'ergo', watts: 140, min: 45 },
      { kind: 'dance', style: 'solo', mix: 'talk', min: 60 },
    ];
    expect(inputs.map(cardioLabel)).toEqual([
      '8,421 steps',
      'Treadmill 6 km/h · 30 min · 2.5%',
      'Bike 21.5 km/h · 45 min',
      'Bike 140 W · 45 min',
      'Solo dance · 60 min · lots of instruction',
    ]);
    const bad = [
      { kind: 'steps', steps: 0 },
      { kind: 'steps', steps: 200_000 },
      { kind: 'treadmill', kmh: 40, min: 10, grade: 0 },
      { kind: 'treadmill', kmh: 5, min: 10, grade: 40 },
      { kind: 'treadmill', kmh: 5, min: 0, grade: 0 },
      { kind: 'bike', kmh: 100, min: 10 },
      { kind: 'ergo', watts: 1, min: 10 },
      { kind: 'dance', style: 'x', mix: 'half', min: 10 },
      { kind: 'dance', style: 'pair', mix: 'x', min: 10 },
      { kind: 'x' },
    ].map((b) => inputProblem(b as never));
    expect(bad).toEqual([
      'Steps from 1 to 100,000.',
      'Steps from 1 to 100,000.',
      'Treadmill speed from 1 to 25 km/h.',
      'Incline from 0 to 25%.',
      'Time from 1 to 720 minutes.',
      'Bike speed from 3 to 70 km/h.',
      'Power from 10 to 700 W.',
      'Pick a dance: partner or solo.',
      'Pick how much was dancing and how much was instruction.',
      'Unknown kind of movement.',
    ]);
    expect(() => setBodyWeight(freshState(), 5, today)).toThrow('Weight out of range: 30–300 kg.');
    expect(() => addSnack(freshState(), 'squat_air', 0, null)).toThrow('An exercise snack needs a positive number of reps or seconds.');
    expect(() => addCardio(freshState(), { kind: 'steps', steps: 10 }, 'later')).toThrow('Invalid day: later');
    // Kroki z drogą i piętrami z telefonu — rozpis po angielsku.
    const p = freshState();
    mergePhone(
      p,
      parsePhonePayload({ v: 1, k: 'phone', os: 'ios', t: Math.floor(now / 1000) - 60, d: [{ day: today, steps: 10_000, m: 8200, floors: 1 }], a: [] }, now)!,
    );
    const steps = stepsDetail(p, { kind: 'steps', steps: 10_000, key: 'k', day: today, at: new Date(now).toISOString(), src: 'phone' });
    expect(steps).toBe('distance from phone 8.2 km · 1 floor');
  });

  it('reminder notifications are composed in English', () => {
    const s = freshState();
    s.plan = { templateId: 'cel-start-30', start: '2026-10-05', ticked: {} };
    const items = reminderItems(s, { morning: true, evening: true, weigh: true }, '2026-10-05', 0);
    const titles = new Set(items.map((i) => i.title));
    expect(titles).toContain('Morning weigh-in');
    expect(titles).toContain('Today’s steps and movement');
    // Nazwa treningu należy do biblioteki planów — tłumaczy ją inna część aplikacji.
    expect(items.filter((i) => i.tag === 'trening').every((i) => i.title.startsWith('Workout today: '))).toBe(true);
    items.filter((i) => i.tag !== 'trening').forEach((i) => expect(i.title).not.toMatch(POLISH));
  });
});

describe('exercise snacks and weigh-ins in English', () => {
  it('the snack card and the snacks screen', () => {
    const s = richState();
    const { unmount } = render(<SnackCard state={s} />);
    expect(screen.getByText('Exercise snack')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Today 2 snacks · \+\d+ XP$/ })).toBeInTheDocument();
    expect(screen.getByText(/^\d more snacks? will earn XP today\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /, today 35 reps · 2×\. Log a snack\.$/ })).toBeInTheDocument();
    expect(screen.getByText('Another exercise')).toBeInTheDocument();
    unmount();
    render(<SnacksPage state={s} onDelete={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Add a snack' })).toBeInTheDocument();
    expect(screen.getByText(/^A short set outside your workout: ten squats while the kettle boils/)).toBeInTheDocument();
    expect(screen.getByText(/^2 snacks · \+\d+ XP\. /)).toBeInTheDocument();
    expect(screen.getByText(/: 35 reps in 2 snacks/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Exercise snacks in the last seven days' })).toBeInTheDocument();
    expect(screen.getByText(/^3 snacks so far · different exercises: 2\.$/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Delete snack: .+ at \d\d:\d\d$/ })).toHaveLength(2);
    for (const pl of ['Dodaj przekąskę', 'Ostatnie siedem dni', 'Wcześniej', 'Dziś']) {
      expect(screen.queryByText(pl)).not.toBeInTheDocument();
    }
    expect(document.body.textContent).not.toMatch(/przekąsk|powt\./);
  });

  it('logging a snack', async () => {
    const user = userEvent.setup();
    const onToast = vi.fn();
    render(<SnackEntry state={richState()} id="squat_air" onLog={vi.fn()} onToast={onToast} />);
    expect(screen.getByText('Enter the number of reps and save.')).toBeInTheDocument();
    expect(screen.getByLabelText('how many reps')).toHaveAttribute('placeholder', 'last time 20');
    expect(screen.getByRole('button', { name: 'Up by 1' })).toBeInTheDocument();
    expect(screen.getByText('Today with this exercise')).toBeInTheDocument();
    expect(screen.getByText(/^Today in total, (in 2 snacks|35 reps in 2 snacks and \d+ reps in your workout)\.$/)).toBeInTheDocument();
    expect(screen.getByText(/^(\d+ to go to the day tier \(\d+ reps\)|Day record complete — there’s no higher tier)\.$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save snack' }));
    expect(onToast).toHaveBeenLastCalledWith('Enter how many reps you did.');
    await user.type(screen.getByLabelText('how many reps'), '900');
    await user.click(screen.getByRole('button', { name: 'Save snack' }));
    expect(onToast).toHaveBeenLastCalledWith('A snack is at most 500 reps — check the number.');
  });

  it('the weigh-in card asks, then shows the weekly average', () => {
    const s = freshState();
    const { unmount } = render(<WeighCard state={s} today={today} onWeigh={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('Weigh-in')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today’s weight' })).toBeInTheDocument();
    expect(screen.getByText('From 30 to 300 kg, to one decimal place.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not today' })).toBeInTheDocument();
    expect(screen.queryByText('Waga z dziś')).not.toBeInTheDocument();
    unmount();
    setBodyWeight(s, 82.4, addDays(today, -8));
    setBodyWeight(s, 81.6, today);
    render(<WeighCard state={s} today={today} onWeigh={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Today 81.6 kg' })).toBeInTheDocument();
    expect(screen.getByText('7-day average: 81.6 kg · a week earlier 82.4 kg (−0.8 kg).')).toBeInTheDocument();
  });
});

describe('achievements in English', () => {
  it('the achievements screen', async () => {
    const user = userEvent.setup();
    render(<Achievements state={richState()} />);
    expect(screen.getByText(/^Every badge family has several tiers/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shelf' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In numbers' })).toBeInTheDocument();
    expect(screen.getByText('workouts')).toBeInTheDocument();
    expect(screen.getByText(/^Exercises done: \d+ · different moves: \d+ · time under load: /)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Show it off' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Closest to earning' })).toBeInTheDocument();
    expect(screen.getAllByText(/^[\d,]+ to go$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Badges \d+\/\d+$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Lifetime/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Workouts logged').length).toBeGreaterThan(0);
    expect(screen.getByText(/^3 of 10 workouts · last tier \d\d\/\d\d$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Steps & cardio/ }));
    expect(screen.getAllByText('Eight thousand').length).toBeGreaterThan(0);
    expect(screen.getByText(/^Days with at least 8,000 steps\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Movement patterns/ }));
    expect(screen.getByText('Reps from the “Hip hinge” group. Timed exercises don’t count.')).toBeInTheDocument();
    for (const pl of ['Półka', 'W liczbach', 'Najbliżej zdobycia', 'Pochwal się', 'Zapisane treningi', 'Dorobek']) {
      expect(screen.queryByText(pl)).not.toBeInTheDocument();
    }
  });

  it('the badge catalogue has no Polish in it', () => {
    ACHIEVEMENTS.forEach((a) => {
      const all = [a.name, a.desc, a.quip ?? '', a.unit ?? '', ...a.tiers.map((t) => formatTier(a, t))].join(' | ');
      expect(all, a.id).not.toMatch(POLISH);
    });
    Object.values(GROUP_LABEL).forEach((l) => expect(l).not.toMatch(POLISH));
    Object.values(GROUP_NOTE).forEach((l) => expect(l).not.toMatch(POLISH));
    // Nazwa ćwiczenia w nazwie rodziny należy do biblioteki ćwiczeń; reszta jest stąd.
    EX_DEFS.forEach((a) => expect(`${a.desc} | ${a.quip} | ${a.unit ?? ''}`, a.id).not.toMatch(POLISH));
    Object.values(EX_QUIPS).flat().forEach((q) => expect(q).not.toMatch(POLISH));
    expect(Object.values(KIND_TITLE)).toEqual(['day record', 'week record', 'month record', 'total']);
    expect(Object.values(KIND_NOW)).toEqual(['today', 'this week', 'this month']);
    LEVEL_TITLES.forEach((t) => expect(t.name).not.toMatch(POLISH));
    expect(levelFor(0).title).toBe('Fresh from the jungle');
    ALL.forEach((id) => expect(profileOf(id).label, id).not.toMatch(POLISH));
    expect(profileOf('swing2').label).toBe('kettlebell swings');
  });

  it('tier units agree with the number; badge log entries are in English', () => {
    expect(formatTier(achievementById('treningi')!, 1)).toBe('1 workout');
    expect(formatTier(achievementById('treningi')!, 1000)).toBe('1,000 workouts');
    expect(formatTier(achievementById('przekaski-dzien')!, 3)).toBe('3 snacks');
    expect(formatTier(achievementById('cardio-dystans')!, 1)).toBe('1 km');
    expect(formatTier(achievementById('czas-suma')!, 90)).toBe('1.5 h');
    expect(formatTier(achievementById('ex:lunge:dzien')!, 50)).toBe('50 reps per side');
    const s = richState();
    const badges = s.events.filter((e) => e.kind === 'badge');
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((e) => {
      expect(e.title).toMatch(/^Badge: /);
      expect(e.text).toMatch(/ Tier: .+\.$/);
      expect(`${e.title} ${e.text}`).not.toMatch(POLISH);
    });
  });
});
