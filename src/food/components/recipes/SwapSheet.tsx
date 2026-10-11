import { Check, TriangleAlert } from 'lucide-react';
import { useId, useMemo } from 'react';
import { brandLine } from '../../lib/display';
import { formatNumber } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import type { Recipe } from '../../recipes/catalog';
import { resolveRecipe, type Candidates, type Overrides, type ResolvedItem } from '../../recipes/resolve';
import { Sheet } from '../common/Sheet';
import { RULE_BROKEN } from './MacroSummary';
import { proteinLine, swapOptions } from './IngredientLine';

interface Props {
  open: boolean;
  recipe: Recipe;
  candidates: Candidates;
  store: string | null;
  overrides: Overrides;
  /** Składnik, który się zamienia; bez niego arkusz jest zamknięty. */
  item: ResolvedItem | null;
  dict: Dictionaries;
  onPick: (code: string) => void;
  onClose: () => void;
}

/** Skąd są produkty na liście — żeby nikt nie szukał w Lidlu zamiennika z Biedronki. */
function sourceLine(item: ResolvedItem, store: string | null, dict: Dictionaries): string {
  const name = store ? (dict.stores[store] ?? store) : null;
  if (item.def.role === 'pantry') return name ? `Masz w domu – najpierw produkty z: ${name}` : 'Masz w domu – dowolny produkt';
  return name ? `Produkty z: ${name}` : 'Produkty z dowolnego sklepu';
}

/**
 * Zamiana składnika w arkuszu od dołu: lista zamienników z tego samego sklepu jako grupa
 * przycisków opcji. Wybór działa od razu (karta za arkuszem już się przelicza), strzałki idą po
 * liście po kolei, a produkt, który złamałby zasadę, jest oznaczony, zanim się go wybierze.
 * Stopka mówi, co wybór robi z porcją; „Gotowe” tylko zamyka.
 */
export function SwapSheet({ open, recipe, candidates, store, overrides, item, dict, onPick, onClose }: Props) {
  const name = useId();
  const options = useMemo(() => (item ? swapOptions(item) : []), [item]);
  // Werdykt dla każdej pozycji: przepis z tym produktem w miejsce obecnego, reszta bez zmian.
  const verdicts = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!item) return map;
    for (const p of options) {
      map.set(p.code, resolveRecipe(recipe, candidates, store, { ...overrides, [item.def.id]: p.code }).passes);
    }
    return map;
  }, [item, options, recipe, candidates, store, overrides]);

  const chosen = item?.product?.code ?? null;
  const passes = chosen ? (verdicts.get(chosen) ?? true) : true;
  const serving = useMemo(
    () => (item ? resolveRecipe(recipe, candidates, store, overrides).perServing : null),
    [item, recipe, candidates, store, overrides],
  );

  return (
    <Sheet
      open={open && item !== null}
      onClose={onClose}
      title={item ? `Zamień: ${item.def.label}` : 'Zamień składnik'}
      subtitle={item ? sourceLine(item, store, dict) : undefined}
      closeLabel="Zamknij zamianę"
      className="fd-rec-swap-sheet"
      footer={
        item && (
          <>
            <p className={`fd-rec-swap-status ${passes ? 'ok' : 'bad'}`} role="status">
              {passes ? (
                <Check size={16} strokeWidth={2} aria-hidden />
              ) : (
                <TriangleAlert size={20} strokeWidth={2} aria-hidden />
              )}
              <span>
                {passes
                  ? `Porcja: ${formatNumber(serving?.protein ?? 0, 0)} g białka, ${formatNumber(serving?.kcal ?? 0, 0)} kcal – zasada spełniona.`
                  : RULE_BROKEN}
              </span>
            </p>
            {/* Zamyka jak ×: przez `dialog.close()`, więc `onClose` przychodzi raz, ze zdarzenia. */}
            <button type="button" className="btn wide" onClick={(e) => e.currentTarget.closest('dialog')?.close()}>
              Gotowe
            </button>
          </>
        )
      }
    >
      {item && (
        <fieldset className="fd-rec-swap">
          <legend className="fd-rec-swap-legend">
            Ilość zostaje ta sama: {item.item.measure ? `${item.item.measure} · ` : ''}
            {formatNumber(item.item.grams, 0)}&nbsp;g. Wybór od razu przelicza przepis.
          </legend>
          <ul className="fd-rec-swap-list">
            {options.map((p) => {
              const breaks = verdicts.get(p.code) === false;
              const meta = [brandLine(p, dict), p.quantity].filter(Boolean).join(' · ');
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
                          łamie zasadę
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
