import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { BridgeContext, type GymBridge, type MoveDay } from '../bridge';

/** Dzień bez ruchu — test nadpisuje tylko to, czego potrzebuje. */
export const testMove = (over: Partial<MoveDay> = {}): MoveDay => ({
  trained: false,
  workoutKcal: null,
  cardioKcal: null,
  otherKcal: null,
  planned: null,
  planActive: false,
  typicalWorkoutKcal: null,
  workouts: 0,
  snacks: 0,
  outings: 0,
  activeMin: 0,
  stepsWorth: null,
  ...over,
});

/** Most do treningów na potrzeby testów: zapisy to szpiedzy, odczyty — puste, chyba że test poda swoje. */
export function testBridge(over: Partial<GymBridge> = {}): GymBridge {
  return {
    weights: [],
    setWeight: vi.fn(),
    heightCm: null,
    setHeight: vi.fn(),
    stepsOn: () => null,
    setSteps: vi.fn(),
    moveOn: () => testMove(),
    toast: vi.fn(),
    ...over,
  };
}

/** Ekran jedzenia pod mostem, jak w App. */
export function renderWithBridge(ui: ReactElement, bridge: GymBridge = testBridge()) {
  return { bridge, ...render(<BridgeContext.Provider value={bridge}>{ui}</BridgeContext.Provider>) };
}
