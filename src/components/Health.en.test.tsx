// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

const { HealthAck, HealthPage } = await import('./Health');
const { HEALTH_ACK_KEY, resetHealthAckCache } = await import('./healthAck');

beforeEach(() => {
  window.localStorage.removeItem(HEALTH_ACK_KEY);
  resetHealthAckCache();
});

describe('Health and safety (English)', () => {
  test('the acknowledgment card and the page are in English, with Polish numbers labelled', () => {
    render(
      <>
        <HealthAck />
        <HealthPage />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Before you use the food suggestions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I understand' })).toBeInTheDocument();
    expect(screen.getByText(/It is not a medical device/)).toBeInTheDocument();
    expect(screen.getByText(/free helpline for adults in emotional crisis \(Poland\)/)).toBeInTheDocument();
    expect(screen.getByText(/emergency number \(across the EU\)/)).toBeInTheDocument();
  });
});
