// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshState } from '../engine/plan';
import { mergePhone, parsePhonePayload } from '../engine/phone';
import { mergeWatch, parsePayload } from '../engine/watch';
import { deriveKeys, newKey, seal } from '../watchseal';
import type { AppState } from '../types';

/**
 * Stan połączenia na ekranach: karta zegarka (zdanie ze stanem, dzisiejsze kroki, wynik „Sprawdź
 * teraz”, lista „Dane nie przychodzą?” w kolejności przyczyn), karta telefonu, linia na ekranie
 * kroków i uwaga na ekranie Dziś — ta ostatnia tylko przy spóźnieniu.
 *
 * Adresy przychodzą z buildu, a skrzynka pamięta wynik ostatniego sprawdzenia w module, więc
 * moduły wczytywane są na nowo po podmianie zmiennych. „Teraz” to 22.10.2026, 14:44 czasu
 * lokalnego — podmieniony jest tylko zegar (`Date`), żeby user-event dalej miał swoje timery.
 */

const NOW = new Date(2026, 9, 22, 14, 44);
const DAY = '2026-10-22';
const KEY = 'ab'.repeat(32);
const at = (h: number, m: number): number => Math.floor(new Date(2026, 9, 22, h, m).getTime() / 1000);

const withWatch = (t: number, steps?: number): AppState => {
  const s = freshState();
  const p = parsePayload({ v: 1, t, d: steps ? [[DAY, steps]] : [], a: [], h: [] }, NOW.getTime())!;
  mergeWatch(s, p, new Date(t * 1000 + 30_000));
  return s;
};

const withPhone = (t: number, os: 'ios' | 'android' = 'android'): AppState => {
  const s = freshState();
  mergePhone(s, parsePhonePayload({ v: 1, k: 'phone', os, t, d: [{ day: DAY, steps: 4100 }], a: [] }, NOW.getTime())!);
  return s;
};

/** Odpowiedź serwera na `/garmin/pull` — bez sieci. */
const serverSays = (status: number, body: unknown = null) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, json: async () => body }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_GARMIN_APP_URL', 'https://apps.garmin.com/apps/x');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const checklist = () => screen.getByRole('list', { name: 'Dane nie przychodzą?' });
const items = () => within(checklist()).getAllByRole('listitem');
/** Najbardziej prawdopodobna przyczyna — pod pytaniem o model, które stoi na górze, dopóki nie wybrano modelu. */
const firstCheck = () => items().find((li) => !/^Czy Twój model jest obsługiwany\?/.test(li.textContent ?? ''))!;

describe('karta zegarka: stan połączenia', () => {
  const card = async (state: AppState, onSync?: () => Promise<unknown>) => {
    localStorage.setItem('gt-garmin-key', KEY);
    const garmin = await import('../garmin');
    const { GarminCard } = await import('./Garmin');
    const onToast = vi.fn();
    const sync = vi.fn(onSync ?? (() => garmin.pullWatch(true)));
    render(<GarminCard state={state} onSync={sync as never} onToast={onToast} />);
    return { onToast, sync };
  };

  it('działa: ostatnia i następna paczka, dzisiejsze kroki, lista zwinięta', async () => {
    await card(withWatch(at(14, 32), 7300));
    expect(screen.getByText('Działa — ostatnia paczka dziś 14:32 (12 min temu), następna ok. 15:02.')).toBeInTheDocument();
    expect(
      screen.getByText('Dzisiejsze kroki z zegarka: 7300 (stan z 14:32 — rosną z każdą paczką).'),
    ).toBeInTheDocument();
    expect(checklist().closest('details')).not.toHaveAttribute('open');
    // Przy działającym połączeniu nikt nie musi czytać o Bluetooth — ale lista jest pod ręką.
    expect(screen.getByText('Dane nie przychodzą?', { selector: 'summary' })).toBeInTheDocument();
  });

  it('spóźnia się: kiedy miała przyjść, przyczyny, lista rozwinięta z Bluetooth na górze', async () => {
    await card(withWatch(at(13, 10)));
    expect(
      screen.getByText('Kolejna paczka się spóźnia — miała przyjść ok. 13:40. Ostatnia: dziś 13:10 (1 godz. temu).'),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Najczęściej telefon jest za daleko od zegarka, Bluetooth jest wyłączony/)).toBeInTheDocument();
    expect(screen.getByText('Dzisiejszych danych z zegarka jeszcze nie ma.')).toBeInTheDocument();
    expect(checklist().closest('details')).toHaveAttribute('open');
    expect(firstCheck()).toHaveTextContent(/^Bluetooth na telefonie włączony/);
    // Ekran zegarka mówi to samo co lista: ostatnią wysyłkę i brak telefonu.
    expect(within(checklist()).getByText(/Ekran GYM TRACKER na zegarku/).closest('li')).toHaveTextContent(
      '„Brak telefonu - Bluetooth?” (No phone)',
    );
  });

  it('od dawna nic: ile godzin, a na górze listy Garmin Connect w tle', async () => {
    await card(withWatch(at(7, 30)));
    expect(screen.getByText('Brak danych od 7 godz. — ostatnia paczka dziś 7:30.')).toBeInTheDocument();
    expect(checklist().closest('details')).toHaveAttribute('open');
    expect(firstCheck()).toHaveTextContent(/^Garmin Connect zainstalowany, zalogowany i może działać w tle/);
    expect(firstCheck()).toHaveTextContent('Bateria → Bez ograniczeń');
  });

  it('przed pierwszą paczką: co zrobić; lista rozwija się dopiero, gdy serwer nic nie ma', async () => {
    serverSays(404);
    const user = userEvent.setup();
    const { onToast } = await card(freshState());
    expect(screen.getByText(/^Czeka na pierwszą paczkę\. Wklej klucz w ustawieniach GYM TRACKER na zegarku/)).toBeInTheDocument();
    expect(checklist().closest('details')).not.toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }));
    expect(await screen.findByText('Sprawdzone przed chwilą.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Zegarek jeszcze nic nie przysłał/);
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/^Zegarek jeszcze nic nie przysłał/));
    expect(checklist().closest('details')).toHaveAttribute('open');
    expect(firstCheck()).toHaveTextContent(/^Klucz z tej karty wklejony w ustawieniach GYM TRACKER/);
    expect(firstCheck()).toHaveTextContent('Connect IQ Store');
  });

  it('„Sprawdź teraz”: ta sama paczka to „bez nowej”, nowsza — „przyszła nowa”', async () => {
    const user = userEvent.setup();
    const reply = vi.fn().mockResolvedValue({ kind: 'ok', payload: { t: at(14, 32), days: [], acts: [], health: [] } });
    await card(withWatch(at(14, 32)), reply);
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Bez nowej paczki — ostatnia z 14:32, zegarek wysyła co ok. 30 min. Chcesz teraz? Otwórz GYM TRACKER na zegarku i naciśnij START.',
    );
    reply.mockResolvedValue({ kind: 'ok', payload: { t: at(14, 40), days: [], acts: [], health: [] } });
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }));
    expect(screen.getByRole('status')).toHaveTextContent('Przyszła nowa paczka (14:40).');
  });

  it('zły klucz: mówi o kluczu, zostawia ostatnią dobrą paczkę i stawia klucz na górze listy', async () => {
    const other = (await deriveKeys(newKey()))!;
    serverSays(200, { blob: await seal(other, JSON.stringify({ v: 1, t: at(14, 40), d: [], a: [], h: [] })) });
    const user = userEvent.setup();
    await card(withWatch(at(14, 32)));
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }));
    expect(
      await screen.findByText(
        'Zły klucz. Paczka z zegarka nie otwiera się tym kluczem — na zegarku jest pewnie inny. Wklej klucz z tej karty jeszcze raz. Ostatnia dobra paczka: dziś 14:32 (12 min temu).',
      ),
    ).toBeInTheDocument();
    expect(firstCheck()).toHaveTextContent(/^Klucz z tej karty/);
  });

  it('bez sieci: nie zgaduje, tylko mówi, że nie może zapytać — i co było ostatnio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const user = userEvent.setup();
    await card(withWatch(at(14, 32)));
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }));
    expect(
      await screen.findByText(
        'Nie mogę teraz zapytać serwera — sprawdź internet w tym urządzeniu. Ostatnio znane: paczka dziś 14:32 (12 min temu).',
      ),
    ).toBeInTheDocument();
  });

  it('karta ma kotwicę dla linków „Stan połączenia”', async () => {
    await card(withWatch(at(14, 32)));
    expect(screen.getByRole('heading', { name: 'Zegarek Garmin' }).closest('.grp')).toHaveAttribute('id', 'zegarek');
  });
});

describe('karta zegarka: model i lista „Dane nie przychodzą?”', () => {
  const remember = (model: Record<string, unknown>) => localStorage.setItem('gt-garmin-model', JSON.stringify(model));

  const card = async (state: AppState = freshState(), onFeedback?: () => void) => {
    localStorage.setItem('gt-garmin-key', KEY);
    const { GarminCard } = await import('./Garmin');
    render(<GarminCard state={state} onSync={vi.fn()} onToast={vi.fn()} onFeedback={onFeedback} />);
  };

  it('klucz w ustawieniach na zegarku: Garmin Connect albo Connect IQ Store — bez zdania o becie', async () => {
    await card();
    const key = items().find((li) => /^Klucz z tej karty wklejony/.test(li.textContent ?? ''))!;
    expect(key).toHaveTextContent(
      'W Garmin Connect: zegarek → Aktywności i aplikacje → GYM TRACKER → Ustawienia. Te same ustawienia są też w aplikacji Connect IQ Store: urządzenie → GYM TRACKER → Ustawienia.',
    );
    expect(key).not.toHaveTextContent('beta');
    expect(key).not.toHaveTextContent('W wersji testowej');
  });

  it('bez wybranego modelu na górze listy: „Czy Twój model jest obsługiwany? Sprawdź →” otwiera sprawdzanie', async () => {
    const user = userEvent.setup();
    await card();
    expect(items()[0]).toHaveTextContent('Czy Twój model jest obsługiwany? Sprawdź →');
    expect(screen.queryByText(/^Wybrany model/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Czy Twój model jest obsługiwany? Sprawdź →' }));
    // Paczka sprawdzania wczytuje się leniwie; pole od razu czeka na nazwę.
    const field = await screen.findByRole('combobox', { name: 'Jaki masz zegarek?' });
    await waitFor(() => expect(field).toHaveFocus());
    // Zegarek już połączony: wynik bez „Połącz zegarek”.
    await user.type(field, 'fr 265{Enter}');
    expect(await screen.findByRole('heading', { name: 'Forerunner® 265 · Obsługiwany' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Połącz zegarek' })).not.toBeInTheDocument();
    // Wybór zostaje zapamiętany: linia nad listą, a pytanie o model znika z listy.
    expect(screen.getByText('Wybrany model: Forerunner® 265 — obsługiwany.')).toBeInTheDocument();
    expect(items()[0]).not.toHaveTextContent('Czy Twój model');
    await user.click(screen.getByRole('button', { name: 'Zwiń' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zmień model' })).toBeInTheDocument();
  }, 15_000);

  it('wybrany model z brakami: „Wybrany model”, czego nie będzie i krok aktualizacji przed instalacją', async () => {
    remember({ key: 'fenix5plus', name: 'fēnix® 5 Plus', v: 'part', lacks: ['bodyBattery'], newest: ['stress', 'rides'] });
    await card();
    expect(screen.getByText('Wybrany model: fēnix® 5 Plus — bez części danych.')).toBeInTheDocument();
    expect(
      screen.getByText('Ten model nie udostępnia aplikacjom Body Battery — w „Z zegarka” ich nie będzie.'),
    ).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Kroki połączenia' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent(/^Najpierw zaktualizuj oprogramowanie zegarka: zsynchronizuj go z Garmin Connect/);
    expect(steps[1]).toHaveTextContent(/^Zainstaluj na zegarku aplikację GYM TRACKER z Connect IQ Store\. Jeśli sklep pisze/);
    expect(items()[0]).not.toHaveTextContent('Czy Twój model');
  });

  it('nieobsługiwany model mimo połączenia: przypomnienie o telefonie', async () => {
    remember({ key: 'vivoactive3', name: 'vívoactive® 3', v: 'no' });
    await card();
    expect(screen.getByText('Wybrany model: vívoactive® 3 — nieobsługiwany.')).toBeInTheDocument();
    expect(
      screen.getByText('vívoactive® 3 nie działa z aplikacją na zegarek — dane może przynieść telefon („Zdrowie z telefonu”).'),
    ).toBeInTheDocument();
    // Bez aktualizacji w danych — instalacja to pierwszy krok.
    const steps = within(screen.getByRole('list', { name: 'Kroki połączenia' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent(/^Zainstaluj na zegarku/);
  });

  it('model z małą pamięcią na pracę w tle czeka na pierwszą paczkę: uwaga na górze i „Napisz do autora”', async () => {
    remember({ key: 'fr55', name: 'Forerunner® 55', v: 'ok', bg: 32 });
    const user = userEvent.setup();
    const onFeedback = vi.fn();
    await card(freshState(), onFeedback);
    expect(items()[0]).toHaveTextContent(
      /^Ten model ma mało pamięci na pracę w tle i nie był jeszcze sprawdzony na prawdziwym zegarku\. Jeśli dane nie przychodzą, napisz — to pomoże\./,
    );
    await user.click(within(items()[0]!).getByRole('button', { name: 'Napisz do autora' }));
    expect(onFeedback).toHaveBeenCalledOnce();
  });

  it('bez okna uwag uwaga o pamięci zostaje, ale bez przycisku', async () => {
    remember({ key: 'fr55', name: 'Forerunner® 55', v: 'ok', bg: 32 });
    await card();
    expect(items()[0]).toHaveTextContent(/^Ten model ma mało pamięci/);
    expect(within(items()[0]!).queryByRole('button')).not.toBeInTheDocument();
  });

  it('uwaga o pamięci tylko przy czekaniu na pierwsze dane i tylko dla modeli z 32 kB', async () => {
    remember({ key: 'fr55', name: 'Forerunner® 55', v: 'ok', bg: 32 });
    await card(withWatch(at(14, 32), 7300));
    expect(screen.queryByText(/mało pamięci/)).not.toBeInTheDocument();
  });

  it('64 kB pamięci na pracę w tle — bez uwagi, także przed pierwszą paczką', async () => {
    remember({ key: 'fr265', name: 'Forerunner® 265', v: 'ok', bg: 64 });
    await card();
    expect(screen.queryByText(/mało pamięci/)).not.toBeInTheDocument();
  });

  it('#/zegarek przewija ustawienia do karty zegarka, a nie do karty telefonu', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    window.history.replaceState(null, '', '#/zegarek');
    try {
      await card();
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll.mock.contexts[0]).toBe(screen.getByRole('heading', { name: 'Zegarek Garmin' }).closest('.grp'));
    } finally {
      window.history.replaceState(null, '', '#/');
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe('przejście do karty na tym samym ekranie', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/');
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('goToCard przewija do karty i zapisuje ją w adresie bez nowego wpisu w historii', async () => {
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.replaceState(null, '', '#/ustawienia');
    const { GarminCard } = await import('./Garmin');
    const { PhoneCard } = await import('./Phone');
    const { goToCard } = await import('./DeviceStatus');
    render(
      <>
        <GarminCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} />
        <PhoneCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} />
      </>,
    );
    const length = window.history.length;
    const changes = vi.fn();
    window.addEventListener('hashchange', changes);
    goToCard('phone');
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('telefon'));
    expect(window.location.hash).toBe('#/ustawienia?karta=telefon');
    // Z `#/zegarek?model=…` zostaje adres zegarka i model — dochodzi tylko karta.
    window.history.replaceState(null, '', '#/zegarek?model=fr265');
    goToCard('phone');
    expect(window.location.hash).toBe('#/zegarek?model=fr265&karta=telefon');
    await new Promise((r) => setTimeout(r, 0));
    expect(changes).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
    window.removeEventListener('hashchange', changes);
  });
});

describe('karta telefonu: stan połączenia', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    localStorage.setItem('gt-phone-key', KEY);
  });

  const card = async (state: AppState) => {
    const { PhoneCard } = await import('./Phone');
    render(<PhoneCard state={state} onSync={vi.fn()} onToast={vi.fn()} />);
  };

  it('działa: co godzinę, z dzisiejszymi krokami i źródłem', async () => {
    await card(withPhone(at(14, 0)));
    expect(screen.getByText('Działa — ostatnia paczka dziś 14:00 (44 min temu), następna ok. 15:00.')).toBeInTheDocument();
    expect(
      screen.getByText('Dzisiejsze kroki z telefonu (Health Connect): 4100 (stan z 14:00 — rosną z każdą paczką).'),
    ).toBeInTheDocument();
  });

  it('spóźnia się: lista dla Androida, z baterią na górze i „dostępem w tle”', async () => {
    await card(withPhone(at(12, 0)));
    expect(screen.getByText(/^Kolejna paczka się spóźnia — miała przyjść ok\. 13:00\./)).toBeInTheDocument();
    expect(screen.getByText(/^Najczęściej telefon uśpił GYM TRACKER Zdrowie/)).toBeInTheDocument();
    expect(checklist().closest('details')).toHaveAttribute('open');
    expect(firstCheck()).toHaveTextContent(/^Aplikacja może działać w tle\. Android: .*Bez ograniczeń/);
    expect(firstCheck()).not.toHaveTextContent('iPhone');
    expect(checklist()).toHaveTextContent('„dostęp w tle”');
    expect(checklist()).toHaveTextContent('„Wyślij teraz”');
  });
});

describe('poza ustawieniami', () => {
  it('ekran Dziś: uwaga tylko przy spóźnieniu i dopiero po pytaniu serwera', async () => {
    localStorage.setItem('gt-garmin-key', KEY);
    serverSays(404);
    const garmin = await import('../garmin');
    const { CardioCard } = await import('./Cardio');

    // Przed pierwszym pytaniem serwera nic: nowa paczka może właśnie czekać.
    const first = render(<CardioCard state={withWatch(at(12, 0))} />);
    expect(screen.queryByRole('link', { name: /nie przysłał danych/ })).not.toBeInTheDocument();
    first.unmount();

    await garmin.pullWatch(true);
    const late = render(<CardioCard state={withWatch(at(12, 0))} />);
    expect(screen.getByRole('link', { name: 'Zegarek nie przysłał danych od 3 godz. — sprawdź połączenie →' })).toHaveAttribute(
      'href',
      '#/ustawienia?karta=zegarek',
    );
    late.unmount();

    // Wszystko w porządku — ani słowa.
    render(<CardioCard state={withWatch(at(14, 32), 7300)} />);
    expect(screen.queryByRole('link', { name: /nie przysłał danych/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Zegarek/)).not.toBeInTheDocument();
  });

  it('ekran kroków: linia stanu nad danymi z zegarka, z drogą do karty', async () => {
    localStorage.setItem('gt-garmin-key', KEY);
    const { CardioPage } = await import('./Cardio');
    render(<CardioPage state={withWatch(at(14, 32), 7300)} onDelete={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'Stan połączenia →' });
    expect(link).toHaveAttribute('href', '#/ustawienia?karta=zegarek');
    expect(link.closest('p')).toHaveTextContent('Zegarek działa — ostatnia paczka 12 min temu, następna ok. 15:02.');
    expect(screen.getByText('Z zegarka')).toBeInTheDocument();
  });

  it('ekran kroków bez połączonego zegarka: bez linii', async () => {
    const { CardioPage } = await import('./Cardio');
    render(<CardioPage state={withWatch(at(14, 32), 7300)} onDelete={vi.fn()} />);
    expect(screen.queryByRole('link', { name: 'Stan połączenia →' })).not.toBeInTheDocument();
  });
});
