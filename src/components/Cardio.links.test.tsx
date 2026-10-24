// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshState } from '../engine/plan';
import { addDays, dayKey } from '../engine/schedule';
import { mergeWatch, parsePayload } from '../engine/watch';
import type { AppState } from '../types';

/**
 * Ekran kroków i formularz kroków a sprawdzanie zegarka: cichy link „Masz zegarek? Sprawdź…”
 * tylko tam, gdzie ma sens (karta zegarka istnieje, nic nie jest połączone, nie schowano go),
 * i zdanie o brakach wybranego modelu nad danymi z zegarka.
 *
 * Adres serwera przychodzi z buildu, a moduły czytają go przy wczytaniu — import po podmianie.
 */

const LINK = 'Masz zegarek? Sprawdź, czy kroki mogą przychodzić same →';
const KEY = 'ab'.repeat(32);

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv('VITE_API_URL', 'https://api.example');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const page = async (state: AppState = freshState()) => {
  const { CardioPage } = await import('./Cardio');
  return render(<CardioPage state={state} onDelete={vi.fn()} />);
};

const form = async (sport: 'steps' | 'treadmill' = 'steps') => {
  const { CardioEntry } = await import('./Cardio');
  return render(<CardioEntry state={freshState()} sport={sport} onLog={vi.fn()} onToast={vi.fn()} />);
};

describe('link do sprawdzenia zegarka', () => {
  it('ekran kroków i formularz kroków: cichy link do #/zegarek z „Nie pokazuj więcej”', async () => {
    const shown = await page();
    expect(screen.getByRole('link', { name: LINK })).toHaveAttribute('href', '#/zegarek');
    expect(screen.getByRole('button', { name: 'Nie pokazuj więcej' })).toBeInTheDocument();
    shown.unmount();
    const steps = await form();
    expect(screen.getByRole('link', { name: LINK })).toHaveAttribute('href', '#/zegarek');
    steps.unmount();
    // Bieżnia to nie kroki — tam linku nie ma.
    await form('treadmill');
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
  });

  it('bez serwera w buildzie nie ma karty zegarka — nie ma też linku', async () => {
    vi.stubEnv('VITE_API_URL', '');
    await page();
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
  });

  it('połączony zegarek albo telefon: kroki już przychodzą, linku nie ma', async () => {
    localStorage.setItem('gt-garmin-key', KEY);
    const watch = await page();
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
    watch.unmount();
    localStorage.clear();
    vi.resetModules();
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    localStorage.setItem('gt-phone-key', KEY);
    await form();
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
  });

  it('„Nie pokazuj więcej” chowa link na stałe — na ekranie kroków i w formularzu', async () => {
    const user = userEvent.setup();
    const first = await page();
    await user.click(screen.getByRole('button', { name: 'Nie pokazuj więcej' }));
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
    expect(localStorage.getItem('gt-watch-link-hidden')).toBe('1');
    first.unmount();
    const again = await page();
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
    again.unmount();
    await form();
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
  });

  it('bez pamięci przeglądarki link chowa się do końca wizyty, bez błędu', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const user = userEvent.setup();
    await page();
    await user.click(screen.getByRole('button', { name: 'Nie pokazuj więcej' }));
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument();
  });
});

describe('braki wybranego modelu nad danymi z zegarka', () => {
  const withWatch = (): AppState => {
    const s = freshState();
    const today = dayKey(Date.now());
    const t = Math.floor(Date.now() / 1000) - 60;
    mergeWatch(s, parsePayload({ v: 1, t, d: [[today, 6000]], a: [], h: [[addDays(today, -1), 52, 48, 71, 142, null, null, null, null]] })!, new Date());
    return s;
  };

  it('model bez stresu, Body Battery i przejazdów: zdanie, dlaczego ich tu nie ma', async () => {
    localStorage.setItem('gt-garmin-key', KEY);
    localStorage.setItem(
      'gt-garmin-model',
      JSON.stringify({ key: 'd2air', name: 'D2™ Air', v: 'part', lacks: ['stress', 'bodyBattery', 'rides'] }),
    );
    await page(withWatch());
    expect(screen.getByText('Z zegarka')).toBeInTheDocument();
    expect(
      screen.getByText('D2™ Air nie udostępnia aplikacjom stresu, Body Battery ani przejazdów rowerem — dlatego ich tu nie ma.'),
    ).toBeInTheDocument();
  });

  it('model z pełnymi danymi albo bez wybranego modelu — bez zdania', async () => {
    localStorage.setItem('gt-garmin-key', KEY);
    localStorage.setItem('gt-garmin-model', JSON.stringify({ key: 'fr265', name: 'Forerunner® 265', v: 'ok' }));
    const full = await page(withWatch());
    expect(screen.queryByText(/nie udostępnia aplikacjom/)).not.toBeInTheDocument();
    full.unmount();
    localStorage.removeItem('gt-garmin-model');
    await page(withWatch());
    expect(screen.queryByText(/nie udostępnia aplikacjom/)).not.toBeInTheDocument();
  });
});
