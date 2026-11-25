import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Connection } from '../src/lib/data';

/** Powiadomienia w ekranach: znacznik na karcie podopiecznego i zdanie w oknie wysyłki. */

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'pl';
});

const env = vi.hoisted(() => ({ api: 'https://api.example.test' }));
let connections: Connection[] = [];

vi.mock('../src/lib/env', async (orig) => {
  const real = await orig<typeof import('../src/lib/env')>();
  return {
    ...real,
    get TRACKER_API_URL() {
      return env.api;
    },
  };
});

vi.mock('../src/session', () => ({
  useReady: () => ({
    coach: { id: 'c1', display_name: 'Anna Nowak', profession: 'trainer', key_fingerprint: 'A'.repeat(22) },
    user: { id: 'c1' },
    key: {} as CryptoKey,
  }),
}));

vi.mock('../src/lib/data', async (orig) => ({
  ...(await orig<typeof import('../src/lib/data')>()),
  listLibrary: vi.fn(async () => []),
  getConnection: vi.fn(async (id: string) => connections.find((c) => c.id === id) ?? null),
  readSnapshot: vi.fn(async () => ({ snapshot: null, at: null, bytes: 0, unreadable: false })),
  listAssignments: vi.fn(async () => []),
  unreadCounts: vi.fn(async () => ({})),
}));

const conn = (id: string, pseudonym: string, notifySealed: boolean): Connection => ({
  id,
  inviteId: `i-${id}`,
  pseudonym,
  areas: ['training'],
  scopes: ['training'],
  clientKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as Connection['clientKey'],
  status: 'active',
  endedBy: null,
  createdAt: '2026-11-01T10:00:00Z',
  endedAt: null,
  lastPushAt: null,
  label: null,
  notifySealed,
});

const ON = conn('on', '7K4Q9XM2HT3PZR8WE5NA', true);
const OFF = conn('off', 'B4Q29XM2HT3PZR8WE5NA', false);
const ON2 = conn('on2', 'C4Q29XM2HT3PZR8WE5NA', true);

beforeEach(() => {
  env.api = 'https://api.example.test';
  connections = [ON, OFF];
});

describe('Karta podopiecznego', () => {
  it('„powiadomienia włączone”, gdy podopieczny je włączył (pieczęć tokenu w bazie); bez niej — nic', async () => {
    const { ClientPage } = await import('../src/pages/Client');
    const { unmount } = render(<ClientPage id="on" />);
    expect(await screen.findByText('powiadomienia włączone')).toHaveAttribute('title', expect.stringMatching(/bez ich treści/));
    unmount();

    render(<ClientPage id="off" />);
    await screen.findByRole('heading', { name: 'GT-B4Q2-9XM2' });
    expect(screen.queryByText('powiadomienia włączone')).toBeNull();
  });

  it('Sztab bez adresu serwera aplikacji nie obiecuje powiadomień', async () => {
    env.api = '';
    const { ClientPage } = await import('../src/pages/Client');
    render(<ClientPage id="on" />);
    await screen.findByRole('heading', { name: 'GT-7K4Q-9XM2' });
    expect(screen.queryByText('powiadomienia włączone')).toBeNull();
  });
});

describe('Okno wysyłki', () => {
  const open = async (connection: Connection, recipients?: Connection[]) => {
    const { SendDialog } = await import('../src/pages/Send');
    render(<SendDialog connection={connection} recipients={recipients} onClose={() => undefined} onSent={() => undefined} />);
    return screen.findByRole('dialog');
  };

  it('z pieczęcią tokenu — „dostanie powiadomienie”', async () => {
    const d = await open(ON);
    expect(d).toHaveTextContent('Podopieczny dostanie powiadomienie na telefon (bez treści).');
  });

  it('bez pieczęci albo bez serwera — „zobaczy to przy następnym otwarciu aplikacji”', async () => {
    const d = await open(OFF);
    expect(d).toHaveTextContent('Bez powiadomienia na telefon — podopieczny zobaczy to przy następnym otwarciu aplikacji.');
  });

  it('bez adresu serwera aplikacji — też bez obietnicy', async () => {
    env.api = '';
    const d = await open(ON);
    expect(d).toHaveTextContent('Bez powiadomienia na telefon');
  });

  it('do wielu — ilu z odbiorców dostanie powiadomienie', async () => {
    const some = await open(ON, [ON, OFF]);
    expect(some).toHaveTextContent('Powiadomienie na telefon: 1 z 2. Pozostali zobaczą to przy następnym otwarciu aplikacji.');
    expect(within(some).queryByText('DEMO')).toBeNull();
  });

  it('do wielu z podopiecznym demo zaznaczonym ręcznie — „DEMO” przy nim na liście odbiorców', async () => {
    const demo = { ...conn('demo', 'D4Q29XM2HT3PZR8WE5NA', false), label: 'DEMO' };
    const d = await open(ON, [ON, demo]);
    const row = within(d).getByText('GT-D4Q2-9XM2').closest('li')!;
    expect(within(row).getByText('DEMO')).toBeInTheDocument();
  });

  it('do wielu, wszyscy z pieczęcią', async () => {
    const all = await open(ON, [ON, ON2]);
    expect(all).toHaveTextContent('Wszyscy odbiorcy dostaną powiadomienie na telefon (bez treści).');
  });
});
