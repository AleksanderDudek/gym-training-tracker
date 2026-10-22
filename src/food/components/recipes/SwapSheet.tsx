import { Check, TriangleAlert } from 'lucide-react';
import { useId, useMemo } from 'react';
import { text } from '../../../i18n';
import { brandLine } from '../../lib/display';
import { formatNumber } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import type { Recipe } from '../../recipes/catalog';
import { resolveRecipe, type Basket, type Candidates, type Overrides, type ResolvedItem } from '../../recipes/resolve';
import { Sheet } from '../common/Sheet';
import { ruleBroken } from './MacroSummary';
import { proteinLine, swapOptions } from './IngredientLine';

const T = text({
  pl: {
    atHomeFrom: (shops: string) => `Masz w domu – najpierw produkty z: ${shops}`,
    atHome: 'Masz w domu – dowolny produkt',
    from: (shops: string) => `Produkty z: ${shops}`,
    anyShop: 'Produkty z dowolnego sklepu',
    title: (name: string) => `Zamień: ${name}`,
    titleEmpty: 'Zamień składnik',
    close: 'Zamknij zamianę',
    passes: (protein: string, kcal: string) => `Porcja: ${protein} g białka, ${kcal} kcal – zasada spełniona.`,
    done: 'Gotowe',
    pack: '1 opakowanie',
    packAmount: (measure: string, grams: string) =>
      `Ilość: ${measure} wybranego produktu, teraz ${grams}\u00a0g. Wybór od razu przelicza przepis.`,
    sameAmount: (measure: string, grams: string) =>
      `Ilość zostaje ta sama: ${measure}${grams}\u00a0g. Wybór od razu przelicza przepis.`,
    breaks: 'łamie zasadę',
  },
  en: {
    atHomeFrom: (shops: string) => `You have it at home – products from ${shops} first`,
    atHome: 'You have it at home – any product',
    from: (shops: string) => `Products from: ${shops}`,
    anyShop: 'Products from any shop',
    title: (name: string) => `Swap: ${name}`,
    titleEmpty: 'Swap an ingredient',
    close: 'Close the swap',
    passes: (protein: string, kcal: string) => `Serving: ${protein} g protein, ${kcal} kcal – rule met.`,
    done: 'Done',
    pack: '1 pack',
    packAmount: (measure: string, grams: string) =>
      `Amount: ${measure} of the chosen product, now ${grams}\u00a0g. Your pick recalculates the recipe straight away.`,
    sameAmount: (measure: string, grams: string) =>
      `The amount stays the same: ${measure}${grams}\u00a0g. Your pick recalculates the recipe straight away.`,
    breaks: 'breaks the rule',
  },
});

interface Props {
  open: boolean;
  recipe: Recipe;
  candidates: Candidates;
  /** Koszyk karty; null: produkty z dowolnego sklepu. */
  basket: Basket | null;
  overrides: Overrides;
  /** Składnik, który się zamienia; bez niego arkusz jest zamknięty. */
  item: ResolvedItem | null;
  dict: Dictionaries;
  onPick: (code: string) => void;
  onClose: () => void;
}

/** Skąd są produkty na liście — żeby nikt nie szukał w Lidlu zamiennika z Biedronki. */
function sourceLine(item: ResolvedItem, basket: Basket | null, dict: Dictionaries): string {
  const name = basket?.length ? basket.map((s) => dict.stores[s] ?? s).join(' + ') : null;
  if (item.def.role === 'pantry') return name ? T.atHomeFrom(name) : T.atHome;
  return name ? T.from(name) : T.anyShop;
}

/**
 * Zamiana składnika w arkuszu od dołu: lista zamienników z tego samego sklepu jako grupa
 * przycisków opcji. Wybór działa od razu (karta za arkuszem już się przelicza), strzałki idą po
 * liście po kolei, a produkt, który złamałby zasadę, jest oznaczony, zanim się go wybierze.
 * Stopka mówi, co wybór robi z porcją; „Gotowe” tylko zamyka.
 */
export function SwapSheet({ open, recipe, candidates, basket, overrides, item, dict, onPick, onClose }: Props) {
  const name = useId();
  const options = useMemo(() => (item ? swapOptions(item) : []), [item]);
  // Werdykt dla każdej pozycji: przepis z tym produktem w miejsce obecnego, reszta bez zmian.
  const verdicts = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!item) return map;
    for (const p of options) {
      map.set(p.code, resolveRecipe(recipe, candidates, basket, { ...overrides, [item.def.id]: p.code }).passes);
    }
    return map;
  }, [item, options, recipe, candidates, basket, overrides]);

  const chosen = item?.product?.code ?? null;
  const passes = chosen ? (verdicts.get(chosen) ?? true) : true;
  const serving = useMemo(
    () => (item ? resolveRecipe(recipe, candidates, basket, overrides).perServing : null),
    [item, recipe, candidates, basket, overrides],
  );

  return (
    <Sheet
      open={open && item !== null}
      onClose={onClose}
      title={item ? T.title(item.def.label) : T.titleEmpty}
      subtitle={item ? sourceLine(item, basket, dict) : undefined}
      closeLabel={T.close}
      className="fd-rec-swap-sheet"
      footer={
        item && (
          <>
            <p className={`fd-rec-swap-status ${passes ? 'fd-rec-ok' : 'fd-rec-bad'}`} role="status">
              {passes ? (
                <Check size={16} strokeWidth={2} aria-hidden />
              ) : (
                <TriangleAlert size={20} strokeWidth={2} aria-hidden />
              )}
              <span>
                {passes
                  ? T.passes(formatNumber(serving?.protein ?? 0, 0), formatNumber(serving?.kcal ?? 0, 0))
                  : ruleBroken(recipe.kind)}
              </span>
            </p>
            {/* Zamyka jak ×: przez `dialog.close()`, więc `onClose` przychodzi raz, ze zdarzenia. */}
            <button type="button" className="btn wide" onClick={(e) => e.currentTarget.closest('dialog')?.close()}>
              {T.done}
            </button>
          </>
        )
      }
    >
      {item && (
        <fieldset className="fd-rec-swap">
          <legend className="fd-rec-swap-legend">
            {item.item.pack ? (
              // Baton to baton: ilość idzie za opakowaniem wybranego produktu.
              <>{T.packAmount(item.item.measure ?? T.pack, formatNumber(item.grams, 0))}</>
            ) : (
              <>{T.sameAmount(item.item.measure ? `${item.item.measure} · ` : '', formatNumber(item.item.grams, 0))}</>
            )}
          </legend>
          <ul className="fd-rec-swap-list">
            {options.map((p) => {
              const breaks = verdicts.get(p.code) === false;
              // W koszyku dwóch sklepów zamiennik mówi, z którego jest.
              const from = basket && basket.length > 1 ? basket.find((s) => p.stores.includes(s)) : undefined;
              const meta = [brandLine(p, dict), p.quantity, from && (dict.stores[from] ?? from)].filter(Boolean).join(' · ');
              return (
                <li key={p.code}>
                  <label className="fd-rec-swap-opt">
                    <input
                      type="radio"
                      name={name}
                      value={p.code}
                      checked={p.code === chosen}
                      onChange={() => onPick(p.code)}
                    />
                    <span className="fd-rec-swap-text">
                      <span className="fd-rec-swap-name">{p.name}</span>
                      {meta && <span className="fd-rec-swap-meta">{meta}</span>}
                      <span className="fd-rec-swap-num">
                        {proteinLine(p)}
                        {p.nutrition.kcal !== null && ` · ${formatNumber(p.nutrition.kcal, 0)} kcal`}
                      </span>
                      {breaks && (
                        <span className="fd-rec-swap-warn">
                          <TriangleAlert size={16} strokeWidth={2} aria-hidden />
                          {T.breaks}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </Sheet>
  );
}
