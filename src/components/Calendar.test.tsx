// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshState } from '../engine/plan';
import type { DietCalendar } from '../engine/calendar';
import type { AppState, LogEntry } from '../types';

/**
 * Strona kalendarza: miesiąc, wybrany dzień, dwa tygodnie przed nami i eksport. Baza diety
 * jest tu atrapą (`food/calendar`), push — też: strona pyta tylko o strefę i o to, czy serwer
 * przypomnień w ogóle jest.
 */

const diet = vi.hoisted(() => ({
  value: { shop: null, retest: null, labDays: [] } as DietCalendar,
  calls: 0,
}));

vi.mock('../food/calendar', () => ({
  loadDietCalendar: async () => {
    diet.calls++;
    return diet.value;
  },
}));

vi.mock('../push', () => ({
  deviceTimeZone: () => 'Europe/Warsaw',
  pushConfigured: () => true,
}));

const { default: CalendarPage } = await import('./Calendar');
const { CalendarCard } = await import('./CalendarCard');

// Wtorek 3 listopada 2026, rano. Plan „cel-start-30” od poniedziałku: pn, śr, pt.
const NOW = new Date(2026, 10, 3, 9, 0);
const log = (date: string, workout = 'Trening A'): LogEntry => ({ date: `${date}T16:00:00.000Z`, workout, ready: 'ok', items: [] });

const withPlan = (): AppState => {
  const s = freshState();
  s.plan = { templateId: 'cel-start-30', start: '2026-11-02', ticked: {} };
  s.log.push(log('2026-11-02'));
  return s;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  diet.value = {
    shop: { kind: 'weekdays', days: [6], at: '10:00' },
    retest: { date: '2026-11-30', markers: ['Ferrytyna'] },
    labDays: ['2026-10-02'],
  };
  diet.calls = 0;
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

const page = (state: AppState, onTrainAt = vi.fn(), onToast = vi.fn()) => {
  render(<CalendarPage state={state} onTrainAt={onTrainAt} onToast={onToast} />);
  return { onTrainAt, onToast };
};

describe('kalendarz — miesiąc i dni', () => {
  it('miesiąc od poniedziałku, dziś zaznaczony, dzień czytany razem z wydarzeniami', async () => {
    page(withPlan());
    expect(screen.getByRole('heading', { name: 'listopad 2026' })).toBeInTheDocument();
    const today = screen.getByRole('button', { name: /^wtorek, 3 listopada/ });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'poniedziałek, 2 listopada: trening zrobiony' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'sobota, 7 listopada: zakupy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'poniedziałek, 30 listopada: badanie termin z planu pod wyniki' })).toBeInTheDocument();
    // Pierwszy listopada 2026 to niedziela: sześć pustych pól przed nim.
    expect(document.querySelectorAll('.cal-blank').length).toBeGreaterThanOrEqual(6);
  });

  it('stuknięcie dnia pokazuje jego wydarzenia, z odnośnikiem do listy zakupów', async () => {
    page(withPlan());
    fireEvent.click(await screen.findByRole('button', { name: 'sobota, 7 listopada: zakupy' }));
    const picked = screen.getByRole('heading', { name: 'sobota, 7 listopada' }).closest('section')!;
    expect(within(picked).getByText('Zakupy')).toBeInTheDocument();
    expect(within(picked).getByText('10:00')).toBeInTheDocument();
    expect(within(picked).getByRole('link', { name: 'Lista zakupów' })).toHaveAttribute('href', '#/jedzenie/zakupy');
  });

  it('dzień bez niczego mówi to wprost', () => {
    page(withPlan());
    fireEvent.click(screen.getByRole('button', { name: /^czwartek, 5 listopada/ }));
    expect(screen.getByText('Nic w tym dniu.')).toBeInTheDocument();
  });

  it('poprzedni i następny miesiąc, z powrotem do dziś', async () => {
    page(withPlan());
    fireEvent.click(screen.getByRole('button', { name: 'Następny miesiąc' }));
    expect(screen.getByRole('heading', { name: 'grudzień 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Poprzedni miesiąc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Poprzedni miesiąc' }));
    expect(screen.getByRole('heading', { name: 'październik 2026' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'piątek, 2 października: badanie' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Wróć do dziś' }));
    expect(screen.getByRole('heading', { name: 'listopad 2026' })).toBeInTheDocument();
  });

  it('legenda mówi znakami i słowami, nie samym kolorem', () => {
    page(withPlan());
    const legend = screen.getByRole('list', { name: 'Znaki w kalendarzu' });
    for (const t of ['trening z planu', 'trening zrobiony', 'trening opuszczony', 'zakupy', 'badanie', 'dziś'])
      expect(within(legend).getByText(t)).toBeInTheDocument();
  });
});

describe('kalendarz — najbliższe dni i eksport', () => {
  it('najbliższe 14 dni: treningi z godziną, zakupy', async () => {
    page(withPlan());
    const soon = screen.getByRole('heading', { name: 'Najbliższe 14 dni' }).closest('section')!;
    expect(within(soon).getByRole('heading', { name: 'jutro' })).toBeInTheDocument();
    expect(within(soon).getAllByText('Trening B').length).toBeGreaterThan(0);
    expect(within(soon).getAllByText('zaplanowany · 18:00').length).toBeGreaterThan(0);
    expect(await within(soon).findAllByText('Zakupy')).toHaveLength(2);
  });

  it('trzy przyciski do Kalendarza Google, w nowej karcie, z wypełnionym formularzem', async () => {
    page(withPlan());
    const train = screen.getByRole('link', { name: /Dodaj treningi do Kalendarza Google/ });
    expect(train).toHaveAttribute('target', '_blank');
    expect(train.getAttribute('rel')).toContain('noopener');
    const q = new URL(train.getAttribute('href')!).searchParams;
    expect(q.get('action')).toBe('TEMPLATE');
    expect(q.get('ctz')).toBe('Europe/Warsaw');
    expect(q.get('recur')).toMatch(/^RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=\d{8}T\d{6}Z$/);
    expect(await screen.findByRole('link', { name: /Dodaj zakupy do Kalendarza Google/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dodaj badanie do Kalendarza Google/ })).toBeInTheDocument();
  });

  it('godzina treningu zmienia się na stronie', () => {
    const { onTrainAt } = page(withPlan());
    const select = screen.getByRole('combobox', { name: 'Godzina treningu w kalendarzu' });
    expect(select).toHaveValue('18:00');
    fireEvent.change(select, { target: { value: '06:30' } });
    expect(onTrainAt).toHaveBeenCalledWith('06:30');
  });

  it('plik .ics: pobranie z liczbą wydarzeń w komunikacie', async () => {
    const created: Blob[] = [];
    const url = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      created.push(b as Blob);
      return 'blob:kalendarz';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { onToast } = page(withPlan());
    await screen.findByRole('link', { name: /Dodaj zakupy/ });
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz plik .ics' }));
    expect(click).toHaveBeenCalled();
    expect(created[0]!.type).toBe('text/calendar;charset=utf-8');
    const text = await created[0]!.text();
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text).toContain('UID:zakupy-2026-11-07@gym-tracker');
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/^Plik gotowy: \d+ wydarze/));
    url.mockRestore();
    click.mockRestore();
  });

  it('uczciwie: bez synchronizacji na bieżąco i jak zaimportować plik do Google', () => {
    page(withPlan());
    expect(screen.getByText(/nie widzi zmian na bieżąco/)).toBeInTheDocument();
    expect(screen.getByText(/calendar\.google\.com → Ustawienia → Importuj i eksportuj/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ustawienia' })).toHaveAttribute('href', '#/ustawienia');
  });

  it('bez planu i bez diety: nic do dodania, podpowiedź o planie, plik pusty', async () => {
    diet.value = { shop: null, retest: null, labDays: [] };
    const { onToast } = page(freshState());
    expect(screen.queryByRole('link', { name: /Kalendarza Google/ })).toBeNull();
    expect(screen.getByText(/Na razie nie ma czego dodać/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ustaw plan' })).toHaveAttribute('href', '#/plan');
    expect(screen.queryByRole('combobox', { name: 'Godzina treningu w kalendarzu' })).toBeNull();
    expect(await screen.findByText(/Zakupy pojawią się tu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz plik .ics' }));
    expect(onToast).toHaveBeenCalledWith('Przez najbliższe 12 tygodni nie ma nic zaplanowanego — plik byłby pusty.');
  });
});

describe('karta kalendarza na ekranie Dziś', () => {
  it('trzy najbliższe wydarzenia i odnośnik; bez diety baza diety się nie wczytuje', () => {
    render(<CalendarCard state={withPlan()} />);
    const list = screen.getByRole('list', { name: 'Najbliższe wydarzenia' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('jutro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kalendarz i Kalendarz Google' })).toHaveAttribute('href', '#/kalendarz');
    expect(diet.calls).toBe(0);
  });

  it('przy diecie dokłada zakupy', async () => {
    localStorage.setItem('gt:diet', '1');
    diet.value = { shop: { kind: 'weekdays', days: [3], at: '17:00' }, retest: null, labDays: [] };
    render(<CalendarCard state={freshState()} />);
    expect(await screen.findAllByText('Zakupy')).toHaveLength(2);
    expect(screen.getAllByText('17:00')).toHaveLength(2);
    expect(diet.calls).toBe(1);
  });

  it('bez planu i diety: jedno zdanie zamiast listy', () => {
    render(<CalendarCard state={freshState()} />);
    expect(screen.getByText(/w jednym kalendarzu/)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
