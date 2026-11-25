import { Component, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { MealsBody, PlannedMeal } from '@gymtracker/link';
import { localDay } from '@gymtracker/link/coaching';
import { linkConfigured } from '../link/config';
import { connectionOf, linkState, ticksOn, useLink } from '../link/store';
import { mealsToday } from '../link/today';
import type { DayProgress } from '../link/today';
import { linkAssignmentPath } from '../routing';
import { num, text } from '../i18n';
import { trail } from '../trail';
import './coach.css';

/**
 * „Jadłospis od prowadzącego” na górze dziennika jedzenia (tylko dziś): posiłki dnia z jadłospisu
 * prowadzącego do odhaczenia na miejscu, odnośnik do całego jadłospisu i — dla posiłku z kaloriami —
 * „Dodaj do dziennika”, które zapisuje go jak szybki wpis (nazwa, kalorie, makro) i odhacza.
 *
 * Odhaczenie wczytuje `sync.ts` dopiero na żądanie. Dziennik nie zna stanu treningów, więc paczka do
 * prowadzącego idzie przy najbliższej synchronizacji (`pushDue`), a nie po 2,5 s jak ze strony zalecenia.
 */

const T = text({
  pl: {
    tag: 'Jadłospis od prowadzącego',
    dayN: (n: number) => `Dzień ${n}`,
    progress: (done: number, due: number) => `zjedzone ${done} z ${due}`,
    kcal: (n: number) => `${num(n)} kcal`,
    add: 'Dodaj',
    addAria: (name: string) => `Dodaj do dziennika: ${name}`,
    added: 'W dzienniku',
    failed: 'Nie udało się dodać posiłku do dziennika.',
  },
  en: {
    tag: 'Meal plan from your coach',
    dayN: (n: number) => `Day ${n}`,
    progress: (done: number, due: number) => `${done} of ${due} eaten`,
    kcal: (n: number) => `${num(n)} kcal`,
    add: 'Add',
    addAria: (name: string) => `Add to diary: ${name}`,
    added: 'In the diary',
    failed: 'The meal could not be added to the diary.',
  },
});

export interface CoachMealsProps {
  /** Dzisiejsze wpisy dziennika: posiłek dodany stąd (szybki wpis pod tą samą nazwą) już nie ma przycisku. */
  entries: readonly { name: string; source: string }[] | undefined;
  /** Bez liczenia kalorii — bez liczb przy posiłkach. */
  showKcal: boolean;
  /** Zapis posiłku jako szybkiego wpisu; bez niego — tylko odhaczanie. */
  onAdd?: (meal: PlannedMeal & { kcal: number }) => Promise<unknown>;
}

export function CoachMeals(props: CoachMealsProps) {
  const s = useLink();
  const plans = linkConfigured() ? mealsToday(s, localDay()) : [];
  if (!plans.length) return null;
  return (
    <>
      {plans.map((p) => (
        <MealsStrip key={p.x.id} p={p} {...props} />
      ))}
    </>
  );
}

function MealsStrip({ p, entries, showKcal, onAdd }: CoachMealsProps & { p: DayProgress<MealsBody> & { dayIndex: number } }) {
  const s = useLink();
  const id = useId();
  const day = localDay();
  const b = p.x.a.body;
  const md = b.days[p.dayIndex]!;
  const ticked = new Set(ticksOn(s, p.x.id, day));
  const done = p.due.filter((i) => ticked.has(i)).length;
  const coach = connectionOf(s, p.x.connectionId)?.coach.name ?? p.x.a.from.name;
  const [busy, setBusy] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  // „Dodaj do dziennika” znika po zapisie (zostaje „W dzienniku”) — fokus przechodzi na pole posiłku obok.
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const refocus = useRef<number | null>(null);
  useEffect(() => {
    if (refocus.current === null) return;
    boxes.current[refocus.current]?.focus();
    refocus.current = null;
  });

  /**
   * Zmiana odhaczeń posiłku `i`: `null` — na odwrót, `true` — odhaczony. Liczona dopiero po wczytaniu
   * `sync.ts`, z zapisu w tej chwili — nie z chwili renderu: dwa szybkie stuknięcia przed wczytaniem
   * inaczej zgubiłyby pierwsze.
   */
  const setTick = (i: number, on: boolean | null) => {
    const { x, due } = p;
    void import('../link/sync')
      .then((m) => {
        const now = linkState();
        const next = new Set(ticksOn(now, x.id, day));
        const want = on ?? !next.has(i);
        // Posiłek dodany do dziennika, a już odhaczony — nie ma czego wysyłać.
        if (want === next.has(i)) return;
        if (want) next.add(i);
        else next.delete(i);
        // Stanu treningów dziennik nie ma — paczka pójdzie przy najbliższej synchronizacji aplikacji.
        m.setDayTicks(x, day, due.filter((d) => next.has(d)), () => null);
        const st = now.assignments.find((a) => a.id === x.id)?.status ?? x.status;
        if (st === 'new' || st === 'seen' || st === 'declined') void m.setAssignmentStatus(x.id, 'started');
      })
      .catch(() => undefined);
  };
  const toggle = (i: number) => setTick(i, null);
  const add = async (i: number, meal: PlannedMeal & { kcal: number }) => {
    if (!onAdd) return;
    setBusy(i);
    setStatus('');
    try {
      await onAdd(meal);
      refocus.current = i;
      setTick(i, true);
    } catch {
      setStatus(T.failed);
    }
    setBusy(null);
  };

  return (
    <section className="grp lk-coach lk-coach-strip" aria-labelledby={`${id}-tag ${id}-t`}>
      <div className="today-tag lk-coach-tag" id={`${id}-tag`}>
        {T.tag}
      </div>
      <h2 className="lk-coach-who" id={`${id}-t`}>
        <a href={linkAssignmentPath(p.x.id)}>{b.title}</a>
      </h2>
      <p className="lk-coach-count tight" aria-live="polite">
        {[coach, md.label || T.dayN(p.dayIndex + 1), T.progress(done, p.due.length)].join(' · ')}
      </p>
      <ul className="lk-coach-ticks">
        {md.meals.map((m, i) => {
          const on = ticked.has(i);
          const kcal = m.kcal;
          const inDiary = !!entries?.some((e) => e.source === 'quick' && e.name === m.name);
          const meta = [m.slot, showKcal && kcal !== null ? T.kcal(Math.round(kcal)) : ''].filter(Boolean).join(' · ');
          return (
            <li key={`${p.x.id}:${i}`} className="lk-coach-meal">
              <label className={`lk-coach-tick${on ? ' lk-coach-done' : ''}`}>
                <input
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(i)}
                />
                {/* Nazwa pierwsza (czytnik ekranu), pora i kalorie wizualnie nad nią. */}
                <span className="lk-coach-label">
                  <span className="lk-coach-name">{m.name}</span>{' '}
                  {meta ? <span className="lk-coach-slot">{meta}</span> : null}
                </span>
              </label>
              {onAdd && kcal !== null ? (
                inDiary ? (
                  <span className="lk-coach-in">{T.added}</span>
                ) : (
                  <button
                    type="button"
                    className="lk-coach-add"
                    aria-label={T.addAria(m.name)}
                    disabled={busy !== null}
                    onClick={() => void add(i, { ...m, kcal })}
                  >
                    {T.add}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="lk-coach-status" role="status">
        {status}
      </p>
    </section>
  );
}

/** Pasek jest dodatkiem do dziennika: gdyby się wywrócił, znika po cichu, a dziennik zostaje. */
export class CoachQuiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    trail.error(error instanceof Error ? error.message : String(error));
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
