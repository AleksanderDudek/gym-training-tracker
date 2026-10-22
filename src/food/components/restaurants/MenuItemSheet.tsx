import { ExternalLink, Plus } from 'lucide-react';
import { useState } from 'react';
import { text } from '../../../i18n';
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

const T = text({
  pl: {
    rows: {
      kcal: 'Energia',
      protein: 'Białko',
      carbs: 'Węglowodany',
      sugars: 'w tym cukry',
      fiber: 'Błonnik',
      fat: 'Tłuszcz',
      saturatedFat: 'w tym nasycone',
      salt: 'Sól',
    },
    close: 'Zamknij pozycję menu',
    saved: (name: string, kcal: string) => `Zapisane w dzienniku: ${name} · ${kcal} kcal.`,
    add: 'Dodaj do dziennika (dziś)',
    protein: 'białka',
    odd: 'W tabeli sieci liczby tej pozycji się nie zgadzają (np. cukrów lub tłuszczów nasyconych więcej niż całości).',
    energyOff: (kcal: string) =>
      `W tabeli sieci kalorie nie zgadzają się z makroskładnikami — z białka, węglowodanów i tłuszczu wychodzi ok. ${kcal} kcal.`,
    asGiven: 'Pokazuję je tak, jak podaje sieć.',
    caption: (name: string) => `Wartości odżywcze: ${name}`,
    value: 'Wartość',
    portion: 'Porcja',
    portionSize: (grams: string, unit: string) => `Porcja: ${grams} ${unit}. `,
    computed: 'Wartości na porcję wyliczone z wartości na 100 g i masy porcji. ',
    source: 'Źródło:',
    table: (chain: string) => `tabela ${chain}`,
    market: (market: string) => ` (menu rynku ${market})`,
    fullMenu: (chain: string) => `Całe menu: ${chain}`,
  },
  en: {
    rows: {
      kcal: 'Energy',
      protein: 'Protein',
      carbs: 'Carbohydrate',
      sugars: 'of which sugars',
      fiber: 'Fibre',
      fat: 'Fat',
      saturatedFat: 'of which saturates',
      salt: 'Salt',
    },
    close: 'Close menu item',
    saved: (name: string, kcal: string) => `Saved in your diary: ${name} · ${kcal} kcal.`,
    add: 'Add to diary (today)',
    protein: 'protein',
    odd: 'In the chain’s table this item’s numbers don’t add up (e.g. more sugars or saturates than the whole).',
    energyOff: (kcal: string) =>
      `In the chain’s table the calories don’t match the macros — protein, carbs and fat give about ${kcal} kcal.`,
    asGiven: 'They’re shown as the chain gives them.',
    caption: (name: string) => `Nutrition facts: ${name}`,
    value: 'Nutrient',
    portion: 'Portion',
    portionSize: (grams: string, unit: string) => `Portion: ${grams} ${unit}. `,
    computed: 'Values per portion worked out from the values per 100 g and the portion weight. ',
    source: 'Source:',
    table: (chain: string) => `${chain} table`,
    market: (market: string) => ` (${market} menu)`,
    fullMenu: (chain: string) => `Full menu: ${chain}`,
  },
});

const ROWS: { key: keyof MenuItem; label: string; sub?: boolean; unit: string; digits: number }[] = [
  { key: 'kcal', label: T.rows.kcal, unit: 'kcal', digits: 0 },
  { key: 'protein', label: T.rows.protein, unit: 'g', digits: 1 },
  { key: 'carbs', label: T.rows.carbs, unit: 'g', digits: 1 },
  { key: 'sugars', label: T.rows.sugars, sub: true, unit: 'g', digits: 1 },
  { key: 'fiber', label: T.rows.fiber, unit: 'g', digits: 1 },
  { key: 'fat', label: T.rows.fat, unit: 'g', digits: 1 },
  { key: 'saturatedFat', label: T.rows.saturatedFat, sub: true, unit: 'g', digits: 1 },
  { key: 'salt', label: T.rows.salt, unit: 'g', digits: 2 },
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
      closeLabel={T.close}
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
      bridge.toast(T.saved(food.name, formatNumber(food.nutrients.kcal, 0)));
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
      <Plus size={20} strokeWidth={2} aria-hidden /> {T.add}
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
        <span className="fd-rest-big-n">{formatNumber(item.protein, 0)} g</span> {T.protein} ·{' '}
        <span className="fd-rest-big-n">{formatNumber(item.kcal, 0)}</span> kcal
      </p>
      {item.inconsistent && (
        <p className="fd-rest-warn" role="note">
          {energyAgrees(item) ? T.odd : T.energyOff(formatNumber(4 * item.protein + 4 * item.carbs + 9 * item.fat, 0))}{' '}
          {T.asGiven}
        </p>
      )}
      {fit && diet && (
        <p className="fd-rest-fit">
          <FitBadge fit={fit} /> {diet.label}: {fit.reason}.
        </p>
      )}

      <table className="fd-rest-table">
        <caption className="sr-only">{T.caption(item.name)}</caption>
        <thead>
          <tr>
            <th scope="col">{T.value}</th>
            <th scope="col">{T.portion}</th>
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
        {item.grams !== null && T.portionSize(formatNumber(item.grams, 0), isDrink(item) ? 'g (ml)' : 'g')}
        {item.computed && T.computed}
        {T.source}{' '}
        <a href={item.url ?? chain.source.url} target="_blank" rel="noopener noreferrer">
          {T.table(chain.name)}
          <ExternalLink size={14} strokeWidth={2} aria-hidden />
        </a>
        {chain.market !== 'PL' && T.market(chain.market)}.
      </p>
      {linkChain && (
        <p className="fd-rest-src">
          <a href={restaurantPath(chain.id)}>{T.fullMenu(chain.name)}</a>
        </p>
      )}
    </div>
  );
}
