import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Invite } from '../src/lib/data';

const created: unknown[] = [];

vi.mock('../src/session', () => ({
  useReady: () => ({
    coach: { id: 'c1', display_name: 'Anna', profession: 'dietitian', key_fingerprint: 'A'.repeat(22) },
    user: { id: 'c1' },
  }),
}));

vi.mock('../src/lib/data', async (orig) => {
  const real = await orig<typeof import('../src/lib/data')>();
  return {
    ...real,
    listInvites: vi.fn(async () => []),
    createInvite: vi.fn(async (_coach: string, input: Omit<Invite, 'id'>): Promise<Invite> => {
      created.push(input);
      return {
        id: '6f1c7a52-6a0b-4b7e-9a45-0c3d9e2b1f10',
        areas: input.areas,
        scopes: input.scopes,
        message: null,
        label: null,
        expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        revokedAt: null,
        acceptedAt: null,
        createdAt: new Date().toISOString(),
      };
    }),
  };
});

describe('Nowe zaproszenie', () => {
  it('dietetyk zaczyna od żywienia i zakresu z niego; link niesie odcisk klucza', async () => {
    history.replaceState(null, '', '/zaproszenia?nowe=1');
    const { Invites } = await import('../src/pages/Invites');
    render(<Invites />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: /Żywienie|Nutrition/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Trening|Training/ })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Jedzenie|Food/ })).toBeChecked();

    await userEvent.click(within(dialog).getByRole('button', { name: /Utwórz link|Create link/ }));
    const link = (await screen.findByRole('textbox', { name: /Link/ })) as HTMLInputElement;
    expect(link.value).toMatch(/#\/wspolpraca\/zaproszenie\?i=6f1c7a52-6a0b-4b7e-9a45-0c3d9e2b1f10&f=A{22}$/);
    expect(screen.getByRole('img', { name: /QR/ })).toBeInTheDocument();
    expect(created[0]).toMatchObject({ areas: ['nutrition'], days: 14 });
  });
});
