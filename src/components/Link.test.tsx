// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateIdentity, newIdSecret } from '@gymtracker/link';
import type { Area } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { acceptInvite } from '../link/accept';
import { invitePreview } from '../link/rpc';
import { activeConnections, clearLink, linkState } from '../link/store';
import { forgetKeys, syncAll } from '../link/sync';
import type { AppState, Route } from '../types';
import LinkPages from './Link';
import type { LinkProps } from './Link';
import { LinkCard, LinkNotice } from './LinkEntry';

/**
 * Strony współpracy pod jsdom, przeciw Sztabowi w pamięci — przez role i etykiety: zaproszenie
 * (kontrola klucza, wyłączność, przyjęcie), karta w profilu, uwaga na ekranie Dziś, zakończenie
 * z potwierdzeniem na stronie i plan od prowadzącego uruchamiany zwykłą drogą.
 */

let server: FakeSztab;

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  window.location.hash = '#/sesja';
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function pages(route: Route & LinkProps['route'], state: AppState = freshState()) {
  const props = {
    ensureSecret: vi.fn((c: string) => c),
    apply: vi.fn(),
    onToast: vi.fn(),
  };
  render(<LinkPages route={route} state={state} {...props} />);
  return props;
}

async function connect(areas: Area[] = ['training']) {
  const inv = await server.invite(areas, ['training']);
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: areas, replace: [], scopes: ['training'], secret: newIdSecret() });
  if (!r.ok) throw new Error(r.reason);
  return r.connection;
}

describe('zaproszenie', () => {
  it('pokazuje prowadzącego, obszary, zakres słowami i ID; przyjęcie wysyła pierwszą paczkę', async () => {
    const inv = await server.invite(['training', 'nutrition'], ['training', 'body'], 'Cześć, zaczynamy w poniedziałek.');
    window.location.hash = `#/wspolpraca/zaproszenie?i=${inv.id}&f=${inv.fingerprint}`;
    const user = userEvent.setup();
    const props = pages({ kind: 'linkInvite' });
    expect(await screen.findByText(/Anna Kowalska \(trener\) zaprasza cię do współpracy/)).toBeInTheDocument();
    expect(screen.getByText('Cześć, zaczynamy w poniedziałek.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Trening —/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Żywienie/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Treningi, serie i plan' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Waga i obwody' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Jedzenie i napoje' })).not.toBeChecked();
    expect(await screen.findByText(/tylko ID: GT-[0-9A-Z]{4}-/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Przyjmij i wyślij dane' }));
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith('Współpraca przyjęta, dane wysłane.'));
    expect(props.ensureSecret).toHaveBeenCalledTimes(1);
    const [c] = activeConnections(linkState());
    expect(c!.scopes).toEqual(['training', 'body']);
    expect(window.location.hash).toBe(`#/wspolpraca/${c!.id}`);
    expect(await server.readSnapshot(c!.id)).toMatchObject({ v: 1, scopes: ['training', 'body'] });
  });

  it('klucz od serwera nie pasuje do linku: odmowa, bez przycisku przyjęcia', async () => {
    const inv = await server.invite(['training']);
    server.swapKey((await generateIdentity(true)).publicJwk);
    window.location.hash = `#/wspolpraca/zaproszenie?i=${inv.id}&f=${inv.fingerprint}`;
    pages({ kind: 'linkInvite' });
    expect(await screen.findByText('To zaproszenie nie przeszło kontroli klucza')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Przyjmij i wyślij dane' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Anna Kowalska/)).not.toBeInTheDocument();
  });

  it('ucięty link — mówi o tym, nie pyta serwera', async () => {
    window.location.hash = '#/wspolpraca/zaproszenie?i=123';
    pages({ kind: 'linkInvite' });
    expect(screen.getByText(/link jest niepełny/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('zajęty obszar: kto go prowadzi, odznaczony; zaznaczenie mówi, co stanie się z dawną współpracą', async () => {
    await connect(['training']);
    const other = await fakeSztab({ coachName: 'Jan Nowak' });
    vi.stubGlobal('fetch', vi.fn(other.fetch));
    const inv = await other.invite(['training', 'insight']);
    window.location.hash = `#/wspolpraca/zaproszenie?i=${inv.id}&f=${inv.fingerprint}`;
    const user = userEvent.setup();
    pages({ kind: 'linkInvite' });
    const training = await screen.findByRole('checkbox', { name: /^Trening —/ });
    expect(training).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Wgląd/ })).toBeChecked();
    expect(screen.getByText(/Teraz prowadzi: Anna Kowalska/)).toBeInTheDocument();
    await user.click(training);
    expect(screen.getByText('Współpraca z: Anna Kowalska się zakończy.')).toBeInTheDocument();
  });

  it('wersja bez Sztabu w buildzie: zaproszenie mówi, że tu nie zadziała', () => {
    vi.stubEnv('VITE_SZTAB_URL', '');
    pages({ kind: 'linkInvite' });
    expect(screen.getByText(/nie łączy się z GYM TRACKER Sztab/)).toBeInTheDocument();
  });
});

describe('wejścia i współpraca', () => {
  it('karta w profilu: bez Sztabu jej nie ma, ze Sztabem mówi, kto prowadzi', async () => {
    vi.stubEnv('VITE_SZTAB_URL', '');
    const { unmount } = render(<LinkCard />);
    expect(screen.queryByRole('heading', { name: 'Współpraca z prowadzącym' })).not.toBeInTheDocument();
    unmount();
    vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
    await connect(['training', 'rehab']);
    render(<LinkCard />);
    expect(screen.getByRole('heading', { name: 'Współpraca z prowadzącym' })).toBeInTheDocument();
    expect(screen.getByText('Anna Kowalska (Trener) — Trening, Rehabilitacja')).toBeInTheDocument();
  });

  it('uwaga na ekranie Dziś tylko przy nowym zaleceniu', async () => {
    const c = await connect();
    const { rerender } = render(<LinkNotice />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await server.send(c.id, {
      area: 'training',
      sentAt: Date.now(),
      from: { name: 'Anna Kowalska', profession: 'trainer' },
      body: { kind: 'note', title: 'Rozgrzewka przed każdym treningiem', text: '10 minut.', checklist: [] },
    });
    await syncAll(() => freshState());
    rerender(<LinkNotice />);
    expect(screen.getByRole('link', { name: /Nowe od prowadzącego — Anna Kowalska: Rozgrzewka/ })).toBeInTheDocument();
  });

  it('zakończenie pyta na stronie i dopiero po „Tak” kończy u prowadzącego', async () => {
    const c = await connect();
    const user = userEvent.setup();
    const props = pages({ kind: 'linkConnection', id: c.id });
    await user.click(screen.getByRole('button', { name: 'Zakończ współpracę' }));
    const box = screen.getByRole('group', { name: 'Zakończyć współpracę?' });
    expect(within(box).getByText(/od razu traci dostęp/)).toBeInTheDocument();
    expect(server.connections.get(c.id)!.status).toBe('active');
    await user.click(within(box).getByRole('button', { name: 'Tak, zakończ' }));
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith('Współpraca zakończona.'));
    expect(server.connections.get(c.id)!.status).toBe('ended');
    expect(screen.queryByRole('button', { name: 'Zakończ współpracę' })).not.toBeInTheDocument();
  });

  it('plan od prowadzącego: opis, film przy ćwiczeniu i „Uruchom” zwykłą drogą — przez podgląd planu', async () => {
    const c = await connect();
    const id = await server.send(c.id, {
      area: 'training',
      sentAt: Date.now(),
      from: { name: 'Anna Kowalska', profession: 'trainer' },
      body: {
        kind: 'plan',
        plan: { id: 'sila', name: 'Siła 8 tyg.', level: 'base', sex: 'any', daysPerWeek: 2, weeks: 8, loadFactor: 1, cycle: ['a'], weekdays: [1, 4], desc: '', kind: 'own' },
        workouts: [{ id: 'a', name: 'Góra A', items: [{ ex: 'swing2' }, { ex: 'nieznane' }] }],
        videos: { swing2: 'https://example.org/swing.mp4' },
        note: 'Ciężar dobierz tak, żeby zostały dwa powtórzenia zapasu.',
      },
    });
    await syncAll(() => freshState());
    const user = userEvent.setup();
    const props = pages({ kind: 'linkAssignment', id });
    expect(screen.getByRole('heading', { name: /plan „Siła 8 tyg.”/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'film od prowadzącego' })).toHaveAttribute('href', 'https://example.org/swing.mp4');
    expect(screen.getByText(/nieznane — tego ćwiczenia nie ma/)).toBeInTheDocument();
    await waitFor(() => expect(linkState().assignments[0]!.status).toBe('seen'));
    await user.click(screen.getByRole('button', { name: 'Uruchom plan od prowadzącego' }));
    expect(props.apply).toHaveBeenCalledTimes(1);
    const next = props.apply.mock.calls[0]![0](freshState()) as AppState;
    expect(next.plans!.map((p) => p.id)).toEqual([expect.stringMatching(/^coach-[0-9a-f]{8}-sila$/)]);
    expect(window.location.hash).toMatch(/^#\/plany\/coach-/);
    expect(props.onToast).toHaveBeenCalledWith(expect.stringContaining('Pominięte ćwiczenia'));
    await waitFor(() => expect(linkState().assignments[0]!.status).toBe('started'));
  });
});
