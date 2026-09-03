import { useState } from 'react';
import { ALL, BUILTIN, EX, READY, WEIGHTED, ex } from '../data/exercises';
import { acwr, sessionTonnage } from '../engine/math';
import { P, exercisesByGroup, planLabel } from '../engine/plan';
import { Chip, Sparkline } from './ui';
import { ExerciseCard } from './ExerciseCard';
import type { AppState, EffortKey, ExerciseId, ReadyKey, SetResult, Workout } from '../types';

/* ---------------- Wybór treningu ---------------- */

export function WorkoutPicker({
  workouts,
  onStart,
  planned,
}: {
  workouts: Workout[];
  onStart: (id: string) => void;
  /** Trening, który wypada dziś według planu — jeśli plan jest uruchomiony. */
  planned?: { id: string; name: string; late: number; points: number } | undefined;
}) {
  return (
    <>
      {planned && (
        <div className={`wrap`}>
          <div className={`banner ${planned.late > 0 ? '' : 'good'}`}>
            <h4>{planned.late > 0 ? 'Termin do nadrobienia' : 'Dziś według planu'}</h4>
            <p>
              {planned.name}
              {planned.late > 0
                ? ` — termin był ${planned.late === 1 ? 'wczoraj' : `${planned.late} dni temu`}. Nadrobienie wciąż się liczy, tylko taniej.`
                : ' — zrobiony dziś liczy się w pełni.'}{' '}
              Do wzięcia <b>{planned.points} pkt</b>.
            </p>
          </div>
        </div>
      )}
      <div className="wrap">
        <h2>Wybierz trening</h2>
      </div>
      <div className="wrap">
        <div className="list">
          {workouts.map((w) => {
            const names = w.items.map((i) => ex(i.ex).name).join(', ');
            return (
              <button
                className={`pick${planned?.id === w.id ? ' planned' : ''}`}
                key={w.id}
                onClick={() => onStart(w.id)}
              >
                <div>
                  <div className="n">{w.name}</div>
                  <div className="d">
                    {w.items.length} ćwiczeń · {names.slice(0, 70)}
                    {names.length > 70 ? '…' : ''}
                  </div>
                </div>
                <div className="go">start</div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------------- Sesja ---------------- */

export function SessionView({
  state,
  workout,
  onReady,
  onSave,
  onClear,
  onSkip,
  onFinish,
  onCancel,
  onToast,
}: {
  state: AppState;
  workout: Workout;
  onReady: (r: ReadyKey) => void;
  onSave: (id: ExerciseId, rows: SetResult[], effort: EffortKey) => void;
  onClear: (id: ExerciseId) => void;
  onSkip: (id: ExerciseId) => void;
  onFinish: () => void;
  onCancel: () => void;
  onToast: (m: string) => void;
}) {
  const session = state.session!;
  const doneCount = Object.keys(session.done).length;

  return (
    <div className="wrap">
      <div className="segline">Jak się dziś czujesz? Wpływa na dzisiejsze cele, nie na twoje poziomy.</div>
      <div className="seg">
        {(Object.keys(READY) as ReadyKey[]).map((k) => (
          <button key={k} aria-pressed={session.ready === k} onClick={() => onReady(k)}>
            {READY[k]}
          </button>
        ))}
      </div>

      <div className="list">
        {workout.items.map((i) => (
          <ExerciseCard
            key={`${i.ex}-${session.started}-${session.ready}-${session.done[i.ex] ? 1 : 0}-${
              session.skip[i.ex] ? 1 : 0
            }`}
            state={state}
            id={i.ex}
            onSave={onSave}
            onClear={onClear}
            onSkip={onSkip}
            onToast={onToast}
          />
        ))}
      </div>

      <div className="actions">
        <button className="btn wide" onClick={onFinish}>
          Zamknij trening ({doneCount} z {workout.items.length} zapisanych)
        </button>
        <button className="btn ghost wide" onClick={onCancel}>
          Porzuć trening
        </button>
      </div>
    </div>
  );
}

/* ---------------- Wskaźnik obciążenia ---------------- */

export function LoadGauge({ state }: { state: AppState }) {
  const a = acwr(state);
  if (a === null) {
    return (
      <div className="gauge">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Obciążenie w czasie</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
          Wskaźnik pojawi się po dwóch tygodniach i czterech zapisanych treningach.
        </p>
      </div>
    );
  }
  const pos = Math.max(0, Math.min(100, (a / 2) * 100));
  const verdict =
    a > 1.5
      ? 'Powyżej 1,5 — skoki ciężaru wstrzymane.'
      : a < 0.8
        ? 'Poniżej 0,8 — trenujesz mniej niż przez ostatni miesiąc.'
        : 'W bezpiecznym zakresie.';

  return (
    <div className="gauge">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>
        Obciążenie w czasie — {a.toFixed(2)}
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
        Tonaż z 7 dni podzielony przez średnią tygodniową z 28 dni.
      </p>
      <div className="gbar">
        <i style={{ left: '40%', right: '35%' }} />
        <b style={{ left: `${pos}%` }} />
      </div>
      <div className="gscale">
        <span>0</span>
        <span>0,8–1,3 bezpiecznie</span>
        <span>2,0</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>{verdict}</p>
    </div>
  );
}

/* ---------------- Poziomy i historia ---------------- */

export function LevelsView({ state }: { state: AppState }) {
  const groups = exercisesByGroup();
  return (
    <>
      <LoadGauge state={state} />
      <div className="sect-label">Poziomy ćwiczeń</div>
      {Object.entries(groups).map(([g, ids]) => (
        <div key={g}>
          <div className="sect-label">{g}</div>
          {ids.map((id) => {
            const p = P(state, id);
            return (
              <div className="prog-row" key={id}>
                <Chip state={state} id={id} />
                <div>
                  <div className="ex-name">{ex(id).name}</div>
                  <div className="ex-target">{planLabel(state, id)}</div>
                </div>
                <div className="streak">
                  {p.e1rm && p.weight ? `1RM ≈ ${p.e1rm} kg` : p.trans ? 'w przejściu' : '—'}
                  <Sparkline hist={p.hist} />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="sect-label">Historia</div>
      {!state.log.length ? (
        <div className="empty">Pierwszy zamknięty trening pojawi się tutaj.</div>
      ) : (
        [...state.log]
          .reverse()
          .slice(0, 40)
          .map((e, idx) => {
            const dt = new Date(e.date);
            return (
              <div className="h-item" key={`${e.date}-${idx}`}>
                <div className="h-date">
                  {String(dt.getDate()).padStart(2, '0')}.{String(dt.getMonth() + 1).padStart(2, '0')}
                </div>
                <div>
                  <div>
                    <b>{e.workout}</b>
                  </div>
                  <div className="h-detail">
                    {e.items
                      .map((i) => `${EX[i.id]?.name ?? i.id} ${i.sets.map((s) => s.reps).join('/')}`)
                      .join(' · ')}
                  </div>
                </div>
                <div className="streak">{Math.round(sessionTonnage(e))} kg·p</div>
              </div>
            );
          })
      )}
    </>
  );
}

/* ---------------- Kreator treningów ---------------- */

export function WorkoutsView({
  state,
  onStart,
  onSaveWorkout,
  onDelete,
  onSetsChange,
  onToast,
}: {
  state: AppState;
  onStart: (id: string) => void;
  onSaveWorkout: (w: Workout) => void;
  onDelete: (w: Workout) => void;
  onSetsChange: (id: ExerciseId, sets: number) => void;
  onToast: (m: string) => void;
}) {
  const [draft, setDraft] = useState<Workout | null>(null);
  const all = [...BUILTIN, ...state.workouts];
  const groups = exercisesByGroup();

  const openBuilder = (w: Workout | null) =>
    setDraft(
      w
        ? { id: w.id, name: w.name, items: w.items.map((i) => ({ ex: i.ex })) }
        : { id: `w${Date.now()}`, name: '', items: [] },
    );

  return (
    <>
      <div className="sect-label">Twoje treningi</div>
      {all.map((w) => {
        const own = !BUILTIN.find((b) => b.id === w.id);
        return (
          <div className="grp" key={w.id}>
            <h3>{w.name}</h3>
            <p>{w.items.map((i) => ex(i.ex).name).join(' · ')}</p>
            <div className="btnrow">
              <button className="btn sm" onClick={() => onStart(w.id)}>
                Zacznij
              </button>
              {own && (
                <>
                  <button className="btn sm ghost" onClick={() => openBuilder(w)}>
                    Edytuj
                  </button>
                  <button className="btn sm ghost" onClick={() => onDelete(w)}>
                    Usuń
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}

      <div className="wrap actions">
        <button className="btn wide" onClick={() => openBuilder(null)}>
          Ułóż nowy trening
        </button>
      </div>

      {draft && (
        <div className="grp">
          <h3>{state.workouts.find((w) => w.id === draft.id) ? 'Edytuj trening' : 'Nowy trening'}</h3>
          <p>Nazwa i lista ćwiczeń. Powtórzenia, serie i ciężar prowadzi silnik progresji.</p>
          <input
            type="text"
            placeholder="np. Trening C — sam swing i core"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />

          {!draft.items.length ? (
            <p style={{ margin: '10px 0 0' }}>Dodaj pierwsze ćwiczenie z listy poniżej.</p>
          ) : (
            draft.items.map((it, idx) => (
              <div className="bitem" key={it.ex}>
                <span>{ex(it.ex).name}</span>
                <select
                  value={P(state, it.ex).sets}
                  onChange={(e) => onSetsChange(it.ex, Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} serie
                    </option>
                  ))}
                </select>
                <button
                  title="Usuń"
                  onClick={() =>
                    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })
                  }
                >
                  ×
                </button>
              </div>
            ))
          )}

          <div style={{ height: 12 }} />
          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setDraft({ ...draft, items: [...draft.items, { ex: e.target.value }] });
            }}
          >
            <option value="">Dodaj ćwiczenie…</option>
            {Object.entries(groups).map(([g, ids]) => {
              const free = ids.filter((id) => !draft.items.find((i) => i.ex === id));
              if (!free.length) return null;
              return (
                <optgroup label={g} key={g}>
                  {free.map((id) => (
                    <option key={id} value={id}>
                      {ex(id).name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          <div style={{ height: 10 }} />
          <div className="btnrow">
            <button
              className="btn"
              onClick={() => {
                if (!draft.name.trim()) {
                  onToast('Nadaj treningowi nazwę.');
                  return;
                }
                if (!draft.items.length) {
                  onToast('Dodaj przynajmniej jedno ćwiczenie.');
                  return;
                }
                onSaveWorkout({ ...draft, name: draft.name.trim() });
                setDraft(null);
              }}
            >
              Zapisz trening
            </button>
            <button className="btn ghost" onClick={() => setDraft(null)}>
              Anuluj
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Ustawienia ---------------- */

export function SettingsView({
  state,
  onWeights,
  onStartWeight,
  onExport,
  onImport,
  onReset,
  onRecalibrate,
}: {
  state: AppState;
  onWeights: (list: number[]) => void;
  onStartWeight: (id: ExerciseId, w: number) => void;
  onExport: () => void;
  onImport: (f: File) => void;
  onReset: () => void;
  onRecalibrate: () => void;
}) {
  const [text, setText] = useState(state.cfg.weights.join(', '));

  return (
    <>
      <div className="grp">
        <h3>Dostępne kettlebelle</h3>
        <p>Wagi po przecinku. Progresja dobiera ciężary wyłącznie z tej listy.</p>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
        <div style={{ height: 10 }} />
        <button
          className="btn"
          onClick={() =>
            onWeights(
              text
                .split(',')
                .map((x) => parseFloat(x.trim()))
                .filter((x) => x > 0)
                .sort((a, b) => a - b),
            )
          }
        >
          Zapisz listę
        </button>
      </div>

      <div className="grp">
        <h3>Kalibracja</h3>
        <p>
          Nowe ćwiczenie zaczyna od jednej serii próbnej na najlżejszym kettlebellu i wchodzi po
          drabinie w górę, aż wynik wpadnie w zakres powtórzeń. Później co kilka sesji wraca test
          w ostatniej serii — po to, żeby aplikacja wyłapała, że jesteś już wyżej, zamiast czekać,
          aż dogoni to po jednym powtórzeniu na sesję.
        </p>
        <p className="tight">
          W fazie próbnej: <b>{ALL.filter((id) => P(state, id).phase === 'calib').length}</b> z{' '}
          {ALL.length} ćwiczeń.
        </p>
        <div style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={onRecalibrate}>
            Zmierz wszystkie poziomy od nowa
          </button>
        </div>
      </div>

      <div className="grp">
        <h3>Poziomy startowe</h3>
        <p>
          Ręczna korekta, gdy znasz swój poziom i nie chcesz czekać na próbę. Ustawienie ciężaru
          zamyka fazę próbną tego ćwiczenia.
        </p>
        {WEIGHTED.map((id) => (
          <div className="wsel" key={id}>
            <span>{ex(id).name}</span>
            <select
              value={String(P(state, id).weight ?? '')}
              onChange={(e) => onStartWeight(id, Number(e.target.value))}
            >
              {state.cfg.weights.map((w) => (
                <option key={w} value={w}>
                  {w} kg
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="grp">
        <h3>Kopia danych</h3>
        <p>Eksport zapisuje wszystko do pliku JSON. Import nadpisuje bieżące dane.</p>
        <div className="btnrow">
          <button className="btn" onClick={onExport}>
            Eksportuj plik
          </button>
          <label className="btn ghost" style={{ cursor: 'pointer' }}>
            Importuj plik
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="grp">
        <h3>Jak działa progresja</h3>
        <p className="tight">Silnik opiera się na kilku zasadach z literatury treningowej:</p>
        <p>
          <b>Poziom z pomiaru, nie z tabelki.</b> Każde ćwiczenie zaczyna od serii próbnej i wchodzi
          po drabinie, aż wynik wpadnie w zakres powtórzeń. Potem co kilka sesji wraca test
          w ostatniej serii — bo sam przyrost po jednym powtórzeniu nigdy nie dogoniłby kogoś, kto
          wystartował kilka poziomów poniżej swoich możliwości.
        </p>
        <p>
          <b>Nadwyżka się liczy.</b> Wynik wyższy od celu podnosi cel od razu do tego wyniku, a nie
          o jedno powtórzenie.
        </p>
        <p>
          <b>Podwójna progresja.</b> Najpierw rosną powtórzenia w zakresie, dopiero potem ciężar.
          Metoda opisana po raz pierwszy w 1911 roku, wciąż standard.
        </p>
        <p>
          <b>Zapas powtórzeń.</b> Cel zaliczony na styk, bez zapasu, nie daje awansu. Badania nad
          oceną zapasu pokazują, że ludzie mylą się średnio o jedno powtórzenie i są dokładniejsi
          blisko upadku — dlatego skala ma trzy stopnie, a nie dziesięć.
        </p>
        <p>
          <b>Przejście ciężaru seria po serii.</b> Skok o 4 kg to 16–33% obciążenia, czyli
          wielokrotnie więcej niż typowy skok na sztandze. Cięższy kettlebell wchodzi więc najpierw
          do jednej serii, potem kolejnej, aż zastąpi wszystkie.
        </p>
        <p>
          <b>Powtórzenia po zmianie ciężaru</b> liczone są wzorem Epleya: 1RM = ciężar × (1 +
          powtórzenia / 30). Z szacowanego maksimum wychodzi, ile powtórzeń da się zrobić na nowym
          kettlebellu.
        </p>
        <p>
          <b>Balistyka inaczej niż siła.</b> Swingi to ruch wybuchowy — nie prowadzi się ich do
          granicy powtórzeń, tylko dokłada serie. Przysiady i wyciskanie to grindy, tam rosną
          powtórzenia.
        </p>
        <p>
          <b>Obciążenie w czasie.</b> Aplikacja liczy stosunek tonażu z 7 dni do średniej z 28 dni.
          Zakres 0,8–1,3 uchodzi za bezpieczny, powyżej 1,5 wstrzymywane są skoki ciężaru. Wskaźnik
          bywa krytykowany, więc traktuj go jako sygnał ostrzegawczy, nie wyrocznię.
        </p>
        <p>
          <b>Przerwa w treningach.</b> Badania nad roztrenowaniem pokazują, że nawet po 12 tygodniach
          przerwy siła spada tylko o 5–15%. Dlatego po dłuższej pauzie cofają się cele powtórzeń, a
          ciężar rusza dopiero po przerwie liczonej w miesiącach.
        </p>
      </div>

      <div className="grp">
        <h3>Reset</h3>
        <p>Kasuje historię, poziomy i własne treningi. Nie da się tego cofnąć.</p>
        <button className="btn ghost" onClick={onReset}>
          Usuń wszystkie dane
        </button>
      </div>

      <footer>
        Dane trzymane lokalnie. Przy bólu lub kontuzji skonsultuj plan z fizjoterapeutą.
        <br />
        Ćwiczeń w bibliotece: {ALL.length}.
      </footer>
    </>
  );
}
