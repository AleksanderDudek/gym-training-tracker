// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLiveQuery } from 'dexie-react-hooks';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { customFood } from '../../diet/foods';
import { clearAll } from '../../diet/store';
import { indexProducts } from '../../lib/search';
import { normalizeChain } from '../../restaurants/normalize';
import { DATASET, makeProduct } from '../../test/fixtures';
import { FoodPicker } from './FoodPicker';

vi.mock('../../restaurants/catalog', () => ({
  CHAINS: [
    normalizeChain({
      id: 'kfc',
      name: 'KFC',
      kind: 'fast-food',
      market: 'PL',
      source: { url: 'https://example.com', title: 'Tabela', checked: '2026-10-12' },
      items: [
        {
          name: 'Strips',
          category: 'kurczak',
          portion: '3 szt.',
          grams: 96,
          kcal: 290,
          protein: 27,
          carbs: 14,
          fat: 14,
          sugars: null,
          fiber: null,
          saturatedFat: null,
          salt: null,
        },
      ],
    }),
  ],
}));

const n = (kcal: number, protein: number, carbs: number, fat: number) => ({
  kcal,
  protein,
  carbs,
  fat,
  sugars: null,
  saturatedFat: null,
  fiber: null,
  salt: null,
});
const PRODUCTS = indexProducts(
  [
    makeProduct({ code: 'ban', name: 'Banan', quantity: '100 g', nutrition: n(89, 1.1, 23, 0.3) }),
    makeProduct({ code: 'bar', name: 'Baton proteinowy', quantity: '45 g', nutrition: n(380, 33, 29, 16) }),
  ],
  {},
);
const POOL = [
  customFood({ id: 9, name: 'Owsianka mamy', amountLabel: '1 miska', kcal: 420, protein: 18, carbs: 60, fat: 11 }),
];

function open(onLogged = vi.fn(), pool = POOL) {
  render(
    <FoodPicker
      open
      date="2026-10-12"
      pool={pool}
      products={PRODUCTS}
      dict={DATASET.dictionaries}
      productsLoading={false}
      onClose={vi.fn()}
      onLogged={onLogged}
    />,
  );
  return within(screen.getByRole('dialog', { name: 'Dodaj zjedzone' }));
}

beforeEach(async () => {
  await clearAll();
});

describe('„Dodaj zjedzone”', () => {
  test('search finds restaurant positions next to products and logs one in a tap', async () => {
    const user = userEvent.setup();
    const onLogged = vi.fn();
    const dialog = open(onLogged);
    await user.type(dialog.getByRole('searchbox', { name: 'Szukaj jedzenia' }), 'strips');
    await user.click(await dialog.findByRole('button', { name: /^Strips \(KFC\)/ }));
    // Porcja z menu: bez pola gramów.
    expect(dialog.queryByRole('textbox', { name: 'Ile gramów' })).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Dodaj' }));
    await waitFor(() => expect(onLogged).toHaveBeenCalledWith('Zapisane: Strips (KFC) · 290 kcal.'));
    expect(await db.entries.toArray()).toMatchObject([
      { name: 'Strips (KFC)', source: 'restaurant', amountLabel: '3 szt. · 96 g' },
    ]);
  });

  test('a set of a banana and a bar: grams per part, the total, one entry and a saved set', async () => {
    const user = userEvent.setup();
    const onLogged = vi.fn();
    const dialog = open(onLogged);
    await user.click(dialog.getByRole('button', { name: 'Zestaw' }));
    const add = dialog.getByRole('button', { name: 'Dodaj' });
    expect(add).toBeDisabled();

    const search = dialog.getByRole('searchbox', { name: 'Szukaj rzeczy do zestawu' });
    await user.type(search, 'banan');
    await user.click(await dialog.findByRole('button', { name: /^Banan/ }));
    expect(search).toHaveValue('');
    const grams = dialog.getByRole('textbox', { name: 'Ile gramów: Banan' });
    await user.clear(grams);
    // Puste gramy to nie „całe opakowanie”: zestaw czeka na liczbę.
    expect(grams).toHaveAttribute('aria-invalid', 'true');
    expect(dialog.getByRole('button', { name: 'Dodaj' })).toBeDisabled();
    await user.type(grams, '120');
    expect(grams).not.toHaveAttribute('aria-invalid');
    await user.type(search, 'baton');
    await user.click(await dialog.findByRole('button', { name: /^Baton proteinowy/ }));

    // 107 kcal banana (120 g) + 171 kcal bar (45 g).
    expect(dialog.getByText(/Razem:/)).toHaveTextContent('278 kcal · B 16 · W 41 · T 8');
    expect(dialog.getByRole('textbox', { name: 'Nazwa zestawu' })).toHaveAttribute(
      'placeholder',
      'Banan + Baton proteinowy',
    );
    await user.type(dialog.getByRole('textbox', { name: 'Nazwa zestawu' }), 'Banan i batonik');
    expect(dialog.getByRole('checkbox', { name: /Zapisz jako mój zestaw/ })).toBeChecked();
    await user.click(add);

    await waitFor(() =>
      expect(onLogged).toHaveBeenCalledWith('Zapisane: Banan i batonik · 278 kcal. Zestaw czeka w wyszukiwaniu.'),
    );
    const [set] = await db.sets.toArray();
    expect(set).toMatchObject({
      name: 'Banan i batonik',
      parts: [
        { name: 'Banan', amountLabel: '120 g' },
        { name: 'Baton proteinowy', amountLabel: '45 g' },
      ],
    });
    expect(await db.entries.toArray()).toMatchObject([
      {
        name: 'Banan i batonik',
        kcal: 278,
        source: 'set',
        key: `set:${set!.id}`,
        amountLabel: 'Banan 120 g + Baton proteinowy 45 g',
      },
    ]);
  });

  test('a part can be taken out, and an unticked set is logged but not kept', async () => {
    const user = userEvent.setup();
    const dialog = open();
    await user.click(dialog.getByRole('button', { name: 'Zestaw' }));
    const search = dialog.getByRole('searchbox', { name: 'Szukaj rzeczy do zestawu' });
    await user.type(search, 'owsianka');
    await user.click(await dialog.findByRole('button', { name: /^Owsianka mamy/ }));
    await user.type(search, 'banan');
    await user.click(await dialog.findByRole('button', { name: /^Banan/ }));
    await user.click(dialog.getByRole('button', { name: 'Usuń z zestawu: Banan' }));
    await user.click(dialog.getByRole('checkbox', { name: /Zapisz jako mój zestaw/ }));
    await user.click(dialog.getByRole('button', { name: 'Dodaj' }));
    await waitFor(async () => expect(await db.entries.count()).toBe(1));
    expect(await db.sets.count()).toBe(0);
    expect((await db.entries.toArray())[0]).toMatchObject({ name: 'Owsianka mamy', kcal: 420, source: 'set' });
  });

  test('a star puts the food under „Ulubione” first, and its „+” logs it in one tap', async () => {
    const user = userEvent.setup();
    const onLogged = vi.fn();
    const dialog = open(onLogged);
    await user.type(dialog.getByRole('searchbox', { name: 'Szukaj jedzenia' }), 'banan');
    const star = await dialog.findByRole('button', { name: 'Ulubione: Banan' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await user.click(star);
    await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'true'));
    expect(await db.favorites.get('product:ban')).toMatchObject({ food: { name: 'Banan', grams: 100 } });
  });

  test('favourites stand first under their own heading, and „+” logs one without opening it', async () => {
    const user = userEvent.setup();
    const onLogged = vi.fn();
    const oats = { ...POOL[0]!, favorite: true as const };
    const dialog = open(onLogged, [oats]);
    expect(dialog.getByText('Ulubione')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Dodaj od razu: Owsianka mamy' }));
    await waitFor(() => expect(onLogged).toHaveBeenCalledWith('Zapisane: Owsianka mamy · 420 kcal.'));
    expect(await db.entries.toArray()).toMatchObject([{ name: 'Owsianka mamy', key: 'custom:9' }]);
  });

  test('a starred row moves under „Ulubione” with the focus still on its star', async () => {
    const user = userEvent.setup();
    // Jak w aplikacji: pula liczona na nowo z ulubionych, więc wiersz przechodzi do drugiej grupy.
    function LivePicker() {
      const starred = useLiveQuery(() => db.favorites.toArray(), []) ?? [];
      const pool = POOL.map((f) => (starred.some((s) => s.key === f.key) ? { ...f, favorite: true as const } : f));
      return (
        <FoodPicker
          open
          date="2026-10-12"
          pool={[customFood({ id: 3, name: 'Banan z masłem', amountLabel: '1', kcal: 300, protein: 8, carbs: 40, fat: 12 }), ...pool]}
          products={PRODUCTS}
          dict={DATASET.dictionaries}
          productsLoading={false}
          onClose={vi.fn()}
          onLogged={vi.fn()}
        />
      );
    }
    render(<LivePicker />);
    const dialog = within(screen.getByRole('dialog', { name: 'Dodaj zjedzone' }));
    const star = await dialog.findByRole('button', { name: 'Ulubione: Owsianka mamy' });
    expect(dialog.queryByText('Ulubione')).not.toBeInTheDocument();
    star.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(dialog.getByText('Ulubione')).toBeInTheDocument());
    const items = dialog.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toBe('Ulubione');
    expect(items[1]).toMatch(/^Owsianka mamy/);
    expect(document.activeElement).toBe(dialog.getByRole('button', { name: 'Ulubione: Owsianka mamy' }));
    expect(document.activeElement).toHaveAttribute('aria-pressed', 'true');
  });
});
