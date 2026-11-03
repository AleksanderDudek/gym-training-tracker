// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { newIdSecret } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { acceptInvite } from '../link/accept';
import { invitePreview } from '../link/rpc';
import { clearLink } from '../link/store';
import { forgetKeys, syncAll } from '../link/sync';
import LinkPages from './Link';
import { LinkCard, LinkNotice } from './LinkEntry';

/** Współpraca po angielsku: żadnej polskiej litery na stronach, karcie i uwadze. */

const POLISH = /[ąćęłńóśźż]/i;
let server: FakeSztab;

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  vi.stubEnv('VITE_SZTAB_APP_URL', 'https://sztab.example.org/');
  server = await fakeSztab({ coachName: 'Anna Smith' });
  vi.stubGlobal('fetch', vi.fn(server.fetch));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const props = { ensureSecret: (c: string) => c, apply: () => undefined, onToast: () => undefined };

describe('working with a coach in English', () => {
  it('invitation, list, connection, item, card and notice have no Polish letters', async () => {
    const inv = await server.invite(['training', 'insight'], ['training', 'labs'], 'Hi, we start on Monday.');
    window.location.hash = `#/wspolpraca/zaproszenie?i=${inv.id}&f=${inv.fingerprint}`;
    const invite = render(<LinkPages route={{ kind: 'linkInvite' }} state={freshState()} {...props} />);
    expect(await screen.findByText('Anna Smith (trainer) invites you to work together.')).toBeInTheDocument();
    expect(await screen.findByText(/only an ID: GT-/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(POLISH);
    invite.unmount();

    const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: ['training'], secret: newIdSecret() });
    if (!r.ok) throw new Error(r.reason);
    const id = await server.send(r.connection.id, {
      area: 'training',
      sentAt: Date.now(),
      from: { name: 'Anna Smith', profession: 'trainer' },
      body: { kind: 'targets', kcal: 2200, protein: 140, steps: 9000, workoutsPerWeek: 3, weightGoal: 78, weeklyRate: -0.4, note: 'Keep it steady.' },
    });
    await syncAll(() => freshState());

    for (const route of [{ kind: 'link' as const }, { kind: 'linkConnection' as const, id: r.connection.id }, { kind: 'linkAssignment' as const, id }]) {
      const view = render(<LinkPages route={route} state={freshState()} {...props} />);
      expect(document.body.textContent).not.toMatch(POLISH);
      view.unmount();
    }
    const card = render(
      <>
        <LinkCard />
        <LinkNotice />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Working with a coach' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(POLISH);
    card.unmount();
  });
});
