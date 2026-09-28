import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { EX, WEIGHTED, ex, ladderFor } from '../data/exercises';
import { step } from '../engine/plan';
import { achCtx, exerciseProgress, formatTier, formatValue } from '../engine/badges';
import { clock, exFamilyId } from '../engine/exbadges';
import { addDays, dayKey, weekdayOf } from '../engine/schedule';
import {
  recentExercises,
  snackHint,
  snackMax,
  snackStats,
  snacksByExercise,
  snacksOf,
  snacksOn,
} from '../engine/snacks';
import { periodValue } from '../engine/volume';
import { XP, snackXpLeft } from '../engine/xp';
import { SNACK_EMPTY, daySeed, pick, plural } from '../engine/quips';
import { go, goBack, snackAddPath, snacksPath, statsPath } from '../routing';
import { Timer } from './Timer';
import { ExercisePicker } from './ExercisePicker';
import type { AppState, ExerciseId, Snack } from '../types';

/**
 * Przekąski ruchowe: zapis krótkiej serii poza treningiem.
 *
 * Droga jest zawsze ta sama: ćwiczenie → liczba → zapis. Na ekranie sesji stoją same
 * ćwiczenia, bez liczb — stuknięcie prowadzi do widoku, w którym wpisuje się, ile było.
 * Gotowa liczba na przycisku („Przysiad ×15”, zapis jednym stuknięciem) była szybsza,
 * ale zapisywała to, co było ostatnio, a nie to, co jest teraz.
 *
 * Licznik dnia pojawia się dopiero po pierwszym zapisie: zero przy każdym ćwiczeniu
 * to lista rzeczy niezrobionych, a nie zaproszenie.
 */

export type LogSnack = (ex: ExerciseId, reps: number, w: number | null) => void;

const SNACK_FORMS = ['przekąska', 'przekąski', 'przekąsek'] as const;
const SNACK_FORMS_LOC = ['przekąsce', 'przekąskach', 'przekąskach'] as const;

/** Liczba z jednostką ćwiczenia: „45 powt.”, „1 min 30 s”. */
export const amountOf = (id: ExerciseId, n: number): string =>
  EX[id]?.unit === 'secs' ? clock(n) : `${n} powt.`;

/** „Przysiad ×15”, „Deska 45 s”, „Swing ×10 · 16 kg”. */
export const snackLabel = (s: Pick<Snack, 'ex' | 'reps' | 'w'>): string => {
  const m = ex(s.ex);
  const amount = m.unit === 'secs' ? clock(s.reps) : `×${s.reps}`;
  return `${m.name} ${amount}${s.w ? ` · ${s.w} kg` : ''}`;
};

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

const dm = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return `${dd}.${mm}`;
};

const WEEKDAY = ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

/**
 * Skróty do ćwiczeń. Dzisiejsze na górze z tym, ile już jest, potem ostatnio robione,
 * a na start kilka ruchów bez sprzętu. Żadnych liczb do zatwierdzenia — tylko wejście
 * do widoku zapisu z wybranym ćwiczeniem.
 */
function SnackShortcuts({ state, today }: { state: AppState; today: string }) {
  const done = snacksByExercise(state, today);
  const doneIds = done.map((d) => d.ex);
  const rest = recentExercises(state, 8).filter((id) => !doneIds.includes(id));
  const ids = [...doneIds, ...rest].slice(0, Math.max(4, doneIds.length));

  return (
    <div className="snack-exs">
      {ids.map((id) => {
        const d = done.find((x) => x.ex === id);
        const now = d ? `dziś ${amountOf(id, d.total)}${d.count > 1 ? ` · ${d.count}×` : ''}` : null;
        return (
          <button
            key={id}
            className={`snack-ex${d ? ' on' : ''}`}
            onClick={() => go(snackAddPath(id))}
            aria-label={`${ex(id).name}${now ? `, ${now}` : ''}. Zapisz przekąskę.`}
          >
            <span className="snack-ex-name">{ex(id).name}</span>
            {now && <span className="snack-ex-now">{now}</span>}
            <span className="snack-ex-go" aria-hidden="true">
              +
            </span>
          </button>
        );
      })}
      <button className="snack-ex other" onClick={() => go(snackAddPath())}>
        <span className="snack-ex-name">Inne ćwiczenie</span>
        <span className="snack-ex-go" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  );
}

/**
 * Karta na ekranie sesji. Stoi pod treningiem z planu, nie nad nim: kto przyszedł trenować,
 * najpierw widzi trening. Licznik dnia wchodzi dopiero z pierwszą zapisaną przekąską.
 */
export function SnackCard({ state }: { state: AppState }) {
  const today = dayKey(Date.now());
  const n = snacksOn(state, today).length;
  const left = snackXpLeft(state, today);

  return (
    <div className="grp snackcard">
      <div className="today-tag light">Przekąska ruchowa</div>
      {n ? (
        <>
          <h3 className="today-name">
            Dziś {n} {plural(n, SNACK_FORMS)} · +{Math.min(n, XP.snackCap) * XP.snack} XP
          </h3>
          <p className="tight">
            {left
              ? `Jeszcze ${left} ${plural(left, SNACK_FORMS)} da dziś doświadczenie.`
              : 'Limit doświadczenia z przekąsek na dziś wyczerpany — kolejne liczą się do odznak.'}
          </p>
        </>
      ) : (
        <>
          <h3 className="today-name">Krótka seria poza treningiem</h3>
          <p className="tight">
            Wybierz ćwiczenie, a liczbę wpiszesz na następnym ekranie. Przekąska nie zmienia planu
            ani poziomów — rośnie za to postać i odznaki ćwiczeń.
          </p>
        </>
      )}
      <SnackShortcuts state={state} today={today} />
      {snacksOf(state).length > 0 && (
        <a className="vidlink" href={snacksPath()}>
          Przekąski — dziś, tydzień i historia →
        </a>
      )}
    </div>
  );
}

/**
 * Ile dziś tego ćwiczenia: przekąski i trening razem, i ile brakuje do progu dnia. Pokazuje
 * się dopiero, gdy jest co liczyć — po pierwszym zapisie albo po treningu z tym ruchem.
 */
function ExerciseToday({ state, id }: { state: AppState; id: ExerciseId }) {
  const today = dayKey(Date.now());
  const ctx = achCtx(state, null, null, today);
  const total = periodValue(ctx.metrics.perEx[id], 'dzien', today);
  if (!total) return null;

  const snacks = snacksByExercise(state, today).find((d) => d.ex === id);
  const fromSnacks = snacks?.total ?? 0;
  const fromWorkout = total - fromSnacks;
  const r = exerciseProgress(ctx, id).find((x) => x.ach.id === exFamilyId(id, 'dzien'));
  // Przy jednym źródle liczba stoi już wyżej, więc zdanie mówi tylko skąd; przy dwóch — ile z czego.
  const where =
    snacks && fromWorkout > 0
      ? `${amountOf(id, fromSnacks)} w ${snacks.count} ${plural(snacks.count, SNACK_FORMS_LOC)} i ${amountOf(id, fromWorkout)} w treningu`
      : snacks
        ? `w ${snacks.count} ${plural(snacks.count, SNACK_FORMS_LOC)}`
        : 'w treningu';

  return (
    <>
      <div className="sect-label">Dziś z tym ćwiczeniem</div>
      <div className="grp snack-today">
        <div className="snack-today-num">
          {amountOf(id, total)}
          {EX[id]?.side && EX[id]?.unit !== 'secs' && <small> na stronę</small>}
        </div>
        <p className="tight">Dziś łącznie, {where}.</p>
        {r && (
          <p className="tight">
            {r.next === null
              ? 'Rekord dnia w komplecie — wyżej już nie ma progu.'
              : `Do progu dnia (${formatTier(r.ach, r.next)}) brakuje ${formatValue(r.ach, Math.max(0, r.next - total))}.`}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Widok zapisu jednej przekąski. Pole liczby jest puste — podpowiedź mówi tylko, ile było
 * ostatnio. Po zapisie widok wraca tam, skąd ktoś przyszedł, a tam czeka już licznik dnia.
 */
export function SnackEntry({
  state,
  id,
  onLog,
  onToast,
}: {
  state: AppState;
  id?: ExerciseId | undefined;
  onLog: LogSnack;
  onToast: (m: string) => void;
}) {
  const initial = id && EX[id] ? id : null;
  const [exId, setExId] = useState<ExerciseId | null>(initial);
  const [reps, setReps] = useState('');
  const [w, setW] = useState<number | null>(() =>
    initial && WEIGHTED.includes(initial) ? snackHint(state, initial).w : null,
  );
  const amountRef = useRef<HTMLInputElement>(null);

  const m = exId ? ex(exId) : null;
  const timed = m?.unit === 'secs';
  const weighted = !!exId && WEIGHTED.includes(exId);
  const inc = exId ? step(exId) : 1;
  const hint = exId ? snackHint(state, exId) : { last: null, w: null };
  const what = timed ? 'sekund' : m?.side ? 'powtórzeń na stronę' : 'powtórzeń';

  const choose = (next: ExerciseId) => {
    setExId(next);
    setReps('');
    setW(WEIGHTED.includes(next) ? snackHint(state, next).w : null);
    // Po wyborze ćwiczenia jedyne, co zostało, to liczba — fokus idzie od razu do niej.
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const bump = (dir: 1 | -1) => {
    const n = parseInt(reps || '0', 10) || 0;
    if (!n && dir < 0) return;
    setReps(String(Math.max(inc, n + dir * inc)));
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!exId) {
      onToast('Najpierw wybierz ćwiczenie.');
      return;
    }
    const n = parseInt(reps || '0', 10) || 0;
    if (n <= 0) {
      onToast(timed ? 'Wpisz, ile sekund trwała przekąska.' : 'Wpisz, ile było powtórzeń.');
      amountRef.current?.focus();
      return;
    }
    if (n > snackMax(exId)) {
      onToast(`Przekąska ma najwyżej ${snackMax(exId)}${timed ? ' s' : ' powtórzeń'} — sprawdź liczbę.`);
      return;
    }
    onLog(exId, n, weighted ? w : null);
    goBack('#/sesja');
  };

  return (
    <>
      <div className="wrap">
        <button className="back" onClick={() => goBack('#/sesja')}>
          ← Wróć
        </button>
        <h2>Przekąska ruchowa</h2>
        <p className="lead">
          {m
            ? `Wpisz, ile było ${what}, i zapisz.`
            : 'Wybierz ćwiczenie. Pisz nazwę — lista zawęża się przy każdej literze.'}
        </p>
      </div>

      <form className="grp snack-entry" onSubmit={save} noValidate>
        <ExercisePicker label="ćwiczenie" value={exId} onChange={choose} autoFocus={!initial} />

        {m && exId && (
          <>
            <div className={`snack-row${weighted ? '' : ' single'}`}>
              <div className="fld">
                <span id="snack-amount">ile {what}</span>
                <div className="stepper">
                  <button type="button" onClick={() => bump(-1)} aria-label={`Mniej o ${inc}`}>
                    −
                  </button>
                  <input
                    ref={amountRef}
                    type="number"
                    inputMode="numeric"
                    enterKeyHint="done"
                    min={1}
                    max={snackMax(exId)}
                    aria-labelledby="snack-amount"
                    // Jedyna podpowiedź to własna liczba z ostatniego razu. Bez historii pole jest
                    // puste — przykładowa liczba też byłaby narzuconą.
                    placeholder={hint.last !== null ? `ostatnio ${timed ? clock(hint.last) : hint.last}` : ''}
                    autoFocus={!!initial}
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                  />
                  <button type="button" onClick={() => bump(1)} aria-label={`Więcej o ${inc}`}>
                    +
                  </button>
                </div>
              </div>
              {weighted && (
                <label className="fld">
                  <span>ciężar</span>
                  <select
                    value={w === null ? '' : String(w)}
                    onChange={(e) => setW(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">bez ciężaru</option>
                    {ladderFor(state, exId).map((x) => (
                      <option key={x} value={x}>
                        {x} kg
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {timed && (
              <Timer
                key={exId}
                who={state.cfg.avatar ?? 'gustaw'}
                mode="stopwatch"
                target={m.def.target}
                onDone={(secs) => setReps(String(Math.max(1, secs)))}
              />
            )}

            <p className="hint">{m.hint}</p>
            <button className="btn wide" type="submit">
              Zapisz przekąskę
            </button>
          </>
        )}
      </form>

      {exId && <ExerciseToday state={state} id={exId} />}
    </>
  );
}

/** Ostatnie siedem dni jako pasek kropek — widać, czy ruch rozkłada się na tydzień. */
function WeekStrip({ byDay, today }: { byDay: Record<string, number>; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="snack-week" role="list" aria-label="Przekąski w ostatnich siedmiu dniach">
      {days.map((d) => {
        const n = byDay[d] ?? 0;
        return (
          <div
            key={d}
            role="listitem"
            className={`sw-day${n ? ' on' : ''}${d === today ? ' now' : ''}`}
            aria-label={`${WEEKDAY[weekdayOf(d)]} ${dm(d)}: ${n} ${plural(n, SNACK_FORMS)}`}
          >
            <b>{n || '·'}</b>
            <span>{WEEKDAY[weekdayOf(d)]}</span>
          </div>
        );
      })}
    </div>
  );
}

function SnackItem({ s, onDelete }: { s: Snack; onDelete: (key: string) => void }) {
  const m = EX[s.ex];
  return (
    <div className="snack-item">
      <span className="snack-time">{time(s.at)}</span>
      <a className="snack-name" href={statsPath(s.ex)}>
        {m?.name ?? s.ex}
      </a>
      <span className="snack-amt">
        {m?.unit === 'secs' ? clock(s.reps) : `×${s.reps}`}
        {s.w ? ` · ${s.w} kg` : ''}
      </span>
      <button
        className="snack-del"
        onClick={() => onDelete(s.key)}
        aria-label={`Usuń przekąskę: ${m?.name ?? s.ex} o ${time(s.at)}`}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Dzień w rozbiciu na ćwiczenia: ile czego, w ilu przekąskach i ile brakuje do progu dnia.
 * Suma dnia liczy też trening, bo odznaka dnia liczy jedno i drugie.
 */
function TodayByExercise({ state, today }: { state: AppState; today: string }) {
  const rows = snacksByExercise(state, today);
  if (!rows.length) return null;
  const ctx = achCtx(state, null, null, today);
  return (
    <ul className="ptlist snack-targets">
      {rows.map((d) => {
        const r = exerciseProgress(ctx, d.ex).find((x) => x.ach.id === exFamilyId(d.ex, 'dzien'));
        const all = periodValue(ctx.metrics.perEx[d.ex], 'dzien', today);
        return (
          <li key={d.ex}>
            <b>{ex(d.ex).name}</b>: {amountOf(d.ex, d.total)} w {d.count}{' '}
            {plural(d.count, SNACK_FORMS_LOC)}
            {all > d.total ? ` (z treningiem ${amountOf(d.ex, all)})` : ''}
            {r && r.next !== null
              ? ` — do progu dnia brakuje ${formatValue(r.ach, Math.max(0, r.next - all))}.`
              : r
                ? ' — rekord dnia w komplecie.'
                : '.'}
          </li>
        );
      })}
    </ul>
  );
}

/** Przekąski: dziś, tydzień i historia. Zapis idzie przez skróty i widok zapisu. */
export function SnacksPage({ state, onDelete }: { state: AppState; onDelete: (key: string) => void }) {
  const [allHistory, setAllHistory] = useState(false);
  const today = dayKey(Date.now());
  const all = snacksOf(state);
  const stats = snackStats(all);
  const todays = snacksOn(state, today);
  const left = snackXpLeft(state, today);

  const past = [...new Set(all.map((s) => dayKey(s.at)))].filter((d) => d < today).sort().reverse();
  const shown = allHistory ? past : past.slice(0, 14);

  return (
    <>
      <div className="wrap">
        <button className="back" onClick={() => go('#/sesja')}>
          ← Twoja sesja
        </button>
        <h2>Przekąski ruchowe</h2>
        <p className="lead">
          Krótka seria poza treningiem: dziesięć przysiadów przy czajniku, minuta deski w przerwie.
          Kilka takich w ciągu dnia przerywa siedzenie i poprawia wydolność. Przekąska nie zmienia
          poziomów ćwiczeń ani planu — dokłada się za to do odznak ćwiczeń i do doświadczenia postaci.
        </p>
      </div>

      <div className="grp">
        <h3>Dodaj przekąskę</h3>
        <p className="tight">Wybierz ćwiczenie — liczbę wpiszesz na następnym ekranie.</p>
        <SnackShortcuts state={state} today={today} />
      </div>

      <div className="sect-label">Dziś</div>
      <div className="grp">
        {/* Żart w pustym dniu stoi we własnym akapicie i rejestrze — nie miesza się z liczbami. */}
        {!todays.length && <p className="tight joke">{pick(SNACK_EMPTY, daySeed())}</p>}
        <p className="tight">
          {todays.length
            ? `${todays.length} ${plural(todays.length, SNACK_FORMS)} · +${Math.min(todays.length, XP.snackCap) * XP.snack} XP. `
            : 'Dziś jeszcze bez przekąsek. '}
          {left
            ? `Doświadczenie da jeszcze ${left} ${plural(left, SNACK_FORMS)}.`
            : 'Limit doświadczenia na dziś wyczerpany — kolejne przekąski liczą się do odznak.'}
        </p>
        <TodayByExercise state={state} today={today} />
        {todays.map((s) => (
          <SnackItem key={s.key} s={s} onDelete={onDelete} />
        ))}
      </div>

      <div className="sect-label">Ostatnie siedem dni</div>
      <div className="grp">
        <WeekStrip byDay={stats.byDay} today={today} />
        <p className="tight" style={{ marginTop: 10 }}>
          Od początku {stats.count} {plural(stats.count, SNACK_FORMS)}
          {stats.run > 1 ? ` · najdłuższy ciąg ${stats.run} dni z rzędu` : ''}
          {stats.distinct ? ` · różnych ćwiczeń: ${stats.distinct}` : ''}.
        </p>
      </div>

      {past.length > 0 && (
        <>
          <div className="sect-label">Wcześniej</div>
          {shown.map((d) => {
            const list = snacksOn(state, d);
            return (
              <div className="h-item" key={d}>
                <div className="h-date">{dm(d)}</div>
                <div className="h-detail">{list.map((s) => snackLabel(s)).join(' · ')}</div>
                <div className="streak">{list.length}</div>
              </div>
            );
          })}
          {past.length > shown.length && (
            <div className="wrap">
              <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setAllHistory(true)}>
                Pokaż wszystkie dni ({past.length})
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
