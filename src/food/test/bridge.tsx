import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { BridgeContext, type GymBridge } from '../bridge';

/** Most do treningów na potrzeby testów: zapisy to szpiedzy, odczyty — puste, chyba że test poda swoje. */
export function testBridge(over: Partial<GymBridge> = {}): GymBridge {
  return {
    weights: [],
    setWeight: vi.fn(),
    heightCm: null,
    setHeight: vi.fn(),
    stepsOn: () => null,
    setSteps: vi.fn(),
    moveOn: () => ({ trained: false, workoutKcal: null, cardioKcal: null }),
    toast: vi.fn(),
    ...over,
  };
}

/** Ekran jedzenia pod mostem, jak w App. */
export function renderWithBridge(ui: ReactElement, bridge: GymBridge = testBridge()) {
  return { bridge, ...render(<BridgeContext.Provider value={bridge}>{ui}</BridgeContext.Provider>) };
}
