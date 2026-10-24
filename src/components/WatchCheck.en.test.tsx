// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { freshState } from '../engine/plan';

/**
 * Sprawdzanie zegarka i karta zegarka po angielsku: każda karta odpowiedzi, listy i rada
 * z telefonem bez jednej polskiej litery. Nazwy produktów (fēnix®, vívoactive®) mają swoje litery,
 * ale nie polskie — sprawdzamy więc cały tekst sprawdzania.
 */

const POLISH = /[ąćęłńóśźż]/i;
const KEY = 'ab'.repeat(32);
const ua = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.com/zdrowie.apk');
  // Komputer: rada mówi o obu telefonach.
  Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', configurable: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (ua) Object.defineProperty(window.navigator, 'userAgent', ua);
  else delete (window.navigator as { userAgent?: string }).userAgent;
});

const noPolish = (el: Element | null) => expect(el?.textContent?.match(POLISH)?.[0] ?? null).toBeNull();

describe('watch check (English visit)', () => {
  it('field, chips, every kind of answer and both lists — no Polish', async () => {
    const { default: WatchCheck } = await import('./WatchCheck');
    const user = userEvent.setup();
    render(<WatchCheck onConnect={vi.fn()} onFeedback={vi.fn()} />);
    const field = screen.getByRole('combobox', { name: 'Which watch do you have?' });
    const wc = document.querySelector('.wc');
    expect(field).toHaveAttribute('placeholder', 'e.g. Forerunner 265, fēnix 7, Venu 3');
    expect(screen.getByRole('group', { name: 'Popular:' })).toHaveTextContent('Forerunner 55');
    noPolish(wc);

    await user.click(screen.getByRole('button', { name: 'Forerunner 55' }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 55 · Supported' })).toHaveFocus();
    expect(screen.getByText('These arrive by themselves: steps, bike rides, heart rate, stress and Body Battery.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect watch' })).toBeInTheDocument();
    await user.click(screen.getByText('More'));
    expect(screen.getByRole('button', { name: 'Something not working? Write to the author' })).toBeInTheDocument();
    noPolish(wc);

    const ask = async (q: string) => {
      await user.clear(field);
      await user.type(field, `${q}{Enter}`);
      noPolish(wc);
    };

    await ask('fenix 5');
    expect(screen.getByRole('heading', { name: 'fēnix® 5 · Not supported' })).toHaveFocus();
    expect(screen.getByText(/^Do you have the/)).toHaveTextContent(
      'Do you have the fēnix® 5 Plus? That’s a different model — supported, without some data.',
    );
    expect(screen.getByText(/^The GYM TRACKER watch app doesn’t run on it: the fēnix® 5 has Connect IQ/)).toBeInTheDocument();
    const box = document.querySelector('.wc-instead')!;
    expect(box).toHaveTextContent('Instead — your phone');
    expect(box).toHaveTextContent(
      'Android: in Garmin Connect, turn on sharing with Health Connect (Settings → Connected Apps), then connect your phone in the “Health from your phone” card. Steps, sleep, heart rate, weight and workouts arrive.',
    );
    expect(box).toHaveTextContent('iPhone: the GYM TRACKER Zdrowie app for iPhone isn’t ready yet');
    expect(within(box as HTMLElement).getByRole('link', { name: '“Health from your phone” →' })).toBeInTheDocument();

    await ask('fenix 5 plus');
    expect(screen.getByRole('heading', { name: 'fēnix® 5 Plus · Supported, without some data' })).toBeInTheDocument();
    expect(screen.getByText('This model doesn’t share Body Battery with apps.')).toBeInTheDocument();
    expect(document.querySelector('.wc-more')).toHaveTextContent(
      'Stress and bike rides arrive once the watch has its latest software — older versions don’t share them with apps.',
    );

    await ask('instinct 2 dual power');
    expect(document.querySelector('.wc-result')).toHaveTextContent(
      'This is the Asian version (APAC). According to Garmin’s data it has older software: steps and heart rate arrive, but stress, Body Battery and bike rides may not. The European version is fully supported.',
    );

    await ask('vivoactive');
    expect(screen.getByRole('heading', { name: 'vívoactive: the models differ — pick yours.' })).toBeInTheDocument();
    expect([...document.querySelectorAll('.wc-group-title')].map((g) => g.textContent)).toEqual([
      'Supported',
      'Supported, without some data',
      'Not supported',
    ]);

    await ask('marq gen 3');
    expect(screen.getByRole('heading', { name: 'MARQ® (Gen 3) · Not supported yet' })).toBeInTheDocument();

    await ask('apple watch');
    expect(screen.getByRole('heading', { name: 'Apple Watch · Not a Garmin' })).toBeInTheDocument();
    expect(screen.getByText(/^Apple Watch isn’t a Garmin — the watch app works with Garmin watches only\./)).toBeInTheDocument();

    await ask('Forerunner 970 Pro');
    expect(screen.getByRole('heading', { name: 'I don’t know exactly “Forerunner 970 Pro”. Did you mean:' })).toBeInTheDocument();

    await ask('xyz');
    expect(screen.getByRole('heading', { name: 'I don’t know “xyz”' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compatible devices in the Connect IQ Store' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write to the author' })).toBeInTheDocument();

    await ask('garmin');
    expect(screen.getByText('Type a model name, e.g. Forerunner 265 or Venu 3.')).toBeInTheDocument();

    await user.click(screen.getByText('Where do I find the model name?'));
    expect(screen.getByText(/^The Garmin Connect app shows the name in your device list\./)).toBeInTheDocument();
    await user.click(screen.getByText(/^All supported watches — \d+ models$/));
    expect(screen.getByText('Legacy (Marvel, Star Wars)')).toBeInTheDocument();
    expect(screen.getByText('List based on Garmin’s data from October 2026.')).toBeInTheDocument();
    noPolish(wc);
  }, 15_000);

  it('suggestions and the screen-reader count are English', async () => {
    const { default: WatchCheck } = await import('./WatchCheck');
    const user = userEvent.setup();
    render(<WatchCheck />);
    await user.type(screen.getByRole('combobox', { name: 'Which watch do you have?' }), 'fr 26');
    const list = await screen.findByRole('listbox', { name: 'Which watch do you have?' });
    expect(within(list).getByRole('option', { name: 'Forerunner® 265 supported' })).toBeInTheDocument();
    expect(
      await screen.findByText(/^\d+ suggestions?$/, { selector: '.sr-only' }, { timeout: 4000 }),
    ).toBeInTheDocument();
    noPolish(document.querySelector('.wc'));
  }, 15_000);
});

describe('Garmin card (English visit)', () => {
  it('before connecting: the check first, quiet buttons under it', async () => {
    const { GarminCard } = await import('./Garmin');
    render(<GarminCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} />);
    expect(await screen.findByRole('combobox', { name: 'Which watch do you have?' })).toBeInTheDocument();
    expect(
      screen.getByText(/^Steps, bike rides and heart rate — and on most watches stress and Body Battery too — arrive/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect without checking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I already have a key from another device' })).toBeInTheDocument();
    noPolish(document.querySelector('.dev-card'));
  }, 15_000);

  it('connected: the chosen model, what it lacks, the memory note and the check item', async () => {
    localStorage.setItem('gt-garmin-key', KEY);
    localStorage.setItem(
      'gt-garmin-model',
      JSON.stringify({ key: 'd2air', name: 'D2™ Air', v: 'part', lacks: ['stress', 'bodyBattery', 'rides'], bg: 32 }),
    );
    const { GarminCard } = await import('./Garmin');
    const view = render(<GarminCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} onFeedback={vi.fn()} />);
    expect(screen.getByText('Chosen model: D2™ Air — without some data.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change model' })).toBeInTheDocument();
    expect(
      screen.getByText('This model doesn’t share stress, Body Battery or bike rides with apps — they won’t appear under “From your watch”.'),
    ).toBeInTheDocument();
    const checks = within(screen.getByRole('list', { name: 'Data not arriving?' })).getAllByRole('listitem');
    expect(checks[0]).toHaveTextContent(/^This model has little memory for background work and hasn’t been tested on a real watch yet\./);
    expect(within(checks[0]!).getByRole('button', { name: 'Write to the author' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Connection steps' })).toHaveTextContent(
      'Install the GYM TRACKER app on your watch from the Connect IQ Store. If the store says the watch needs an update, sync it with Garmin Connect or connect it to Garmin Express on a computer.',
    );
    const key = checks.find((li) => /^The key from this card/.test(li.textContent ?? ''))!;
    expect(key).toHaveTextContent('The same settings are also in the Connect IQ Store app: device → GYM TRACKER → Settings.');
    expect(key).not.toHaveTextContent('beta');
    noPolish(document.querySelector('.dev-card'));
    view.unmount();

    localStorage.removeItem('gt-garmin-model');
    render(<GarminCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} />);
    const first = within(screen.getByRole('list', { name: 'Data not arriving?' })).getAllByRole('listitem')[0]!;
    expect(first).toHaveTextContent('Is your model supported? Check →');
    noPolish(document.querySelector('.dev-card'));
  });
});
