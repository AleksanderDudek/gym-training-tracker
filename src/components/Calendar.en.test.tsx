// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

vi.mock('../food/calendar', () => ({
  loadDietCalendar: async () => ({
    shop: { kind: 'every', days: 7, from: '2026-11-07', at: '10:00' },
    retest: { date: '2026-11-30', markers: ['Ferritin'] },
    labDays: [],
  }),
}));

vi.mock('../push', () => ({
  deviceTimeZone: () => 'Europe/London',
  pushConfigured: () => true,
}));

const { freshState } = await import('../engine/plan');
const { default: CalendarPage } = await import('./Calendar');
const { CalendarCard } = await import('./CalendarCard');

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 3, 9, 0));
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('Calendar (English)', () => {
  it('the page and the Today card speak English, with no Polish letters', async () => {
    const s = freshState();
    s.plan = { templateId: 'cel-start-30', start: '2026-11-02', ticked: {} };
    const { container } = render(
      <>
        <CalendarPage state={s} onTrainAt={() => undefined} onToast={() => undefined} />
        <CalendarCard state={s} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next 14 days' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Add shopping to Google Calendar/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add workouts to Google Calendar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download .ics file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tuesday 3 November/ })).toHaveAttribute('aria-current', 'date');
    expect(screen.getByText(/Settings → Import & export → Import/)).toBeInTheDocument();
    // Plan names in the data stay as they are; everything around them is English.
    const text = (container.textContent ?? '').replace(/Trening [AB]/g, '');
    expect(text).not.toMatch(POLISH);
    for (const el of container.querySelectorAll('[aria-label]')) expect(el.getAttribute('aria-label')).not.toMatch(POLISH);
  });
});
