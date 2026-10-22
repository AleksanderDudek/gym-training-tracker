import { Clock3, Star } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { pluralEn, text } from '../../../i18n';
import { addDays, daysBetween } from '../../diet/model';
import { formatNumber } from '../../lib/format';
import { moveRange } from '../../prep/dates';
import { rangeLabel, shortDate } from '../../prep/format';
import type { SwapOption } from '../../prep/select';
import { planEnd, planName } from '../../prep/store';
import { NAME_MAX, cleanName, type PrepPlan } from '../../prep/types';
import { Sheet } from '../common/Sheet';
import { COMMON } from '../common/text';

const T = text({
  pl: {
    nameTitle: 'Nazwa planu',
    name: 'Nazwa',
    nameHint: (generated: string) => `Puste pole — plan wróci do nazwy „${generated}”. Plan z własną nazwą nie zniknie sam z listy.`,
    saveName: 'Zapisz nazwę',
    datesTitle: 'Daty planu',
    first: 'Pierwszy dzień (zakupy)',
    pick: (min: string, max: string) => `Wybierz dzień od ${min} do ${max}.`,
    now: (range: string) => `Teraz: ${range}.`,
    moved: (range: string, days: number, shift: number) =>
      `Nowe daty: ${range} · ${days} dni, ${shift > 0 ? 'później' : 'wcześniej'} o ${Math.abs(shift)} ${Math.abs(shift) === 1 ? 'dzień' : 'dni'}.`,
    clearTicks: (n: number) => `Wyczyść odhaczone na liście zakupów (${n})`,
    datesNote:
      'Przepisy, porcje i lista zostają te same. Zapisy w dzienniku zostają w dniach, w których je zrobiono. W nowych dniach dziennik pójdzie za tym planem.',
    move: 'Przesuń plan',
    swapTitle: (name: string) => `Wymień: ${name}`,
    swapSub: 'Na porcję przepisu — w planie porcja i dodatki dopasują się do celu dnia.',
    search: 'Szukaj przepisu',
    fit: (n: number) =>
      `${n} ${n === 1 ? 'przepis pasuje' : n < 5 ? 'przepisy pasują' : 'przepisów pasuje'} — najlepszy dla planu na górze.`,
    of: (shown: number, all: number) => `${shown} z ${all}.`,
    favourite: 'ulubiony',
    best: 'najlepiej pasuje',
    style: 'pasuje do stylu',
    shared: 'wspólne zakupy',
    avoided: 'wcześniej wymieniony',
    chooseLabel: (name: string) => `Wybierz: ${name}`,
    choose: 'Wybierz',
    nothing: 'Nic o tej nazwie — wyczyść pole, żeby zobaczyć wszystkie.',
  },
  en: {
    nameTitle: 'Plan name',
    name: 'Name',
    nameHint: (generated: string) =>
      `Leave it empty and the plan goes back to “${generated}”. A plan with its own name won’t drop off the list by itself.`,
    saveName: 'Save name',
    datesTitle: 'Plan dates',
    first: 'First day (shopping)',
    pick: (min: string, max: string) => `Pick a day from ${min} to ${max}.`,
    now: (range: string) => `Now: ${range}.`,
    moved: (range: string, days: number, shift: number) =>
      `New dates: ${range} · ${days} days, ${Math.abs(shift)} ${pluralEn(Math.abs(shift), 'day', 'days')} ${shift > 0 ? 'later' : 'earlier'}.`,
    clearTicks: (n: number) => `Clear the ticks on the shopping list (${n})`,
    datesNote:
      'The recipes, servings and list stay the same. Diary entries stay on the days they were made. On the new days the diary will follow this plan.',
    move: 'Move plan',
    swapTitle: (name: string) => `Swap: ${name}`,
    swapSub: 'Per recipe serving — in the plan the serving and sides adjust to the day’s goal.',
    search: 'Search recipes',
    fit: (n: number) => `${n} ${pluralEn(n, 'recipe fits', 'recipes fit')} — the best for the plan at the top.`,
    of: (shown: number, all: number) => `${shown} of ${all}.`,
    favourite: 'favourite',
    best: 'best fit',
    style: 'fits the style',
    shared: 'shared shopping',
    avoided: 'swapped out before',
    chooseLabel: (name: string) => `Choose: ${name}`,
    choose: 'Choose',
    nothing: 'Nothing by that name — clear the field to see them all.',
  },
});

/*
 * Okna planu z zakupami: nazwa, daty i wybór przepisu przy „Wymień”. Treść montuje się dopiero przy
 * otwarciu (`{open && …}`), więc każde otwarcie zaczyna od stanu planu, a nie od tego, co ktoś
 * wpisał i zamknął.
 */

interface RenameProps {
  plan: PrepPlan | null;
  onSave: (name: string) => void;
  onClose: () => void;
}

/** „Zmień nazwę”: jedno pole; puste przywraca nazwę ze stylu i sklepu. */
export function RenameSheet({ plan, onSave, onClose }: RenameProps) {
  return (
    <Sheet open={plan !== null} title={T.nameTitle} onClose={onClose} className="fd-prep-sheet">
      {plan && <RenameForm plan={plan} onSave={onSave} />}
    </Sheet>
  );
}

function RenameForm({ plan, onSave }: { plan: PrepPlan; onSave: (name: string) => void }) {
  const [name, setName] = useState(plan.name ?? '');
  const generated = planName({ ...plan, name: undefined });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(cleanName(name));
  };
  return (
    <form className="fd-prep-sheet-form" onSubmit={submit}>
      <label className="fld">
        <span>{T.name}</span>
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX}
          placeholder={generated}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="tight fd-prep-soft">{T.nameHint(generated)}</p>
      <button type="submit" className="btn wide">
        {T.saveName}
      </button>
    </form>
  );
}

interface DatesProps {
  plan: PrepPlan | null;
  today: string;
  onSave: (start: string, clearTicks: boolean) => void;
  onClose: () => void;
}

/**
 * „Zmień daty”: nowy pierwszy dzień, a cały plan przesuwa się razem z nim — te same przepisy,
 * porcje i lista. Plan użyty jeszcze raz po swoim końcu dostaje od razu czystą listę zakupów.
 */
export function DatesSheet({ plan, today, onSave, onClose }: DatesProps) {
  return (
    <Sheet open={plan !== null} title={T.datesTitle} onClose={onClose} className="fd-prep-sheet">
      {plan && <DatesForm plan={plan} today={today} onSave={onSave} />}
    </Sheet>
  );
}

function DatesForm({ plan, today, onSave }: { plan: PrepPlan; today: string; onSave: DatesProps['onSave'] }) {
  const { min, max } = moveRange(today);
  const [start, setStart] = useState(plan.settings.start);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && start >= min && start <= max;
  const end = valid ? addDays(start, plan.settings.days - 1) : null;
  const reuse = valid && start > planEnd(plan);
  const [clear, setClear] = useState<boolean | null>(null);
  const clearTicks = plan.bought.length > 0 && (clear ?? reuse);
  const shift = valid ? daysBetween(plan.settings.start, start) : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && shift !== 0) onSave(start, clearTicks);
  };

  return (
    <form className="fd-prep-sheet-form" onSubmit={submit} noValidate>
      <label className="fld">
        <span>{T.first}</span>
        <input
          type="date"
          value={start}
          min={min}
          max={max}
          onChange={(e) => setStart(e.target.value)}
          aria-invalid={!valid || undefined}
          aria-describedby="fd-prep-dates-hint"
        />
      </label>
      <p className={`tight${valid ? '' : ' fd-prep-warn'}`} id="fd-prep-dates-hint" aria-live="polite">
        {!valid
          ? T.pick(shortDate(min), shortDate(max))
          : shift === 0
            ? T.now(rangeLabel(plan.settings.start, planEnd(plan)))
            : T.moved(rangeLabel(start, end!), plan.settings.days, shift)}
      </p>
      {plan.bought.length > 0 && (
        <label className="check-row">
          <input type="checkbox" checked={clearTicks} onChange={(e) => setClear(e.target.checked)} />
          <span>{T.clearTicks(plan.bought.length)}</span>
        </label>
      )}
      <p className="tight fd-prep-soft">{T.datesNote}</p>
      <button type="submit" className="btn wide" disabled={!valid || shift === 0}>
        {T.move}
      </button>
    </form>
  );
}

interface SwapProps {
  /** Danie do wymiany; `null` — okno zamknięte. */
  name: string | null;
  options: SwapOption[];
  /** Ulubione przepisy (id): gwiazdka przy nazwie. */
  favorites: ReadonlySet<string>;
  /** Gdy nic nie pasuje: dlaczego i co by pomogło. */
  empty: string;
  onPick: (recipeId: string) => void;
  onClose: () => void;
}

/** Od ilu przepisów lista dostaje pole do szukania. */
const SEARCH_FROM = 9;

/**
 * „Wymień”: każdy przepis, który może zająć to miejsce w planie — najlepszy dla planu na górze.
 * Liczby są na porcję przepisu; w planie porcja i dodatki dopasują się do celu dnia.
 */
export function SwapSheet({ name, options, favorites, empty, onPick, onClose }: SwapProps) {
  return (
    <Sheet
      open={name !== null}
      title={name ? T.swapTitle(name) : ''}
      subtitle={T.swapSub}
      onClose={onClose}
      className="fd-prep-sheet"
    >
      {name !== null && <SwapList options={options} favorites={favorites} empty={empty} onPick={onPick} />}
    </Sheet>
  );
}

function SwapList({ options, favorites, empty, onPick }: Omit<SwapProps, 'name' | 'onClose'>) {
  const [query, setQuery] = useState('');
  if (!options.length) return <p className="tight">{empty}</p>;
  const q = query.trim().toLocaleLowerCase('pl');
  const shown = q ? options.filter((o) => o.recipe.recipe.name.toLocaleLowerCase('pl').includes(q)) : options;
  const best = options[0]!.recipe.recipe.id;
  return (
    <>
      {options.length >= SEARCH_FROM && (
        <label className="fld fd-prep-search">
          <span>{T.search}</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </label>
      )}
      <p className="tight fd-prep-soft" aria-live="polite">
        {shown.length === options.length ? T.fit(options.length) : T.of(shown.length, options.length)}
      </p>
      <ul className="fd-prep-rows">
        {shown.map((o) => {
          const r = o.recipe;
          const id = r.recipe.id;
          const m = r.perServing;
          return (
            <li key={id} className="fd-prep-row">
              <div className="fd-prep-row-main">
                <p className="fd-prep-name">
                  {favorites.has(id) && (
                    <Star size={16} strokeWidth={2} className="fd-prep-fav" aria-label={T.favourite} role="img" />
                  )}{' '}
                  {r.recipe.name}
                </p>
                <p className="fd-prep-meta fd-prep-nums">
                  {formatNumber(m.kcal, 0)} kcal · {COMMON.p} {formatNumber(m.protein, 0)} · {COMMON.c}{' '}
                  {formatNumber(m.carbs, 0)} · {COMMON.f} {formatNumber(m.fat, 0)} ·{' '}
                  <Clock3 size={14} strokeWidth={2} aria-hidden /> {r.recipe.minutes} min
                </p>
                <p className="fd-prep-tags">
                  {id === best && <span className="fd-prep-tag fd-prep-tag-best">{T.best}</span>}
                  {r.fit.level === 'great' && <span className="fd-prep-tag">{T.style}</span>}
                  {o.shared > 0 && <span className="fd-prep-tag">{T.shared}</span>}
                  {o.avoided && <span className="fd-prep-tag fd-prep-tag-soft">{T.avoided}</span>}
                </p>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => onPick(id)} aria-label={T.chooseLabel(r.recipe.name)}>
                {T.choose}
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="tight">{T.nothing}</p>}
    </>
  );
}
