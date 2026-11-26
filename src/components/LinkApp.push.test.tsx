// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { acceptInvite } from '../link/accept';
import { enableCoachPush } from '../link/notify';
import { hasNotifyChores } from '../link/notifyMemo';
import { invitePreview } from '../link/rpc';
import { clearLink, connectionOf, linkState } from '../link/store';
import { forgetKeys } from '../link/sync';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { fakeDevice, fakeWorker, forgetDevice } from '../test/pushDevice';
import type { FakeDevice, FakeWorker } from '../test/pushDevice';

/**
 * „Usuń wszystkie dane” przy włączonych powiadomieniach od prowadzącego, w całej aplikacji: serwer aplikacji
 * zapomina token, a gdy nie odpowiadał — wyrejestrowanie przeżywa reset i idzie przy następnej synchronizacji,
 * choć współprac już nie ma. Subskrypcja trzymana tylko dla prowadzącego znika.
 */

vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
});

const API = 'https://api.example';
let server: FakeSztab;
let worker: FakeWorker;
let device: FakeDevice;

const app = async (hash: string) => {
  window.history.replaceState(null, '', hash);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const { default: App } = await import('../App');
  render(<App />);
};

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  worker = fakeWorker(API, server.fetch);
  vi.stubGlobal('fetch', vi.fn(worker.fetch));
  device = fakeDevice({ permission: 'granted' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  forgetDevice();
});

describe('„Usuń wszystkie dane” z powiadomieniami od prowadzącego', () => {
  it(
    'bez sieci do serwera aplikacji: wyrejestrowanie czeka i idzie przy następnej synchronizacji',
    async () => {
      const inv = await server.invite(['training'], ['training']);
      const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: ['training'], secret: newIdSecret() });
      if (!r.ok) throw new Error(r.reason);
      expect(await enableCoachPush(r.connection.id, freshState())).toBe('on');
      const token = connectionOf(linkState(), r.connection.id)!.notify!.token;

      const user = userEvent.setup();
      await app('#/ustawienia');
      await user.click(await screen.findByRole('button', { name: 'Usuń wszystkie dane' }, { timeout: 8000 }));
      const dialog = (await screen.findByText('Usunąć wszystkie dane?', {}, { timeout: 8000 })).closest<HTMLElement>('[role=dialog]')!;
      worker.setOffline(true);
      await user.click(within(dialog).getByRole('button', { name: 'Usuń wszystko' }));
      await waitFor(() => expect(server.connections.get(r.connection.id)!.status).toBe('ended'), { timeout: 8000 });
      await waitFor(() => expect(linkState().connections).toEqual([]));
      // Reset doszedł do końca (ostatni krok zapisuje świeży stan) — nic z niego nie przeżyje testu.
      await waitFor(() => expect(localStorage.getItem('kb-trener-v3')).not.toBeNull(), { timeout: 8000 });
      // Subskrypcję trzymał tylko prowadzący (przypomnień nikt nie włączał) — znika z przeglądarki.
      expect(device.subscription).toBeNull();
      expect(hasNotifyChores()).toBe(true);
      expect(worker.calls.filter((x) => x.path === '/link/unregister')).toEqual([]);

      // Powrót do aplikacji z siecią: synchronizacja rusza, choć współprac już nie ma.
      worker.setOffline(false);
      document.dispatchEvent(new Event('visibilitychange'));
      await waitFor(() => expect(worker.last('/link/unregister')).toEqual({ token }), { timeout: 8000 });
      await waitFor(() => expect(hasNotifyChores()).toBe(false));
    },
    20_000,
  );
});
