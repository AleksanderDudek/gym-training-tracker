// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { freshState } from '../engine/plan';
import { GARMIN_STORE_URL } from '../garmin';
import type WatchCheckType from './WatchCheck';

/**
 * „Czy mój zegarek jest obsługiwany?”: pole z podpowiedziami (combobox z WAI-ARIA, fokus po
 * wyborze na nagłówku wyniku), każda karta odpowiedzi z jednym następnym krokiem, droga przez
 * telefon dobrana do systemu, pełna lista i karta zegarka, której sprawdzanie jest pierwszym widokiem.
 *
 * Adresy aplikacji i serwera przychodzą z buildu, a moduły czytają je przy wczytaniu — stąd
 * `resetModules` i import po podmianie zmiennych. Liczby i kolejność podpowiedzi należą do
 * wyszukiwarki (`src/watches`), więc testy sprawdzają ekran, a nie ranking.
 */

const ua = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
const asPhone = (s: string) => Object.defineProperty(window.navigator, 'userAgent', { value: s, configurable: true });
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9)';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv('VITE_API_URL', 'https://api.example');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock('../watches/find');
  vi.doUnmock('./WatchCheck');
  if (ua) Object.defineProperty(window.navigator, 'userAgent', ua);
  else delete (window.navigator as { userAgent?: string }).userAgent;
  if (height) Object.defineProperty(window, 'innerHeight', height);
  window.history.replaceState(null, '', '#/');
});

type Props = ComponentProps<typeof WatchCheckType>;

const check = async (props: Partial<Props> = {}) => {
  const { default: WatchCheck } = await import('./WatchCheck');
  const onShown = vi.fn();
  const view = render(<WatchCheck onShown={onShown} {...props} />);
  return { onShown, rerender: (p: Partial<Props>) => view.rerender(<WatchCheck onShown={onShown} {...p} />) };
};

const field = () => screen.getByRole('combobox', { name: 'Jaki masz zegarek?' });
const options = () => screen.queryAllByRole('option');
const result = () => screen.getByRole('heading', { level: 3 }).closest('.wc-result') as HTMLElement;
const live = () => document.querySelector('.wc > .sr-only[aria-live="polite"]')!;

describe('pole z podpowiedziami', () => {
  it('combobox z WAI-ARIA: podpowiedzi od dwóch znaków, z odpowiedzią, nic nie jest podświetlone samo', async () => {
    const user = userEvent.setup();
    await check();
    const input = field();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('enterkeyhint', 'search');
    expect(input).toHaveAttribute('placeholder', 'np. Forerunner 265, fēnix 7, Venu 3');
    await user.type(input, 'f');
    expect(options()).toHaveLength(0);
    await user.type(input, 'r 26');
    const list = await screen.findByRole('listbox', { name: 'Jaki masz zegarek?' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(options().length).toBeGreaterThan(0);
    expect(options().every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);
    // Każda podpowiedź mówi od razu, czy model jest obsługiwany.
    expect(within(list).getByRole('option', { name: /^Forerunner® 265\s*obsługiwany$/ })).toBeInTheDocument();
  });

  it('strzałki chodzą po liście, Enter wybiera podświetloną, Escape najpierw zamyka listę, potem czyści', async () => {
    const user = userEvent.setup();
    await check();
    const input = field();
    await user.type(input, 'fr 26');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    const first = options()[0]!;
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    await user.keyboard('{ArrowDown}');
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    const name = first.querySelector('.wc-opt-name')!.textContent!;
    await user.keyboard('{Enter}');
    const head = screen.getByRole('heading', { level: 3 });
    expect(head).toHaveFocus();
    expect(head.textContent!.startsWith(`${name} · `)).toBe(true);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue(name.replace(/[®™]/g, ''));

    // Escape przy otwartej liście tylko ją zamyka — wpisany tekst zostaje.
    await user.clear(input);
    await user.type(input, 'fo');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('fo');
    // Drugi Escape czyści pole i wynik.
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('Enter bez podświetlenia i „Sprawdź” sprawdzają wpisany tekst; „Wyczyść” wraca do pustego pola', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'vivoactive 3{Enter}');
    expect(screen.getByRole('heading', { name: 'vívoactive® 3 · Nieobsługiwany' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Wyczyść' }));
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    await user.type(field(), 'fr 265');
    await user.click(screen.getByRole('button', { name: 'Sprawdź' }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 265 · Obsługiwany' })).toHaveFocus();
  });

  it('skrót przenosi fokus na nagłówek wyniku; skróty są tylko przy pustym polu bez wyniku', async () => {
    const user = userEvent.setup();
    await check();
    const chips = screen.getByRole('group', { name: 'Popularne:' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Forerunner 55',
      'Forerunner 165',
      'Forerunner 265',
      'Venu 3',
      'vívoactive 5',
      'fēnix 7',
    ]);
    await user.click(within(chips).getByRole('button', { name: 'Forerunner 55' }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 55 · Obsługiwany' })).toHaveFocus();
    expect(field()).toHaveValue('Forerunner 55');
    expect(screen.queryByRole('group', { name: 'Popularne:' })).not.toBeInTheDocument();
  });

  it('pole nie zaznacza swojego tekstu przy fokusie', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'fr 265{Enter}');
    expect(field()).not.toHaveFocus();
    await user.click(field());
    const input = field() as HTMLInputElement;
    expect(input).toHaveFocus();
    expect(input.selectionEnd! - input.selectionStart!).toBe(0);
  });

  it('niski ekran: najwyżej 5 podpowiedzi i „i N więcej — dopisz numer modelu”; zwykły — 8', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerHeight', { value: 650, configurable: true, writable: true });
    await check();
    await user.type(field(), 'fo');
    await screen.findByRole('listbox');
    expect(options()).toHaveLength(5);
    expect(screen.getByText(/^i \d+ więcej — dopisz numer modelu$/)).toBeInTheDocument();
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true, writable: true });
    await user.type(field(), 'r');
    await waitFor(() => expect(options()).toHaveLength(8));
  });

  it('czytnik ekranu słyszy liczbę podpowiedzi pół sekundy po ostatnim znaku, nie przy każdej literze', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'fo');
    const typed = Date.now();
    expect(live()).toHaveTextContent('');
    await waitFor(() => expect(live()).toHaveTextContent(/^\d+ podpowiedzi$/), { timeout: 5000 });
    expect(Date.now() - typed).toBeGreaterThanOrEqual(450);
    // Nic nie pasuje — też słychać, z podpowiedzią, co dalej.
    await user.type(field(), 'qqq');
    expect(live()).toHaveTextContent('');
    await waitFor(() => expect(live()).toHaveTextContent('Brak podpowiedzi — naciśnij Sprawdź.'), { timeout: 5000 });
  }, 15_000);
});

describe('karty odpowiedzi', () => {
  it('obsługiwany: co przyjdzie, „Połącz zegarek” tylko z połączeniem, w „Więcej” Connect IQ i uwagi tylko z oknem uwag', async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    const { onShown, rerender } = await check({ onConnect });
    await user.type(field(), 'fr 265{Enter}');
    const card = result();
    expect(card).toHaveClass('ok');
    expect(within(card).getByText('Przyjdą same: kroki, przejazdy rowerem, tętno, stres i Body Battery.')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Połącz zegarek' }));
    expect(onConnect).toHaveBeenCalledOnce();
    expect(onShown).toHaveBeenLastCalledWith('supported');
    const more = within(card).getByText('Więcej').closest('details')!;
    expect(more).toHaveTextContent('Connect IQ 5.2.0.');
    // Wersja Connect IQ nigdy w nagłówku.
    expect(screen.getByRole('heading', { level: 3 })).not.toHaveTextContent('Connect IQ');
    expect(within(more).queryByRole('button', { name: 'Coś nie działa? Napisz do autora' })).not.toBeInTheDocument();
    const onFeedback = vi.fn();
    rerender({ onFeedback });
    expect(within(result()).queryByRole('button', { name: 'Połącz zegarek' })).not.toBeInTheDocument();
    await user.click(within(result()).getByRole('button', { name: 'Coś nie działa? Napisz do autora' }));
    expect(onFeedback).toHaveBeenCalledOnce();
  });

  it('fēnix 5 Plus: bez Body Battery, stres i przejazdy po aktualizacji, wersja azjatycka w notce', async () => {
    await check({ initial: 'fenix5plus' });
    const head = screen.getByRole('heading', { name: 'fēnix® 5 Plus · Obsługiwany, bez części danych' });
    // Model z pamięci albo z adresu — wynik od razu, fokus zostaje tam, gdzie był.
    expect(head).not.toHaveFocus();
    expect(document.body).toHaveFocus();
    const card = result();
    expect(card).toHaveClass('part');
    expect(within(card).getByText('Przyjdą same: kroki, przejazdy rowerem, tętno i stres.')).toBeInTheDocument();
    expect(within(card).getByText('Ten model nie udostępnia aplikacjom Body Battery.')).toBeInTheDocument();
    const more = within(card).getByText('Więcej').closest('details')!;
    expect(more).toHaveTextContent(
      'Stres i przejazdy rowerem przyjdą, gdy zegarek ma najnowsze oprogramowanie — starsze wersje nie udostępniają ich aplikacjom.',
    );
    expect(more).toHaveTextContent(
      'Kupiony w Azji (wersja APAC, bez polskiego w menu)? Według danych Garmina ta wersja może nie przysyłać: stresu ani przejazdów rowerem.',
    );
    expect(more).toHaveTextContent('Connect IQ 3.3.3.');
    // „Po aktualizacji” to pole, nie nagłówek.
    expect(head).not.toHaveTextContent(/aktualiz/);
  });

  it('Instinct 2: nagłówek „Obsługiwany”, wersja azjatycka tylko w notce; Dual Power — karta wersji azjatyckiej', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'instinct 2{Enter}');
    expect(screen.getByRole('heading', { name: 'Instinct® 2 · Obsługiwany' })).toBeInTheDocument();
    expect(result()).not.toHaveTextContent(/Masz może Instinct® 2 Dual Power/);
    expect(within(result()).getByText('Więcej').closest('details')).toHaveTextContent(
      'może nie przysyłać: stresu, Body Battery ani przejazdów rowerem.',
    );

    await user.clear(field());
    await user.type(field(), 'instinct 2 dual power{Enter}');
    expect(screen.getByRole('heading', { name: 'Instinct® 2 Dual Power · Obsługiwany, bez części danych' })).toHaveFocus();
    expect(result()).toHaveTextContent(
      'wersja azjatycka To wersja azjatycka (APAC). Według danych Garmina ma starsze oprogramowanie: przyjdą kroki i tętno, ale stres, Body Battery i przejazdy rowerem mogą nie przychodzić. Wersja europejska jest obsługiwana w pełni.',
    );
  });

  it('nieobsługiwany: pytanie o podobną nazwę tuż pod nagłówkiem, potem powód i telefon', async () => {
    const user = userEvent.setup();
    const { onShown } = await check();
    await user.type(field(), 'fenix 5{Enter}');
    const head = screen.getByRole('heading', { name: 'fēnix® 5 · Nieobsługiwany' });
    expect(result()).toHaveClass('no');
    expect(onShown).toHaveBeenLastCalledWith('unsupported');
    expect(head.nextElementSibling).toHaveTextContent(
      'Masz może fēnix® 5 Plus? To inny model — obsługiwany, bez części danych.',
    );
    expect(result()).toHaveTextContent(
      /Aplikacja GYM TRACKER na zegarku na nim nie działa: fēnix® 5 ma Connect IQ [\d.]+, a potrzeba co najmniej 3\.2 — dopiero od tej wersji aplikacja może zapisywać dane w tle\./,
    );
    expect(within(result()).getByText('Zamiast tego — telefon')).toBeInTheDocument();
    // Nazwa w pytaniu sprawdza tamten model.
    await user.click(within(head.nextElementSibling as HTMLElement).getByRole('button', { name: 'fēnix® 5 Plus' }));
    expect(screen.getByRole('heading', { name: 'fēnix® 5 Plus · Obsługiwany, bez części danych' })).toHaveFocus();
    expect(field()).toHaveValue('fēnix 5 Plus');
  });

  it('telefon na Androidzie z aplikacją: Garmin Connect → Health Connect i „Zdrowie z telefonu” jako główna droga', async () => {
    asPhone(ANDROID);
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    await check({ initial: 'vivoactive3' });
    const box = within(result()).getByText('Zamiast tego — telefon').closest('.wc-instead') as HTMLElement;
    expect(box).toHaveTextContent(
      'Android: w Garmin Connect włącz udostępnianie do Health Connect (Ustawienia → Połączone aplikacje), a potem połącz telefon w karcie „Zdrowie z telefonu”. Przyjdą kroki, sen, tętno, waga i treningi.',
    );
    expect(box).not.toHaveTextContent('iPhone');
    expect(within(box).getByRole('link', { name: '„Zdrowie z telefonu” →' })).toHaveAttribute('href', '#/ustawienia?karta=telefon');
    expect(within(box).queryByRole('link', { name: 'Wpisz kroki →' })).not.toBeInTheDocument();
  });

  it('iPhone bez aplikacji: kroki ręcznie jako jedyna droga', async () => {
    asPhone(IPHONE);
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    await check({ initial: 'vivoactive3' });
    const box = result().querySelector('.wc-instead') as HTMLElement;
    expect(box).toHaveTextContent(
      'iPhone: aplikacja GYM TRACKER Zdrowie na iPhone’a jeszcze nie jest gotowa — na razie kroki wpiszesz ręcznie, to kilka sekund dziennie.',
    );
    expect(box).not.toHaveTextContent('Android');
    expect(within(box).getByRole('link', { name: 'Wpisz kroki →' })).toHaveAttribute('href', '#/cardio/kroki');
    expect(within(box).queryByRole('link', { name: '„Zdrowie z telefonu” →' })).not.toBeInTheDocument();
  });

  it('komputer: oba systemy, z główną drogą przez telefon i kroki ręcznie obok', async () => {
    asPhone('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    const { onShown } = await check({ initial: 'vivoactive3' });
    const box = result().querySelector('.wc-instead') as HTMLElement;
    expect(box).toHaveTextContent(/Android: w Garmin Connect włącz udostępnianie do Health Connect/);
    expect(box).toHaveTextContent(/iPhone: aplikacja GYM TRACKER Zdrowie na iPhone’a jeszcze nie jest gotowa/);
    expect(within(box).getByRole('link', { name: '„Zdrowie z telefonu” →' })).toHaveClass('btn');
    expect(within(box).getByRole('link', { name: 'Wpisz kroki →' })).toHaveClass('vidlink');
    expect(onShown).toHaveBeenCalledWith('unsupported');
  });

  it('bez żadnej aplikacji na telefon: jedno zdanie o krokach i „Wpisz kroki →” jako główna droga', async () => {
    asPhone('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await check({ initial: 'vivoactive3' });
    const box = result().querySelector('.wc-instead') as HTMLElement;
    expect([...box.querySelectorAll('p.tight')].map((p) => p.textContent)).toEqual([
      'Na razie kroki wpiszesz ręcznie — to kilka sekund dziennie.',
    ]);
    expect(within(box).getByRole('link', { name: 'Wpisz kroki →' })).toHaveClass('btn');
  });

  it('Apple Watch: „To nie Garmin” i tylko droga przez iPhone’a — także na Androidzie', async () => {
    asPhone(ANDROID);
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    vi.stubEnv('VITE_HEALTH_IOS_URL', 'https://apps.apple.com/app/id1');
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'apple watch{Enter}');
    expect(screen.getByRole('heading', { name: 'Apple Watch · To nie Garmin' })).toHaveFocus();
    expect(result()).toHaveClass('other');
    expect(result()).toHaveTextContent(
      'Apple Watch to nie Garmin — aplikacja na zegarek działa tylko z zegarkami Garmin. Apple Watch zapisuje kroki, tętno i treningi w Apple Zdrowie na iPhonie.',
    );
    const box = result().querySelector('.wc-instead') as HTMLElement;
    expect(box).toHaveTextContent('iPhone: połącz telefon w karcie „Zdrowie z telefonu” — dane z Apple Watch są już w Apple Zdrowie.');
    expect(box).not.toHaveTextContent('Android');
  });

  it('inna marka: rada nazywa jej aplikację tylko tam, gdzie wiadomo', async () => {
    asPhone(ANDROID);
    vi.stubEnv('VITE_HEALTH_ANDROID_URL', 'https://example.org/zdrowie.apk');
    await check({ initial: 'polar' });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/· To nie Garmin$/);
    expect(result().querySelector('.wc-instead')).toHaveTextContent(
      'Android: w aplikacji Polar Flow włącz zapisywanie do Health Connect (jeśli ma taką opcję), a potem połącz telefon w karcie „Zdrowie z telefonu”. Przyjdzie to, co ta aplikacja tam zapisuje.',
    );
  });

  it('jeszcze nieobsługiwany, licznik rowerowy i opaska — każdy z powodem', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'marq gen 3{Enter}');
    expect(screen.getByRole('heading', { name: 'MARQ® (Gen 3) · Jeszcze nieobsługiwany' })).toBeInTheDocument();
    expect(result()).toHaveClass('no');
    expect(result()).toHaveTextContent(
      'Ten zegarek jest nowszy niż lista modeli, z którą zbudowano aplikację na zegarek. Obsługa jest planowana.',
    );
    await user.clear(field());
    await user.type(field(), 'edge 1040{Enter}');
    expect(screen.getByRole('heading', { name: 'Edge® 1040 · Nieobsługiwany' })).toBeInTheDocument();
    expect(result()).toHaveTextContent(
      'Aplikacja GYM TRACKER na zegarku na nim nie działa: Edge® 1040 to licznik rowerowy, a aplikacja działa na zegarkach.',
    );
    await user.clear(field());
    await user.type(field(), 'vivosmart 5{Enter}');
    expect(result()).toHaveTextContent('vívosmart® 5 to opaska bez aplikacji Connect IQ.');
  });

  it('nieznany: najbliższe modele, link do listy w sklepie (wersja publiczna) i „Napisz do autora” tylko z oknem uwag', async () => {
    const user = userEvent.setup();
    const { onShown, rerender } = await check();
    await user.type(field(), 'xyz{Enter}');
    expect(screen.getByRole('heading', { name: 'Nie znam „xyz”' })).toHaveFocus();
    expect(onShown).toHaveBeenLastCalledWith(null);
    expect(result()).toHaveTextContent('Może to nowy model albo inna pisownia.');
    expect(within(result()).getByRole('link', { name: 'Zgodne urządzenia w Connect IQ Store' })).toHaveAttribute(
      'href',
      GARMIN_STORE_URL,
    );
    expect(GARMIN_STORE_URL).toContain('681b79f1');
    expect(within(result()).queryByRole('button', { name: 'Napisz do autora' })).not.toBeInTheDocument();
    const onFeedback = vi.fn();
    rerender({ onFeedback });
    await user.click(within(result()).getByRole('button', { name: 'Napisz do autora' }));
    expect(onFeedback).toHaveBeenCalledOnce();

    await user.clear(field());
    await user.type(field(), 'forerunner 975{Enter}');
    expect(screen.getByRole('heading', { name: 'Nie znam „forerunner 975”' })).toBeInTheDocument();
    expect(result()).toHaveTextContent('Najbliżej:');
    await user.click(within(result()).getByRole('button', { name: /^Forerunner® 970 · obsługiwany$/ }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 970 · Obsługiwany' })).toHaveFocus();
  });

  it('zgadywanie: „Czy chodzi o:” i wybór jednym stuknięciem', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'Forerunner 970 Pro{Enter}');
    expect(screen.getByRole('heading', { name: 'Nie znam dokładnie „Forerunner 970 Pro”. Czy chodzi o:' })).toHaveFocus();
    await user.click(within(result()).getByRole('button', { name: /^Forerunner® 970 · / }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 970 · Obsługiwany' })).toHaveFocus();
  });

  it('widok linii: modele pogrupowane według odpowiedzi, wybór przenosi fokus', async () => {
    const user = userEvent.setup();
    const { onShown } = await check();
    await user.type(field(), 'vivoactive{Enter}');
    expect(screen.getByRole('heading', { name: 'vívoactive: modele się różnią — wybierz swój.' })).toHaveFocus();
    expect(onShown).toHaveBeenLastCalledWith(null);
    const groups = [...result().querySelectorAll('.wc-group-title')].map((g) => g.textContent);
    expect(groups).toEqual(['Obsługiwane', 'Obsługiwane, bez części danych', 'Nieobsługiwane']);
    await user.click(within(result()).getByRole('button', { name: 'vívoactive® 5' }));
    expect(screen.getByRole('heading', { name: 'vívoactive® 5 · Obsługiwany' })).toHaveFocus();
  });

  it('same słowa bez modelu: podpowiedź, co wpisać, a fokus zostaje w polu', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'garmin{Enter}');
    expect(screen.getByText('Wpisz nazwę modelu, np. Forerunner 265 albo Venu 3.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it('„nie wiem” otwiera „Gdzie znajdę nazwę modelu?” i przenosi tam fokus', async () => {
    const real = await vi.importActual<typeof import('../watches/find')>('../watches/find');
    // Odpowiedź „help” daje wyszukiwarka (pakiet W1); tu ekran dostaje ją wprost.
    vi.doMock('../watches/find', () => ({
      ...real,
      answer: (q: string) => (q.trim() === 'nie wiem' ? { kind: 'help' } : real.answer(q)),
    }));
    const user = userEvent.setup();
    await check();
    const where = screen.getByText('Gdzie znajdę nazwę modelu?');
    expect(where.closest('details')).not.toHaveAttribute('open');
    await user.type(field(), 'nie wiem{Enter}');
    expect(where.closest('details')).toHaveAttribute('open');
    expect(where).toHaveFocus();
    expect(screen.getByText(/^Aplikacja Garmin Connect pokazuje nazwę na liście urządzeń\./)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('`initial` jako identyfikator i jako tekst — wynik od razu, bez zapamiętania i bez ruszania fokusu', async () => {
    const first = await check({ initial: 'vivoactive3' });
    expect(screen.getByRole('heading', { name: 'vívoactive® 3 · Nieobsługiwany' })).not.toHaveFocus();
    expect(field()).toHaveValue('vívoactive 3');
    expect(first.onShown).toHaveBeenLastCalledWith('unsupported');
    cleanup();
    const second = await check({ initial: 'fr 265' });
    expect(screen.getByRole('heading', { name: 'Forerunner® 265 · Obsługiwany' })).not.toHaveFocus();
    expect(field()).toHaveValue('fr 265');
    expect(second.onShown).toHaveBeenLastCalledWith('supported');
    expect(localStorage.getItem('gt-garmin-model')).toBeNull();
  });

  it('wybór zapamiętuje model z brakami', async () => {
    const user = userEvent.setup();
    await check();
    await user.type(field(), 'd2 air{Enter}');
    expect(screen.getByRole('heading', { name: 'D2™ Air · Obsługiwany, bez części danych' })).toHaveFocus();
    expect(JSON.parse(localStorage.getItem('gt-garmin-model')!)).toEqual({
      key: 'd2air',
      name: 'D2™ Air',
      v: 'part',
      lacks: ['stress', 'bodyBattery', 'rides'],
    });
  });

  it('pamięć przeglądarki, która rzuca wyjątkiem, niczego nie psuje', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const user = userEvent.setup();
    await check();
    await user.click(screen.getByRole('button', { name: 'Forerunner 165' }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 165 · Obsługiwany' })).toHaveFocus();
  });

  it('pełna lista: rysowana dopiero po otwarciu, pogrupowana według linii, wybór sprawdza model', async () => {
    const user = userEvent.setup();
    await check();
    const summary = screen.getByText(/^Wszystkie obsługiwane zegarki — \d+ modeli$/);
    expect(summary.closest('details')!.querySelectorAll('button')).toHaveLength(0);
    await user.click(summary);
    const all = summary.closest('details')!;
    expect(all).toHaveAttribute('open');
    expect(within(all).getByText('Forerunner')).toBeInTheDocument();
    expect(within(all).getByText('Legacy (Marvel, Star Wars)')).toBeInTheDocument();
    expect(within(all).getByRole('button', { name: 'D2™ Air · bez części danych' })).toBeInTheDocument();
    await user.click(within(all).getByRole('button', { name: 'Forerunner® 265' }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 265 · Obsługiwany' })).toHaveFocus();
    expect(screen.getByText('Lista według danych Garmina z października 2026.')).toBeInTheDocument();
  });

  it('w połączonej karcie (compact): bez skrótów, listy i źródła, a pole od razu czeka na nazwę', async () => {
    await check({ compact: true });
    expect(field()).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'Popularne:' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Wszystkie obsługiwane zegarki/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Lista według danych Garmina/)).not.toBeInTheDocument();
    expect(screen.getByText('Gdzie znajdę nazwę modelu?')).toBeInTheDocument();
  });
});

describe('karta zegarka: sprawdzanie jako pierwszy widok', () => {
  const card = async (onFeedback?: () => void) => {
    const { GarminCard } = await import('./Garmin');
    render(<GarminCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} onFeedback={onFeedback} />);
    return screen.findByRole('combobox', { name: 'Jaki masz zegarek?' });
  };
  const quiet = () => [...document.querySelectorAll('.dev-card > .watch-actions button')].map((b) => b.textContent);

  it('bez wyniku: „Sprawdź” to główna akcja, pod spodem „Połącz bez sprawdzania” i klucz z innego urządzenia', async () => {
    await card();
    expect(screen.getByRole('heading', { name: 'Zegarek Garmin' })).toBeInTheDocument();
    expect(
      screen.getByText(/^Kroki, przejazdy rowerem i tętno — a na większości zegarków także stres i Body Battery — przyjdą/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sprawdź' })).not.toHaveClass('ghost');
    expect(quiet()).toEqual(['Połącz bez sprawdzania', 'Mam już klucz z innego urządzenia']);
    expect(screen.queryByRole('button', { name: 'Połącz zegarek' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Prościej przez telefon/)).not.toBeInTheDocument();
  }, 15_000);

  it('obsługiwany: „Połącz zegarek” w wyniku, pod spodem tylko klucz; połączenie pokazuje klucz i wybrany model', async () => {
    const user = userEvent.setup();
    await card();
    await user.click(screen.getByRole('button', { name: 'Forerunner 265' }));
    expect(screen.getByRole('heading', { name: 'Forerunner® 265 · Obsługiwany' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Sprawdź' })).toHaveClass('ghost');
    expect(quiet()).toEqual(['Mam już klucz z innego urządzenia']);
    await user.click(screen.getByRole('button', { name: 'Połącz zegarek' }));
    expect(localStorage.getItem('gt-garmin-key')).toMatch(/^[0-9a-f]{64}$/);
    expect(screen.getByLabelText('Klucz do zegarka')).toBeInTheDocument();
    expect(screen.getByText('Wybrany model: Forerunner® 265 — obsługiwany.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Kroki połączenia' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent(
      'Zainstaluj na zegarku aplikację GYM TRACKER z Connect IQ Store. Jeśli sklep pisze, że zegarek trzeba zaktualizować, zsynchronizuj go z Garmin Connect albo podłącz do Garmin Express na komputerze.',
    );
  }, 15_000);

  it('nieobsługiwany: główna droga przez telefon, a cicho „Połącz mimo to” — nikt nie jest zablokowany', async () => {
    const user = userEvent.setup();
    const input = await card();
    await user.type(input, 'vivoactive 3{Enter}');
    expect(screen.getByRole('heading', { name: 'vívoactive® 3 · Nieobsługiwany' })).toHaveFocus();
    expect(quiet()).toEqual(['Połącz mimo to', 'Mam już klucz z innego urządzenia']);
    expect(screen.queryByRole('button', { name: 'Połącz zegarek' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Połącz mimo to' }));
    expect(localStorage.getItem('gt-garmin-key')).toMatch(/^[0-9a-f]{64}$/);
    expect(screen.getByText('Wybrany model: vívoactive® 3 — nieobsługiwany.')).toBeInTheDocument();
  }, 15_000);

  it('wybrany wcześniej model: wynik od razu, bez ruszania fokusu, z przyciskami dla jego odpowiedzi', async () => {
    localStorage.setItem('gt-garmin-model', JSON.stringify({ key: 'fr265', name: 'Forerunner® 265', v: 'ok' }));
    await card();
    expect(await screen.findByRole('heading', { name: 'Forerunner® 265 · Obsługiwany' })).not.toHaveFocus();
    await waitFor(() => expect(quiet()).toEqual(['Mam już klucz z innego urządzenia']));
  }, 15_000);

  it('paczka sprawdzania się nie wczytała: zdanie i link do listy w sklepie, połączenie dalej działa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.doMock('./WatchCheck', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { GarminCard } = await import('./Garmin');
    render(<GarminCard state={freshState()} onSync={vi.fn()} onToast={vi.fn()} />);
    expect(
      await screen.findByText(/^Nie udało się wczytać listy zegarków — sprawdź internet i odśwież stronę\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zgodne urządzenia w Connect IQ Store' })).toHaveAttribute('href', GARMIN_STORE_URL);
    expect(quiet()).toEqual(['Połącz bez sprawdzania', 'Mam już klucz z innego urządzenia']);
  }, 15_000);
});

describe('#/zegarek z linku', () => {
  const app = async (hash: string) => {
    window.history.replaceState(null, '', hash);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    // Pobieranie paczek zegarka i telefonu po starcie — serwer nic nie ma.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, json: async () => null }));
    const { default: App } = await import('../App');
    render(<App />);
  };

  it(
    'świeży profil z ?model=fr265: bez wprowadzenia, ustawienia z kartą zegarka i wynikiem; introSeen nietknięte',
    async () => {
      await app('#/zegarek?model=fr265');
      expect(
        await screen.findByRole('heading', { name: 'Forerunner® 265 · Obsługiwany' }, { timeout: 8000 }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Wprowadzenie' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Zegarek Garmin' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Jaki masz zegarek?' })).toHaveValue('Forerunner 265');
      expect(document.body).toHaveFocus();
      // Wprowadzenie wejdzie przy następnym zwykłym starcie: nic nie zapisało, że je widziano.
      const saved = JSON.parse(localStorage.getItem('kb-trener-v3') ?? '{}') as { introSeen?: string };
      expect(saved.introSeen).toBeUndefined();
    },
    15_000,
  );

  it(
    'świeży profil bez linku do karty: wprowadzenie wchodzi jak dotąd',
    async () => {
      await app('#/ustawienia');
      expect(await screen.findByRole('dialog', { name: 'Wprowadzenie' }, { timeout: 8000 })).toBeInTheDocument();
    },
    15_000,
  );
});
