// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret } from '@gymtracker/link';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { acceptInvite } from '../link/accept';
import { invitePreview } from '../link/rpc';
import { LINK_KEY, clearLink, linkState } from '../link/store';
import { forgetKeys } from '../link/sync';

/**
 * Współpraca w całej aplikacji: link zaproszenia na świeżym profilu (bez wprowadzenia, sekret ID
 * zapisany przy przyjęciu), synchronizacja przy starcie (koniec po stronie prowadzącego jako uwaga
 * na ekranie Dziś) i „Usuń wszystkie dane”, które kończy współpracę także u prowadzącego.
 */

let server: FakeSztab;

const app = async (hash: string) => {
  window.history.replaceState(null, '', hash);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const { default: App } = await import('../App');
  render(<App />);
};

const saved = () => JSON.parse(localStorage.getItem('kb-trener-v3') ?? '{}') as { cfg?: { linkSecret?: string } };

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function connected() {
  const inv = await server.invite(['training'], ['training']);
  const secret = newIdSecret();
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: ['training'], secret });
  if (!r.ok) throw new Error(r.reason);
  return { c: r.connection, secret };
}

describe('współpraca w aplikacji', () => {
  it(
    'link zaproszenia na świeżym profilu: bez wprowadzenia; przyjęcie zapisuje sekret ID w danych aplikacji',
    async () => {
      const inv = await server.invite(['training'], ['training']);
      const user = userEvent.setup();
      await app(`#/wspolpraca/zaproszenie?i=${inv.id}&f=${inv.fingerprint}`);
      const accept = await screen.findByRole('button', { name: 'Przyjmij i wyślij dane' }, { timeout: 8000 });
      expect(screen.queryByRole('dialog', { name: 'Wprowadzenie' })).not.toBeInTheDocument();
      expect(saved().cfg?.linkSecret).toBeUndefined();
      await user.click(accept);
      await waitFor(() => expect(saved().cfg?.linkSecret).toMatch(/^[A-Za-z0-9_-]{43}$/), { timeout: 8000 });
      expect(await screen.findByText('Twoje ID u tego prowadzącego', {}, { timeout: 8000 })).toBeInTheDocument();
      // Klucze i tokeny poza zapisem aplikacji — w kopii zapasowej ich nie ma.
      expect(localStorage.getItem('kb-trener-v3')).not.toContain(linkState().connections[0]!.token!);
      expect(localStorage.getItem(LINK_KEY)).toContain(linkState().connections[0]!.id);
    },
    20_000,
  );

  it(
    'przy starcie: prowadzący zakończył współpracę — uwaga na ekranie Dziś',
    async () => {
      const { c } = await connected();
      server.endByCoach(c.id);
      await app('#/sesja');
      expect(
        await screen.findByRole('link', { name: /Współpraca z: Anna Kowalska — zakończona przez prowadzącego/ }, { timeout: 8000 }),
      ).toBeInTheDocument();
      expect(linkState().connections[0]!.status).toBe('ended');
    },
    20_000,
  );

  it(
    '„Usuń wszystkie dane” kończy współpracę u prowadzącego i zapomina ją na telefonie',
    async () => {
      const { c } = await connected();
      const user = userEvent.setup();
      await app('#/ustawienia');
      await user.click(await screen.findByRole('button', { name: 'Usuń wszystkie dane' }, { timeout: 8000 }));
      const dialog = (await screen.findByText('Usunąć wszystkie dane?', {}, { timeout: 8000 })).closest<HTMLElement>('[role=dialog]')!;
      expect(within(dialog).getByText(/Współpraca z prowadzącym się zakończy/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Usuń wszystko' }));
      await waitFor(() => expect(server.connections.get(c.id)!.status).toBe('ended'), { timeout: 8000 });
      expect(localStorage.getItem(LINK_KEY)).toBeNull();
      expect(linkState().connections).toEqual([]);
      expect(saved().cfg?.linkSecret).toBeUndefined();
    },
    20_000,
  );
});
