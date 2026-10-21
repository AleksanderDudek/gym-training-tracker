import { Clock3, Star } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { addDays, daysBetween } from '../../diet/model';
import { formatNumber } from '../../lib/format';
import { moveRange } from '../../prep/dates';
import { rangeLabel, shortDate } from '../../prep/format';
import type { SwapOption } from '../../prep/select';
import { planEnd, planName } from '../../prep/store';
import { NAME_MAX, cleanName, type PrepPlan } from '../../prep/types';
import { Sheet } from '../common/Sheet';

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
    <Sheet open={plan !== null} title="Nazwa planu" onClose={onClose} className="fd-prep-sheet">
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
        <span>Nazwa</span>
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
      <p className="tight fd-prep-soft">Puste pole — plan wróci do nazwy „{generated}”. Plan z własną nazwą nie zniknie sam z listy.</p>
      <button type="submit" className="btn wide">
        Zapisz nazwę
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
    <Sheet open={plan !== null} title="Daty planu" onClose={onClose} className="fd-prep-sheet">
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
        <span>Pierwszy dzień (zakupy)</span>
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
          ? `Wybierz dzień od ${shortDate(min)} do ${shortDate(max)}.`
          : shift === 0
            ? `Teraz: ${rangeLabel(plan.settings.start, planEnd(plan))}.`
            : `Nowe daty: ${rangeLabel(start, end!)} · ${plan.settings.days} dni, ${shift > 0 ? 'później' : 'wcześniej'} o ${Math.abs(shift)} ${Math.abs(shift) === 1 ? 'dzień' : 'dni'}.`}
      </p>
      {plan.bought.length > 0 && (
        <label className="check-row">
          <input type="checkbox" checked={clearTicks} onChange={(e) => setClear(e.target.checked)} />
          <span>Wyczyść odhaczone na liście zakupów ({plan.bought.length})</span>
        </label>
      )}
      <p className="tight fd-prep-soft">
        Przepisy, porcje i lista zostają te same. Zapisy w dzienniku zostają w dniach, w których je zrobiono. W nowych dniach
        dziennik pójdzie za tym planem.
      </p>
      <button type="submit" className="btn wide" disabled={!valid || shift === 0}>
        Przesuń plan
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
      title={name ? `Wymień: ${name}` : ''}
      subtitle="Na porcję przepisu — w planie porcja i dodatki dopasują się do celu dnia."
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
          <span>Szukaj przepisu</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </label>
      )}
      <p className="tight fd-prep-soft" aria-live="polite">
        {shown.length === options.length
          ? `${options.length} ${options.length === 1 ? 'przepis pasuje' : options.length < 5 ? 'przepisy pasują' : 'przepisów pasuje'} — najlepszy dla planu na górze.`
          : `${shown.length} z ${options.length}.`}
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
                    <Star size={16} strokeWidth={2} className="fd-prep-fav" aria-label="ulubiony" role="img" />
                  )}{' '}
                  {r.recipe.name}
                </p>
                <p className="fd-prep-meta fd-prep-nums">
                  {formatNumber(m.kcal, 0)} kcal · B {formatNumber(m.protein, 0)} · W {formatNumber(m.carbs, 0)} · T{' '}
                  {formatNumber(m.fat, 0)} ·{' '}
                  <Clock3 size={14} strokeWidth={2} aria-hidden /> {r.recipe.minutes} min
                </p>
                <p className="fd-prep-tags">
                  {id === best && <span className="fd-prep-tag best">najlepiej pasuje</span>}
                  {r.fit.level === 'great' && <span className="fd-prep-tag">pasuje do stylu</span>}
                  {o.shared > 0 && <span className="fd-prep-tag">wspólne zakupy</span>}
                  {o.avoided && <span className="fd-prep-tag soft">wcześniej wymieniony</span>}
                </p>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => onPick(id)} aria-label={`Wybierz: ${r.recipe.name}`}>
                Wybierz
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="tight">Nic o tej nazwie — wyczyść pole, żeby zobaczyć wszystkie.</p>}
    </>
  );
}
