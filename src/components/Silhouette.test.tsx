// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Zmniejszanie zdjęcia rysuje na płótnie, którego jsdom nie ma — tu przychodzi gotowy JPEG.
vi.mock('../silhouetteImage', () => ({
  preparePhoto: vi.fn(async (file: Blob) => {
    if (file.type === 'image/heic') throw new Error('cannot decode');
    return {
      full: new Blob([new Uint8Array(500)], { type: 'image/jpeg' }),
      thumb: new Blob([new Uint8Array(40)], { type: 'image/jpeg' }),
      w: 810,
      h: 1080,
    };
  }),
}));

import { freshState } from '../engine/plan';
import { setMeasures } from '../engine/measures';
import { addDays, dayKey } from '../engine/schedule';
import { CAMERA_MARK, addPhoto, forgetPhotos, listPhotos } from '../silhouette';
import { SilhouetteCard } from './Silhouette';
import type { AppState } from '../types';

const today = dayKey(Date.now());
let made = 0;

beforeEach(async () => {
  await forgetPhotos();
  made = 0;
  // jsdom nie ma adresów `blob:` — liczymy, ile ich powstało i ile oddano.
  URL.createObjectURL = vi.fn(() => `blob:test/${++made}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.clearAllMocks());

function stateWith(): AppState {
  const s = freshState();
  setMeasures(s, addDays(today, -40), { waist: 92, hips: 104, arm: 33 });
  setMeasures(s, addDays(today, -20), { waist: 90.5 });
  setMeasures(s, addDays(today, -6), { waist: 89.7, hips: 102.5 });
  return s;
}

const card = (state: AppState, over: Partial<Parameters<typeof SilhouetteCard>[0]> = {}) => {
  const props = { state, onMeasures: vi.fn(), onDeleteMeasures: vi.fn(), onToast: vi.fn(), ...over };
  return { ...props, ...render(<SilhouetteCard {...props} />) };
};

describe('Profil → Sylwetka: obwody', () => {
  it('ostatnie wartości, zmiana od pierwszego pomiaru i wykres każdego obwodu — bez ocen', async () => {
    const { container } = card(stateWith());
    expect(screen.getByRole('heading', { name: 'Sylwetka' })).toBeInTheDocument();
    const waist = screen.getByText('Talia', { selector: '.sil-m-head span' }).closest('.sil-m')!;
    expect(waist).toHaveTextContent('89,7 cm');
    expect(waist).toHaveTextContent(/−2,3 cm od .+ · 3 pomiary/);
    expect(within(waist as HTMLElement).getByRole('img', { name: /^Talia: od 92,0 do 89,7, najniżej 89,7, najwyżej 92,0, 3 pomiarów\.$/ })).toBeInTheDocument();
    const arm = screen.getByText('Ramię', { selector: '.sil-m-head span' }).closest('.sil-m')!;
    expect(arm).toHaveTextContent(/33,0 cm\s*pierwszy pomiar/);
    // Klatki i uda nikt nie mierzył — nie ma ich kafelków.
    expect(container.querySelectorAll('.sil-m')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/brawo|uwaga|ryzyk|norma|za dużo|za mało/i);
    await screen.findByText(/^Bez zdjęć/);
  });

  it('podpowiedź pomiaru: talia według WHO, rano, na wydechu', async () => {
    card(freshState());
    await userEvent.click(screen.getByText('Jak mierzyć'));
    expect(screen.getByText(/między dolnym żebrem a górą kości biodrowej \(tak mierzy WHO\)/)).toBeVisible();
    expect(screen.getByText(/na spokojnym wydechu/)).toBeVisible();
    expect(screen.getByText(/^Rano/)).toBeVisible();
    await screen.findByText(/^Bez zdjęć/);
  });

  it('zapis wysyła tylko wpisane pola, z przecinkiem; liczba spoza zakresu nie wychodzi', async () => {
    const { onMeasures, onToast } = card(freshState());
    await userEvent.type(screen.getByLabelText('Talia, cm'), '88,4');
    await userEvent.type(screen.getByLabelText('Udo, cm'), '580');
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz pomiar' }));
    expect(onToast).toHaveBeenCalledWith('Udo: wpisz od 20 do 120 cm.');
    expect(onMeasures).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Udo, cm'));
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz pomiar' }));
    expect(onMeasures).toHaveBeenCalledWith({ waist: 88.4 });
    expect(screen.getByLabelText('Talia, cm')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz pomiar' }));
    expect(onToast).toHaveBeenLastCalledWith('Wpisz co najmniej jeden obwód.');
  });

  it('ostatnie pomiary z usuwaniem dnia', async () => {
    const s = stateWith();
    const { onDeleteMeasures } = card(s);
    const list = screen.getByLabelText('Ostatnie pomiary');
    expect(within(list).getAllByRole('button')).toHaveLength(3);
    expect(list).toHaveTextContent('talia 89,7 · biodra 102,5');
    await userEvent.click(within(list).getAllByRole('button')[0]!);
    expect(onDeleteMeasures).toHaveBeenCalledWith(addDays(today, -6));
  });
});

describe('Profil → Sylwetka: zdjęcia', () => {
  it('karta mówi wprost: zdjęcia zostają na telefonie i nie wchodzą do kopii', async () => {
    card(freshState());
    expect(screen.getByText(/nigdzie ich nie wysyłamy i nie wchodzą do kopii zapasowej/)).toBeInTheDocument();
    expect(screen.getByText(/„Usuń wszystkie dane” kasuje także je/)).toBeInTheDocument();
    await screen.findByText(/^Bez zdjęć/);
  });

  it('dodanie z galerii: dzień z daty pliku, miniatura na liście, nieczytelny plik — komunikat', async () => {
    const { onToast } = card(freshState());
    await screen.findByText(/^Bez zdjęć/);
    const old = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg', lastModified: Date.parse(`${addDays(today, -30)}T10:00:00Z`) });
    const heic = new File([new Uint8Array(10)], 'b.heic', { type: 'image/heic' });
    await userEvent.upload(screen.getByTestId('sil-gallery'), [old, heic]);
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Zdjęcie dodane. Nie udało się odczytać zdjęcia. Spróbuj innego pliku (JPEG albo PNG).'));
    const photos = await listPhotos();
    expect(photos.map((p) => p.day)).toEqual([addDays(today, -30)]);
    const list = await screen.findByRole('list', { name: 'Zdjęcia według daty' });
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    expect(list.querySelector('img')).toHaveAttribute('src', expect.stringMatching(/^blob:/));
  });

  it('aparat: znacznik przed otwarciem, zdjęcie z dziś, znacznik zdjęty po powrocie', async () => {
    card(freshState());
    await screen.findByText(/^Bez zdjęć/);
    const input = screen.getByTestId('sil-camera');
    expect(input).toHaveAttribute('capture', 'user');
    expect(input).toHaveAttribute('accept', 'image/*');
    await userEvent.click(screen.getByRole('button', { name: 'Aparat' }));
    expect(window.sessionStorage.getItem(CAMERA_MARK)).not.toBeNull();
    await userEvent.upload(input, new File([new Uint8Array(10)], 'c.jpg', { type: 'image/jpeg', lastModified: 1 }));
    await screen.findByRole('list', { name: 'Zdjęcia według daty' });
    expect((await listPhotos())[0]!.day).toBe(today);
    expect(window.sessionStorage.getItem(CAMERA_MARK)).toBeNull();
  });

  it('karta zamknięta przy aparacie: po wczytaniu podpowiedź, że zdjęcie czeka w galerii', async () => {
    window.sessionStorage.setItem(CAMERA_MARK, String(Date.now() - 30_000));
    card(freshState());
    expect(screen.getByRole('status')).toHaveTextContent(/Telefon zamknął aplikację, kiedy był otwarty aparat/);
    expect(window.sessionStorage.getItem(CAMERA_MARK)).toBeNull();
    await screen.findByText(/^Bez zdjęć/);
  });

  it('oglądanie, pobranie i usunięcie z potwierdzeniem; adresy blob: są oddawane', async () => {
    await addPhoto({ day: addDays(today, -3), full: new Blob([new Uint8Array(9)]), thumb: new Blob([new Uint8Array(3)]), w: 3, h: 4 });
    const { onToast, unmount } = card(freshState());
    const list = await screen.findByRole('list', { name: 'Zdjęcia według daty' });
    await userEvent.click(within(list).getByRole('button'));
    const viewer = await screen.findByRole('region', { name: /^Zdjęcie sylwetki z / });
    await within(viewer).findByRole('img');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await userEvent.click(within(viewer).getByRole('button', { name: 'Pobierz' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe(`sylwetka-${addDays(today, -3)}.jpg`);
    click.mockRestore();
    await userEvent.click(within(viewer).getByRole('button', { name: 'Usuń' }));
    expect(screen.getByText('Usunąć to zdjęcie? Nie da się tego cofnąć.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usuń zdjęcie' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Zdjęcie usunięte.'));
    expect(await listPhotos()).toEqual([]);
    await screen.findByText(/^Bez zdjęć/);
    unmount();
    // Każdy utworzony adres (miniatury, pełne zdjęcie) został oddany, poza pobraniem — to oddaje zegar.
    expect(vi.mocked(URL.revokeObjectURL).mock.calls.length).toBeGreaterThanOrEqual(made - 1);
  });

  it('porównanie: „Przed” i „Po” obok siebie, domyślnie pierwsze i ostatnie, do zmiany', async () => {
    await addPhoto({ day: '2026-08-01', full: new Blob([new Uint8Array(9)]), thumb: new Blob([new Uint8Array(3)]), w: 3, h: 4, at: 1 });
    await addPhoto({ day: '2026-09-01', full: new Blob([new Uint8Array(9)]), thumb: new Blob([new Uint8Array(3)]), w: 3, h: 4, at: 2 });
    await addPhoto({ day: '2026-09-01', full: new Blob([new Uint8Array(9)]), thumb: new Blob([new Uint8Array(3)]), w: 3, h: 4, at: 3 });
    card(freshState());
    await userEvent.click(await screen.findByRole('button', { name: 'Porównaj dwa zdjęcia' }));
    const cmp = screen.getByRole('region', { name: 'Porównaj dwa zdjęcia' });
    const before = within(cmp).getByLabelText('Przed') as HTMLSelectElement;
    const after = within(cmp).getByLabelText('Po') as HTMLSelectElement;
    expect(before.selectedOptions[0]!.textContent).toMatch(/^1 sie/);
    expect(after.selectedOptions[0]!.textContent).toMatch(/^1 wrz.* \(2\)$/);
    await waitFor(() => expect(within(cmp).getAllByRole('img')).toHaveLength(2));
    await userEvent.selectOptions(after, after.options[1]!);
    expect(within(cmp).getByText(/^Po · 1 wrz.* \(1\)$/)).toBeInTheDocument();
    await userEvent.click(within(cmp).getByRole('button', { name: 'Zamknij porównanie' }));
    expect(screen.queryByRole('region', { name: 'Porównaj dwa zdjęcia' })).not.toBeInTheDocument();
  });
});
