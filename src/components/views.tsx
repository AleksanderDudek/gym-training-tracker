import { useState } from 'react';
import {
  ALL,
  GEAR_LABEL,
  READY,
  WEIGHTED,
  ex,
  gearOf,
  ladderFor,
} from '../data/exercises';
import { acwr } from '../engine/math';
import { P, exercisesByGroup } from '../engine/plan';
import { ExerciseCard } from './ExerciseCard';
import { CircuitHead, PairHead, PrepContent, blocksOf, cueFor, tagOf } from './Structure';
import { roundRestOf } from '../engine/rests';
import { plan } from '../engine/plan';
import { altsFor } from '../engine/structure';
import { HealthCard } from './Health';
import { RemindersCard } from './Reminders';
import { GarminCard } from './Garmin';
import type { PullResult } from '../garmin';
import { SupportLine } from './Support';
import type { AppState, EffortKey, ExerciseId, ReadyKey, ReminderPrefs, SetResult, Workout } from '../types';

/* ---------------- Sesja ---------------- */

export function SessionView({
  state,
  workout,
  planned,
  onSwap,
  onReady,
  onSave,
  onClear,
  onSkip,
  onFinish,
  onCancel,
  onToast,
  onGuided,
}: {
  state: AppState;
  /** Powrót do prowadzenia seria po serii. */
  onGuided: () => void;
  /** Trening na dziś — z zamianami. */
  workout: Workout;
  /** Trening, jak go zapisano — bez zamian; z niego biorą się zamienniki. */
  planned: Workout;
  onSwap: (orig: ExerciseId, to: ExerciseId) => void;
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
  // Ćwiczenie na dziś → ćwiczenie z treningu. Kolejność pozycji się nie zmienia.
  const origOf = new Map(workout.items.map((it, i) => [it.ex, planned.items[i]?.ex ?? it.ex]));
  const swapsFor = (live: ExerciseId) => {
    const orig = origOf.get(live) ?? live;
    const alts = altsFor(orig, planned).filter((a) => a === live || !workout.items.some((it) => it.ex === a));
    return { orig, options: live === orig ? alts : [orig, ...alts.filter((a) => a !== live)] };
  };

  return (
    <div className="wrap">
      {/* Nazwa treningu i stan sesji stoją w pasku aplikacji — tu byłyby drugi raz. */}
      {session.deload && (
        <div className="dnote tip" style={{ marginTop: 12 }}>
          <b>Tydzień lżejszy</b>
          <p className="tight">
            Mniej serii niż zwykle i bez testu „ile dasz radę”. Zostaw 2–3 powtórzenia zapasu — wynik
            trafi do historii, ale poziomy zostaną bez zmian.
          </p>
        </div>
      )}
      <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={onGuided}>
        Prowadź mnie seria po serii
      </button>
      <div className="segline">Jak się dziś czujesz? Wpływa na dzisiejsze cele, nie na twoje poziomy.</div>
      <div className="seg">
        {(Object.keys(READY) as ReadyKey[]).map((k) => (
          <button key={k} aria-pressed={session.ready === k} onClick={() => onReady(k)}>
            {READY[k]}
          </button>
        ))}
      </div>

      {/* Otwarte, dopóki nic nie zapisano — potem zwija się, żeby nie odpychać serii w dół. */}
      <details className="prep prep-session" open={doneCount === 0}>
        <summary>Przygotowanie stanowiska i rozgrzewka</summary>
        <PrepContent state={state} workout={workout} />
      </details>

      <div className="list">
        {blocksOf(workout.items).map((b) => {
          const sets = (id: ExerciseId) => plan(state, id).length;
          const cards = b.ids.map((id, i) => (
            <ExerciseCard
              key={`${id}-${session.started}-${session.ready}-${session.done[id] ? 1 : 0}-${session.skip[id] ? 1 : 0}`}
              state={state}
              id={id}
              tag={tagOf(b, i)}
              cue={cueFor(b, i, sets, workout.rest)}
              swaps={swapsFor(id)}
              onSwap={onSwap}
              onSave={onSave}
              onClear={onClear}
              onSkip={onSkip}
              onToast={onToast}
            />
          ));
          if (b.kind === 'circuit')
            return (
              <div className="pairbox" key={`c${b.n}`}>
                <CircuitHead b={b} sets={sets} roundRest={roundRestOf(state, workout).secs} />
                {cards}
              </div>
            );
          return b.kind === 'pair' ? (
            <div className="pairbox" key={`p${b.n}`}>
              <PairHead b={b} sets={sets} />
              {cards}
            </div>
          ) : (
            cards
          );
        })}
      </div>

      <div className="actions">
        <button className="btn wide" onClick={onFinish}>
          Zamknij sesję ({doneCount} z {workout.items.length} zapisanych)
        </button>
        <button className="btn ghost wide" onClick={onCancel}>
          Porzuć sesję
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
        <h2 style={{ margin: '0 0 4px', fontSize: 15 }}>Obciążenie w czasie</h2>
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
      <h2 style={{ margin: '0 0 4px', fontSize: 15 }}>
        Obciążenie w czasie — {a.toFixed(2)}
      </h2>
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

/* ---------------- Kreator treningów ---------------- */

/* ---------------- Ustawienia ---------------- */

export function SettingsView({
  state,
  onWeights,
  onStartWeight,
  onExport,
  onImport,
  onReset,
  onRecalibrate,
  onIntro,
  onReminders,
  onWatchSync,
  onToast,
  onFeedback,
}: {
  state: AppState;
  onFeedback?: (() => void) | undefined;
  onReminders: (p: ReminderPrefs) => void;
  onWatchSync: () => Promise<PullResult>;
  onToast: (m: string) => void;
  onWeights: (list: number[]) => void;
  onStartWeight: (id: ExerciseId, w: number) => void;
  onExport: () => void;
  onImport: (f: File) => void;
  onReset: () => void;
  onRecalibrate: () => void;
  onIntro: () => void;
}) {
  const [text, setText] = useState(state.cfg.weights.join(', '));
  const groups = exercisesByGroup();

  return (
    <>
      <RemindersCard state={state} onPrefs={onReminders} onToast={onToast} />
      <GarminCard state={state} onSync={onWatchSync} onToast={onToast} />

      {onFeedback && (
        <div className="grp">
          <h2>Uwagi i błędy</h2>
          <p className="tight">
            Coś nie działa, czegoś brakuje, coś jest niejasne? Napisz — wiadomość trafia prosto do
            autora, a zrzut ekranu i ślad wizyty pomagają odtworzyć problem. To samo okno otwiera
            dymek w pasku na górze, z każdego ekranu.
          </p>
          <button className="btn ghost sm" onClick={onFeedback}>
            Napisz do autora
          </button>
        </div>
      )}

      <div className="grp">
        <h2>Dostępne kettlebelle</h2>
        <p>
          Wagi po przecinku. Progresja dobiera ciężary wyłącznie z tej listy — ale tylko dla
          ćwiczeń z kettlebellem. Sztanga, hantle i maszyny mają własne drabiny, bo skaczą
          inaczej: gryf od dwudziestki co 2,5–10 kg, stos maszyny co 5.
        </p>
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
        <h2>Kalibracja</h2>
        <p>
          Nowe ćwiczenie zaczyna od jednej serii próbnej na lekkim obciążeniu i wchodzi po
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
        <h2>Poziomy startowe</h2>
        <p>
          Ręczna korekta, gdy znasz swój poziom i nie chcesz czekać na próbę. Ustawienie ciężaru
          zamyka fazę próbną tego ćwiczenia.
        </p>
        {/* Biblioteka ma ponad sto ćwiczeń — bez zwijanych partii ta sekcja byłaby ścianą. */}
        {Object.entries(groups).map(([g, ids]) => {
          const weighted = ids.filter((id) => WEIGHTED.includes(id));
          if (!weighted.length) return null;
          return (
            <details className="gsel" key={g}>
              <summary>
                {g} <i>{weighted.length}</i>
              </summary>
              {weighted.map((id) => (
                <div className="wsel" key={id}>
                  <span>
                    {ex(id).name}
                    <i className="gear">{GEAR_LABEL[gearOf(id)]}</i>
                  </span>
                  <select
                    value={String(P(state, id).weight ?? '')}
                    onChange={(e) => onStartWeight(id, Number(e.target.value))}
                  >
                    {ladderFor(state, id).map((w) => (
                      <option key={w} value={w}>
                        {w} kg
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </details>
          );
        })}
      </div>

      <div className="wrap">
        <SupportLine compact />
      </div>

      <div className="grp">
        <h2>Wprowadzenie</h2>
        <p>Cztery ekrany o tym, jak aplikacja prowadzi trening. Można je otworzyć kiedykolwiek.</p>
        <button className="btn ghost sm" onClick={onIntro}>
          Pokaż wprowadzenie
        </button>
      </div>

      <div className="grp">
        <h2>Kopia danych</h2>
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
        <h2>Jak działa progresja</h2>
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
          <b>Przejście ciężaru seria po serii.</b> Skok o rozmiar kettlebella to 16–33%
          obciążenia, czyli wielokrotnie więcej niż typowy skok na sztandze. Cięższy ciężar wchodzi
          więc najpierw do jednej serii, potem kolejnej, aż zastąpi wszystkie. Każdy sprzęt ma
          własną drabinę, więc na sztandze kroki są proporcjonalnie mniejsze.
        </p>
        <p>
          <b>Powtórzenia po zmianie ciężaru</b> liczone są wzorem Epleya: 1RM = ciężar × (1 +
          powtórzenia / 30). Z szacowanego maksimum wychodzi, ile powtórzeń da się zrobić na nowym
          ciężarze.
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

      <HealthCard />

      <div className="grp">
        <h2>Reset</h2>
        <p>Kasuje historię, poziomy i własne treningi. Nie da się tego cofnąć.</p>
        <button className="btn ghost" onClick={onReset}>
          Usuń wszystkie dane
        </button>
      </div>

      <footer>
        Dane trzymane lokalnie. Aplikacja nie zastępuje fizjoterapeuty, dietetyka ani lekarza.
        <br />
        Ćwiczeń w bibliotece: {ALL.length}.
      </footer>
    </>
  );
}
