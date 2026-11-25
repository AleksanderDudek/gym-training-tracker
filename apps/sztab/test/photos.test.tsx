import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Connection, Photo } from '../src/lib/data';

// Teksty po polsku bez względu na język maszyny — zanim cokolwiek wczyta `@gt/i18n`.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'pl';
});

const { byMonth, daysBetween, PhotosTab, weightNear } = await import('../src/pages/client/PhotosTab');

/** 1×1 JPEG — treść nie ma znaczenia, zakładka tylko ją pokazuje. */
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKAA/9k=';

const photo = (id: string, day: string, createdAt = `${day}T10:00:00Z`): Photo => ({ v: 1, id, day, w: 540, h: 720, jpeg: JPEG, createdAt });

let photos: Photo[] = [];
const snapshotReads = vi.fn();

vi.mock('../src/session', () => ({
  useReady: () => ({ key: {} as CryptoKey, user: { id: 'c1' }, coach: { id: 'c1' } }),
}));

vi.mock('../src/lib/data', async (orig) => {
  const real = await orig<typeof import('../src/lib/data')>();
  return {
    ...real,
    listPhotos: vi.fn(async () => photos),
    readSnapshot: vi.fn(async () => {
      snapshotReads();
      return {
        snapshot: { body: { body: [{ day: '2026-09-29', kg: 84.2 }, { day: '2026-11-25', kg: 80.6 }], measures: [] } },
        at: null,
        bytes: 0,
        unreadable: false,
      };
    }),
  };
});

const conn = (scopes: Connection['scopes'] = ['training', 'body', 'photos']): Connection => ({
  id: '3f1c7a52-6a0b-4b7e-9a45-0c3d9e2b1f10',
  inviteId: '4f1c7a52-6a0b-4b7e-9a45-0c3d9e2b1f10',
  pseudonym: 'ABCDEFGHJKMNPQRSTVWX',
  areas: ['training'],
  scopes,
  clientKey: {} as Connection['clientKey'],
  status: 'active',
  endedBy: null,
  createdAt: '2026-09-01T10:00:00Z',
  endedAt: null,
  lastPushAt: null,
  label: null,
});

beforeEach(() => {
  snapshotReads.mockClear();
  // Jak `listPhotos`: od najnowszego dnia.
  photos = [photo('c', '2026-11-25'), photo('b', '2026-10-28'), photo('a', '2026-09-30')];
});

describe('pomocnicze', () => {
  it('dni między zdjęciami bez znaku i bez przesunięć strefy', () => {
    expect(daysBetween('2026-09-30', '2026-11-25')).toBe(56);
    expect(daysBetween('2026-11-25', '2026-09-30')).toBe(56);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('ważenie najbliższe dniowi, najwyżej 3 dni obok', () => {
    const w = [{ day: '2026-10-01', kg: 80 }, { day: '2026-10-05', kg: 79 }];
    expect(weightNear(w, '2026-10-02')?.kg).toBe(80);
    expect(weightNear(w, '2026-10-03')?.kg).toBe(80);
    expect(weightNear(w, '2026-10-04')?.kg).toBe(79);
    expect(weightNear(w, '2026-10-12')).toBeNull();
  });

  it('miesiące od najnowszego', () => {
    expect(byMonth([photo('x', '2026-11-02'), photo('y', '2026-11-01'), photo('z', '2026-10-30')]).map((g) => [g.month, g.photos.length])).toEqual([
      ['2026-11', 2],
      ['2026-10', 1],
    ]);
  });
});

describe('Zakładka „Zdjęcia”', () => {
  it('siatka miesiącami z opisami po dacie, bez pobierania', async () => {
    render(<PhotosTab c={conn()} />);
    expect(await screen.findByRole('heading', { name: /listopad 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /październik 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Zdjęcie sylwetki z 25 listopada 2026' })).toHaveAttribute('src', `data:image/jpeg;base64,${JPEG}`);
    expect(screen.getByText(/3 zdjęcia/)).toBeInTheDocument();
    expect(screen.getByText(/odszyfrowuje tylko ta przeglądarka/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pobierz|download/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /pobierz|download/i })).toBeNull();
    // Paczki z wagą nie czyta, dopóki nikt nie porównuje.
    expect(snapshotReads).not.toHaveBeenCalled();
  });

  it('kliknięcie otwiera duży podgląd; strzałki przeglądają, Esc zamyka', async () => {
    const user = userEvent.setup();
    render(<PhotosTab c={conn()} />);
    await user.click(await screen.findByRole('button', { name: /Zdjęcie sylwetki z 28 października 2026/ }));
    const dialog = screen.getByRole('dialog', { name: 'Zdjęcie z 28 października 2026' });
    expect(within(dialog).getByRole('img', { name: 'Zdjęcie sylwetki z 28 października 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nowsze →' }));
    expect(screen.getByRole('dialog', { name: 'Zdjęcie z 25 listopada 2026' })).toBeInTheDocument();
    // Fokus zostaje na przycisku, a nie skacze na początek okna.
    expect(screen.getByRole('button', { name: 'Nowsze →' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: 'Zdjęcie z 28 października 2026' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: 'Zdjęcie z 25 listopada 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '← Starsze' }));
    await user.click(screen.getByRole('button', { name: '← Starsze' }));
    expect(screen.getByRole('dialog', { name: 'Zdjęcie z 30 września 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '← Starsze' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('„Porównaj”: najstarsze i najnowsze obok siebie, odstęp w dniach i waga z tych dni', async () => {
    const user = userEvent.setup();
    render(<PhotosTab c={conn()} />);
    await user.click(await screen.findByRole('button', { name: 'Porównaj' }));
    const cmp = screen.getByRole('region', { name: 'Porównanie' });
    expect(within(cmp).getByLabelText('Zdjęcie po lewej')).toHaveValue('a');
    expect(within(cmp).getByLabelText('Zdjęcie po prawej')).toHaveValue('c');
    expect(within(cmp).getByText(/56 dni między zdjęciami/)).toBeInTheDocument();
    expect(await within(cmp).findByText(/84,2 kg · ważenie 29 wrz/)).toBeInTheDocument();
    expect(within(cmp).getByText('80,6 kg')).toBeInTheDocument();
    expect(within(cmp).getByText(/waga −3,6 kg/)).toBeInTheDocument();

    await user.selectOptions(within(cmp).getByLabelText('Zdjęcie po lewej'), 'b');
    expect(within(cmp).getByText(/28 dni między zdjęciami/)).toBeInTheDocument();
    expect(within(cmp).getByText('Bez ważenia w pobliżu tego dnia')).toBeInTheDocument();

    await user.click(within(cmp).getByRole('button', { name: 'Zamknij porównanie' }));
    expect(screen.queryByRole('region', { name: 'Porównanie' })).toBeNull();
  });

  it('z dużego podglądu: „Porównaj z najstarszym” stawia to zdjęcie obok najstarszego', async () => {
    const user = userEvent.setup();
    render(<PhotosTab c={conn()} />);
    await user.click(await screen.findByRole('button', { name: /Zdjęcie sylwetki z 28 października 2026/ }));
    await user.click(screen.getByRole('button', { name: 'Porównaj z najstarszym' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const cmp = screen.getByRole('region', { name: 'Porównanie' });
    expect(within(cmp).getByLabelText('Zdjęcie po lewej')).toHaveValue('a');
    expect(within(cmp).getByLabelText('Zdjęcie po prawej')).toHaveValue('b');
    // Najstarsze porównuje się z najnowszym.
    await user.click(screen.getByRole('button', { name: /Zdjęcie sylwetki z 30 września 2026/ }));
    expect(screen.getByRole('button', { name: 'Porównaj z najnowszym' })).toBeInTheDocument();
  });

  it('bez zgody na ciało porównanie nie czyta paczki i nie pokazuje wagi', async () => {
    const user = userEvent.setup();
    render(<PhotosTab c={conn(['photos'])} />);
    await user.click(await screen.findByRole('button', { name: 'Porównaj' }));
    expect(screen.getByText(/56 dni między zdjęciami/)).toBeInTheDocument();
    expect(snapshotReads).not.toHaveBeenCalled();
    expect(screen.queryByText(/kg/)).toBeNull();
  });

  it('pusto, gdy zgoda jest, a zdjęcia jeszcze nie przyszły', async () => {
    photos = [];
    render(<PhotosTab c={conn()} />);
    expect(await screen.findByRole('heading', { name: 'Zdjęcia jeszcze nie przyszły' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Porównaj' })).toBeNull();
  });
});
