// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshState } from '../engine/plan';
import { mergePhone, parsePhonePayload } from '../engine/phone';
import { localDayOf } from '../engine/watch';
import { addDays, dayKey } from '../engine/schedule';
import { BodyCard, CardioPage } from './Cardio';
import type { AppState } from '../types';

/**
 * Zdrowie z telefonu na ekranach: karta w ustawieniach (adresy z buildu, więc moduły wczytywane
 * na nowo po podmianie zmiennych), wpisy „z telefonu”, liczby zdrowia i propozycja ważenia.
 */

const today = dayKey(Date.now());

const withPhone = (days: Record<string, unknown>[], os: 'ios' | 'android' = 'ios'): AppState => {
  const s = freshState();
  mergePhone(s, parsePhonePayload({ v: 1, k: 'phone', os, t: Math.floor(Date.now() / 1000) - 60, d: days, a: [] })!);
  return s;
};

describe('karta „Zdrowie z telefonu”', () => {
  const ua = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
  const asPhone = (s: string) => Object.defineProperty(window.navigator, 'userAgent', { value: s, configurable: true });

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.stubEnv('VITE_API_URL', 'https://api.example');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    if (ua) Object.defineProperty(window.navigator, 'userAgent', ua);
    else delete (window.navigator as { userAgent?: string }).userAgent;
  });

  const card = async (state: AppState = freshState()) => {
    const { PhoneCard } = await import('./Phone');
    const onToast = vi.fn();
    const onSync = vi.fn().mockResolvedValue({ kind: 'empty' });
    render(<PhoneCard state={state} onSync={onSync} onToast={onToast} />);
    return { onToast, onSync };
  };

  it('bez adresu żadnej aplikacji karty nie ma', async () => {
    await card();
    expect(screen.queryByRole('heading', { name: 'Zdrowie z telefonu' })).not.toBeInTheDocument();
  });

  it('na Androidzie: połączenie daje klucz, instrukcję dla Androida i kopiowanie', async () => {
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    vi.stubEnv('VITE_HEALTH_IOS_URL', 'https://apps.apple.com/app/id1');
    asPhone('Mozilla/5.0 (Linux; Android 15; Pixel 9)');
    // user-event podstawia własny schowek — z niego czytamy, co skopiowano.
    const user = userEvent.setup();
    const { onToast } = await card();
    await user.click(screen.getByRole('button', { name: 'Połącz telefon' }));
    const key = (screen.getByLabelText('Klucz do aplikacji na telefonie') as HTMLTextAreaElement).value;
    expect(key).toMatch(/^([0-9a-f]{8} ){7}[0-9a-f]{8}$/);
    expect(localStorage.getItem('gt-phone-key')).toBe(key.replace(/ /g, ''));
    const steps = screen.getByRole('list', { name: 'Kroki połączenia' });
    expect(within(steps).getByRole('link', { name: 'pliku APK' })).toHaveAttribute('href', 'https://example.org/zdrowie.apk');
    expect(within(steps).queryByText(/iPhone/)).not.toBeInTheDocument();
    // Garmin najprościej przez telefon: Garmin Connect pisze do Health Connect.
    expect(within(steps).getByText(/Masz zegarek Garmin\? W aplikacji Garmin Connect/)).toHaveTextContent(
      'udostępnianie do Health Connect',
    );
    await user.click(screen.getByRole('button', { name: 'Kopiuj klucz' }));
    expect(await navigator.clipboard.readText()).toBe(key.replace(/ /g, ''));
    expect(onToast).toHaveBeenCalledWith('Klucz skopiowany — wklej go w aplikacji GYM TRACKER Zdrowie.');
  });

  it('na komputerze obie instrukcje; brakująca aplikacja mówi, że jej jeszcze nie ma', async () => {
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    asPhone('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const user = userEvent.setup();
    await card();
    await user.click(screen.getByRole('button', { name: 'Połącz telefon' }));
    expect(screen.getByText(/iPhone: aplikacji jeszcze nie ma/)).toBeInTheDocument();
    expect(screen.getByText(/Masz zegarek Garmin\? W aplikacji/)).toHaveTextContent('Apple Zdrowie albo Health Connect');
    expect(screen.getByRole('link', { name: 'pliku APK' })).toBeInTheDocument();
  });

  it('zdanie o zegarku Garmin: obie drogi naraz i link do sprawdzenia modelu w karcie zegarka', async () => {
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    const user = userEvent.setup();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.replaceState(null, '', '#/ustawienia');
    try {
      const { GarminCard } = await import('./Garmin');
      const { PhoneCard } = await import('./Phone');
      render(
        <>
          <GarminCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} />
          <PhoneCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} />
        </>,
      );
      const sentence = screen.getByText(/^Masz zegarek Garmin\?/).closest('p')!;
      expect(sentence).toHaveTextContent(
        'Masz zegarek Garmin? Garmin Connect przekaże jego dane przez telefon — razem ze snem i wagą. Aplikacja GYM TRACKER na zegarku dokłada stres i Body Battery, a oba połączenia mogą działać naraz. Sprawdź swój model →',
      );
      const link = within(sentence).getByRole('link', { name: 'Sprawdź swój model →' });
      expect(link).toHaveAttribute('href', '#/zegarek');
      // Karta zegarka stoi wyżej na tym samym ekranie: przewinięcie do niej, bez nowej trasy.
      await user.click(link);
      expect(scroll.mock.contexts[0]).toBe(document.getElementById('zegarek'));
      expect(window.location.hash).toBe('#/ustawienia?karta=zegarek');
    } finally {
      window.history.replaceState(null, '', '#/');
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('zły klucz z innego urządzenia nie przechodzi', async () => {
    vi.stubEnv('VITE_HEALTH_IOS_URL', 'https://apps.apple.com/app/id1');
    const user = userEvent.setup();
    const { onToast } = await card();
    await user.click(screen.getByRole('button', { name: 'Mam już klucz z innego urządzenia' }));
    await user.type(screen.getByRole('textbox'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Zapisz klucz' }));
    expect(onToast).toHaveBeenCalledWith('Klucz to 64 znaki: cyfry i litery od a do f.');
    expect(localStorage.getItem('gt-phone-key')).toBeNull();
  });

  it('po pierwszych danych: skąd i kiedy przyszły, klucz schowany, „Sprawdź teraz” pyta serwer', async () => {
    vi.stubEnv('VITE_HEALTH_IOS_URL', 'https://apps.apple.com/app/id1');
    localStorage.setItem('gt-phone-key', 'ab'.repeat(32));
    const user = userEvent.setup();
    // Dzień telefonu, nie dzień UTC aplikacji — karta pyta o kroki z dnia według zegara telefonu.
    const { onSync, onToast } = await card(withPhone([{ day: localDayOf(new Date()), steps: 5000 }]));
    expect(screen.getByText(/^Działa — ostatnia paczka dziś \d+:\d\d \(1 min temu\), następna (jutro )?ok\. \d+:\d\d\.$/)).toBeInTheDocument();
    expect(screen.getByText(/^Dzisiejsze kroki z telefonu \(Zdrowie\): 5000 \(stan z \d+:\d\d — rosną z każdą paczką\)\.$/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Klucz do aplikacji na telefonie')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }));
    expect(onSync).toHaveBeenCalledOnce();
    // Pusta skrzynka przy danych w zapisie: telefon milczy od ponad tygodnia (serwer trzyma paczkę 7 dni).
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('telefon nic nie wysłał od ponad tygodnia'));
    expect(screen.getByRole('status')).toHaveTextContent('telefon nic nie wysłał od ponad tygodnia');
    expect(screen.getByRole('link', { name: 'Polityka prywatności' })).toHaveAttribute('href', 'privacy.html');
    await user.click(screen.getByRole('button', { name: 'Pokaż klucz' }));
    expect(screen.getByLabelText('Klucz do aplikacji na telefonie')).toBeInTheDocument();
  });
});

describe('ekran kroków i cardio z telefonem', () => {
  it('kroki z telefonu bez krzyżyka i z dopiskiem; zdrowie z telefonu bez oceny', () => {
    const s = withPhone([
      { day: today, steps: 9120, rhr: 52, hrMin: 48, hrAvg: 71, hrMax: 142, sleep: 432, kg: 82.4 },
      { day: addDays(today, -1), sleep: 45 },
    ]);
    render(<CardioPage state={s} onDelete={vi.fn()} />);
    expect(screen.getByText('· z telefonu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuń wpis/ })).not.toBeInTheDocument();
    expect(screen.getByText('Z telefonu')).toBeInTheDocument();
    expect(
      screen.getByText('tętno spoczynkowe 52 · tętno 48–142, średnio 71 · sen 7 h 12 min · waga 82,4 kg'),
    ).toBeInTheDocument();
    expect(screen.getByText('sen 45 min')).toBeInTheDocument();
    expect(screen.getByText(/Liczby z Apple Zdrowie albo Health Connect/)).toBeInTheDocument();
  });
  it('kroki z drogą i piętrami z telefonu mają rozpis pod wpisem', () => {
    const s = withPhone([{ day: today, steps: 10_000, m: 8200, floors: 12 }]);
    render(<CardioPage state={s} onDelete={vi.fn()} />);
    expect(screen.getByText('droga z telefonu 8,2 km · 12 pięter')).toBeInTheDocument();
  });
});

describe('ważenie z telefonu', () => {
  const body = (state: AppState) => {
    const onWeight = vi.fn();
    render(<BodyCard state={state} onWeight={onWeight} onHeight={vi.fn()} onDeleteWeight={vi.fn()} onToast={vi.fn()} />);
    return onWeight;
  };

  it('nowsze ważenie z telefonu wchodzi do dziennika jednym przyciskiem, z jego dniem', async () => {
    const day = addDays(today, -1);
    const user = userEvent.setup();
    const onWeight = body(withPhone([{ day, kg: 82.4 }]));
    expect(screen.getByText(/Telefon ma nowsze ważenie: 82,4 kg/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wpisz do dziennika' }));
    expect(onWeight).toHaveBeenCalledWith(82.4, day);
  });

  it('bez nowszego ważenia nic nie proponuje', () => {
    const s = withPhone([{ day: addDays(today, -2), kg: 82.4 }]);
    s.body = [{ day: addDays(today, -1), kg: 82 }];
    body(s);
    expect(screen.queryByRole('button', { name: 'Wpisz do dziennika' })).not.toBeInTheDocument();
  });
});
