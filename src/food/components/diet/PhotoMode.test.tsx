// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll } from '../../diet/store';
import { dishById } from '../../photo/dishes';
import { KcalShown } from './kcalShown';
import { PhotoMode } from './PhotoMode';

const recognize = vi.hoisted(() => vi.fn());
vi.mock('../../photo/recognize', () => ({ MODEL_MB: 20, recognize, warmUp: vi.fn(), release: vi.fn() }));

const DATE = '2026-10-14';

beforeEach(async () => {
  await clearAll();
  localStorage.clear();
  recognize.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:photo');
  URL.revokeObjectURL = vi.fn();
});

const photo = () => new File([new Uint8Array([1, 2, 3])], 'obiad.jpg', { type: 'image/jpeg' });

describe('Zdjęcie posiłku', () => {
  test('rozpoznane danie, porcja suwakiem, „jak tłuste?”, zapis z nazwą i szacunkiem', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('pierogiRuskie')!, score: 0.62 },
      { dish: dishById('gyoza')!, score: 0.12 },
    ]);
    const onLogged = vi.fn();
    const onDone = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={onLogged} onDone={onDone} />);
    expect(screen.getByText(/ok\. 20 MB/)).toBeInTheDocument();
    await user.upload(container.querySelectorAll('input[type=file]')[1] as HTMLInputElement, photo());

    expect(await screen.findByText('To chyba:')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pierogi ruskie' }));
    const plate = screen.getByRole('region', { name: 'Na talerzu' });
    const slider = within(plate).getByRole('slider', { name: 'Porcja' });
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('zwykła porcja'));
    // Z 1 porcji (indeks 3) na 1½ (indeks 5).
    fireEvent.change(slider, { target: { value: '5' } });
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('1,5 × porcja'));
    await user.click(within(plate).getByRole('button', { name: 'tłuste' }));
    await user.click(within(plate).getByRole('button', { name: 'Dodaj do dziennika' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({ date: DATE, source: 'dish', key: 'dish:pierogiRuskie', name: 'Pierogi ruskie (tłuste)', amountLabel: '420 g' });
    expect(entry!.kcal).toBeGreaterThan(800);
    expect(onLogged).toHaveBeenCalledWith(expect.stringMatching(/ze zdjęcia — ok\. \d/));
  });

  test('niepewny model: prośba o wybór; wyszukiwanie dań; dwa dania na talerzu z sumą', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('padThai')!, score: 0.21 },
      { dish: dishById('ramen')!, score: 0.19 },
    ]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(container.querySelectorAll('input[type=file]')[0] as HTMLInputElement, photo());
    expect(await screen.findByText(/Nie jestem pewien/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pad thai' }));
    await user.type(screen.getByLabelText('Szukaj dania'), 'sajgonki');
    await user.click(await screen.findByRole('button', { name: /Sajgonki/ }));
    expect(screen.getByText(/Razem:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj 2 pozycje' })).toBeInTheDocument();
  });

  test('pewne danie, niepewny rodzaj: „To chyba pierogi — wybierz rodzaj”', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('pierogiRuskie')!, score: 0.35 },
      { dish: dishById('pierogiMeat')!, score: 0.3 },
      { dish: dishById('gyoza')!, score: 0.1 },
    ]);
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await userEvent.setup().upload(container.querySelectorAll('input[type=file]')[1] as HTMLInputElement, photo());
    expect(await screen.findByText('To chyba pierogi — wybierz rodzaj:')).toBeInTheDocument();
  });

  test('błąd modelu: komunikat, a wyszukiwanie dalej działa; bez liczenia kalorii nie ma kcal', async () => {
    recognize.mockRejectedValue(new Error('wasm'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { container } = render(
      <KcalShown.Provider value={false}>
        <PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />
      </KcalShown.Provider>,
    );
    await user.upload(container.querySelectorAll('input[type=file]')[1] as HTMLInputElement, photo());
    expect(await screen.findByRole('alert')).toHaveTextContent(/Wyszukaj danie/);
    await user.type(screen.getByLabelText('Szukaj dania'), 'pizza');
    await user.click((await screen.findAllByRole('button', { name: /Pizza/ }))[0]!);
    expect(screen.queryByText(/kcal/)).toBeNull();
  });
});
