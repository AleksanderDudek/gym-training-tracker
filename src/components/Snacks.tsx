import { useState } from 'react';
import { EX, GEAR_LABEL, WEIGHTED, ex, gearOf, ladderFor } from '../data/exercises';
import { exercisesByGroup, step } from '../engine/plan';
import { achCtx, exerciseProgress, formatTier, formatValue } from '../engine/badges';
import { clock, exFamilyId } from '../engine/exbadges';
import { addDays, dayKey, weekdayOf } from '../engine/schedule';
import { quickPicks, snackDefaults, snackMax, snackStats, snacksOf, snacksOn } from '../engine/snacks';
import type { SnackPick } from '../engine/snacks';
import { XP, snackXpLeft } from '../engine/xp';
import { SNACK_EMPTY, daySeed, pick, plural } from '../engine/quips';
import { go, snacksPath, statsPath } from '../routing';
import { Timer } from './Timer';
import type { AppState, ExerciseId, Snack } from '../types';

/**
 * Przekąski ruchowe: zapis krótkiej serii poza treningiem.
 *
 * Najczęstsza przekąska to ta sama co wczoraj, więc na górze stoją przyciski „jeszcze raz”
 * — jedno stuknięcie i zapisane. Formularz jest dla nowej. Poniżej dzień, tydzień
 * i historia, żeby było widać, że drobne serie się sumują.
 */

export type LogSnack = (ex: ExerciseId, reps: number, w: number | null) => void;

const SNACK_FORMS = ['przekąska', 'przekąski', 'przekąsek'] as const;

/** „Przysiad ×15”, „Deska 45 s”, „Swing ×10 · 16 kg”. */
export const snackLabel = (p: SnackPick): string => {
  const m = ex(p.ex);
  const amount = m.unit === 'secs' ? clock(p.reps) : `×${p.reps}`;
  return `${m.name} ${amount}${p.w ? ` · ${p.w} kg` : ''}`;
};

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

const dm = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return `${dd}.${mm}`;
};

const WEEKDAY = ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

/** Przyciski „jeszcze raz to samo”. */
function Picks({ picks, onLog }: { picks: SnackPick[]; onLog: LogSnack }) {
  if (!picks.length) return null;
  return (
    <div className="snack-picks">
      {picks.map((p) => (
        <button
          key={`${p.ex}|${p.reps}|${p.w ?? ''}`}
          className="snack-pick"
          onClick={() => onLog(p.ex, p.reps, p.w)}
          aria-label={`Zapisz przekąskę: ${snackLabel(p)}`}
        >
          <span aria-hidden="true">+</span> {snackLabel(p)}
        </button>
      ))}
    </div>
  );
}

/**
 * Karta na ekranie sesji. Stoi pod treningiem z planu, nie nad nim: kto przyszedł trenować,
 * najpierw widzi trening. Kto ma wolne — widzi, że dziesięć przysiadów też się liczy.
 */
export function SnackCard({ state, onLog }: { state: AppState; onLog: LogSnack }) {
  const today = dayKey(Date.now());
  const done = snacksOn(state, today).length;
  const left = snackXpLeft(state, today);
  const picks = quickPicks(state, 3);

  return (
    <div className="grp snackcard">
      <div className="today-tag light">Przekąska ruchowa</div>
      <h3 className="today-name">
        {done ? `Dziś ${done} ${plural(done, SNACK_FORMS)}` : 'Krótka seria poza treningiem'}
      </h3>
      <p className="tight">
        {done
          ? left
            ? `Jeszcze ${left} ${plural(left, SNACK_FORMS)} da dziś doświadczenie.`
            : 'Dzisiejszy limit doświadczenia z przekąsek wyczerpany — kolejne liczą się do odznak.'
          : 'Kilka przysiadów, minuta deski. Nie zmienia planu ani poziomów, rośnie za to postać i odznaki ćwiczeń.'}
      </p>
      <Picks picks={picks} onLog={onLog} />
      <div className="actions">
        <button className="btn ghost wide" onClick={() => go(snacksPath())}>
          {picks.length ? 'Inna przekąska' : 'Zapisz przekąskę'}
        </button>
      </div>
    </div>
  );
}

/** Formularz nowej przekąski. */
function SnackForm({
  state,
  initial,
  onLog,
  onToast,
}: {
  state: AppState;
  initial: ExerciseId;
  onLog: LogSnack;
  onToast: (m: string) => void;
}) {
  const groups = exercisesByGroup();
  const [id, setId] = useState<ExerciseId>(initial);
  const d0 = snackDefaults(state, initial);
  const [reps, setReps] = useState(String(d0.reps));
  const [w, setW] = useState<number | null>(d0.w);

  const m = ex(id);
  const timed = m.unit === 'secs';
  const weighted = WEIGHTED.includes(id);
  const inc = step(id);

  const choose = (next: ExerciseId) => {
    const d = snackDefaults(state, next);
    setId(next);
    setReps(String(d.reps));
    setW(WEIGHTED.includes(next) ? d.w : null);
  };

  const bump = (dir: 1 | -1) => {
    const n = (parseInt(reps || '0', 10) || 0) + dir * inc;
    setReps(String(Math.max(inc, n)));
  };

  const save = () => {
    const n = parseInt(reps || '0', 10) || 0;
    if (n <= 0) {
      onToast(timed ? 'Wpisz, ile sekund trwała przekąska.' : 'Wpisz, ile było powtórzeń.');
      return;
    }
    if (n > snackMax(id)) {
      onToast(`Przekąska ma najwyżej ${snackMax(id)}${timed ? ' s' : ' powtórzeń'} — sprawdź liczbę.`);
      return;
    }
    onLog(id, n, weighted ? w : null);
  };

  return (
    <div className="grp">
      <h3>Nowa przekąska</h3>
      <label className="fld">
        <span>ćwiczenie</span>
        <select value={id} onChange={(e) => choose(e.target.value)}>
          {Object.entries(groups).map(([g, ids]) => (
            <optgroup label={g} key={g}>
              {ids.map((x) => (
                <option key={x} value={x}>
                  {ex(x).name} · {GEAR_LABEL[gearOf(x)]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className={`snack-row${weighted ? '' : ' single'}`}>
        <div className="fld">
          <span id="snack-amount">
            {timed ? 'sekundy' : m.side ? 'powtórzenia na stronę' : 'powtórzenia'}
          </span>
          <div className="stepper">
            <button type="button" onClick={() => bump(-1)} aria-label={`Mniej o ${inc}`}>
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={snackMax(id)}
              aria-labelledby="snack-amount"
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
              {ladderFor(state, id).map((x) => (
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
          key={id}
          who={state.cfg.avatar ?? 'gustaw'}
          mode="stopwatch"
          target={parseInt(reps || '0', 10) || m.def.target}
          onDone={(secs) => setReps(String(Math.max(1, secs)))}
        />
      )}

      <p className="hint">{m.hint}</p>
      <button className="btn wide" onClick={save}>
        Zapisz przekąskę
      </button>
    </div>
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
 * Co jeszcze dziś da się dobić przekąską: rekord dnia każdego ćwiczenia, które już dziś
 * się pojawiło, i ile brakuje do jego następnego progu.
 */
function TodayTargets({ state, ids, today }: { state: AppState; ids: ExerciseId[]; today: string }) {
  if (!ids.length) return null;
  const ctx = achCtx(state, null, null, today);
  return (
    <ul className="ptlist snack-targets">
      {ids.map((id) => {
        const r = exerciseProgress(ctx, id).find((x) => x.ach.id === exFamilyId(id, 'dzien'));
        if (!r) return null;
        const now = r.current ?? 0;
        return (
          <li key={id}>
            <b>{ex(id).name}</b>: dziś {formatValue(r.ach, now)}
            {r.next === null
              ? ' — rekord dnia domknięty w komplecie.'
              : ` — do progu dnia (${formatTier(r.ach, r.next)}) brakuje ${formatValue(r.ach, Math.max(0, r.next - now))}.`}
          </li>
        );
      })}
    </ul>
  );
}

export function SnacksPage({
  state,
  id,
  onLog,
  onDelete,
  onToast,
}: {
  state: AppState;
  id?: ExerciseId | undefined;
  onLog: LogSnack;
  onDelete: (key: string) => void;
  onToast: (m: string) => void;
}) {
  const [allHistory, setAllHistory] = useState(false);
  // Ćwiczenie na start liczone raz: gdyby szło za ostatnią przekąską przy każdym renderze,
  // stuknięcie w szybki wybór przebudowałoby formularz razem z wpisaną liczbą i stoperem.
  const [fallback] = useState<ExerciseId>(() => quickPicks(state, 1)[0]?.ex ?? 'squat_air');
  const today = dayKey(Date.now());
  const all = snacksOf(state);
  const stats = snackStats(all);
  const picks = quickPicks(state, 4);
  const todays = snacksOn(state, today);
  const left = snackXpLeft(state, today);
  const initial: ExerciseId = id && EX[id] ? id : fallback;

  const past = [...new Set(all.map((s) => dayKey(s.at)))].filter((d) => d < today).sort().reverse();
  const shown = allHistory ? past : past.slice(0, 14);
  const todayIds = [...new Set(todays.map((s) => s.ex))];

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

      {picks.length > 0 && (
        <div className="grp">
          <h3>Jeszcze raz to samo</h3>
          <p className="tight">Jedno stuknięcie zapisuje przekąskę od razu.</p>
          <Picks picks={picks} onLog={onLog} />
        </div>
      )}

      {/* Klucz idzie za adresem: formularz przestawia się, gdy ktoś przyjdzie z podstrony
          innego ćwiczenia — i tylko wtedy. */}
      <SnackForm key={id ?? ''} state={state} initial={initial} onLog={onLog} onToast={onToast} />

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
        {todays.map((s) => (
          <SnackItem key={s.key} s={s} onDelete={onDelete} />
        ))}
        <TodayTargets state={state} ids={todayIds} today={today} />
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
