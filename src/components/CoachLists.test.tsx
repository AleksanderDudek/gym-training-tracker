// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshState } from '../engine/plan';
import { coachId } from '../link/assign';
import { clearLink } from '../link/store';
import { assignment, connection, seedLink } from '../test/coachSeed';
import type { AppState, PlanTemplate, Workout } from '../types';
import { PlanCatalog } from './Plans';
import { WorkoutLibrary } from './Workouts';

/**
 * Plany i treningi od prowadzącego (numery `coach-…`) przypięte na górze list pod „Od prowadzącego —
 * <prowadzący>”: biegnący plan z oznaczeniem, własne zostają niżej; po końcu współpracy — zwykłe własne.
 */

beforeEach(() => {
  localStorage.clear();
  clearLink();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
});

afterEach(() => vi.unstubAllEnvs());

const plan = (id: string, name: string, cycle: string[]): PlanTemplate => ({
  id,
  name,
  level: 'base',
  sex: 'any',
  daysPerWeek: 2,
  weeks: 8,
  loadFactor: 1,
  cycle,
  weekdays: [1, 4],
  desc: '',
  kind: 'own',
});

const workout = (id: string, name: string): Workout => ({ id, name, items: [{ ex: 'swing2' }] });

function seeded(status: 'active' | 'ended' = 'active') {
  const a = assignment(
    { kind: 'plan', plan: plan('sila', 'Siła 8 tyg.', ['a']), workouts: [workout('a', 'Góra A')], videos: {}, note: '' },
    { status: 'started' },
  );
  const planId = coachId(a.id, 'sila');
  const workoutId = coachId(a.id, 'a');
  seedLink({ connections: [connection({ status, coach: { name: 'Ola Nowak', profession: 'trainer' } })], assignments: [{ ...a, made: { plan: planId } }] });
  const state: AppState = {
    ...freshState(),
    workouts: [workout('moj-trening', 'Mój trening'), workout(workoutId, 'Góra A')],
    plans: [plan('moj-plan', 'Mój plan', ['moj-trening']), plan(planId, 'Siła 8 tyg.', [workoutId])],
  };
  return { state, planId, workoutId };
}

describe('lista planów', () => {
  it('plan od prowadzącego na samej górze, pod jego nazwiskiem, z oznaczeniem, gdy biegnie', () => {
    const { state, planId } = seeded();
    const running: AppState = { ...state, plan: { templateId: planId, start: '2026-11-23', ticked: {} } };
    render(<PlanCatalog state={running} />);
    const section = screen.getByRole('region', { name: 'Od prowadzącego — Ola Nowak' });
    expect(within(section).getByRole('heading', { name: 'Siła 8 tyg.' })).toBeInTheDocument();
    expect(within(section).getByText('Twój plan teraz')).toBeInTheDocument();
    // Pierwsza sekcja pod wstępem — nad planami z celem; własny plan zostaje w „Twoich planach”, bez kopii.
    const goal = screen.getByText('Plany z celem');
    expect(section.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'Siła 8 tyg.' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Mój plan' })).toBeInTheDocument();
    expect(within(section).queryByRole('heading', { name: 'Mój plan' })).not.toBeInTheDocument();
  });

  it('po końcu współpracy plan wraca między własne', () => {
    const { state } = seeded('ended');
    render(<PlanCatalog state={state} />);
    expect(screen.queryByRole('region', { name: /Od prowadzącego/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Siła 8 tyg.' })).toBeInTheDocument();
  });
});

describe('biblioteka treningów', () => {
  it('trening od prowadzącego na górze, nad gotowymi i własnymi; dzisiejszy z planu oznaczony', () => {
    const { state, workoutId } = seeded();
    render(<WorkoutLibrary state={state} plannedId={workoutId} onStart={() => undefined} />);
    const section = screen.getByRole('region', { name: 'Od prowadzącego — Ola Nowak' });
    expect(within(section).getByRole('heading', { name: 'Góra A' })).toBeInTheDocument();
    expect(within(section).getByText('Dziś według planu')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.slice(0, 2)).toEqual(['Od prowadzącego — Ola Nowak', 'Góra A']);
    expect(headings.filter((h) => h === 'Góra A')).toHaveLength(1);
    expect(headings).toContain('Mój trening');
  });
});
