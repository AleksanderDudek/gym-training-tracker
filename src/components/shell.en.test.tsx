// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { freshState } from '../engine/plan';
import { mergePhone, parsePhonePayload } from '../engine/phone';
import { mergeWatch, parsePayload } from '../engine/watch';
import type { AppState } from '../types';

/**
 * Powłoka, ustawienia i urządzenia po angielsku: ekrany i karty z tej części aplikacji nie mają
 * ani jednej polskiej litery, a czyste funkcje tekstu mówią po angielsku.
 *
 * Teksty z cudzych modułów (hasło plakatu, rada trenera, nazwy partii i ćwiczeń) tłumaczy kto
 * inny, więc test wycina je przed sprawdzeniem — tak samo jak kartę „Język · Language”, która
 * celowo mówi w obu językach. Przyciski w aplikacji GYM TRACKER Zdrowie (tylko po polsku) stoją
 * w cudzysłowie z angielskim objaśnieniem i też są wycinane.
 */

const POLISH = /[ąćęłńóśźż]/i;

const NOW = new Date(2026, 9, 22, 14, 44);
const DAY = '2026-10-22';
const KEY = 'ab'.repeat(32);
const at = (h: number, m: number): number => Math.floor(new Date(2026, 9, 22, h, m).getTime() / 1000);

/** Zegarek i telefon z paczkami: zegarek sprzed 12 minut, telefon spóźniony. */
const withDevices = (): AppState => {
  const s = freshState();
  const w = parsePayload({ v: 1, t: at(14, 32), d: [[DAY, 7300]], a: [], h: [] }, NOW.getTime())!;
  mergeWatch(s, w, new Date(at(14, 32) * 1000 + 30_000));
  const p = parsePhonePayload({ v: 1, k: 'phone', os: 'android', t: at(11, 0), d: [{ day: DAY, steps: 4100 }], a: [] }, NOW.getTime())!;
  mergePhone(s, p);
  return s;
};

/** Tekst strony bez fragmentów, które celowo albo jeszcze nie są po angielsku. */
async function englishText(root: HTMLElement = document.body): Promise<string> {
  const { FREE_NOTE, TAGLINE } = await import('../engine/share');
  const copy = root.cloneNode(true) as HTMLElement;
  // Partie, nazwy ćwiczeń i sprzęt w „Poziomach startowych” — dane z biblioteki ćwiczeń.
  copy.querySelectorAll('details.gsel').forEach((n) => n.remove());
  // Rada dnia i żart trenera — z `engine/quips`.
  copy.querySelectorAll('.mbanner-tip, .mbanner-line').forEach((n) => n.remove());
  // Karta języka: nagłówek i nazwy języków celowo w obu językach.
  copy.querySelectorAll('.grp').forEach((n) => {
    if (n.querySelector('h2')?.textContent === 'Język · Language') n.remove();
  });
  return (copy.textContent ?? '')
    .replaceAll(TAGLINE, '')
    .replaceAll(FREE_NOTE, '')
    .replaceAll('“Wyślij teraz”', '')
    .replaceAll('“Odłącz”', '');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_GARMIN_APP_URL', 'https://apps.garmin.com/apps/x');
  vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.com/zdrowie.apk');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BElzZ2V4YW1wbGU');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const noop = () => undefined;

describe('settings (English visit)', () => {
  it('the whole settings page with both devices connected has no Polish', async () => {
    localStorage.setItem('gt-garmin-key', KEY);
    localStorage.setItem('gt-phone-key', 'cd'.repeat(32));
    const { SettingsView } = await import('./views');
    const state = withDevices();
    render(
      <SettingsView
        state={state}
        onFeedback={noop}
        onReminders={noop}
        onWatchSync={async () => ({ kind: 'skip' })}
        onPhoneSync={async () => ({ kind: 'skip' })}
        onToast={noop}
        onClockPref={noop}
        onIntro={noop}
        onInstall={noop}
        onWeights={noop}
        onStartWeight={noop}
        onExport={noop}
        onImport={noop}
        onReset={noop}
        onRecalibrate={noop}
      />,
    );
    // Karta przypomnień czeka na stan powiadomień (bez service workera: „nie obsługuje”).
    expect(await screen.findByRole('heading', { name: 'Reminders' })).toBeInTheDocument();
    expect(screen.getByText(/^This browser doesn’t support notifications from websites/)).toBeInTheDocument();

    for (const name of [
      'Recommend to friends',
      'App on your Home Screen',
      'Garmin watch',
      'Health from your phone',
      'Workout time in the top bar',
      'Feedback and bugs',
      'Contact',
      'Your kettlebells',
      'Calibration',
      'Starting levels',
      'Introduction',
      'Data backup',
      'How progression works',
      'Health and safety',
      'Reset',
    ])
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();

    expect(screen.getByText('Working — last upload today 14:32 (12 min ago), next around 15:02.')).toBeInTheDocument();
    expect(screen.getByText('Today’s steps from the watch: 7,300 (as of 14:32 — they grow with every upload).')).toBeInTheDocument();
    expect(screen.getByText('The next upload is late — it was due around 12:00. Last one: today 11:00 (3 hours ago).')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Workout time in the top bar' })).toHaveTextContent('OnOff');
    expect(screen.getByRole('button', { name: 'Export file' })).toBeInTheDocument();
    expect(document.querySelector('footer')).toHaveTextContent(/Exercises in the library: \d+\.$/);

    const text = await englishText();
    expect(text.match(POLISH)?.[0] ?? null).toBeNull();
  });

  it('device cards before connecting: English buttons and setup text', async () => {
    const { GarminCard } = await import('./Garmin');
    const { PhoneCard } = await import('./Phone');
    const state = freshState();
    render(
      <>
        <GarminCard state={state} onSync={async () => ({ kind: 'skip' })} onToast={noop} />
        <PhoneCard state={state} onSync={async () => ({ kind: 'skip' })} onToast={noop} />
      </>,
    );
    // Karta zegarka zaczyna od sprawdzenia modelu (leniwa paczka); połączyć da się i bez niego.
    expect(await screen.findByRole('combobox', { name: 'Which watch do you have?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect without checking' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Popular:' })).toHaveTextContent('Forerunner 55');
    expect(screen.getByRole('link', { name: 'Check your model →' })).toHaveAttribute('href', '#/zegarek');
    expect(screen.getByRole('button', { name: 'Connect phone' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'I already have a key from another device' })).toHaveLength(2);
    expect((await englishText()).match(POLISH)?.[0] ?? null).toBeNull();
  });
});

describe('device status words (English visit)', () => {
  it('pure text functions speak English', async () => {
    const ds = await import('../deviceStatus');
    const { statusText, lineText } = await import('./DeviceStatus');
    const { whenText } = await import('../garmin');
    const now = NOW.getTime();
    const min = 60_000;
    expect(ds.agoText(now - 30_000, now)).toBe('just now');
    expect(ds.agoText(now - 12 * min, now)).toBe('12 min ago');
    expect(ds.agoText(now - 60 * min, now)).toBe('1 hour ago');
    expect(ds.sinceText(7 * 60)).toBe('7 hours');
    expect(ds.sinceText(30 * 60)).toBe('a day');
    expect(ds.sinceText(3 * 1440)).toBe('3 days');
    expect(ds.atText(new Date(2026, 9, 1, 21, 40).getTime(), now)).toBe('1 Oct 21:40');
    expect(whenText(new Date(2026, 9, 21, 7, 30).toISOString(), NOW)).toBe('yesterday 7:30');

    const stale = ds.deviceStatus({ lastT: at(7, 30), got: null, kind: 'ok', hasKey: true, nowMs: now, cadenceMin: 30 });
    expect(statusText('watch', stale, now)).toBe('No data for 7 hours — last upload today 7:30.');
    expect(lineText('phone', stale, now)).toBe('Phone: no data for 7 hours.');
    const setup = ds.deviceStatus({ lastT: null, got: null, kind: null, hasKey: true, nowMs: now, cadenceMin: 60 });
    expect(lineText('watch', setup, now)).toBe('Watch: waiting for the first upload.');

    expect(ds.checkSaid('watch', null, { kind: 'ok', payload: { t: at(14, 40) } }, now)).toBe('A new upload arrived (14:40).');
    expect(ds.checkSaid('phone', at(14, 0), { kind: 'empty' }, now)).toBe(
      'There’s no upload on the server — the phone hasn’t sent anything for over a week. Check “Data not arriving?”.',
    );
    expect(ds.checkSaid('watch', null, { kind: 'skip' }, now)).toBe('Try again in a moment.');
  });

  it('screen titles, tabs and contact links', async () => {
    const { TABS, screenOf, SECTIONS } = await import('../routing');
    const { contactLinks } = await import('../contact');
    expect(TABS.map((t) => t.label)).toEqual(['Today', 'Training', 'Food', 'Awards', 'Profile']);
    expect(SECTIONS.work.map((s) => s.label)).toEqual(['Plan', 'Workouts', 'Exercises']);
    expect(screenOf({ kind: 'tab', tab: 'set' }).title).toBe('Settings');
    expect(screenOf({ kind: 'cardio' }).title).toBe('Steps & cardio');
    expect(screenOf({ kind: 'cardioAdd', sport: 'treadmill' }).title).toBe('Treadmill');
    expect(screenOf({ kind: 'diet', page: 'shopping' }).title).toBe('Shopping list');
    expect(contactLinks(true).map((l) => l.name)).toEqual(['Instagram', 'Discord', 'Buy an espresso']);
    expect(contactLinks(false).find((l) => l.id === 'support')?.note).toBe(
      'Support the author — pay by card from any country.',
    );
  });
});

describe('profile (English visit)', () => {
  /** Pięć sesji tego samego ćwiczenia z kettlebellem, coraz cięższych — jest z czego liczyć kierunek. */
  const withHistory = async (): Promise<{ state: AppState; id: string }> => {
    const { WEIGHTED } = await import('../data/exercises');
    const id = WEIGHTED[0]!;
    const state = freshState();
    state.log = [12, 12, 16, 16, 20].map((w, i) => ({
      date: `2026-10-${String(1 + i * 5).padStart(2, '0')}T18:00:00.000Z`,
      workout: 'Workout A',
      ready: 'ok' as const,
      items: [{ id, sets: [10, 10, 9].map((reps) => ({ reps, w })), effort: 'solid' as const }],
    }));
    return { state, id };
  };

  /** Teksty tych części ekranu, które są z tego pliku — reszta profilu to cudze karty. */
  const own = (selector: string): string =>
    [...document.querySelectorAll(selector)].map((n) => n.textContent ?? '').join(' | ');

  it('profile tab: tiles, history and exercise list in English', async () => {
    const { state } = await withHistory();
    const { ProfileView } = await import('./Profile');
    render(<ProfileView state={state} onAvatar={noop} onWeight={noop} onHeight={noop} onDeleteWeight={noop} onToast={noop} />);
    expect(screen.getByText('Your exercises')).toBeInTheDocument();
    expect(screen.getByText('Workout history')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exercise snacks' })).toBeInTheDocument();
    expect(own('.tiles')).toContain('training age');
    expect(own('.streak')).toContain('kg·reps');
    expect(own('.ex-target')).toMatch(/^5 sessions · today · ▲ \d+%$/);
    // Własne części profilu: wstęp, kafelki, nagłówki list, wiersze i karta przekąsek (bez cudzych kart obok).
    const snacks = screen.getByRole('heading', { name: 'Exercise snacks' }).closest('.grp')!.textContent ?? '';
    const mine = `${own('.wrap > .lead, .tiles, .sect-label, .ex-target, .streak')} | ${snacks}`;
    expect(mine.match(POLISH)?.[0] ?? null).toBeNull();
  });

  it('one exercise’s history: trend, tiles and sessions in English', async () => {
    const { state, id } = await withHistory();
    const { ExerciseStatsPage } = await import('./Profile');
    render(<ExerciseStatsPage state={state} id={id} />);
    expect(screen.getByRole('heading', { name: 'How it went' })).toBeInTheDocument();
    expect(screen.getByText('Session by session')).toBeInTheDocument();
    expect(own('.trend')).toMatch(/^Up \d+% — from /);
    expect(own('.h-detail')).toContain('solid');
    const mine = own('.trend, .grp > .tight, .tiles, .sect-label, .h-detail, .wrap > .tight');
    expect(mine.match(POLISH)?.[0] ?? null).toBeNull();
  });
});

describe('app shell (English visit)', () => {
  it('top bar, intro, contact and feedback windows have no Polish', async () => {
    const { TopBar } = await import('./TopBar');
    const { Intro } = await import('./Intro');
    const { ContactDialog } = await import('./Contact');
    const { FeedbackDialog } = await import('./Feedback');
    const { InstallSteps } = await import('./Install');
    render(
      <>
        <TopBar
          title="Settings"
          parent="#/profil"
          strip={false}
          onSnooze={noop}
          install={{ onOpen: noop, onHide: noop }}
          settings
          onFeedback={noop}
          onContact={noop}
        />
        <Intro onDone={noop} />
        <ContactDialog onClose={noop} onFeedback={noop} pl={false} />
        <FeedbackDialog state={freshState()} onClose={noop} onSent={noop} />
        <InstallSteps place="in-app" reminders />
      </>,
    );
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write to the author — feedback or a bug' })).toBeInTheDocument();
    expect(screen.getByText('Add to your Home Screen — your data will be safe.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Training that does the maths' })).toBeInTheDocument();
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contact the author' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect((await englishText()).match(POLISH)?.[0] ?? null).toBeNull();
  });

  it('error screens, load gauge and the weight chip', async () => {
    const { RootBoundary } = await import('./RootBoundary');
    const { LoadBoundary } = await import('./LoadBoundary');
    const { LoadGauge } = await import('./views');
    const { Chip } = await import('./ui');
    const { ALL, ex } = await import('../data/exercises');
    const { P } = await import('../engine/plan');
    const state = freshState();
    const bodyweight = ALL.find((id) => ex(id).mode !== 'stage' && P(state, id).weight === null)!;
    const Boom = (): never => {
      throw new Error('boom');
    };
    vi.spyOn(console, 'error').mockImplementation(noop);
    render(
      <>
        <RootBoundary>
          <Boom />
        </RootBoundary>
        <LoadBoundary what="the Food tab">
          <Boom />
        </LoadBoundary>
        <LoadGauge state={state} />
        <Chip state={state} id={bodyweight} />
      </>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Couldn’t load the Food tab')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Refresh' })).toHaveLength(2);
    expect(screen.getByText('Load over time')).toBeInTheDocument();
    expect(document.querySelector('.chip')).toHaveTextContent('BODYWEIGHT');
    expect((await englishText()).match(POLISH)?.[0] ?? null).toBeNull();
  });
});
