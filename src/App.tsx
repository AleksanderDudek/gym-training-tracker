import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL, BUILTIN, EX, ex } from './data/exercises';
import { acwr, daysSince, epley, round1, weeklyRate } from './engine/math';
import { P, freshState } from './engine/plan';
import { applyLayoff, applyResult } from './engine/progression';
import { queueSave, store } from './storage/storage';
import { Banner, Modal, Toast, useModal } from './components/ui';
import { SessionView, SettingsView } from './components/views';
import { WorkoutBuilder, WorkoutLibrary, WorkoutPreview } from './components/Workouts';
import { PlanBuilder, PlanCatalog, PlanDetail } from './components/Plans';
import { ExerciseStatsPage, ProfileView } from './components/Profile';
import { SessionHome } from './components/SessionHome';
import type { TodayPlan } from './components/SessionHome';
import { AtlasView, ExercisePage } from './components/atlas';
import { Catalogue, PlanView } from './components/PlanView';
import { Achievements } from './components/Achievements';
import { dayKey, daysBetween } from './engine/schedule';
import { bankPoints, snapshot } from './engine/snapshot';
import { achCtx, migrateBadges, revokeUnmet, syncBadges } from './engine/badges';
import { pointsToday, rankFor } from './engine/score';
import { seedFromPlan } from './engine/plan';
import { loadFactorFor, planOf, planById, planId } from './data/plans';
import { PLANS_PATH, TABS, activeTab, currentPath, go, goBack, screenOf, useRoute } from './routing';
import { Icon } from './components/icons';
import { BadgeDefs } from './components/BadgeArt';
import { Celebrate } from './components/Celebrate';
import { Intro } from './components/Intro';
import { ShareButton } from './components/Share';
import { SupportLine, snoozeUntil, supportSnoozed } from './components/Support';
import { TopBar } from './components/TopBar';
import { metrics } from './engine/metrics';
import { LOADING, SAVED, SNACK_SAVED, daySeed, pick } from './engine/quips';
import { progressSubject, punchline } from './engine/share';
import { bandFor, BAND_MOOD, BAND_NAME } from './components/BadgeArt';
import { addSnack, removeSnack, snacksOf, snacksOn, validSnack } from './engine/snacks';
import { XP, cardioXp, levelFor, xpSummary } from './engine/xp';
import type { LevelState } from './engine/xp';
import { SnackEntry, SnacksPage, snackLabel } from './components/Snacks';
import { CardioEntry, CardioPage, cardioLabel, kcalText } from './components/Cardio';
import { addCardio, minutesByDay, removeCardio, validCardio } from './engine/cardio';
import { removeBodyWeight, setBodyWeight, validBody, validHeight } from './engine/body';
import { cardioBurn, workoutBurn } from './engine/burn';
import { LevelUp, avatarOf } from './components/Character';
import type { Avatar } from './components/Character';
import type {
  ActivePlan,
  AppState,
  AchievementHit,
  CardioInput,
  Change,
  EffortKey,
  ExerciseId,
  PlanOptions,
  PlanTemplate,
  ReadyKey,
  ReminderPrefs,
  SetResult,
  Workout,
} from './types';
import { pushConfigured, syncReminders } from './push';

const clone = (s: AppState): AppState => JSON.parse(JSON.stringify(s)) as AppState;

/** Poziom postaci na teraz — liczony od zera z historii, tak jak wszystko inne. */
const levelNow = (s: AppState): LevelState => levelFor(xpSummary(s).total);

/**
 * Co z zapisu da się wziąć bez sprawdzania, a co trzeba przesiać: przekąski z nieznanym
 * ćwiczeniem albo zepsutą datą wywróciłyby liczenie odznak, a postać spoza obsady — rysunek.
 */
function restoreExtras(next: AppState, saved: Partial<AppState>): void {
  next.snacks = Array.isArray(saved.snacks) ? saved.snacks.filter(validSnack) : [];
  next.cardio = Array.isArray(saved.cardio) ? saved.cardio.filter(validCardio) : [];
  // Ważenia po dniu i bez powtórzeń: waga z dnia bierze ostatnie ważenie przed nim,
  // więc lista musi być posortowana, a dzień — jeden.
  const byDay = new Map<string, NonNullable<AppState['body']>[number]>();
  (Array.isArray(saved.body) ? saved.body.filter(validBody) : []).forEach((b) => byDay.set(b.day, b));
  next.body = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  if (next.cfg.height !== undefined && !validHeight(next.cfg.height)) delete next.cfg.height;
  // Plany własne: tylko te, które da się rozpisać na kalendarz — bez tego plan z zepsutym
  // zapisem wywróciłby ekran planu, a nie tylko zniknął z listy.
  next.plans = Array.isArray(saved.plans)
    ? saved.plans.filter(validOwnPlan).map((t) => ({
        ...t,
        // Pola potrzebne dopiero przy starcie — z ręcznie poprawionego pliku bywają puste.
        level: (['zero', 'base', 'strong'] as const).includes(t.level) ? t.level : 'base',
        sex: (['f', 'm', 'any'] as const).includes(t.sex) ? t.sex : 'any',
        loadFactor: Number.isFinite(t.loadFactor) ? t.loadFactor : loadFactorFor('base', 'any'),
        daysPerWeek: t.weekdays.length,
        desc: typeof t.desc === 'string' ? t.desc : '',
      }))
    : [];
  if (typeof saved.supportSnooze === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.supportSnooze))
    next.supportSnooze = saved.supportSnooze;
  if (next.cfg.avatar !== undefined && next.cfg.avatar !== 'gustaw' && next.cfg.avatar !== 'gosia')
    delete next.cfg.avatar;
  // Zamiany ćwiczeń w trwającej sesji: tylko istniejące ćwiczenia, inaczej sesja by się wywróciła.
  if (next.session?.swap !== undefined) {
    const raw: unknown = next.session.swap;
    const ok = raw && typeof raw === 'object' ? Object.entries(raw).filter(([a, b]) => EX[a] && typeof b === 'string' && EX[b]) : [];
    if (ok.length) next.session.swap = Object.fromEntries(ok) as Record<string, string>;
    else delete next.session.swap;
  }
  const r = next.cfg.reminders;
  if (r !== undefined && (typeof r !== 'object' || typeof r.morning !== 'boolean' || typeof r.evening !== 'boolean'))
    delete next.cfg.reminders;
}

const isDay = (n: unknown): boolean => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 7;

/** Czy zapisany plan własny nadaje się do rozpisania. */
function validOwnPlan(t: Partial<PlanTemplate> | null | undefined): t is PlanTemplate {
  return (
    !!t &&
    t.kind === 'own' &&
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    Number.isInteger(t.weeks) &&
    t.weeks! >= 1 &&
    t.weeks! <= 52 &&
    Array.isArray(t.weekdays) &&
    t.weekdays.length > 0 &&
    t.weekdays.every(isDay) &&
    Array.isArray(t.cycle) &&
    t.cycle.length > 0 &&
    t.cycle.every((c) => typeof c === 'string') &&
    (t.deload === undefined || (Array.isArray(t.deload) && t.deload.every((w) => Number.isInteger(w))))
  );
}

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
        restoreExtras(next, saved);
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

  // Wprowadzenie wchodzi samo tylko przy pierwszym uruchomieniu i nigdy w trakcie sesji —
  // kto już trenuje, ten nie potrzebuje wycieczki po ekranach. Z ustawień da się je otworzyć
  // ponownie w dowolnym momencie.
  const showIntro =
    replayIntro || (!!state && !state.introSeen && !state.log.length && !state.session);
  // Pasek wsparcia: nie w trakcie treningu, nie pod wprowadzeniem, nie w tygodniu po schowaniu.
  const strip =
    !!state && !state.session && !showIntro && !supportSnoozed(state, dayKey(Date.now()));
  // Kolor paska systemowego idzie za tym, co stoi na samej górze: tło wprowadzenia albo jasny
  // pasek aplikacji — pasek wsparcia stoi pod nim, więc go nie zmienia. Przed wczytaniem zostaje
  // kolor z `index.html`, ten sam co paska aplikacji, żeby start nie mrugał.
  const topColor = !state ? null : showIntro ? '#D7D9D3' : '#FAFAF8';
  useEffect(() => {
    if (topColor) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', topColor);
  }, [topColor]);

  const commit = useCallback((next: AppState) => {
    setState(next);
    void queueSave(next, setSaveBroken);
  }, []);

  // Lista przypomnień na serwerze idzie za stanem: po zmianie planu albo zapisanym treningu
  // i po powrocie do aplikacji następnego dnia. Bez serwera w buildzie, bez zgody albo bez
  // zmian w liście nic nie wychodzi do sieci.
  useEffect(() => {
    if (!state || !pushConfigured()) return;
    const sync = () => void syncReminders(state);
    const t = window.setTimeout(sync, 2000);
    const back = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', back);
    };
  }, [state]);

  if (!state) return <div className="empty">{pick(LOADING, daySeed())}</div>;

  // Cztery zakładki aplikacji renderują się po staremu; atlas i podstrony ćwiczeń mają własne gałęzie.
  const view = route.kind === 'tab' ? route.tab : null;
  const workouts: Workout[] = [...BUILTIN, ...state.workouts];
  const planned = state.session ? workouts.find((w) => w.id === state.session!.workout) : undefined;
  // Zamiany na dziś (zajęta maszyna, brak sprzętu) podmieniają ćwiczenie tylko w tej sesji —
  // zapis, progresja i podsumowanie widzą to, co naprawdę zrobiono.
  const swap = state.session?.swap;
  const current =
    planned && swap ? { ...planned, items: planned.items.map((i) => ({ ...i, ex: swap[i.ex] ?? i.ex })) } : planned;
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
        deload: due.deload,
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
    // Tydzień lżejszy dotyczy treningu z planu na dziś — sesja dodatkowa idzie normalnie.
    const due = snapshot(state)?.stats.due;
    const deload = !!due?.deload && due.workout === id;
    next.session = {
      workout: id,
      started: new Date().toISOString(),
      ready: 'ok',
      res: {},
      done: {},
      skip: {},
      ...(deload ? { deload: true } : {}),
    };
    commit(next);
    go('#/sesja', { top: true });
    window.scrollTo({ top: 0 });
  };

  /** Zamiana ćwiczenia na dziś. Zamiana na oryginał cofa zamianę. */
  const swapExercise = (orig: ExerciseId, to: ExerciseId) => {
    const next = clone(state);
    const s = next.session!;
    const live = s.swap?.[orig] ?? orig;
    delete s.res[live];
    delete s.done[live];
    delete s.skip[live];
    const map = { ...(s.swap ?? {}) };
    if (to === orig) delete map[orig];
    else map[orig] = to;
    if (Object.keys(map).length) s.swap = map;
    else delete s.swap;
    commit(next);
    setToastMsg(to === orig ? `Wracasz do: ${ex(orig).name}.` : `Na dziś: ${ex(to).name} zamiast ${ex(orig).name}.`);
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

  /* ---------- przekąski i postać ---------- */

  /**
   * Awans dostaje własne okno, po odznakach — trzecia wiadomość, trzeci temat. Poziomy
   * wpadają rzadko, więc okno nie spowszednieje, a przeskoczyć je można jednym stuknięciem.
   */
  const sayLevel = async (before: LevelState, next: AppState) => {
    const after = levelNow(next);
    if (after.level <= before.level) return;
    await say('Awans postaci', <LevelUp before={before} after={after} />, {
      ok: 'Dalej',
      tone: 'celebrate-box',
      cast: { who: avatarOf(next), mood: 'euphoric' },
    });
  };

  const logSnack = (id: ExerciseId, reps: number, w: number | null) => {
    const before = levelNow(state);
    const next = clone(state);
    const snack = addSnack(next, id, reps, w);
    const fresh = syncBadges(next, badgeCtx(next));
    commit(next);
    const n = snacksOn(next, dayKey(Date.now())).length;
    setToastMsg(
      `Zapisane: ${snackLabel(snack)} · ${n <= XP.snackCap ? `+${XP.snack} XP` : 'bez XP, limit na dziś'}. ${pick(SNACK_SAVED, n + next.snacks.length)}`,
    );
    void (async () => {
      if (fresh.length) await sayBadges(fresh, metrics(next), 'Przy tej przekąsce');
      await sayLevel(before, next);
    })();
  };

  /**
   * Usunięcie przekąski to poprawka pomyłki, więc cofa też to, co pomyłka dała: progi
   * przekąsek i progi tego ćwiczenia, których historia już nie uzasadnia. Reszta odznak
   * zostaje nietknięta — nie ma nic wspólnego z tą jedną przekąską.
   */
  const deleteSnack = (key: string) => {
    const next = clone(state);
    const gone = snacksOf(next).find((s) => s.key === key);
    if (!gone || !removeSnack(next, key)) return;
    const revoked = revokeUnmet(
      next,
      badgeCtx(next),
      (d) => d.group === 'przekaski' || (d.group === 'cwiczenia' && d.id.startsWith(`ex:${gone.ex}:`)),
    );
    commit(next);
    setToastMsg(
      revoked
        ? `Przekąska usunięta razem z ${revoked === 1 ? 'progiem, który dała' : `progami, które dała (${revoked})`}.`
        : 'Przekąska usunięta.',
    );
  };

  const setAvatar = (a: Avatar) => {
    const next = clone(state);
    next.cfg.avatar = a;
    commit(next);
  };

  /* ---------- kroki, cardio i waga ---------- */

  /**
   * Zapis ruchu. Waga wpisana w formularzu to dzisiejsze ważenie — idzie do dziennika wagi,
   * a nie do wpisu, bo przyda się też treningom i kolejnym spacerom.
   */
  const logCardio = (input: CardioInput, day: string, kg: number | null) => {
    const before = levelNow(state);
    const next = clone(state);
    if (kg !== null) setBodyWeight(next, kg, dayKey(Date.now()));
    const { entry, replaced } = addCardio(next, input, day);
    // Nowa liczba kroków na ten sam dzień bywa poprawką literówki w dół — wtedy cofa progi,
    // których historia już nie uzasadnia, tak jak usunięcie wpisu.
    const revoked = replaced ? revokeUnmet(next, badgeCtx(next), (d) => d.group === 'cardio') : 0;
    const fresh = syncBadges(next, badgeCtx(next));
    commit(next);
    const b = cardioBurn(next, entry);
    const dayXp = (s: AppState): number => cardioXp(minutesByDay(s)[day] ?? 0);
    const gained = dayXp(next) - dayXp(state);
    setToastMsg(
      `Zapisane: ${cardioLabel(entry)}${b ? ` · ${kcalText(b.active)}` : ''}` +
        (gained > 0 ? ` · +${gained} XP` : dayXp(next) >= XP.cardioCap ? ' · bez XP, limit dnia' : '') +
        '.' +
        (replaced ? ' Poprzednia liczba kroków z tego dnia zastąpiona.' : '') +
        (revoked ? ` Cofnięte progi, których nowa liczba nie uzasadnia: ${revoked}.` : '') +
        (b ? '' : ' Kalorie pokażą się po wpisaniu wagi.'),
    );
    void (async () => {
      if (fresh.length) await sayBadges(fresh, metrics(next), 'Przy tym wpisie');
      await sayLevel(before, next);
    })();
  };

  /** Usunięcie wpisu to poprawka pomyłki — cofa progi kroków i cardio, które dała. */
  const deleteCardio = (key: string) => {
    const next = clone(state);
    if (!removeCardio(next, key)) return;
    const revoked = revokeUnmet(next, badgeCtx(next), (d) => d.group === 'cardio');
    commit(next);
    setToastMsg(
      revoked
        ? `Wpis usunięty razem z ${revoked === 1 ? 'progiem, który dał' : `progami, które dał (${revoked})`}.`
        : 'Wpis usunięty.',
    );
  };

  const setWeight = (kg: number) => {
    // Pierwsze ważenie obowiązuje też wstecz — ruch sprzed niego nie ma innej wagi.
    const first = !state.body?.length;
    const next = clone(state);
    const b = setBodyWeight(next, kg, dayKey(Date.now()));
    commit(next);
    setToastMsg(
      `Waga zapisana: ${b.kg.toLocaleString('pl-PL')} kg. ` +
        (first ? 'Kalorie policzone — także dla wcześniejszych wpisów.' : 'Kalorie od dziś liczą się z niej.'),
    );
  };

  const deleteWeight = (day: string) => {
    const next = clone(state);
    if (!removeBodyWeight(next, day)) return;
    commit(next);
    setToastMsg('Ważenie usunięte.');
  };

  const setHeight = (cm: number | null) => {
    const next = clone(state);
    if (cm === null) delete next.cfg.height;
    else next.cfg.height = cm;
    commit(next);
    setToastMsg(cm === null ? 'Wzrost usunięty — krok liczony dla 170 cm.' : `Wzrost zapisany: ${cm} cm.`);
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
        {session.deload ? (
          <p style={{ marginTop: 12 }}>
            Tydzień lżejszy: wyniki trafią do historii, ale poziomy zostaną bez zmian — ani w górę,
            ani w dół.
          </p>
        ) : blockJump && (
          <p style={{ marginTop: 12 }}>
            Skoki na cięższe obciążenie są dziś wstrzymane — {reason}. Cele powtórzeń rosną normalnie.
          </p>
        )}
      </>,
      'Zamknij i przelicz',
      { who: 'gustaw', mood: 'tired' },
    );
    if (!ok) return;

    const before = levelNow(state);
    const xpBefore = xpSummary(state).total;
    const next = clone(state);
    const changes: Change[] = [];
    // Tydzień lżejszy nie jest oceniany: mniej serii to plan, a nie porażka, a zapas powtórzeń
    // to cel, a nie sygnał za lekkiego ciężaru.
    if (!session.deload)
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
    const after = levelNow(next);
    const gained = after.xp - xpBefore;
    const burn = workoutBurn(next, next.log[next.log.length - 1]!);
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
        ) : session.deload ? (
          <p>Tydzień lżejszy — poziomy bez zmian. Kolejny mocny trening startuje z tego samego miejsca.</p>
        ) : (
          <p>
            Bez zmian poziomów. Cel rośnie, gdy każda seria dobije do wyznaczonej liczby i zostanie
            zapas powtórzeń.
          </p>
        )}
        <p className="xpline">
          Postać: +{gained} XP · poziom {after.level}, {after.title}
          {after.level > before.level ? ' — awans!' : `, do kolejnego ${after.toNext} XP`}
        </p>
        {burn ? (
          <>
            <p className="xpline">
              Ruch: {kcalText(burn.active)} ponad spoczynek · ok. {Math.round(burn.secs / 60)} min serii z przerwami
            </p>
            <p className="kcal-split">
              {burn.items.map((i) => `${ex(i.id).name} ${kcalText(i.active).replace('≈ ', '')}`).join(' · ')}
            </p>
          </>
        ) : (
          <p className="kcal-split">Wpisz wagę w profilu, a policzę też kalorie tego treningu.</p>
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
    await sayLevel(before, next);
  };

  /**
   * Odznaki pokazywane osobno, po podsumowaniu poziomów — dwie wiadomości, dwa tematy.
   * Lista przycięta, bo po imporcie historii potrafi wpaść kilkanaście progów naraz,
   * a ekran z osiemnastoma gratulacjami nie cieszy nikogo.
   */
  const sayBadges = async (
    hits: AchievementHit[],
    m: ReturnType<typeof metrics>,
    context = 'W tej samej sesji',
  ) => {
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
        <Celebrate hits={hits} context={context} />
        <div className="after">
          <ShareButton subject={subject} medalRef={medalBox} label="Udostępnij odznakę" />
          <SupportLine seed={top.tier + m.workouts} compact />
        </div>
      </div>,
      { ok: 'Nieźle', tone: 'celebrate-box', cast: { who: 'gustaw', mood: BAND_MOOD[bandFor(top.tier, top.ach.tiers.length)] } },
    );
  };

  /* ---------- ustawienia i dane ---------- */

  const setReminders = (r: ReminderPrefs) => {
    const next = clone(state);
    next.cfg.reminders = r;
    commit(next);
  };

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
    const seeded = seedFromPlan(next, opts.loadFactor ?? t.loadFactor);
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
    go('#/plan', { top: true, replace: true });

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
    // Zmiana częstotliwości istnieje tylko w konfiguratorze klasycznym — plan z celem i własny
    // mają rotację ułożoną pod konkretną liczbę dni.
    if (!t || (t.kind ?? 'classic') !== 'classic') return;
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
    const before = levelNow(state);
    const next = clone(state);
    const ticked = next.plan!.ticked ?? {};
    if (ticked[index]) delete ticked[index];
    else ticked[index] = true;
    next.plan!.ticked = ticked;
    const fresh = syncBadges(next, badgeCtx(next));
    commit(next);
    void (async () => {
      if (fresh.length) await sayBadges(fresh, metrics(next));
      await sayLevel(before, next);
    })();
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

  /* ---------- treningi i plany własne ---------- */

  const saveWorkout = (w: Workout) => {
    const next = clone(state);
    const i = next.workouts.findIndex((x) => x.id === w.id);
    if (i > -1) next.workouts[i] = w;
    else next.workouts.push(w);
    commit(next);
    setToastMsg(`Zapisany: ${w.name}.`);
  };

  /**
   * Trening użyty w planie własnym albo w uruchomionym planie nie znika po cichu — plan
   * wskazywałby wtedy dzień bez treningu. Najpierw trzeba zmienić plan.
   */
  const deleteWorkout = async (w: Workout) => {
    if (state.session?.workout === w.id) {
      setToastMsg(`„${w.name}” właśnie trwa — najpierw zamknij albo porzuć sesję.`);
      return;
    }
    const inPlans = (state.plans ?? []).filter((p) => p.cycle.includes(w.id));
    const activeT = state.plan ? planOf(state, state.plan.templateId) : undefined;
    if (inPlans.length || activeT?.cycle.includes(w.id)) {
      setToastMsg(
        `„${w.name}” jest w planie ${[...new Set([...inPlans, ...(activeT ? [activeT] : [])].map((p) => `„${p.name}”`))].join(', ')} — najpierw zmień plan.`,
      );
      return;
    }
    const ok = await ask('Usunąć trening?', <p>„{w.name}” zniknie z listy. Poziomy ćwiczeń zostaną nietknięte.</p>, 'Usuń');
    if (!ok) return;
    const next = clone(state);
    next.workouts = next.workouts.filter((x) => x.id !== w.id);
    commit(next);
    go('#/treningi', { replace: true });
  };

  const savePlan = (t: PlanTemplate) => {
    const next = clone(state);
    next.plans ??= [];
    const i = next.plans.findIndex((x) => x.id === t.id);
    if (i > -1) next.plans[i] = t;
    else next.plans.push(t);
    // Uruchomiony plan trzyma dni wybrane przy starcie. Kreator planu własnego ustala dni
    // wprost, więc po edycji kalendarz ma iść za nimi — inaczej tabela tygodnia i kalendarz
    // mówiłyby co innego.
    if (next.plan?.templateId === t.id) next.plan.weekdays = [...t.weekdays];
    commit(next);
    setToastMsg(
      state.plan?.templateId === t.id
        ? `Plan zapisany. Kalendarz przeliczy się z nowego układu.`
        : `Plan zapisany: ${t.name}. Zacznij go, kiedy chcesz.`,
    );
  };

  const deletePlan = async (t: PlanTemplate) => {
    if (state.plan?.templateId === t.id) {
      setToastMsg('To twój aktualny plan. Najpierw go zakończ — punkty przejdą do dorobku.');
      return;
    }
    const ok = await ask('Usunąć plan?', <p>„{t.name}” zniknie z katalogu. Treningi i historia zostaną.</p>, 'Usuń');
    if (!ok) return;
    const next = clone(state);
    next.plans = (next.plans ?? []).filter((x) => x.id !== t.id);
    commit(next);
    go(PLANS_PATH, { replace: true });
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
        restoreExtras(next, parsed);
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

  /* ---------- pasek aplikacji ---------- */

  // W trakcie sesji pasek aplikacji pokazuje postęp, a nie statystyki sprzed tygodni — to jedyna
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

  const today = dayKey(Date.now());
  const screen = screenOf(route);
  const inSession = view === 'train' && !!current;
  const title = inSession ? current!.name : screen.title;
  const subtitle = inSession
    ? sessionProgress
    : view === 'train'
      ? new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
      : null;
  // Klucz strony: nowy ekran wjeżdża od nowa, ten sam ekran z nowymi danymi — nie.
  const pageKey =
    route.kind === 'tab' ? `tab:${route.tab}` : `${route.kind}:${'id' in route ? (route.id ?? '') : ''}`;

  const snoozeSupport = () => {
    const next = clone(state);
    next.supportSnooze = snoozeUntil(today);
    commit(next);
    setToastMsg('Pasek wsparcia wróci za tydzień. Kawę da się postawić też z Ustawień.');
  };

  return (
    <>
      <TopBar
        title={title}
        subtitle={subtitle}
        parent={inSession ? null : screen.parent}
        strip={strip}
        onSnooze={snoozeSupport}
        settings={!screen.parent && !inSession}
      />

      <main className="page" key={pageKey}>
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
          onStop={() => void stopPlan()}
          onTick={tickDay}
          onFrequency={(n) => void changeFrequency(n)}
        />
      )}
      {route.kind === 'plans' && <PlanCatalog state={state} />}
      {route.kind === 'planClassic' && (
        <Catalogue onStart={(t, o) => void startPlan(t, o)} onCancel={() => goBack(PLANS_PATH)} />
      )}
      {route.kind === 'planDetail' && (
        <PlanDetail
          key={route.id}
          state={state}
          id={route.id}
          onStart={(t, o) => void startPlan(t, o)}
          onDelete={(t) => void deletePlan(t)}
        />
      )}
      {route.kind === 'planEdit' && (
        <PlanBuilder key={route.id ?? 'nowy'} state={state} id={route.id} onSave={savePlan} onToast={setToastMsg} />
      )}

      {route.kind === 'atlas' && <AtlasView state={state} />}
      {route.kind === 'exercise' && <ExercisePage state={state} id={route.id} />}
      {route.kind === 'exstats' && <ExerciseStatsPage state={state} id={route.id} />}
      {route.kind === 'snacks' && <SnacksPage state={state} onDelete={deleteSnack} />}
      {route.kind === 'snackAdd' && (
        // Klucz za adresem: wejście z innym ćwiczeniem zaczyna czysty formularz.
        <SnackEntry
          key={route.id ?? ''}
          state={state}
          id={route.id}
          onLog={logSnack}
          onToast={setToastMsg}
        />
      )}

      {route.kind === 'cardio' && <CardioPage state={state} onDelete={deleteCardio} />}
      {route.kind === 'cardioAdd' && (
        // Klucz za adresem: skrót z innym rodzajem ruchu zaczyna czysty formularz.
        <CardioEntry
          key={route.sport ?? 'steps'}
          state={state}
          sport={route.sport ?? 'steps'}
          onLog={logCardio}
          onToast={setToastMsg}
        />
      )}

      {view === 'train' &&
        (current ? (
          <SessionView
            state={state}
            workout={current}
            planned={planned!}
            onSwap={swapExercise}
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
            state={state}
            today={todayPlan}
            statsLine={subline.join(' · ')}
            onStart={startSession}
          />
        ))}

      {view === 'prog' && (
        <ProfileView
          state={state}
          onAvatar={setAvatar}
          onWeight={setWeight}
          onHeight={setHeight}
          onDeleteWeight={deleteWeight}
          onToast={setToastMsg}
        />
      )}

      {view === 'ach' && <Achievements state={state} />}

      {view === 'work' && <WorkoutLibrary state={state} plannedId={plannedId} onStart={startSession} />}
      {route.kind === 'workout' && (
        <WorkoutPreview state={state} id={route.id} onStart={startSession} onDelete={(w) => void deleteWorkout(w)} />
      )}
      {route.kind === 'workoutEdit' && (
        <WorkoutBuilder
          key={`${route.id ?? ''}:${route.from ?? ''}`}
          state={state}
          id={route.id}
          from={route.from}
          onSave={saveWorkout}
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
          onReminders={setReminders}
          onToast={setToastMsg}
          onIntro={() => setReplayIntro(true)}
          onWeights={setWeights}
          onStartWeight={setStartWeight}
          onExport={exportData}
          onImport={importData}
          onReset={() => void resetAll()}
          onRecalibrate={() => void recalibrate()}
        />
      )}

      </main>

      <nav aria-label="Główna nawigacja">
        {TABS.map((t) => {
          const on = activeTab(route) === t.key;
          return (
            <a
              key={t.key}
              href={t.path}
              aria-current={on ? 'page' : 'false'}
              onClick={(e) => {
                // Stuknięcie w zakładkę, na której się jest, przewija na górę — jak w iOS i Androidzie.
                if (!on || currentPath() !== t.path) return;
                e.preventDefault();
                const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
              }}
            >
              <span className="navpill">
                <Icon name={t.icon} />
              </span>
              <span className="navlabel">{t.label}</span>
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
