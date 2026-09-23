import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL, BUILTIN, ex } from './data/exercises';
import { acwr, daysSince, epley, round1, weeklyRate } from './engine/math';
import { P, freshState } from './engine/plan';
import { applyLayoff, applyResult } from './engine/progression';
import { queueSave, store } from './storage/storage';
import { Banner, Modal, Toast, useModal } from './components/ui';
import { SessionView, SettingsView, WorkoutsView } from './components/views';
import { ExerciseStatsPage, ProfileView } from './components/Profile';
import { SessionHome } from './components/SessionHome';
import type { TodayPlan } from './components/SessionHome';
import { AtlasView, ExercisePage } from './components/atlas';
import { PlanView } from './components/PlanView';
import { Achievements } from './components/Achievements';
import { dayKey, daysBetween } from './engine/schedule';
import { bankPoints, snapshot } from './engine/snapshot';
import { achCtx, migrateBadges, syncBadges } from './engine/badges';
import { pointsToday, rankFor } from './engine/score';
import { seedFromPlan } from './engine/plan';
import { planById, planId } from './data/plans';
import { SETTINGS_PATH, TABS, activeTab, go, useRoute } from './routing';
import { Icon } from './components/icons';
import { BadgeDefs } from './components/BadgeArt';
import { Celebrate } from './components/Celebrate';
import { Intro } from './components/Intro';
import { ShareButton } from './components/Share';
import { SupportButton, SupportLine } from './components/Support';
import { metrics } from './engine/metrics';
import { LOADING, SAVED, daySeed, pick } from './engine/quips';
import { progressSubject, punchline } from './engine/share';
import { bandFor, BAND_MOOD, BAND_NAME } from './components/BadgeArt';
import type {
  ActivePlan,
  AppState,
  AchievementHit,
  Change,
  EffortKey,
  ExerciseId,
  PlanOptions,
  PlanTemplate,
  ReadyKey,
  SetResult,
  Workout,
} from './types';

const clone = (s: AppState): AppState => JSON.parse(JSON.stringify(s)) as AppState;

/** Nazwa stopnia na teraz. Bez planu punkty są tylko te z dorobku. */
const rankNow = (s: AppState): string =>
  rankFor(s.award.banked + (snapshot(s)?.score.points ?? 0)).rank.name;

/** Kontekst dla silnika odznak: stan, wyliczone metryki i to, co wynika z planu na dziś. */
const badgeCtx = (s: AppState) => {
  const snap = snapshot(s);
  return achCtx(s, snap?.schedule ?? null, snap?.stats ?? null, snap?.today ?? dayKey(Date.now()));
};

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const route = useRoute();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [saveBroken, setSaveBroken] = useState(false);
  const [replayIntro, setReplayIntro] = useState(false);
  const medalBox = useRef<HTMLDivElement>(null);
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
        next.plan = saved.plan ?? null;
        next.events = saved.events ?? [];
        next.introSeen = saved.introSeen;
        next.award = {
          banked: saved.award?.banked ?? 0,
          badges: migrateBadges(saved.award?.badges ?? {}),
        };
        if (next.session && ![...BUILTIN, ...next.workouts].find((w) => w.id === next.session!.workout))
          next.session = null;
        if (next.session) {
          next.session.skip ??= {};
          next.session.ready ??= 'ok';
        }
      }
      if (!next.session) next.notice = applyLayoff(next, daysSince(next));
      // Odznaki dopinane przy starcie, a nie tylko po treningu: część z nich zdobywa się
      // samym upływem czasu, a aplikacja bywa zamknięta przez tydzień. Data zdobycia ma
      // zostać ta, którą widać na ekranie, więc świeże odznaki od razu idą na dysk.
      const fresh = syncBadges(next, badgeCtx(next));
      setState(next);
      if (fresh.length) void queueSave(next, setSaveBroken);
    })();
  }, []);

  const commit = useCallback((next: AppState) => {
    setState(next);
    void queueSave(next, setSaveBroken);
  }, []);

  if (!state) return <div className="empty">{pick(LOADING, daySeed())}</div>;

  // Cztery zakładki aplikacji renderują się po staremu; atlas i podstrony ćwiczeń mają własne gałęzie.
  const view = route.kind === 'tab' ? route.tab : null;
  const workouts: Workout[] = [...BUILTIN, ...state.workouts];
  const current = state.session ? workouts.find((w) => w.id === state.session!.workout) : undefined;
  // Co wypada dziś według planu — razem z terminem zaległym, ale wciąż do nadrobienia.
  const snap = snapshot(state);
  const todayPlan: TodayPlan = (() => {
    if (!snap) return { kind: 'none' };
    const due = snap.stats.due;
    const w = due ? workouts.find((x) => x.id === due.workout) : undefined;
    if (due && w)
      return {
        kind: 'due',
        workout: w,
        late: daysBetween(due.date, snap.today),
        points: pointsToday(snap.stats, snap.today).now,
      };
    const next = snap.stats.next;
    return {
      kind: 'rest',
      ...(next
        ? {
            nextDate: next.date,
            nextName: workouts.find((x) => x.id === next.workout)?.name ?? next.workout,
            nextIn: daysBetween(snap.today, next.date),
          }
        : {}),
    };
  })();
  const plannedId = todayPlan.kind === 'due' ? todayPlan.workout?.id : undefined;

  const d = daysSince(state);
  const rate = weeklyRate(state);
  const ratio = acwr(state);
  // Wprowadzenie samo z siebie wchodzi tylko przy pierwszym uruchomieniu i nigdy w trakcie
  // sesji — kto już trenuje, ten nie potrzebuje wycieczki po ekranach. Z ustawień da się
  // je otworzyć ponownie w dowolnym momencie.
  const firstRun = !state.introSeen && !state.log.length && !state.session;
  const showIntro = replayIntro || firstRun;

  const closeIntro = () => {
    setReplayIntro(false);
    if (state.introSeen) return;
    const next = clone(state);
    next.introSeen = dayKey(Date.now());
    commit(next);
  };

  /* ---------- sesja ---------- */

  const startSession = (id: string) => {
    const next = clone(state);
    next.session = { workout: id, started: new Date().toISOString(), ready: 'ok', res: {}, done: {}, skip: {} };
    commit(next);
    go('#/sesja');
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
      { who: 'siwy', mood: 'wise' },
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
        { who: 'siwy', mood: 'calm' },
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
            Skoki na cięższe obciążenie są dziś wstrzymane — {reason}. Cele powtórzeń rosną normalnie.
          </p>
        )}
      </>,
      'Zamknij i przelicz',
      { who: 'gustaw', mood: 'tired' },
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
    const fresh = syncBadges(next, badgeCtx(next));
    commit(next);
    window.scrollTo({ top: 0 });

    const m = metrics(next);
    const subject = {
      kind: 'session' as const,
      seed: m.workouts,
      title: `${w.name} zaliczony`,
      lines: [
        `${logged.length} ${logged.length === 1 ? 'ćwiczenie' : 'ćwiczeń'} w tej sesji`,
        `${m.workouts} ${m.workouts === 1 ? 'zapisany trening' : 'zapisanych treningów'} · ${m.reps.toLocaleString('pl-PL')} powtórzeń`,
      ],
      punch: punchline(m.tonnage, m.reps, m.workouts),
    };

    await say(
      pick(SAVED, m.workouts),
      <>
        {/*
          Kawa na górze podsumowania, a nie pod spodem: to jedyny moment, w którym
          aplikacja właśnie coś dla kogoś zrobiła, a lista zmian bywa długa i dół okna
          trzeba do niej doscrollować. Prośba pada raz na ekran — drugiego bloku niżej
          już nie ma.
        */}
        <SupportLine seed={m.workouts} />
        {changes.length ? (
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
            Bez zmian poziomów. Cel rośnie, gdy każda seria dobije do wyznaczonej liczby i zostanie
            zapas powtórzeń.
          </p>
        )}
        <div className="after">
          <ShareButton subject={subject} label="Udostępnij wynik" />
          <ShareButton
            subject={progressSubject(m, rankNow(next), m.workouts)}
            label="Udostępnij cały dorobek"
          />
        </div>
      </>,
    );

    if (fresh.length) await sayBadges(fresh, m);
  };

  /**
   * Odznaki pokazywane osobno, po podsumowaniu poziomów — dwie wiadomości, dwa tematy.
   * Lista przycięta, bo po imporcie historii potrafi wpaść kilkanaście progów naraz,
   * a ekran z osiemnastoma gratulacjami nie cieszy nikogo.
   */
  const sayBadges = async (hits: AchievementHit[], m: ReturnType<typeof metrics>) => {
    const top = [...hits].sort(
      (a, b) => bandFor(b.tier, b.ach.tiers.length) - bandFor(a.tier, a.ach.tiers.length),
    )[0]!;
    const subject = {
      kind: 'badge' as const,
      seed: top.tier + m.workouts,
      title: top.ach.name,
      band: BAND_NAME[bandFor(top.tier, top.ach.tiers.length)],
      lines: [
        top.ach.tiers.length > 1 ? `próg ${top.tier} z ${top.ach.tiers.length}` : 'odznaka jednorazowa',
        top.ach.desc,
      ],
      punch: punchline(m.tonnage, m.reps, top.tier),
    };

    await say(
      hits.length === 1 ? 'Zdobyte!' : `Zdobyte: ${hits.length}`,
      <div ref={medalBox}>
        <Celebrate hits={hits} />
        <div className="after">
          <ShareButton subject={subject} medalRef={medalBox} label="Udostępnij odznakę" />
          <SupportLine seed={top.tier + m.workouts} compact />
        </div>
      </div>,
      { ok: 'Nieźle', tone: 'celebrate-box', cast: { who: 'gustaw', mood: BAND_MOOD[bandFor(top.tier, top.ach.tiers.length)] } },
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

  /**
   * Uruchomienie planu. Dzień startu i dni tygodnia przychodzą z katalogu, bo to jedyne
   * dwie rzeczy, których żaden algorytm nie zgadnie za człowieka.
   */
  const startPlan = async (t: PlanTemplate, opts: PlanOptions) => {
    const next = clone(state);
    const banked = next.plan ? bankPoints(next) : 0;
    const seeded = seedFromPlan(next, t.loadFactor);
    const plan: ActivePlan = {
      templateId: t.id,
      start: opts.start,
      weekdays: opts.weekdays,
      policy: opts.policy,
      ticked: {},
    };
    next.plan = plan;
    // Zdarzenie datowane dniem ustawienia planu, nie dniem startu — plan bywa ustawiany
    // z wyprzedzeniem, a wpis z przyszłą datą wypadłby z dziennika aż do tego dnia.
    const set = dayKey(Date.now());
    next.events.push({
      id: `plan-start:${t.id}:${opts.start}`,
      date: set < opts.start ? set : opts.start,
      kind: 'plan-start',
      title: `Start planu: ${t.name}`,
      text:
        (opts.start > set ? `Pierwsze terminy od ${opts.start}. ` : '') +
        (banked ? `Punkty z poprzedniego planu (${banked}) trafiły do dorobku.` : ''),
    });
    syncBadges(next, badgeCtx(next));
    commit(next);
    go('#/plan');

    const first = snapshot(next)?.stats.next;
    await say(
      'Plan ustawiony',
      <>
        <p>
          {t.name}. Start {opts.start}
          {first ? `, pierwszy termin ${first.date}` : ''}.
        </p>
        <p style={{ marginTop: 10 }}>
          Ciężary startowe ustawione w <b>{seeded}</b> ćwiczeniach. Ćwiczenia z zaliczonym już
          wynikiem zostały nietknięte — zmierzony poziom jest wart więcej niż tabelka.
        </p>
        <p style={{ marginTop: 10 }}>
          {opts.policy === 'shift'
            ? 'Opuszczony termin nie zjada treningu: ten sam trening wchodzi na kolejny termin.'
            : 'Rotacja idzie sztywno z kalendarzem — opuszczony trening przepada.'}
        </p>
      </>,
    );
  };

  /** Zmiana częstotliwości na podpowiedź silnika. Plan startuje od dziś, dorobek zostaje. */
  const changeFrequency = async (days: number) => {
    const t = state.plan ? planById(state.plan.templateId) : undefined;
    if (!t) return;
    const target = planById(planId(t.level, t.sex, days));
    if (!target) return;
    const ok = await ask(
      `Przejść na ${days}× w tygodniu?`,
      <p>
        Nowy kalendarz rusza od dziś. Punkty z dotychczasowego planu trafiają do dorobku,
        odznaki i poziomy ćwiczeń zostają bez zmian.
      </p>,
      'Zmień plan',
    );
    if (!ok) return;
    const next = clone(state);
    const banked = bankPoints(next);
    next.plan = {
      templateId: target.id,
      start: dayKey(Date.now()),
      weekdays: target.weekdays,
      policy: next.plan?.policy ?? 'shift',
      ticked: {},
    };
    next.events.push({
      id: `plan-swap:${target.id}:${next.plan.start}`,
      date: next.plan.start,
      kind: 'plan-swap',
      title: `Zmiana wariantu na ${days}× w tygodniu`,
      text: `Punkty z poprzedniego kalendarza (${banked}) trafiły do dorobku.`,
    });
    commit(next);
    setToastMsg(`Plan zmieniony na ${days}× w tygodniu.`);
  };

  /**
   * Ręczne odhaczenie terminu — dla treningu zrobionego poza aplikacją. Liczy się tak samo
   * jak zapisany, bo aplikacja mierzy regularność, a nie to, gdzie ktoś wpisał powtórzenia.
   */
  const tickDay = (index: number) => {
    const next = clone(state);
    const ticked = next.plan!.ticked ?? {};
    if (ticked[index]) delete ticked[index];
    else ticked[index] = true;
    next.plan!.ticked = ticked;
    const fresh = syncBadges(next, badgeCtx(next));
    commit(next);
    if (fresh.length) void sayBadges(fresh, metrics(next));
  };

  const stopPlan = async () => {
    const ok = await ask(
      'Zakończyć plan?',
      <p>
        Kalendarz zniknie. Punkty z tego planu przechodzą do dorobku, a odznaki, poziomy
        ćwiczeń i historia zostają bez zmian.
      </p>,
      'Zakończ',
    );
    if (!ok) return;
    const next = clone(state);
    const banked = bankPoints(next);
    next.events.push({
      id: `plan-stop:${next.plan!.templateId}:${dayKey(Date.now())}`,
      date: dayKey(Date.now()),
      kind: 'plan-stop',
      title: 'Plan zakończony',
      text: `Do dorobku doszło ${banked} punktów.`,
    });
    next.plan = null;
    commit(next);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-tracker-${new Date().toISOString().slice(0, 10)}.json`;
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
        next.plan = parsed.plan ?? null;
        next.events = parsed.events ?? [];
        next.award = {
          banked: parsed.award?.banked ?? 0,
          badges: migrateBadges(parsed.award?.badges ?? {}),
        };
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
      { who: 'siwy', mood: 'wise' },
    );
    if (!ok) return;
    await store.clear();
    commit(freshState());
  };

  /* ---------- nagłówek ---------- */

  // W trakcie sesji nagłówek pokazuje postęp, a nie statystyki sprzed tygodni — to jedyna
  // liczba, której ktoś w połowie treningu naprawdę szuka.
  const sessionProgress = current
    ? `${Object.keys(state.session!.done).length} z ${current.items.length} ćwiczeń zapisanych`
    : null;

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
                ? 'sesja w toku'
                : `${state.log.length} ${state.log.length === 1 ? 'zapisany trening' : 'zapisanych treningów'}`}
            </span>
            <span className="headtools">
              <SupportButton />
              <a
              className="gearbtn"
              href={SETTINGS_PATH}
              aria-label="Ustawienia"
              aria-current={view === 'set' ? 'page' : 'false'}
            >
              <Icon name="settings" size={21} />
              </a>
            </span>
          </div>
          <h1>{current ? current.name : 'GYM TRACKER'}</h1>
          <div className="subline">{sessionProgress ?? subline.join(' · ')}</div>
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
              text: `Tonaż z ostatniego tygodnia to ${ratio.toFixed(2)} średniej z czterech tygodni. Powyżej 1,5 rośnie ryzyko przeciążenia, więc skoki na cięższe obciążenie są wstrzymane. Cele powtórzeń rosną normalnie.`,
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

      {view === 'plan' && (
        <PlanView
          state={state}
          onStart={(t, o) => void startPlan(t, o)}
          onStop={() => void stopPlan()}
          onTick={tickDay}
          onFrequency={(n) => void changeFrequency(n)}
        />
      )}

      {route.kind === 'atlas' && <AtlasView state={state} />}
      {route.kind === 'exercise' && <ExercisePage state={state} id={route.id} />}
      {route.kind === 'exstats' && <ExerciseStatsPage state={state} id={route.id} />}

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
          <SessionHome
            today={todayPlan}
            lastLabel={
              d === null
                ? null
                : d === 0
                  ? 'Ostatni trening: dzisiaj.'
                  : d === 1
                    ? 'Ostatni trening: wczoraj.'
                    : `Ostatni trening: ${d} dni temu.`
            }
            onStart={startSession}
          />
        ))}

      {view === 'prog' && <ProfileView state={state} />}

      {view === 'ach' && <Achievements state={state} />}

      {view === 'work' && (
        <WorkoutsView
          state={state}
          plannedId={plannedId}
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
          onIntro={() => setReplayIntro(true)}
          onWeights={setWeights}
          onStartWeight={setStartWeight}
          onExport={exportData}
          onImport={importData}
          onReset={() => void resetAll()}
          onRecalibrate={() => void recalibrate()}
        />
      )}

      <nav aria-label="Główna nawigacja">
        {TABS.map((t) => {
          const on = activeTab(route) === t.key;
          return (
            <a key={t.key} href={t.path} aria-current={on ? 'page' : 'false'}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </a>
          );
        })}
      </nav>

      {showIntro && <Intro onDone={closeIntro} />}

      <BadgeDefs />
      <Modal req={req} />
      <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />
    </>
  );
}
