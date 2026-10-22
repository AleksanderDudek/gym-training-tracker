// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { BUILTIN, ex } from '../data/exercises';
import { GOAL_PLANS, planById, planId } from '../data/plans';
import { freshState } from '../engine/plan';
import type { AppState, Session } from '../types';
import { AtlasView, ExercisePage } from './atlas';
import { CharacterCard } from './Character';
import { GuidedSession } from './Guided';
import { PlanDetail } from './Plans';
import { PlanView } from './PlanView';
import { SessionHome } from './SessionHome';
import { Timer } from './Timer';
import { WorkoutBuilder, WorkoutLibrary, WorkoutPreview } from './Workouts';

/*
 * Ekrany treningu po angielsku. Dane i silnik (nazwy ćwiczeń, uwagi doradcy, żarty) tłumaczy kto
 * inny, więc test nie szuka zera polskich liter na całej stronie — sprawdza teksty z katalogów
 * tych ekranów: angielskie są, polskich nie ma.
 */

const noop = () => {};
const A = BUILTIN.find((w) => w.id === 'A')!;

/** Polskie teksty z katalogów tych ekranów — żaden nie może się pokazać po angielsku. */
const POLISH = [
  'Wybierz dowolny trening',
  'Nikt nie pilnuje terminów',
  'Dziś według planu',
  'Zrobiony dziś liczy się w pełni',
  'Ułóż własny trening',
  'Zmień pod siebie',
  'Kolejność i serie na dziś',
  'Które partie pracują',
  'Skopiuj i zmień pod siebie',
  'Przed treningiem',
  'Zapisz trening',
  'przerwa między seriami',
  'Plany z celem',
  'Ułóż własny plan',
  'Plan klasyczny z kettlebell',
  'Skąd te punkty',
  'Rytm i przerwy',
  'Zmień plan od dziś',
  'Najbliższy termin',
  'Serie tygodniowo',
  'Zacznij ten plan',
  'Ciężary startowe',
  'Jak się dziś czujesz',
  'Przygotowanie stanowiska i rozgrzewka',
  'Pokaż czas treningu w pasku',
  'Pomiń to ćwiczenie dziś',
  'Lista ćwiczeń',
  'Zamknij trening',
  'Na co uważać',
  'Dodaj do treningu',
  'Tor ruchu',
  'Twoja postać',
  'Skąd się bierze doświadczenie',
  'Start odliczania',
];

const expectNoPolish = () => {
  const body = document.body.textContent ?? '';
  for (const pl of POLISH) expect(body, pl).not.toContain(pl);
  // Atrybuty dostępności też należą do katalogów.
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
    for (const attr of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(attr) ?? '';
      for (const word of ['Zamień:', 'Serie:', 'Usuń:', 'W górę:', 'W dół:', 'Czas treningu', 'Części treningu', 'Sekcje zakładki'])
        expect(v, `${attr}="${v}"`).not.toContain(word);
    }
  }
};

const withPlan = (): AppState => {
  const s = freshState();
  const t = planById(planId('base', 'any', 3))!;
  s.plan = { templateId: t.id, start: '2026-09-28', weekdays: t.weekdays, policy: 'shift', ticked: {} };
  return s;
};

const session = (extra: Partial<Session> = {}): Session => ({
  workout: A.id,
  started: new Date().toISOString(),
  ready: 'ok',
  res: {},
  done: {},
  skip: {},
  ...extra,
});

const guidedProps = (state: AppState) => ({
  state,
  workout: A,
  onReady: noop,
  onBegin: noop,
  onStartPart: noop,
  onSkipPart: noop,
  onClockPref: noop,
  onLogSet: noop,
  onUndo: noop,
  onEffort: noop,
  onRest: noop,
  onSkip: noop,
  onFinish: noop,
  onList: noop,
  onToast: noop,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('training screens in English', () => {
  it('Today without a plan', () => {
    render(<SessionHome state={freshState()} today={{ kind: 'none' }} statsLine="" onStart={noop} onWeigh={noop} onWeighSkip={noop} />);
    expect(screen.getByText('No plan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nobody’s keeping an eye on deadlines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up a plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick any workout' })).toBeInTheDocument();
    expect(screen.getByText(/You have no plan, so it’s your call/)).toBeInTheDocument();
    expectNoPolish();
  });

  it('Today with a workout due', () => {
    render(
      <SessionHome
        state={freshState()}
        today={{ kind: 'due', workout: A, late: 0, points: 10 }}
        statsLine=""
        onStart={noop}
        onWeigh={noop}
        onWeighSkip={noop}
      />,
    );
    expect(screen.getByText('Today, as planned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Start: ${A.name}` })).toBeInTheDocument();
    expect(screen.getByText('Done today, it counts in full. 10 pts up for grabs.')).toBeInTheDocument();
    expect(screen.getByText(/^\d+ exercises? · /)).toBeInTheDocument();
    expectNoPolish();
  });

  it('workout library, preview and builder', () => {
    const state = freshState();
    const { unmount } = render(<WorkoutLibrary state={state} onStart={noop} />);
    expect(screen.getByRole('button', { name: 'Build your own workout' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Workout type' })).toHaveTextContent('AllFull bodyPush · pull · legs');
    expect(screen.getAllByRole('button', { name: 'Preview' }).length).toBeGreaterThan(3);
    expect(screen.getAllByRole('button', { name: 'Make it yours' }).length).toBeGreaterThan(3);
    expectNoPolish();
    unmount();

    const preview = render(<WorkoutPreview state={state} id={A.id} onStart={noop} onDelete={noop} />);
    expect(screen.getByText('Order and sets for today')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Muscles worked' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advisor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Before the workout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy and make it yours' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Sets per muscle group in this session' })).toBeInTheDocument();
    expectNoPolish();
    preview.unmount();

    render(<WorkoutBuilder state={state} from={A.id} onSave={noop} onSetsChange={noop} onToast={noop} />);
    const first = ex(A.items[0]!.ex).name;
    expect(screen.getByRole('textbox', { name: 'name' })).toHaveValue(`${A.name} — my version`);
    expect(screen.getByRole('button', { name: `Swap: ${first}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Move down: ${first}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save workout' })).toBeInTheDocument();
    expect(screen.getByText('rest between sets')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'How to do the exercises' })).toHaveTextContent('Straight setsCircuit — rounds');
    expectNoPolish();
  });

  it('plan catalogue, plan details and the running plan', () => {
    const catalogue = render(<PlanView state={freshState()} onStop={noop} onTick={noop} onFrequency={noop} edits={edits} />);
    expect(screen.getByText('Goal plans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build your own plan' })).toBeInTheDocument();
    expect(screen.getByText('Classic kettlebell plan')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Length' })).toHaveTextContent('Any length30 days60 days90 days');
    expectNoPolish();
    catalogue.unmount();

    const detail = render(<PlanDetail state={freshState()} id={GOAL_PLANS[0]!.id} onStart={noop} onDelete={noop} />);
    expect(screen.getByRole('heading', { name: 'Weekly sets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start this plan' })).toBeInTheDocument();
    expect(screen.getByText(/^Starting weights: /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveTextContent('M');
    expectNoPolish();
    detail.unmount();

    render(<PlanView state={withPlan()} onStop={noop} onTick={noop} onFrequency={noop} edits={edits} />);
    expect(screen.getByText('Where the points come from')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rhythm and breaks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change the plan from today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Journal' })).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /^Week \d+ of \d+ · done \d+ of \d+/.test(el.textContent ?? '')),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End plan' })).toBeInTheDocument();
    expectNoPolish();
  });

  it('guided session: start screen and the first set', () => {
    const state = freshState();
    state.session = session();
    const start = render(<GuidedSession {...guidedProps(state)} />);
    expect(screen.getByText('How do you feel today? It affects today’s targets, not your levels.')).toBeInTheDocument();
    expect(screen.getByText('Station setup and warm-up')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Let’s go' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^\d+ parts? in order$/ })).toBeInTheDocument();
    expectNoPolish();
    start.unmount();

    const now = Date.now();
    state.session = session({ clock: { begin: now, parts: { 1: { start: now } } } });
    render(<GuidedSession {...guidedProps(state)} />);
    expect(screen.getByText(/^Set 1 of \d+$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip this exercise today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeInTheDocument();
    expect(screen.getByText(/^Part 1 of \d+/)).toBeInTheDocument();
    expectNoPolish();
  });

  it('exercise atlas, exercise page, character card and timer', () => {
    const state = freshState();
    const atlas = render(<AtlasView state={state} />);
    expect(screen.getByText(/^Every exercise has its own page/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'no equipment' })).toBeInTheDocument();
    expect(screen.getByText(/^\d+ of \d+ exercises\.$/)).toBeInTheDocument();
    expectNoPolish();
    atlas.unmount();

    const page = render(<ExercisePage state={state} id={A.items[0]!.ex} />);
    expect(screen.getByRole('heading', { name: 'What to watch out for' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add to a workout' })).toBeInTheDocument();
    expect(screen.getByText(/^Progression type: /)).toBeInTheDocument();
    expectNoPolish();
    page.unmount();

    const card = render(<CharacterCard state={state} onAvatar={noop} />);
    expect(screen.getByText('Your character · Gustaw')).toBeInTheDocument();
    expect(screen.getByText('Where XP comes from')).toBeInTheDocument();
    expect(screen.getByText('Waiting for your first move', { exact: false })).toBeInTheDocument();
    expectNoPolish();
    card.unmount();

    render(<Timer mode="count" target={30} onDone={noop} />);
    expect(screen.getByRole('button', { name: 'Start countdown' })).toBeInTheDocument();
    expect(screen.getByText('of 30 s', { exact: false })).toBeInTheDocument();
    expectNoPolish();
  });
});

const edits = { onWeekdays: noop, onPolicy: noop, onExtend: noop, onStart: noop };
