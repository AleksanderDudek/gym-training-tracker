// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret } from '@gymtracker/link';
import { freshState } from '../../engine/plan';
import { acceptInvite } from '../../link/accept';
import { enableCoachPush } from '../../link/notify';
import { invitePreview } from '../../link/rpc';
import { activeConnections, clearLink, connectionOf, linkState, updateLink } from '../../link/store';
import { forgetKeys } from '../../link/sync';
import { fakeSztab } from '../../test/linkServer';
import type { FakeSztab } from '../../test/linkServer';
import { fakeDevice, fakeWorker, forgetDevice } from '../../test/pushDevice';
import type { FakeDevice, FakeWorker } from '../../test/pushDevice';
import type { Route } from '../../types';
import LinkPages from '../Link';
import type { LinkProps } from '../Link';
import { VisitsPage } from './Visits';

/**
 * Powiadomienia od prowadzącego na ekranach, pod jsdom: pole przy zaproszeniu (zaznaczone, gdy telefon
 * umie; ukryte bez powiadomień; wskazówka na iPhonie w Safari), sekcja na stronie współpracy z przełącznikiem
 * i przypomnienie 2 godziny przed wizytą zarezerwowaną na telefonie.
 */

vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
});

const API = 'https://api.example';
let server: FakeSztab;
let worker: FakeWorker;
const HOUR = 3_600_000;
const CHECK = 'Powiadamiaj mnie o wiadomościach, zaleceniach i wizytach';
const ua = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  worker = fakeWorker(API, server.fetch);
  vi.stubGlobal('fetch', vi.fn(worker.fetch));
  window.location.hash = '#/sesja';
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  forgetDevice();
  if (ua) Object.defineProperty(window.navigator, 'userAgent', ua);
  else delete (window.navigator as { userAgent?: string }).userAgent;
});

function pages(route: Route & LinkProps['route']) {
  const props = { ensureSecret: vi.fn((c: string) => c), apply: vi.fn(), onToast: vi.fn() };
  render(<LinkPages route={route} state={freshState()} {...props} />);
  return props;
}

async function connect() {
  const inv = await server.invite(['training'], ['training']);
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: ['training'], secret: newIdSecret() });
  if (!r.ok) throw new Error(r.reason);
  return r.connection;
}

async function openInvite() {
  const inv = await server.invite(['training'], ['training']);
  window.location.hash = `#/wspolpraca/zaproszenie?i=${inv.id}&f=${inv.fingerprint}`;
  const props = pages({ kind: 'linkInvite' });
  await screen.findByText(/Anna Kowalska \(trener\) zaprasza cię do współpracy/);
  return props;
}

const section = (name: string): HTMLElement => screen.getByRole('heading', { level: 2, name }).closest('.grp') as HTMLElement;

describe('zaproszenie', () => {
  let device: FakeDevice;
  beforeEach(() => {
    device = fakeDevice();
  });

  it('pole zaznaczone; przyjęcie pyta o zgodę i włącza powiadomienia tej współpracy', async () => {
    const user = userEvent.setup();
    const props = await openInvite();
    const check = await screen.findByRole('checkbox', { name: CHECK });
    expect(check).toBeChecked();
    expect(screen.getByText(/bez treści i bez nazwiska/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Przyjmij i wyślij dane' }));
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith('Współpraca przyjęta, dane wysłane.'));
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
    const [c] = activeConnections(linkState());
    const token = c!.notify!.token;
    expect(worker.last('/link/register')).toMatchObject({ token, lang: 'pl' });
    expect(server.connections.get(c!.id)!.notifyToken).toBe(token);
  });

  it('odznaczone: bez pytania o zgodę i bez rejestracji', async () => {
    const user = userEvent.setup();
    const props = await openInvite();
    await user.click(await screen.findByRole('checkbox', { name: CHECK }));
    await user.click(screen.getByRole('button', { name: 'Przyjmij i wyślij dane' }));
    await waitFor(() => expect(props.onToast).toHaveBeenCalled());
    expect(device.requestPermission).not.toHaveBeenCalled();
    expect(worker.calls).toEqual([]);
    expect(activeConnections(linkState())[0]!.notify).toBeUndefined();
  });

  it('odmowa zgody: współpraca przyjęta, powiadomień nie ma', async () => {
    device.answer('denied');
    const user = userEvent.setup();
    const props = await openInvite();
    await user.click(await screen.findByRole('checkbox', { name: CHECK }).then(() => screen.getByRole('button', { name: 'Przyjmij i wyślij dane' })));
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith('Współpraca przyjęta, dane wysłane.'));
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
    expect(worker.calls).toEqual([]);
    expect(activeConnections(linkState())[0]!.notify).toBeUndefined();
  });

  it('iPhone w karcie Safari: wskazówka o ekranie początkowym zamiast pola', async () => {
    Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', configurable: true });
    await openInvite();
    expect(await screen.findByText(/Na iPhonie powiadomienia działają tylko w aplikacji dodanej do ekranu początkowego/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: CHECK })).not.toBeInTheDocument();
  });
});

describe('zaproszenie bez powiadomień', () => {
  it('przeglądarka bez Web Push: pola nie ma', async () => {
    await openInvite();
    await screen.findByText(/tylko ID: GT-/);
    expect(screen.queryByRole('checkbox', { name: CHECK })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Powiadomienia' })).not.toBeInTheDocument();
  });
});

describe('strona współpracy', () => {
  it('wyłączone → włącz → wyłącz; stan i przełącznik w sekcji „Powiadomienia”', async () => {
    const device = fakeDevice();
    const c = await connect();
    const user = userEvent.setup();
    const props = pages({ kind: 'linkConnection', id: c.id });
    const box = await screen.findByRole('heading', { level: 2, name: 'Powiadomienia' }).then(() => section('Powiadomienia'));
    expect(await within(box).findByRole('status')).toHaveTextContent('Wyłączone');
    expect(within(box).getByText(/tylko „nowa wiadomość” albo „nowe zalecenie” — bez treści/)).toBeInTheDocument();

    await user.click(within(box).getByRole('button', { name: 'Włącz powiadomienia' }));
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith('Powiadomienia od prowadzącego włączone.'));
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
    expect(within(box).getByRole('status')).toHaveTextContent(/^Włączone/);
    const token = connectionOf(linkState(), c.id)!.notify!.token;
    expect(server.connections.get(c.id)!.notifyToken).toBe(token);

    await user.click(within(box).getByRole('button', { name: 'Wyłącz powiadomienia' }));
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith('Powiadomienia od prowadzącego wyłączone.'));
    expect(within(box).getByRole('status')).toHaveTextContent('Wyłączone');
    expect(worker.last('/link/unregister')).toEqual({ token });
    expect(server.connections.get(c.id)!.notifyToken).toBeNull();
  });

  it('zablokowane w przeglądarce: jak odblokować, bez przycisku', async () => {
    fakeDevice({ permission: 'denied' });
    const c = await connect();
    pages({ kind: 'linkConnection', id: c.id });
    const box = await screen.findByRole('heading', { level: 2, name: 'Powiadomienia' }).then(() => section('Powiadomienia'));
    expect(within(box).getByRole('status')).toHaveTextContent(/zablokowane.*uprawnienia strony → Powiadomienia/);
    expect(within(box).queryByRole('button')).not.toBeInTheDocument();
  });

  it('serwer aplikacji nie odpowiada: komunikat, dalej wyłączone', async () => {
    fakeDevice({ permission: 'granted' });
    const c = await connect();
    worker.setOffline(true);
    const user = userEvent.setup();
    const props = pages({ kind: 'linkConnection', id: c.id });
    const box = await screen.findByRole('heading', { level: 2, name: 'Powiadomienia' }).then(() => section('Powiadomienia'));
    await user.click(await within(box).findByRole('button', { name: 'Włącz powiadomienia' }));
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith('Nie udało się — sprawdź połączenie i spróbuj jeszcze raz.'));
    expect(within(box).getByRole('status')).toHaveTextContent('Wyłączone');
  });

  it('zakończona współpraca: sekcji nie ma, a token znika z serwera aplikacji', async () => {
    fakeDevice({ permission: 'granted' });
    const c = await connect();
    await enableCoachPush(c.id, freshState());
    const token = connectionOf(linkState(), c.id)!.notify!.token;
    updateLink((s) => {
      const x = s.connections.find((y) => y.id === c.id)!;
      x.status = 'ended';
      x.endedBy = 'client';
      x.endedAt = Date.now();
      x.token = null;
    });
    pages({ kind: 'linkConnection', id: c.id });
    await waitFor(() => expect(connectionOf(linkState(), c.id)!.notify).toBeUndefined());
    expect(worker.last('/link/unregister')).toEqual({ token });
    expect(screen.queryByRole('heading', { name: 'Powiadomienia' })).not.toBeInTheDocument();
  });
});

describe('wizyty', () => {
  it('rezerwacja przy włączonych powiadomieniach: przypomnienie 2 godziny przed; odwołanie je kasuje', async () => {
    fakeDevice({ permission: 'granted' });
    const c = await connect();
    await enableCoachPush(c.id, freshState());
    const token = connectionOf(linkState(), c.id)!.notify!.token;
    const slot = server.slot({ title: 'Trening personalny', startsAt: new Date(Date.now() + 30 * HOUR).toISOString(), endsAt: new Date(Date.now() + 31 * HOUR).toISOString() });
    const user = userEvent.setup();
    const onToast = vi.fn();
    render(<VisitsPage id={c.id} onToast={onToast} />);
    const free = await screen.findByText('Trening personalny').then(() => section('Wolne terminy'));
    await user.click(within(free).getByRole('button', { name: 'Zarezerwuj' }));
    await user.click(within(free).getByRole('button', { name: 'Tak, rezerwuję' }));
    await waitFor(() => expect(worker.last('/link/notify')).toBeDefined());
    const booking = server.connections.get(c.id)!.bookings[0]!.id;
    expect(worker.last('/link/notify')).toEqual({ token, kind: 'visit-soon', at: Date.parse(slot.startsAt) - 2 * HOUR, ref: booking });

    const yours = section('Twoje wizyty');
    await user.click(await within(yours).findByRole('button', { name: 'Odwołaj' }));
    await user.click(within(within(yours).getByRole('group', { name: 'Odwołać tę wizytę?' })).getByRole('button', { name: 'Tak, odwołaj' }));
    await waitFor(() => expect(worker.last('/link/cancel')).toEqual({ token, ref: booking }));
  });

  it('bez włączonych powiadomień rezerwacja nie planuje niczego', async () => {
    fakeDevice({ permission: 'granted' });
    const c = await connect();
    server.slot({ title: 'Konsultacja' });
    const user = userEvent.setup();
    const onToast = vi.fn();
    render(<VisitsPage id={c.id} onToast={onToast} />);
    const free = await screen.findByText('Konsultacja').then(() => section('Wolne terminy'));
    await user.click(within(free).getByRole('button', { name: 'Zarezerwuj' }));
    await user.click(within(free).getByRole('button', { name: 'Tak, rezerwuję' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Zarezerwowane. Wizyta jest w „Twoich wizytach”.'));
    expect(worker.calls).toEqual([]);
  });
});
