// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, localDay } from '@gymtracker/link/coaching';
import { freshState } from '../engine/plan';
import { clearLink, linkState } from '../link/store';
import { coachPrefix } from '../link/assign';
import { linkAssignmentPath, linkChatPath, linkConnectionPath, linkVisitsPath, planPath } from '../routing';
import { FORM, HABITS, MEALS, assignment, connection, message, seedLink } from '../test/coachSeed';
import type { AppState, PlanTemplate } from '../types';
import { CoachPlanNote, CoachToday } from './CoachToday';
import { SessionHome } from './SessionHome';

/**
 * Karta „Od prowadzącego” na ekranie Dziś: tylko przy trwającej współpracy i gdy coś czeka, w kolejności
 * ważności, z nawykami do odhaczenia na miejscu (właściwy dzień, „w trakcie”), z linią powiadomień
 * tylko w stanie „wyłączone” i z planem od prowadzącego przypisanym w karcie treningu.
 */

const push = vi.hoisted(() => ({ state: 'unconfigured' as string, enable: vi.fn() }));
vi.mock('../link/notify', () => ({
  coachPushState: vi.fn(async () => push.state),
  enableCoachPush: push.enable,
}));

const HOUR = 3_600_000;

beforeEach(() => {
  localStorage.clear();
  clearLink();
  push.state = 'unconfigured';
  push.enable.mockReset();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  // Nic z karty nie powinno sięgać po sieć (współprace bez tokenu) — a gdyby, to „bez sieci”.
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const plan = (id: string, name: string): PlanTemplate => ({
  id,
  name,
  level: 'base',
  sex: 'any',
  daysPerWeek: 2,
  weeks: 8,
  loadFactor: 1,
  cycle: ['a'],
  weekdays: [1, 4],
  desc: '',
  kind: 'own',
});

describe('karta „Od prowadzącego”', () => {
  it('bez współpracy, bez Sztabu w buildzie i bez niczego do pokazania — nie ma jej', () => {
    const { unmount } = render(<CoachToday />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    unmount();

    // Trwająca współpraca, ale nic nie czeka.
    seedLink({ connections: [connection()], assignments: [assignment({ kind: 'note', title: 'Stare', text: '', checklist: [] }, { status: 'done' })] });
    const again = render(<CoachToday />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    again.unmount();

    // Coś czeka, ale współpraca się skończyła (bez zawiadomienia) albo build nie ma Sztabu.
    seedLink({ connections: [connection({ status: 'ended' })], messages: [message('Hej')] });
    const ended = render(<CoachToday />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    ended.unmount();
    seedLink({ connections: [connection()], messages: [message('Hej')] });
    vi.stubEnv('VITE_SZTAB_URL', '');
    render(<CoachToday />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('nagłówek z prowadzącym prowadzi do współpracy; pozycje w kolejności ważności', () => {
    const start = Date.now() + 3 * HOUR;
    const habits = assignment(HABITS);
    const meals = assignment(MEALS);
    const form = assignment(FORM);
    const fresh = assignment(
      {
        kind: 'plan',
        plan: plan('sila', 'Siła 8 tyg.'),
        workouts: [{ id: 'a', name: 'Góra A', items: [{ ex: 'swing2' }] }],
        videos: {},
        note: '',
      },
      { status: 'new', sent: 'new' },
    );
    const note = assignment({ kind: 'note', title: 'Sen przed 23', text: '', checklist: [] }, { status: 'new', sent: 'new' });
    seedLink({
      connections: [
        connection({
          visits: {
            at: Date.now(),
            bookings: [
              {
                id: 'b1',
                slotId: 's1',
                startsAt: new Date(start).toISOString(),
                endsAt: new Date(start + HOUR).toISOString(),
                title: 'Konsultacja',
                place: null,
                note: null,
                cancelledAt: null,
                cancelledBy: null,
              },
            ],
          },
        }),
      ],
      assignments: [note, fresh, meals, habits, form],
      messages: [message('Jak poszło wczoraj?')],
    });
    render(<CoachToday />);

    const card = screen.getByRole('region', { name: 'Od prowadzącego Ola Nowak · Dietetyk' });
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Ola Nowak · Dietetyk');
    expect(within(card).getByRole('link', { name: 'Ola Nowak · Dietetyk' })).toHaveAttribute('href', linkConnectionPath('c1'));

    const items = within(card).getAllByRole('listitem').filter((li) => li.parentElement?.classList.contains('lk-coach-list'));
    const hm = new Date(start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    expect(items.map((li) => li.textContent)).toEqual([
      'Nowa wiadomość„Jak poszło wczoraj?”',
      'Do wypełnienia dziś: Wywiad na startProwadzący czeka na odpowiedzi, zanim zacznie.',
      expect.stringMatching(/^Codzienne · zrobione 0 z 2/),
      'Jadłospis: 0 z 3 zjedzoneRedukcja 2000',
      expect.stringMatching(new RegExp(`^Wizyta (dziś|jutro) o ${hm} — Konsultacja$`)),
      'Uruchom plan od prowadzącego: Siła 8 tyg.',
      'Nowe zalecenie: Sen przed 23',
    ]);
    const hrefs = items.map((li) => li.querySelector('a.lk-coach-row')?.getAttribute('href') ?? null);
    expect(hrefs).toEqual([
      linkChatPath('c1'),
      linkAssignmentPath(form.id),
      null,
      linkAssignmentPath(meals.id),
      linkVisitsPath('c1'),
      linkAssignmentPath(fresh.id),
      linkAssignmentPath(note.id),
    ]);
    // Nawyki: lista z podpisanymi polami, nagłówkiem prowadzi do zalecenia.
    const ticks = within(card).getByRole('list', { name: /^Codzienne/ });
    expect(within(ticks).getByRole('checkbox', { name: 'Kreatyna 5 g' })).not.toBeChecked();
    expect(within(card).getByRole('link', { name: 'Codzienne' })).toHaveAttribute('href', linkAssignmentPath(habits.id));
    // Brak linii o powiadomieniach, gdy powiadomień w tej wersji nie ma.
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('odhaczenie nawyku na miejscu zapisuje dzisiejszy dzień i robi z listy „w trakcie”', async () => {
    const habits = assignment(HABITS);
    const yesterday = addDays(localDay(), -1);
    seedLink({ connections: [connection()], assignments: [habits], ticks: { [habits.id]: { [yesterday]: [1] } } });
    const user = userEvent.setup();
    render(<CoachToday state={freshState()} />);
    const box = screen.getByRole('checkbox', { name: 'Woda 2 l' });
    await user.click(box);
    await waitFor(() => expect(linkState().ticks[habits.id]?.[localDay()]).toEqual([1]));
    // Inny dzień nietknięty.
    expect(linkState().ticks[habits.id]?.[yesterday]).toEqual([1]);
    await waitFor(() => expect(linkState().assignments[0]!.status).toBe('started'));
    expect(await screen.findByText(/zrobione 1 z 2/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Woda 2 l' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Woda 2 l' })).toHaveFocus();

    await user.click(screen.getByRole('checkbox', { name: 'Kreatyna 5 g' }));
    await waitFor(() => expect(linkState().ticks[habits.id]?.[localDay()]).toEqual([0, 1]));
    expect(screen.getByText(/wszystko zrobione \(2\)/)).toBeInTheDocument();
  });

  it('dwa szybkie stuknięcia, zanim wczyta się synchronizacja: oba odhaczenia zostają', async () => {
    const habits = assignment(HABITS);
    seedLink({ connections: [connection()], assignments: [habits] });
    render(<CoachToday state={freshState()} />);
    // Oba w tym samym renderze — lista liczona w chwili stuknięcia zgubiłaby pierwsze.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kreatyna 5 g' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Woda 2 l' }));
    await waitFor(() => expect(linkState().ticks[habits.id]?.[localDay()]).toEqual([0, 1]));
    expect(await screen.findByText(/wszystko zrobione \(2\)/)).toBeInTheDocument();
  });

  it('koniec współpracy ze strony prowadzącego zostaje jedną linią', () => {
    seedLink({ connections: [connection({ status: 'ended', endedBy: 'coach', endNotice: true })] });
    render(<CoachToday />);
    expect(screen.getByRole('link', { name: /Współpraca z: Ola Nowak — zakończona przez prowadzącego/ })).toHaveAttribute('href', '#/wspolpraca');
  });

  it('plan od prowadzącego czeka na start, gdy nie biegnie żaden plan; biegnący ma podpis w karcie treningu', () => {
    const a = assignment({ kind: 'plan', plan: plan('sila', 'Siła 8 tyg.'), workouts: [], videos: {}, note: '' }, { status: 'started' });
    const planId = `${coachPrefix(a.id)}sila`;
    seedLink({ connections: [connection()], assignments: [{ ...a, made: { plan: planId } }] });
    const state: AppState = { ...freshState(), plans: [plan('moj', 'Mój'), plan(planId, 'Siła 8 tyg.')] };
    const { unmount } = render(<CoachToday state={state} today={{ kind: 'none' }} />);
    expect(screen.getByRole('link', { name: 'Plan od prowadzącego czeka na start: Siła 8 tyg.' })).toHaveAttribute('href', planPath(planId));
    unmount();

    // Plan biegnie: karta nie powtarza dzisiejszego treningu (nie ma czego pokazać), a karta treningu mówi, czyj to plan.
    render(<CoachToday state={state} today={{ kind: 'rest' }} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    render(<CoachPlanNote planId={planId} />);
    expect(screen.getByRole('link', { name: 'Plan od prowadzącego: Ola Nowak · Dietetyk' })).toHaveAttribute('href', linkConnectionPath('c1'));
  });

  it('linia o powiadomieniach tylko przy „wyłączone”; „Włącz” woła współpracę i oddaje fokus nagłówkowi', async () => {
    seedLink({ connections: [connection()], messages: [message('Hej')] });
    push.state = 'off';
    push.enable.mockResolvedValue('on');
    const state = freshState();
    const user = userEvent.setup();
    render(<CoachToday state={state} />);
    const on = await screen.findByRole('button', { name: 'Włącz powiadomienia od prowadzącego' });
    await user.click(on);
    expect(push.enable).toHaveBeenCalledWith('c1', state);
    expect(await screen.findByRole('status')).toHaveTextContent('Powiadomienia od prowadzącego włączone.');
    expect(screen.queryByRole('button', { name: 'Włącz powiadomienia od prowadzącego' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ola Nowak · Dietetyk' })).toHaveFocus();
  });

  it('„Nie teraz” chowa linię na tym telefonie; iPhone bez instalacji dostaje wskazówkę', async () => {
    seedLink({ connections: [connection()], messages: [message('Hej')] });
    push.state = 'off';
    const user = userEvent.setup();
    const { unmount } = render(<CoachToday state={freshState()} />);
    await user.click(await screen.findByRole('button', { name: 'Nie teraz' }));
    expect(screen.queryByRole('button', { name: 'Włącz powiadomienia od prowadzącego' })).not.toBeInTheDocument();
    unmount();
    render(<CoachToday state={freshState()} />);
    // Zapamiętane — po ponownym otwarciu też nic.
    await waitFor(() => expect(screen.getByRole('region')).toBeInTheDocument());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    localStorage.removeItem('gt-coach-push-later');
    push.state = 'ios-install';
    const ios = render(<CoachToday state={freshState()} />);
    expect(await within(ios.container).findByText(/działają na iPhonie po dodaniu GYM TRACKERa/)).toBeInTheDocument();
  });
});

describe('ekran Dziś', () => {
  it('karta stoi na samej górze, nad linią statystyk', () => {
    seedLink({ connections: [connection()], messages: [message('Hej')] });
    const noop = () => undefined;
    const { container } = render(
      <SessionHome state={freshState()} today={{ kind: 'none' }} statsLine="Ostatni trening: wczoraj" onStart={noop} onWeigh={noop} onWeighSkip={noop} />,
    );
    const card = screen.getByRole('region', { name: /^Od prowadzącego/ });
    expect(container.firstElementChild).toContainElement(card);
    expect(card.compareDocumentPosition(screen.getByText('Ostatni trening: wczoraj')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
