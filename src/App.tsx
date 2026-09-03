import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL, BUILTIN, ex } from './data/exercises';
import { acwr, daysSince, epley, round1, weeklyRate } from './engine/math';
import { P, freshState } from './engine/plan';
import { applyLayoff, applyResult } from './engine/progression';
import { queueSave, store } from './storage/storage';
import { Banner, Modal, Toast, useModal } from './components/ui';
import { LevelsView, SessionView, SettingsView, WorkoutPicker, WorkoutsView } from './components/views';
import { AtlasView, ExercisePage } from './components/atlas';
import { TABS, activeTab, go, useRoute } from './routing';
import type {
  AppState,
  Change,
  EffortKey,
  ExerciseId,
  ReadyKey,
  SetResult,
  Workout,
} from './types';

const clone = (s: AppState): AppState => JSON.parse(JSON.stringify(s)) as AppState;

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const route = useRoute();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [saveBroken, setSaveBroken] = useState(false);
  const { req, say, ask } = useModal();
  const booted = useRef(false);

  /* ---------- wczytanie ---------- */
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      const saved = await store.get();
      const next = freshState();
      if (saved) {
        ALL.forEach((id) => {
          const p = saved.prog?.[id];
          if (!p) return;
          Object.assign(next.prog[id]!, p);
          // Zapisy sprzed wprowadzenia fazy próbnej nie mają pola `phase`. Kto ma już
          // jakikolwiek wynik, ten jest po kalibracji — nie wolno go cofać do prób.
          if (p.phase === undefined)
            next.prog[id]!.phase = p.hist?.length || saved.log?.length ? 'work' : 'calib';
        });
        next.cfg = saved.cfg ?? next.cfg;
        next.workouts = saved.workouts ?? [];
        next.log = saved.log ?? [];
        next.session = saved.session ?? null;
        if (next.session && ![...BUILTIN, ...next.workouts].find((w) => w.id === next.session!.workout))
          next.session = null;
        if (next.session) {
          next.session.skip ??= {};
          next.session.ready ??= 'ok';
        }
      }
      if (!next.session) next.notice = applyLayoff(next, daysSince(next));
      setState(next);
    })();
  }, []);

  const commit = useCallback((next: AppState) => {
    setState(next);
    void queueSave(next, setSaveBroken);
  }, []);

  if (!state) return <div className="empty">Wczytywanie…</div>;

  // Cztery zakładki aplikacji renderują się po staremu; atlas i podstrony ćwiczeń mają własne gałęzie.
  const view = route.kind === 'tab' ? route.tab : null;
  const workouts: Workout[] = [...BUILTIN, ...state.workouts];
  const current = state.session ? workouts.find((w) => w.id === state.session!.workout) : undefined;
  const d = daysSince(state);
  const rate = weeklyRate(state);
  const ratio = acwr(state);

  /* ---------- sesja ---------- */

  const startSession = (id: string) => {
    const next = clone(state);
    next.session = { workout: id, started: new Date().toISOString(), ready: 'ok', res: {}, done: {}, skip: {} };
    commit(next);
    go('#/trening');
    window.scrollTo({ top: 0 });
  };

  const saveExercise = (id: ExerciseId, rows: SetResult[], effort: EffortKey) => {
    const next = clone(state);
    next.session!.res[id] = { rows, effort };
    next.session!.done[id] = true;
    delete next.session!.skip[id];
    commit(next);
  };

  const clearExercise = (id: ExerciseId) => {
    const next = clone(state);
    delete next.session!.res[id];
    delete next.session!.done[id];
    commit(next);
  };

  const skipExercise = (id: ExerciseId) => {
    const next = clone(state);
    const s = next.session!;
    if (s.skip[id]) delete s.skip[id];
    else {
      s.skip[id] = true;
      delete s.res[id];
      delete s.done[id];
    }
    commit(next);
  };

  const cancelSession = async () => {
    const ok = await ask(
      'Porzucić trening?',
      <p>Wpisane wyniki przepadną, a poziomy zostaną bez zmian.</p>,
      'Porzuć',
    );
    if (!ok) return;
    const next = clone(state);
    next.session = null;
    commit(next);
  };

  const finishSession = async () => {
    const w = current!;
    const session = state.session!;
    const logged = w.items.filter((i) => session.done[i.ex]);
    const missing = w.items.filter((i) => !session.done[i.ex] && !session.skip[i.ex]);

    if (!logged.length) {
      const ok = await ask(
        'Zakończyć bez zapisu?',
        <p>Żadne ćwiczenie nie ma wyniku, więc nie ma czego przeliczyć. Trening nie trafi do historii.</p>,
        'Zakończ',
      );
      if (!ok) return;
      const next = clone(state);
      next.session = null;
      commit(next);
      return;
    }

    const spike = ratio !== null && ratio > 1.5;
    const blockJump = (d !== null && d >= 11 && d < 21) || spike || session.ready === 'low';
    const reason = spike
      ? 'tygodniowy tonaż mocno wyprzedza średnią z miesiąca'
      : session.ready === 'low'
        ? 'oznaczyłeś dziś gorszy dzień'
        : 'po przerwie w treningach';

    const ok = await ask(
      'Zamknąć trening?',
      <>
        {missing.length ? (
          <>
            <p>
              Zapisane: <b>{logged.length}</b> z {w.items.length}. Bez wyniku zostaje:
            </p>
            <ul>
              {missing.map((i) => (
                <li key={i.ex}>— {ex(i.ex).name}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Wszystkie {logged.length} ćwiczeń ma wynik.</p>
        )}
        {blockJump && (
          <p style={{ marginTop: 12 }}>
            Skoki na cięższy kettlebell są dziś wstrzymane — {reason}. Cele powtórzeń rosną normalnie.
          </p>
        )}
      </>,
      'Zamknij i przelicz',
    );
    if (!ok) return;

    const next = clone(state);
    const changes: Change[] = [];
    logged.forEach((i) => {
      const r = next.session!.res[i.ex]!;
      const c = applyResult(next, i.ex, r.rows, r.effort, blockJump);
      if (c) changes.push(c);
    });

    next.log.push({
      date: new Date().toISOString(),
      workout: w.name,
      ready: session.ready,
      items: logged.map((i) => ({
        id: i.ex,
        sets: next.session!.res[i.ex]!.rows,
        effort: next.session!.res[i.ex]!.effort,
      })),
    });
    next.session = null;
    next.notice = null;
    commit(next);
    window.scrollTo({ top: 0 });

    await say(
      'Trening zapisany',
      changes.length ? (
        <>
          <p>Zmiany na kolejną sesję:</p>
          <ul>
            {changes.map((c, i) => (
              <li key={i}>
                {c.type === 'level' ? '▲' : c.type === 'down' ? '▼' : '·'} {c.text}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          Bez zmian poziomów. Cel rośnie, gdy każda seria dobije do wyznaczonej liczby i zostanie zapas
          powtórzeń.
        </p>
      ),
    );
  };

  /* ---------- ustawienia i dane ---------- */

  const setWeights = (list: number[]) => {
    if (list.length < 2) {
      setToastMsg('Podaj przynajmniej dwie wagi, np. 12, 16, 20, 24.');
      return;
    }
    const next = clone(state);
    next.cfg.weights = list;
    ALL.forEach((id) => {
      const p = P(next, id);
      if (p.weight !== null && !list.includes(p.weight))
        p.weight = list.reduce((a, b) => (Math.abs(b - p.weight!) < Math.abs(a - p.weight!) ? b : a));
      if (p.trans && !list.includes(p.trans.to)) p.trans = null;
    });
    commit(next);
  };

  const setStartWeight = (id: ExerciseId, w: number) => {
    const next = clone(state);
    const p = P(next, id);
    p.weight = w;
    p.target = p.min;
    p.trans = null;
    p.e1rm = round1(epley(w, p.target));
    // Ręczne ustawienie poziomu jest odpowiedzią na to samo pytanie, które zadaje próba.
    p.phase = 'work';
    commit(next);
  };

  const recalibrate = async () => {
    const ok = await ask(
      'Zmierzyć poziomy od nowa?',
      <p>
        Każde ćwiczenie dostanie serię próbną — jedną serię bez sufitu, z której wyjdzie nowy
        poziom. Próba startuje od miejsca, w którym jesteś teraz, więc może pójść w górę albo w
        dół. Historia i zapisane treningi zostają nietknięte.
      </p>,
      'Zmierz od nowa',
    );
    if (!ok) return;
    const next = clone(state);
    ALL.forEach((id) => {
      const p = P(next, id);
      p.phase = 'calib';
      p.calibRuns = 0;
      p.probe = false;
      p.sinceProbe = 0;
      p.easyRun = 0;
      p.stalls = 0;
      p.maxHolds = 0;
      p.trans = null;
    });
    commit(next);
    setToastMsg('Próby ustawione. Kolejny trening zmierzy poziomy.');
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trener-kettlebell-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result)) as AppState;
        if (!parsed.prog || !parsed.cfg) throw new Error('format');
        const next = freshState();
        ALL.forEach((id) => {
          const p = parsed.prog[id];
          if (p) Object.assign(next.prog[id]!, p);
        });
        next.cfg = parsed.cfg;
        next.workouts = parsed.workouts ?? [];
        next.log = parsed.log ?? [];
        next.session = parsed.session ?? null;
        commit(next);
        setToastMsg('Dane wczytane.');
      } catch {
        void say('Nie udało się wczytać', <p>Wybierz plik JSON wyeksportowany z tej aplikacji.</p>);
      }
    };
    r.readAsText(f);
  };

  const resetAll = async () => {
    const ok = await ask(
      'Usunąć wszystkie dane?',
      <p>Historia, poziomy ćwiczeń i własne treningi znikną bezpowrotnie.</p>,
      'Usuń wszystko',
    );
    if (!ok) return;
    await store.clear();
    commit(freshState());
  };

  /* ---------- nagłówek ---------- */

  const subline = [
    d === null
      ? 'Pierwszy trening'
      : d === 0
        ? 'Ostatni trening dzisiaj'
        : d === 1
          ? 'Ostatni trening wczoraj'
          : `Ostatni trening ${d} dni temu`,
    rate !== null ? `${rate.toFixed(1)} sesji na tydzień` : null,
    ratio !== null ? `obciążenie ${ratio.toFixed(2)}` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="wrap">
        <header>
          <div className="meta">
            <span>
              {state.session
                ? 'trening w toku'
                : `${state.log.length} ${state.log.length === 1 ? 'zapisany trening' : 'zapisanych treningów'}`}
            </span>
          </div>
          <h1>{current ? current.name : 'Trener kettlebell'}</h1>
          <div className="subline">{subline.join(' · ')}</div>
        </header>
      </div>

      {view !== null && (
      <div className="wrap">
        {saveBroken && (
          <Banner
            notice={{
              level: 'warn',
              title: 'Zapis nie działa',
              text: 'Przeglądarka odmówiła zapisu danych. Wyniki trzymają się w pamięci, ale znikną po odświeżeniu. Wyeksportuj plik z Ustawień, zanim zamkniesz kartę.',
            }}
          />
        )}
        {state.notice && <Banner notice={state.notice} />}
        {ratio !== null && ratio > 1.5 && (
          <Banner
            notice={{
              level: 'warn',
              title: 'Skok obciążenia',
              text: `Tonaż z ostatniego tygodnia to ${ratio.toFixed(2)} średniej z czterech tygodni. Powyżej 1,5 rośnie ryzyko przeciążenia, więc skoki na cięższy kettlebell są wstrzymane. Cele powtórzeń rosną normalnie.`,
            }}
          />
        )}
        {!state.session && d === 0 && state.log.length > 0 && (
          <Banner
            notice={{
              level: 'warn',
              title: 'Trenowałeś dzisiaj',
              text: 'Możesz zalogować kolejną sesję, ale te same wzorce ruchowe dwa razy w ciągu dnia nie dadzą lepszej progresji.',
            }}
          />
        )}
      </div>
      )}

      {route.kind === 'atlas' && <AtlasView state={state} />}
      {route.kind === 'exercise' && <ExercisePage state={state} id={route.id} />}

      {view === 'train' &&
        (current ? (
          <SessionView
            state={state}
            workout={current}
            onReady={(r: ReadyKey) => {
              const next = clone(state);
              next.session!.ready = r;
              commit(next);
            }}
            onSave={saveExercise}
            onClear={clearExercise}
            onSkip={skipExercise}
            onFinish={() => void finishSession()}
            onCancel={() => void cancelSession()}
            onToast={setToastMsg}
          />
        ) : (
          <WorkoutPicker workouts={workouts} onStart={startSession} />
        ))}

      {view === 'prog' && <LevelsView state={state} />}

      {view === 'work' && (
        <WorkoutsView
          state={state}
          onStart={startSession}
          onSaveWorkout={(w) => {
            const next = clone(state);
            const i = next.workouts.findIndex((x) => x.id === w.id);
            if (i > -1) next.workouts[i] = w;
            else next.workouts.push(w);
            commit(next);
          }}
          onDelete={(w) => {
            void (async () => {
              const ok = await ask(
                'Usunąć trening?',
                <p>„{w.name}” zniknie z listy. Poziomy ćwiczeń zostaną nietknięte.</p>,
                'Usuń',
              );
              if (!ok) return;
              const next = clone(state);
              next.workouts = next.workouts.filter((x) => x.id !== w.id);
              commit(next);
            })();
          }}
          onSetsChange={(id, sets) => {
            const next = clone(state);
            const p = P(next, id);
            p.sets = sets;
            p.maxSets = Math.max(p.maxSets, sets);
            commit(next);
          }}
          onToast={setToastMsg}
        />
      )}

      {view === 'set' && (
        <SettingsView
          state={state}
          onWeights={setWeights}
          onStartWeight={setStartWeight}
          onExport={exportData}
          onImport={importData}
          onReset={() => void resetAll()}
          onRecalibrate={() => void recalibrate()}
        />
      )}

      <nav>
        {TABS.map((t) => (
          <a key={t.key} href={t.path} aria-current={activeTab(route) === t.key ? 'page' : 'false'}>
            {t.label}
          </a>
        ))}
      </nav>

      <Modal req={req} />
      <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />
    </>
  );
}
