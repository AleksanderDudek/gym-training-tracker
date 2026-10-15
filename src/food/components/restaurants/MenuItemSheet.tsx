import { ExternalLink, Plus } from 'lucide-react';
import { useState } from 'react';
import { restaurantPath } from '../../../routing';
import { useBridge } from '../../bridge';
import type { DietProfile } from '../../diet/profiles';
import { logFood, now } from '../../diet/store';
import { formatNumber } from '../../lib/format';
import { energyAgrees } from '../../restaurants/normalize';
import { isDrink, portionLabel, restaurantFood } from '../../restaurants/food';
import { CATEGORY_LABELS, type Chain, type MenuItem } from '../../restaurants/types';
import { Sheet } from '../common/Sheet';
import { StarButton } from '../common/StarButton';
import { FitBadge } from '../diet/SuggestionList';

interface Props {
  chain: Chain | null;
  item: MenuItem | null;
  diet: DietProfile | null;
  /** Odnośnik do całego menu sieci — z wyszukiwania przez wszystkie lokale. */
  linkChain?: boolean;
  onClose: () => void;
}

const ROWS: { key: keyof MenuItem; label: string; sub?: boolean; unit: string; digits: number }[] = [
  { key: 'kcal', label: 'Energia', unit: 'kcal', digits: 0 },
  { key: 'protein', label: 'Białko', unit: 'g', digits: 1 },
  { key: 'carbs', label: 'Węglowodany', unit: 'g', digits: 1 },
  { key: 'sugars', label: 'w tym cukry', sub: true, unit: 'g', digits: 1 },
  { key: 'fiber', label: 'Błonnik', unit: 'g', digits: 1 },
  { key: 'fat', label: 'Tłuszcz', unit: 'g', digits: 1 },
  { key: 'saturatedFat', label: 'w tym nasycone', sub: true, unit: 'g', digits: 1 },
  { key: 'salt', label: 'Sól', unit: 'g', digits: 2 },
];

/**
 * Karta pozycji menu: tabela na porcję (i na 100 g, gdy sieć podaje masę porcji), ocena pod profil
 * diety i „Dodaj do dziennika” — na dziś, porcja tak, jak ją podają. Wartości nieopublikowane
 * stoją jako „—”, nigdy jako zero.
 */
export function MenuItemSheet({ chain, item, diet, linkChain = false, onClose }: Props) {
  return (
    <Sheet
      open={chain !== null && item !== null}
      onClose={onClose}
      title={item?.name ?? ''}
      subtitle={chain && item ? `${chain.name} · ${CATEGORY_LABELS[item.category]} · ${portionLabel(item)}` : undefined}
      closeLabel="Zamknij pozycję menu"
      className="fd-rest-sheet"
      actions={chain && item && <StarButton food={restaurantFood(chain, item)} />}
      footer={chain && item && <AddButton chain={chain} item={item} />}
    >
      {chain && item && <Body chain={chain} item={item} diet={diet} linkChain={linkChain} />}
    </Sheet>
  );
}

function AddButton({ chain, item }: { chain: Chain; item: MenuItem }) {
  const bridge = useBridge();
  const [busy, setBusy] = useState(false);
  const add = async (dialog: HTMLDialogElement | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const food = restaurantFood(chain, item);
      await logFood(now().date, food);
      bridge.toast(`Zapisane w dzienniku: ${food.name} · ${formatNumber(food.nutrients.kcal, 0)} kcal.`);
      // Zamyka jak ×: przez `dialog.close()`, więc `onClose` przychodzi raz, ze zdarzenia.
      dialog?.close();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      className="btn wide"
      disabled={busy}
      onClick={(e) => void add(e.currentTarget.closest('dialog'))}
    >
      <Plus size={20} strokeWidth={2} aria-hidden /> Dodaj do dziennika (dziś)
    </button>
  );
}

function Body({ chain, item, diet, linkChain }: { chain: Chain; item: MenuItem; diet: DietProfile | null; linkChain: boolean }) {
  const per100 = item.grams !== null && item.grams > 0 ? 100 / item.grams : null;
  const fit = diet?.fit(item) ?? null;
  const cell = (value: number | null, digits: number, unit: string) =>
    value === null ? '—' : `${formatNumber(value, digits)} ${unit}`;

  return (
    <div className="fd-rest-detail">
      <p className="fd-rest-big">
        <span className="fd-rest-big-n">{formatNumber(item.protein, 0)} g</span> białka ·{' '}
        <span className="fd-rest-big-n">{formatNumber(item.kcal, 0)}</span> kcal
      </p>
      {item.inconsistent && (
        <p className="fd-rest-warn" role="note">
          {energyAgrees(item)
            ? 'W tabeli sieci liczby tej pozycji się nie zgadzają (np. cukrów lub tłuszczów nasyconych więcej niż całości).'
            : `W tabeli sieci kalorie nie zgadzają się z makroskładnikami — z białka, węglowodanów i tłuszczu wychodzi ok. ${formatNumber(4 * item.protein + 4 * item.carbs + 9 * item.fat, 0)} kcal.`}{' '}
          Pokazuję je tak, jak podaje sieć.
        </p>
      )}
      {fit && diet && (
        <p className="fd-rest-fit">
          <FitBadge fit={fit} /> {diet.label}: {fit.reason}.
        </p>
      )}

      <table className="fd-rest-table">
        <caption className="sr-only">Wartości odżywcze: {item.name}</caption>
        <thead>
          <tr>
            <th scope="col">Wartość</th>
            <th scope="col">Porcja</th>
            {per100 !== null && <th scope="col">{isDrink(item) ? '100 g (ml)' : '100 g'}</th>}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const value = item[r.key] as number | null;
            return (
              <tr key={r.key} className={r.sub ? 'fd-rest-sub' : undefined}>
                <th scope="row">{r.label}</th>
                <td>{cell(value, r.digits, r.unit)}</td>
                {per100 !== null && <td>{cell(value === null ? null : value * per100, r.digits, r.unit)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="fd-rest-src">
        {item.grams !== null && <>Porcja: {formatNumber(item.grams, 0)} {isDrink(item) ? 'g (ml)' : 'g'}. </>}
        {item.computed && 'Wartości na porcję wyliczone z wartości na 100 g i masy porcji. '}
        Źródło:{' '}
        <a href={item.url ?? chain.source.url} target="_blank" rel="noopener noreferrer">
          tabela {chain.name}
          <ExternalLink size={14} strokeWidth={2} aria-hidden />
        </a>
        {chain.market !== 'PL' && ` (menu rynku ${chain.market})`}.
      </p>
      {linkChain && (
        <p className="fd-rest-src">
          <a href={restaurantPath(chain.id)}>Całe menu: {chain.name}</a>
        </p>
      )}
    </div>
  );
}
