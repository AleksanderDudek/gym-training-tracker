import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import {
  PLANS_PATH,
  TABS,
  activeTab,
  currentPath,
  forgetSections,
  go,
  goBack,
  isDeviceLink,
  isFoodRoute,
  isTabRoot,
  screenOf,
  tabHref,
  useRoute,
} from './routing';
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
import {
  addCardio,
  deviceStepsOn,
  minutesByDay,
  minutesOn,
  outingsOn,
  removeCardio,
  stepsOn,
  stepsWorthOn,
  typedStepsOn,
  validCardio,
} from './engine/cardio';
import { mergeWatch, restoreWatch } from './engine/watch';
import { mergePhone, restorePhone } from './engine/phone';
import type { PhonePayload } from './engine/phone';
import { addSet, answerEffort, extendRest, forgetAsk, settleOpen, skipRest, startRest, undoSet } from './engine/session';
import type { RestPlan } from './engine/rests';
import { cursorOf, sessionSteps } from './engine/steps';
import { blocksOf } from './engine/blocks';
import {
  durationText,
  settleExercises,
  startClock,
  startListClock,
  startPart,
  summary,
  timeOf,
  timed,
  validClock,
  validLogTime,
} from './engine/clock';
import { formatClock } from './components/Timer';
import { GuidedSession } from './components/Guided';
import { PromoPage } from './components/Promo';
import type { WatchPayload } from './engine/watch';
import { HEIGHT_RANGE, WEIGHT_RANGE, bodyOf, removeBodyWeight, setBodyWeight, validBody, validHeight, validWeight } from './engine/body';
import { beyondStepsBurn, cardioBurn, dayBurn, plannedBurn, typicalWorkoutBurn, workoutBurn } from './engine/burn';
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
  LogTime,
  PlanOptions,
  PlanPolicy,
  PlanTemplate,
  ReadyKey,
  ReminderPrefs,
  SetResult,
  Workout,
} from './types';
import { pushConfigured, syncReminders } from './push';
import { currentInstallPlace } from './install';
import { InstallSteps } from './components/Install';
import { apiConfigured } from './api';
import { forgetWatch, garminConfigured, garminKey, pullWatch } from './garmin';
import type { PullResult } from './garmin';
import { forgetPhone, phoneConfigured, phoneKey, pullPhone } from './phone';
import type { PhonePull } from './phone';
import { forgetWatchModel } from './watches/remember';
import { attachTrail, trail } from './trail';
import { FeedbackDialog } from './components/Feedback';
import { ContactDialog } from './components/Contact';
import { UpdateBar } from './components/UpdateBar';
import { withExtension, withWeekdays } from './engine/planedit';
import { BridgeContext } from './food/bridge';
import type { GymBridge } from './food/bridge';
import { LoadBoundary } from './components/LoadBoundary';
import { LOCALE, pluralEn, text } from './i18n';

/**
 * Zakładka Jedzenie w osobnej paczce (razem z Dexie, Leafletem i kodem bazy produktów): ekrany
 * treningu jej nie wczytują, a pierwsze wejście w Jedzenie wczytuje ją raz — z zapasu service
 * workera albo z sieci.
 */
const FoodRoot = lazy(() => import('./food/FoodRoot'));

/** Zapisy, które ekrany jedzenia robią w danych treningowych. Podmieniane co render — zawsze ze świeżym stanem. */
type BridgeWrites = Pick<GymBridge, 'setWeight' | 'setHeight' | 'setSteps'> & Required<Pick<GymBridge, 'skipWeigh'>>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dzień pominięcia ważenia („Nie dziś”, `cfg.weighSkip`) — dzień treningów w chwili wywołania.
 * Poza komponentem: most woła to z obsługi zdarzeń, a reguła czystości renderu widzi zegar w każdym
 * domknięciu komponentu.
 */
const weighDay = (): string => dayKey(Date.now());

const clone = (s: AppState): AppState => JSON.parse(JSON.stringify(s)) as AppState;

const T = text({
  pl: {
    weekdays: ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'niedz'],
    q: (s: string) => `„${s}”`,
    // Podsumowanie czasu
    time: (d: string) => `Czas: ${d}`,
    work: (d: string) => `ćwiczenia ${d}`,
    gaps: (d: string) => `przejścia ${d}`,
    longest: (clock: string, names: string) => `Najdłuższe przejście ${clock} przed „${names}”.`,
    untimed: 'Poza statystykami czasu — liczą się treningi od 3 minut do 4 godzin.',
    // Komunikaty
    weightsMoved: (n: number) =>
      `Dziennik wagi przejął ${n === 1 ? 'ważenie' : `ważenia (${n})`} z dziennika diety.`,
    swapBack: (name: string) => `Wracasz do: ${name}.`,
    swapTo: (to: string, from: string) => `Na dziś: ${to} zamiast ${from}.`,
    levelUp: 'Awans postaci',
    next: 'Dalej',
    snackSaved: (label: string, xp: number | null, quip: string) =>
      `Zapisane: ${label} · ${xp !== null ? `+${xp} XP` : 'bez XP, limit na dziś'}. ${quip}`,
    atSnack: 'Przy tej przekąsce',
    snackDeleted: (revoked: number) =>
      revoked
        ? `Przekąska usunięta razem z ${revoked === 1 ? 'progiem, który dała' : `progami, które dała (${revoked})`}.`
        : 'Przekąska usunięta.',
    logged: (label: string) => `Zapisane: ${label}`,
    noXpDay: ' · bez XP, limit dnia',
    stepsReplaced: ' Poprzednia liczba kroków z tego dnia zastąpiona.',
    deviceMore: (phone: boolean, steps: string) =>
      ` ${phone ? 'Telefon' : 'Zegarek'} podał więcej (${steps}) — liczy się jego liczba.`,
    revokedNew: (n: number) => ` Cofnięte progi, których nowa liczba nie uzasadnia: ${n}.`,
    kcalLater: ' Kalorie pokażą się po wpisaniu wagi.',
    atEntry: 'Przy tym wpisie',
    fromWatch: 'Z danymi z zegarka',
    fromPhone: 'Z danymi z telefonu',
    entryDeleted: (revoked: number) =>
      revoked
        ? `Wpis usunięty razem z ${revoked === 1 ? 'progiem, który dał' : `progami, które dał (${revoked})`}.`
        : 'Wpis usunięty.',
    weightSaved: (when: string | null) => (when ? `Waga z ${when} zapisana: ` : 'Waga zapisana: '),
    kcalFirst: 'Kalorie policzone — także dla wcześniejszych wpisów.',
    kcalFromDay: 'Kalorie od tego dnia liczą się z niej.',
    kcalFromToday: 'Kalorie od dziś liczą się z niej.',
    weighDeleted: 'Ważenie usunięte.',
    heightRemoved: 'Wzrost usunięty — krok liczony dla 170 cm.',
    heightSaved: (cm: number) => `Wzrost zapisany: ${cm} cm.`,
    weightRange: (min: number, max: number) => `Waga poza zakresem ${min}–${max} kg.`,
    heightRange: (min: number, max: number) => `Wzrost poza zakresem ${min}–${max} cm.`,
    stepsFailed: 'Nie udało się zapisać kroków.',
    // Sesja
    abandonQ: 'Porzucić trening?',
    abandonText: 'Wpisane wyniki przepadną, a poziomy zostaną bez zmian.',
    abandon: 'Porzuć',
    noSaveQ: 'Zakończyć bez zapisu?',
    noSaveText: 'Żadne ćwiczenie nie ma wyniku, więc nie ma czego przeliczyć. Trening nie trafi do historii.',
    end: 'Zakończ',
    reasonSpike: 'tygodniowy tonaż mocno wyprzedza średnią z miesiąca',
    reasonLow: 'oznaczyłeś dziś gorszy dzień',
    reasonBreak: 'po przerwie w treningach',
    finishQ: 'Zamknąć trening?',
    loggedOf: (n: number, total: number): ReactNode => (
      <>
        Zapisane: <b>{n}</b> z {total}. Bez wyniku zostaje:
      </>
    ),
    allDone: (n: number) => `Wszystkie ${n} ćwiczeń ma wynik.`,
    workoutTime: (d: string): ReactNode => (
      <>
        Czas treningu: <b>{d}</b>.
      </>
    ),
    deloadFinish: 'Tydzień lżejszy: wyniki trafią do historii, ale poziomy zostaną bez zmian — ani w górę, ani w dół.',
    jumpsPaused: (reason: string) =>
      `Skoki na cięższe obciążenie są dziś wstrzymane — ${reason}. Cele powtórzeń rosną normalnie.`,
    finishOk: 'Zamknij i przelicz',
    done: (name: string) => `${name} zaliczony`,
    exercisesInSession: (n: number) => `${n} ${n === 1 ? 'ćwiczenie' : 'ćwiczeń'} w tej sesji`,
    onTraining: (d: string) => `${d} na treningu`,
    totals: (workouts: number, reps: string) =>
      `${workouts} ${workouts === 1 ? 'zapisany trening' : 'zapisanych treningów'} · ${reps} powtórzeń`,
    changes: 'Zmiany na kolejną sesję:',
    deloadSaved: 'Tydzień lżejszy — poziomy bez zmian. Kolejny mocny trening startuje z tego samego miejsca.',
    noChanges: 'Bez zmian poziomów. Cel rośnie, gdy każda seria dobije do wyznaczonej liczby i zostanie zapas powtórzeń.',
    xpLine: (gained: number, level: number, title: string, up: boolean, toNext: number) =>
      `Postać: +${gained} XP · poziom ${level}, ${title}${up ? ' — awans!' : `, do kolejnego ${toNext} XP`}`,
    burnLine: (kcal: string, min: number) => `Ruch: ${kcal} ponad spoczynek · ok. ${min} min serii z przerwami`,
    noWeight: 'Wpisz wagę w profilu, a policzę też kalorie tego treningu.',
    shareResult: 'Udostępnij wynik',
    shareAll: 'Udostępnij cały dorobek',
    sameSession: 'W tej samej sesji',
    tier: (tier: number, of: number) => `próg ${tier} z ${of}`,
    oneOff: 'odznaka jednorazowa',
    earned: (n: number) => (n === 1 ? 'Zdobyte!' : `Zdobyte: ${n}`),
    shareBadge: 'Udostępnij odznakę',
    nice: 'Nieźle',
    // Ustawienia i plan
    twoWeights: 'Podaj przynajmniej dwie wagi, np. 12, 16, 20, 24.',
    remeasureQ: 'Zmierzyć poziomy od nowa?',
    remeasureText: (
      <>
        Każde ćwiczenie dostanie serię próbną — jedną serię bez sufitu, z której wyjdzie nowy
        poziom. Próba startuje od miejsca, w którym jesteś teraz, więc może pójść w górę albo w
        dół. Historia i zapisane treningi zostają nietknięte.
      </>
    ) as ReactNode,
    remeasure: 'Zmierz od nowa',
    remeasured: 'Próby ustawione. Kolejny trening zmierzy poziomy.',
    planStarted: (name: string) => `Start planu: ${name}`,
    firstDates: (start: string) => `Pierwsze terminy od ${start}. `,
    bankedPlan: (n: number) => `Punkty z poprzedniego planu (${n}) trafiły do dorobku.`,
    planSet: 'Plan ustawiony',
    planSetLine: (name: string, start: string, first: string | null) =>
      `${name}. Start ${start}${first ? `, pierwszy termin ${first}` : ''}.`,
    seeded: (n: number): ReactNode => (
      <>
        Ciężary startowe ustawione w <b>{n}</b> ćwiczeniach. Ćwiczenia z zaliczonym już
        wynikiem zostały nietknięte — zmierzony poziom jest wart więcej niż tabelka.
      </>
    ),
    policyShift: 'Opuszczony termin nie zjada treningu: ten sam trening wchodzi na kolejny termin.',
    policyStrict: 'Rotacja idzie sztywno z kalendarzem — opuszczony trening przepada.',
    freqQ: (days: number) => `Przejść na ${days}× w tygodniu?`,
    freqText: (
      <>
        Nowy kalendarz rusza od dziś. Punkty z dotychczasowego planu trafiają do dorobku,
        odznaki i poziomy ćwiczeń zostają bez zmian.
      </>
    ) as ReactNode,
    changePlan: 'Zmień plan',
    freqEvent: (days: number) => `Zmiana wariantu na ${days}× w tygodniu`,
    bankedCalendar: (n: number) => `Punkty z poprzedniego kalendarza (${n}) trafiły do dorobku.`,
    freqChanged: (days: number) => `Plan zmieniony na ${days}× w tygodniu.`,
    daysEvent: (days: string) => `Nowe dni treningowe: ${days}`,
    daysEventText: 'Od dziś. Terminy, które minęły, zostają bez zmian.',
    daysChanged: 'Dni planu zmienione od dziś.',
    policyShiftSet: 'Opuszczony trening poczeka na kolejny termin.',
    policyStrictSet: 'Opuszczony trening przepada razem z terminem.',
    extendEvent: (weeks: number) => `Plan dłuższy o ${weeks} tygodnie`,
    extendEventText: 'Kolejne terminy dochodzą na końcu, w tych samych dniach.',
    extended: (weeks: number) => `Plan przedłużony o ${weeks} tygodnie.`,
    stopQ: 'Zakończyć plan?',
    stopText: (
      <>
        Kalendarz zniknie. Punkty z tego planu przechodzą do dorobku, a odznaki, poziomy
        ćwiczeń i historia zostają bez zmian.
      </>
    ) as ReactNode,
    stop: 'Zakończ',
    stopped: 'Plan zakończony',
    stoppedText: (n: number) => `Do dorobku doszło ${n} punktów.`,
    workoutSaved: (name: string) => `Zapisany: ${name}.`,
    workoutRunning: (name: string) => `„${name}” właśnie trwa — najpierw zamknij albo porzuć sesję.`,
    workoutInPlan: (name: string, plans: string) => `„${name}” jest w planie ${plans} — najpierw zmień plan.`,
    deleteWorkoutQ: 'Usunąć trening?',
    deleteWorkoutText: (name: string) => `„${name}” zniknie z listy. Poziomy ćwiczeń zostaną nietknięte.`,
    delete: 'Usuń',
    planSavedActive: 'Plan zapisany. Kalendarz przeliczy się z nowego układu.',
    planSaved: (name: string) => `Plan zapisany: ${name}. Zacznij go, kiedy chcesz.`,
    planIsActive: 'To twój aktualny plan. Najpierw go zakończ — punkty przejdą do dorobku.',
    deletePlanQ: 'Usunąć plan?',
    deletePlanText: (name: string) => `„${name}” zniknie z katalogu. Treningi i historia zostaną.`,
    // Kopia danych
    noDiet: 'Plik zapisany bez dziennika jedzenia — nie udało się go odczytać.',
    loaded: 'Dane wczytane.',
    loadedDiet: 'Dane wczytane — razem z dziennikiem jedzenia.',
    loadedNoDiet: 'Trening wczytany. Dziennika jedzenia z tego pliku nie udało się odtworzyć.',
    loadFailed: 'Nie udało się wczytać',
    loadFailedText: 'Wybierz plik JSON wyeksportowany z tej aplikacji.',
    resetQ: 'Usunąć wszystkie dane?',
    resetText: (food: boolean, watch: boolean, phone: boolean) =>
      'Historia, poziomy ćwiczeń i własne treningi znikną bezpowrotnie' +
      (food ? ' — razem z dziennikiem jedzenia i profilem diety' : '') +
      '.' +
      (watch ? ' Zegarek Garmin zostanie odłączony — inaczej przysłałby ostatni tydzień z powrotem.' : '') +
      (phone ? ' Telefon zostanie odłączony — inaczej przysłałby ostatnie dwa tygodnie z powrotem.' : ''),
    resetAll: 'Usuń wszystko',
    // Pasek aplikacji
    setOf: (n: number, of: number) => `seria ${n} z ${of}`,
    partOf: (n: number, of: number, sets: string) => `Część ${n} z ${of} · ${sets}`,
    listProgress: (done: number, of: number) => `${done} z ${of} ćwiczeń zapisanych`,
    firstWorkout: 'Pierwszy trening',
    lastToday: 'Ostatni trening dzisiaj',
    lastYesterday: 'Ostatni trening wczoraj',
    lastDaysAgo: (d: number) => `Ostatni trening ${d} dni temu`,
    perWeek: (rate: string) => `${rate} sesji na tydzień`,
    loadRatio: (ratio: string) => `obciążenie ${ratio}`,
    saveBroken: 'Zapis nie działa',
    saveBrokenText:
      'Przeglądarka odmówiła zapisu danych. Wyniki trzymają się w pamięci, ale znikną po odświeżeniu. Wyeksportuj plik z Ustawień, zanim zamkniesz kartę.',
    snoozed: 'Pasek wsparcia wróci za tydzień. Kawę da się postawić też z Ustawień.',
    home: 'Aplikacja na ekranie początkowym',
    gotIt: 'Rozumiem',
    installHidden: 'Instrukcja zostaje w Ustawieniach.',
    thanks: 'Dzięki! Wiadomość poszła do autora.',
    spike: 'Skok obciążenia',
    spikeText: (ratio: string) =>
      `Tonaż z ostatniego tygodnia to ${ratio} średniej z czterech tygodni. Powyżej 1,5 rośnie ryzyko przeciążenia, więc skoki na cięższe obciążenie są wstrzymane. Cele powtórzeń rosną normalnie.`,
    trainedToday: 'Trenowałeś dzisiaj',
    trainedTodayText:
      'Możesz zalogować kolejną sesję, ale te same wzorce ruchowe dwa razy w ciągu dnia nie dadzą lepszej progresji.',
    foodTab: 'zakładki Jedzenie',
    nav: 'Główna nawigacja',
  },
  en: {
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    q: (s: string) => `“${s}”`,
    time: (d: string) => `Time: ${d}`,
    work: (d: string) => `exercises ${d}`,
    gaps: (d: string) => `transitions ${d}`,
    longest: (clock: string, names: string) => `Longest transition ${clock} before “${names}”.`,
    untimed: 'Not in the time stats — only workouts from 3 minutes to 4 hours count.',
    weightsMoved: (n: number) =>
      `The weight log took over ${n === 1 ? 'a weigh-in' : `${n} weigh-ins`} from the diet diary.`,
    swapBack: (name: string) => `Back to: ${name}.`,
    swapTo: (to: string, from: string) => `For today: ${to} instead of ${from}.`,
    levelUp: 'Level up!',
    next: 'Next',
    snackSaved: (label: string, xp: number | null, quip: string) =>
      `Logged: ${label} · ${xp !== null ? `+${xp} XP` : 'no XP, daily limit reached'}. ${quip}`,
    atSnack: 'With this snack',
    snackDeleted: (revoked: number) =>
      revoked
        ? `Snack deleted, along with ${revoked === 1 ? 'the badge tier it earned' : `the ${revoked} badge tiers it earned`}.`
        : 'Snack deleted.',
    logged: (label: string) => `Logged: ${label}`,
    noXpDay: ' · no XP, daily limit reached',
    stepsReplaced: ' The earlier step count for that day was replaced.',
    deviceMore: (phone: boolean, steps: string) =>
      ` Your ${phone ? 'phone' : 'watch'} reported more (${steps}) — its number counts.`,
    revokedNew: (n: number) => ` Badge tiers the new number no longer supports were taken back: ${n}.`,
    kcalLater: ' Calories will show once you enter your weight.',
    atEntry: 'With this entry',
    fromWatch: 'With data from your watch',
    fromPhone: 'With data from your phone',
    entryDeleted: (revoked: number) =>
      revoked
        ? `Entry deleted, along with ${revoked === 1 ? 'the badge tier it earned' : `the ${revoked} badge tiers it earned`}.`
        : 'Entry deleted.',
    weightSaved: (when: string | null) => (when ? `Weight for ${when} saved: ` : 'Weight saved: '),
    kcalFirst: 'Calories worked out — for earlier entries too.',
    kcalFromDay: 'Calories from that day on use it.',
    kcalFromToday: 'Calories from today on use it.',
    weighDeleted: 'Weigh-in deleted.',
    heightRemoved: 'Height removed — stride worked out for 170 cm.',
    heightSaved: (cm: number) => `Height saved: ${cm} cm.`,
    weightRange: (min: number, max: number) => `Weight out of range: ${min}–${max} kg.`,
    heightRange: (min: number, max: number) => `Height out of range: ${min}–${max} cm.`,
    stepsFailed: 'Couldn’t save steps.',
    abandonQ: 'Abandon the workout?',
    abandonText: 'The results you entered will be lost, and your levels stay the same.',
    abandon: 'Abandon',
    noSaveQ: 'Finish without saving?',
    noSaveText: 'No exercise has a result, so there’s nothing to recalculate. The workout won’t go into your history.',
    end: 'Finish',
    reasonSpike: 'this week’s tonnage is well ahead of the monthly average',
    reasonLow: 'you marked today as an off day',
    reasonBreak: 'after a break from training',
    finishQ: 'Finish the workout?',
    loggedOf: (n: number, total: number): ReactNode => (
      <>
        Logged: <b>{n}</b> of {total}. Still without a result:
      </>
    ),
    allDone: (n: number) => (n === 1 ? 'The exercise has a result.' : `All ${n} exercises have a result.`),
    workoutTime: (d: string): ReactNode => (
      <>
        Workout time: <b>{d}</b>.
      </>
    ),
    deloadFinish: 'Lighter week: results go into your history, but your levels stay the same — neither up nor down.',
    jumpsPaused: (reason: string) =>
      `Jumps to a heavier weight are paused today — ${reason}. Rep targets go up as usual.`,
    finishOk: 'Finish and recalculate',
    done: (name: string) => `${name} done`,
    exercisesInSession: (n: number) => `${n} ${pluralEn(n, 'exercise', 'exercises')} this session`,
    onTraining: (d: string) => `${d} of training`,
    totals: (workouts: number, reps: string) =>
      `${workouts} ${pluralEn(workouts, 'logged workout', 'logged workouts')} · ${reps} reps`,
    changes: 'Changes for the next session:',
    deloadSaved: 'Lighter week — levels unchanged. Your next hard workout starts from the same place.',
    noChanges: 'No level changes. The target goes up when every set hits its number with reps to spare.',
    xpLine: (gained: number, level: number, title: string, up: boolean, toNext: number) =>
      `Character: +${gained} XP · level ${level}, ${title}${up ? ' — level up!' : `, ${toNext} XP to the next level`}`,
    burnLine: (kcal: string, min: number) => `Activity: ${kcal} above resting · about ${min} min of sets with rests`,
    noWeight: 'Enter your weight in your profile and I’ll work out this workout’s calories too.',
    shareResult: 'Share result',
    shareAll: 'Share all your progress',
    sameSession: 'In the same session',
    tier: (tier: number, of: number) => `tier ${tier} of ${of}`,
    oneOff: 'one-off badge',
    earned: (n: number) => (n === 1 ? 'Earned!' : `Earned: ${n}`),
    shareBadge: 'Share badge',
    nice: 'Nice',
    twoWeights: 'Enter at least two weights, e.g. 12, 16, 20, 24.',
    remeasureQ: 'Re-measure your levels?',
    remeasureText: (
      <>
        Every exercise gets a test set — one set with no ceiling that gives a new level. The test starts from where you
        are now, so it can go up or down. Your history and logged workouts stay untouched.
      </>
    ),
    remeasure: 'Re-measure',
    remeasured: 'Test sets scheduled. Your next workout will measure your levels.',
    planStarted: (name: string) => `Plan started: ${name}`,
    firstDates: (start: string) => `First deadlines from ${start}. `,
    bankedPlan: (n: number) => `Points from the previous plan (${n}) went into your total.`,
    planSet: 'Plan set',
    planSetLine: (name: string, start: string, first: string | null) =>
      `${name}. Starts ${start}${first ? `, first deadline ${first}` : ''}.`,
    seeded: (n: number): ReactNode => (
      <>
        Starting weights set for <b>{n}</b> exercises. Exercises that already have a logged result were left alone —
        a measured level is worth more than a table.
      </>
    ),
    policyShift: 'A missed deadline doesn’t eat the workout: the same workout moves to the next deadline.',
    policyStrict: 'The rotation follows the calendar strictly — a missed workout is lost.',
    freqQ: (days: number) => `Switch to ${days}× a week?`,
    freqText: (
      <>
        The new calendar starts today. Points from your current plan go into your total; badges and exercise levels
        stay the same.
      </>
    ),
    changePlan: 'Change plan',
    freqEvent: (days: number) => `Switched to ${days}× a week`,
    bankedCalendar: (n: number) => `Points from the previous calendar (${n}) went into your total.`,
    freqChanged: (days: number) => `Plan changed to ${days}× a week.`,
    daysEvent: (days: string) => `New training days: ${days}`,
    daysEventText: 'From today. Past deadlines stay as they were.',
    daysChanged: 'Plan days changed from today.',
    policyShiftSet: 'A missed workout will wait for the next deadline.',
    policyStrictSet: 'A missed workout is lost along with its deadline.',
    extendEvent: (weeks: number) => `Plan extended by ${weeks} ${pluralEn(weeks, 'week', 'weeks')}`,
    extendEventText: 'New deadlines are added at the end, on the same days.',
    extended: (weeks: number) => `Plan extended by ${weeks} ${pluralEn(weeks, 'week', 'weeks')}.`,
    stopQ: 'End the plan?',
    stopText: (
      <>
        The calendar will disappear. Points from this plan go into your total, and badges, exercise levels and history
        stay the same.
      </>
    ),
    stop: 'End plan',
    stopped: 'Plan ended',
    stoppedText: (n: number) => `${n} ${pluralEn(n, 'point', 'points')} added to your total.`,
    workoutSaved: (name: string) => `Saved: ${name}.`,
    workoutRunning: (name: string) => `“${name}” is in progress — finish or abandon the session first.`,
    workoutInPlan: (name: string, plans: string) => `“${name}” is in the plan ${plans} — change the plan first.`,
    deleteWorkoutQ: 'Delete the workout?',
    deleteWorkoutText: (name: string) => `“${name}” will disappear from the list. Exercise levels stay untouched.`,
    delete: 'Delete',
    planSavedActive: 'Plan saved. The calendar will recalculate from the new layout.',
    planSaved: (name: string) => `Plan saved: ${name}. Start it whenever you like.`,
    planIsActive: 'That’s your current plan. End it first — its points will go into your total.',
    deletePlanQ: 'Delete the plan?',
    deletePlanText: (name: string) => `“${name}” will disappear from the catalogue. Workouts and history stay.`,
    noDiet: 'File saved without the food diary — it couldn’t be read.',
    loaded: 'Data loaded.',
    loadedDiet: 'Data loaded — food diary included.',
    loadedNoDiet: 'Training loaded. The food diary from this file couldn’t be restored.',
    loadFailed: 'Couldn’t load the file',
    loadFailedText: 'Choose a JSON file exported from this app.',
    resetQ: 'Delete all data?',
    resetText: (food: boolean, watch: boolean, phone: boolean) =>
      'Your history, exercise levels and custom workouts will be gone for good' +
      (food ? ' — along with your food diary and diet profile' : '') +
      '.' +
      (watch ? ' Your Garmin watch will be disconnected — otherwise it would send the last week back.' : '') +
      (phone ? ' Your phone will be disconnected — otherwise it would send the last two weeks back.' : ''),
    resetAll: 'Delete everything',
    setOf: (n: number, of: number) => `set ${n} of ${of}`,
    partOf: (n: number, of: number, sets: string) => `Part ${n} of ${of} · ${sets}`,
    listProgress: (done: number, of: number) => `${done} of ${of} exercises logged`,
    firstWorkout: 'First workout',
    lastToday: 'Last workout today',
    lastYesterday: 'Last workout yesterday',
    lastDaysAgo: (d: number) => `Last workout ${d} days ago`,
    perWeek: (rate: string) => `${rate} sessions a week`,
    loadRatio: (ratio: string) => `load ${ratio}`,
    saveBroken: 'Saving isn’t working',
    saveBrokenText:
      'The browser refused to save your data. Your results are kept in memory but will vanish when you refresh. Export a file from Settings before you close the tab.',
    snoozed: 'The support bar will be back in a week. You can also buy a coffee from Settings.',
    home: 'App on your Home Screen',
    gotIt: 'Got it',
    installHidden: 'The instructions stay in Settings.',
    thanks: 'Thanks! Your message is on its way to the author.',
    spike: 'Load spike',
    spikeText: (ratio: string) =>
      `Last week’s tonnage is ${ratio}× your four-week average. Above 1.5 the risk of overload goes up, so jumps to a heavier weight are paused. Rep targets go up as usual.`,
    trainedToday: 'You trained today',
    trainedTodayText:
      'You can log another session, but the same movement patterns twice in one day won’t give you better progress.',
    foodTab: 'the Food tab',
    nav: 'Main navigation',
  },
});

/** Dni tygodnia słowami do dziennika planu. */
const WD_NAME = T.weekdays;

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
  // Dane z zegarka: przesiane jak paczka — zepsuty dzień odpada, reszta zostaje.
  const watch = restoreWatch(saved.watch);
  if (watch) next.watch = watch;
  const phone = restorePhone(saved.phone);
  if (phone) next.phone = phone;
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
  if (typeof saved.installHidden === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.installHidden))
    next.installHidden = saved.installHidden;
  if (next.cfg.avatar !== undefined && next.cfg.avatar !== 'gustaw' && next.cfg.avatar !== 'gosia')
    delete next.cfg.avatar;
  // Zmiany dni w trakcie planu i przedłużenie: tylko poprawne daty, dni 1–7 i rozsądna liczba tygodni.
  if (next.plan) {
    const ch: unknown = next.plan.changes;
    const ok = Array.isArray(ch)
      ? ch.filter(
          (c): c is { from: string; weekdays: number[] } =>
            !!c && typeof c.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.from) && Array.isArray(c.weekdays) && c.weekdays.length > 0 && c.weekdays.every(isDay),
        )
      : [];
    if (ok.length) next.plan.changes = ok.sort((a, b) => a.from.localeCompare(b.from));
    else delete next.plan.changes;
    const x = next.plan.extraWeeks;
    if (x !== undefined && !(Number.isInteger(x) && x >= 0 && x <= 52)) delete next.plan.extraWeeks;
  }
  // Zamiany ćwiczeń w trwającej sesji: tylko istniejące ćwiczenia, inaczej sesja by się wywróciła.
  if (next.session?.swap !== undefined) {
    const raw: unknown = next.session.swap;
    const ok = raw && typeof raw === 'object' ? Object.entries(raw).filter(([a, b]) => EX[a] && typeof b === 'string' && EX[b]) : [];
    if (ok.length) next.session.swap = Object.fromEntries(ok) as Record<string, string>;
    else delete next.session.swap;
  }
  if (next.cfg.view !== undefined && next.cfg.view !== 'guided' && next.cfg.view !== 'list') delete next.cfg.view;
  if (next.cfg.clock !== undefined && typeof next.cfg.clock !== 'boolean') delete next.cfg.clock;
  // Zegar sesji i czasy w dzienniku: zepsuty zegar znika (sesja idzie wtedy bez czasu), zamiast
  // dać ujemne przejścia albo wywrócić historię i odznaki czasu.
  if (next.session?.clock !== undefined && !validClock(next.session.clock)) delete next.session.clock;
  next.log.forEach((e) => {
    if (e?.time !== undefined && !validLogTime(e.time)) delete e.time;
  });
  if (next.cfg.weighSkip !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(next.cfg.weighSkip))) delete next.cfg.weighSkip;
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

/**
 * Czas w podsumowaniu treningu: całość, praca w częściach, przejścia i najdłuższe z nich —
 * z nazwą części, przed którą wypadło, bo to tam warto szukać zgubionych minut.
 */
function TimeSummary({ time }: { time: LogTime }) {
  const t = summary(time);
  const started = time.parts.some((p) => p.at !== undefined);
  const line = [
    T.time(durationText(t.secs)),
    started ? T.work(durationText(t.work)) : null,
    t.longest ? T.gaps(durationText(t.gaps)) : null,
  ].filter(Boolean);
  return (
    <>
      <p className="xpline">{line.join(' · ')}</p>
      {t.longest && t.longest.secs > 0 && (
        <p className="kcal-split">
          {T.longest(formatClock(t.longest.secs), t.longest.ex.map((id) => ex(id).name).join(' + '))}
        </p>
      )}
      {!timed(time) && (
        <p className="kcal-split">{T.untimed}</p>
      )}
    </>
  );
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const route = useRoute();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);
  const [contactOpen, setContactOpen] = useState(false);
  const closeContact = useCallback(() => setContactOpen(false), []);

  // Ślad wizyty do wiadomości z uwagą — tylko w pamięci, patrz `trail.ts`.
  useEffect(() => attachTrail(), []);
  useEffect(() => {
    trail.view(`${currentPath()} · ${screenOf(route).title}`);
  }, [route]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [saveBroken, setSaveBroken] = useState(false);
  const [replayIntro, setReplayIntro] = useState(false);
  // Wejście linkiem do karty urządzenia (`#/zegarek?model=…` z opisu w Connect IQ Store,
  // `#/ustawienia?karta=…`): adres z chwili otwarcia, raz na wizytę.
  const [deviceLink] = useState(() => isDeviceLink(window.location.hash));
  // iPhone poza aplikacją z ikony — to się nie zmienia, dopóki karta jest otwarta.
  const [installPlace] = useState(currentInstallPlace);
  const medalBox = useRef<HTMLDivElement>(null);
  const { req, say, ask } = useModal();
  const booted = useRef(false);
  /**
   * Ostatni zatwierdzony stan, także ten sprzed renderu. Ekrany jedzenia potrafią zapisać dwie
   * rzeczy w jednym stuknięciu (waga i kroki dnia): druga musi zacząć od wyniku pierwszej,
   * a nie od stanu z ostatniego renderu, inaczej pierwsza by przepadła.
   */
  const live = useRef<AppState | null>(null);

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
      live.current = next;
      setState(next);
      if (fresh.length) void queueSave(next, setSaveBroken);
    })();
  }, []);

  // Wprowadzenie wchodzi samo tylko przy pierwszym uruchomieniu i nigdy w trakcie sesji —
  // kto już trenuje, ten nie potrzebuje wycieczki po ekranach. Z ustawień da się je otworzyć
  // ponownie w dowolnym momencie. Kto przyszedł linkiem do karty zegarka albo telefonu, przyszedł
  // po jedną odpowiedź: w tej wizycie wprowadzenie nie wchodzi, a `introSeen` zostaje nietknięte,
  // więc pokaże się przy następnym zwykłym starcie.
  const showIntro =
    replayIntro || (!!state && !deviceLink && !state.introSeen && !state.log.length && !state.session);
  // Pasek „dodaj do ekranu początkowego” (iPhone w Safari): na tych samych zasadach co pasek
  // wsparcia, ale przed nim — dane, które Safari może skasować po tygodniu, są ważniejsze niż kawa.
  const installStrip = !!state && !!installPlace && !state.session && !showIntro && !state.installHidden;
  // Pasek wsparcia: nie w trakcie treningu, nie pod wprowadzeniem, nie w tygodniu po schowaniu.
  const strip =
    !!state &&
    !state.session &&
    !showIntro &&
    !installStrip &&
    !supportSnoozed(state, dayKey(Date.now()));
  // Kolor paska systemowego idzie za tym, co stoi na samej górze: tło wprowadzenia albo jasny
  // pasek aplikacji — pasek wsparcia stoi pod nim, więc go nie zmienia. Przed wczytaniem zostaje
  // kolor z `index.html`, ten sam co paska aplikacji, żeby start nie mrugał.
  const topColor = !state ? null : showIntro ? '#D7D9D3' : '#FAFAF8';
  useEffect(() => {
    if (topColor) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', topColor);
  }, [topColor]);

  /** Zatwierdza stan; obietnica mówi, czy trafił na dysk (prawie wszyscy jej nie potrzebują). */
  const commit = useCallback((next: AppState): Promise<boolean> => {
    live.current = next;
    setState(next);
    return queueSave(next, setSaveBroken);
  }, []);

  /*
   * Most do zakładki Jedzenie (`food/bridge.ts`): odczyty z bieżącego stanu, przeliczane razem
   * z nim, i zapisy przez `bridgeWrites` — podmieniane co render na funkcje, które zaczynają od
   * `live.current`, więc żadna nie trzyma starego stanu.
   */
  const bridgeWrites = useRef<BridgeWrites | null>(null);
  const bridge = useMemo<GymBridge | null>(() => {
    if (!state) return null;
    // Kalendarz planu treningowego i typowy trening liczone raz na stan, nie przy każdym dniu.
    const snap = snapshot(state);
    const typical = typicalWorkoutBurn(state);
    const workouts = [...BUILTIN, ...state.workouts];
    return {
      weights: bodyOf(state),
      setWeight: (kg, day) => bridgeWrites.current?.setWeight(kg, day),
      heightCm: state.cfg.height ?? null,
      setHeight: (cm) => bridgeWrites.current?.setHeight(cm),
      // Ta sama reguła co wszędzie w aplikacji: z wpisu ręcznego i zegarka zostaje wyższa liczba.
      stepsOn: (day) => stepsOn(state, day) || null,
      setSteps: (day, steps) => bridgeWrites.current?.setSteps(day, steps),
      moveOn: (day) => {
        const burn = dayBurn(state, day);
        const slot = snap?.schedule.days.find((d) => d.date === day);
        const workout = slot ? workouts.find((w) => w.id === slot.workout) : undefined;
        return {
          // Ten sam dzień co w kaloriach dnia (`dayBurn`) i w kalendarzu planu.
          trained: state.log.some((e) => dayKey(e.date) === day),
          workoutKcal: burn ? burn.workouts : null,
          cardioKcal: burn ? burn.cardio : null,
          otherKcal: beyondStepsBurn(state, day),
          planned: workout ? { name: workout.name, kcal: plannedBurn(state, workout)?.active ?? null } : null,
          planActive: snap !== null,
          typicalWorkoutKcal: typical,
          workouts: state.log.filter((e) => dayKey(e.date) === day).length,
          snacks: snacksOn(state, day).length,
          outings: outingsOn(state, day),
          activeMin: minutesOn(state, day),
          stepsWorth: stepsWorthOn(state, day),
        };
      },
      toast: setToastMsg,
      // To samo pominięcie co karta ważenia na ekranie Dziś (`cfg.weighSkip`, dzień jak w `Weigh`).
      weighSkipped: () => state.cfg.weighSkip === weighDay(),
      skipWeigh: () => bridgeWrites.current?.skipWeigh(),
    };
  }, [state]);

  /*
   * Ważenia z dziennika diety (dawne Produkty PL na tej samej domenie, kopia diety albo plan
   * z Excela) przechodzą do dziennika wagi przy każdym wejściu w Jedzenie — i znikają z diety,
   * więc waga ma jedno źródło, a ważenie usunięte w profilu nie wraca. Z diety znikają dopiero
   * wtedy, gdy dziennik wagi z nimi naprawdę się zapisał: przy zepsutym zapisie ważenia żyłyby
   * tylko w pamięci i przepadłyby z obu miejsc po odświeżeniu. Bez IndexedDB albo bez zapisu —
   * po cichu (zepsuty zapis ma swój pasek): kolejne wejście spróbuje jeszcze raz. `moving`
   * pilnuje, żeby dwa przebiegi (StrictMode, szybkie przejścia) nie szły naraz.
   */
  const onFood = isFoodRoute(route);
  const moving = useRef(false);
  const loaded = !!state;
  useEffect(() => {
    if (!onFood || !loaded || moving.current) return;
    moving.current = true;
    void (async () => {
      try {
        const [{ db }, { weightsToMigrate }, { forgetDietWeights }] = await Promise.all([
          import('./food/diet/db'),
          import('./food/diet/body'),
          import('./food/backup'),
        ]);
        const days = await db.days.filter((d) => d.weightKg != null).toArray();
        const base = live.current;
        if (!days.length || !base) return;
        const found = weightsToMigrate(days, bodyOf(base));
        let saved: boolean;
        if (found.length) {
          const next = clone(base);
          found.forEach((w) => setBodyWeight(next, w.kg, w.day));
          const writing = commit(next);
          setToastMsg(T.weightsMoved(found.length));
          saved = await writing;
        } else {
          // Te dni dziennik wagi już ma — ale może tylko w pamięci, z poprzedniego przejęcia przy
          // zepsutym zapisie. Jeden zapis bieżącego stanu to rozstrzyga.
          saved = await queueSave(base, setSaveBroken);
        }
        if (saved) await forgetDietWeights();
      } catch {
        // Bez IndexedDB nie ma czego przenosić.
      } finally {
        moving.current = false;
      }
    })();
  }, [onFood, loaded, commit]);

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

  // Dane z zegarka i telefonu: przy otwarciu i po powrocie do aplikacji, nie częściej niż raz
  // na minutę (pilnuje tego skrzynka). Nigdy w trakcie treningu — nowe odznaki i awans wyskakują
  // w oknie, a okno w środku serii to ostatnie, czego ktoś potrzebuje.
  const onWatch = useRef<(p: WatchPayload) => void>(() => undefined);
  const onPhone = useRef<(p: PhonePayload) => void>(() => undefined);
  const ready = !!state;
  const training = !!state?.session;
  useEffect(() => {
    if (!ready || training || !(garminConfigured() || phoneConfigured())) return;
    // Jedno po drugim: obie paczki zaczynają od `live.current`, ale okna z odznakami
    // z dwóch źródeł naraz nachodziłyby na siebie.
    const pull = () =>
      void pullWatch()
        .then((r) => {
          if (r.kind === 'ok') onWatch.current(r.payload);
        })
        .then(() => pullPhone())
        .then((r) => {
          if (r.kind === 'ok') onPhone.current(r.payload);
        });
    const t = window.setTimeout(pull, 1500);
    const back = () => {
      if (document.visibilityState === 'visible') pull();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', back);
    };
  }, [ready, training]);

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
    forgetAsk(s, live, to);
    const map = { ...(s.swap ?? {}) };
    if (to === orig) delete map[orig];
    else map[orig] = to;
    if (Object.keys(map).length) s.swap = map;
    else delete s.swap;
    // Zamiana zeruje wynik ćwiczenia, więc jego część mogła się otworzyć z powrotem.
    settleClock(next, { ...planned!, items: planned!.items.map((i) => ({ ...i, ex: map[i.ex] ?? i.ex })) }, [to], Date.now());
    commit(next);
    setToastMsg(to === orig ? T.swapBack(ex(orig).name) : T.swapTo(ex(to).name, ex(orig).name));
  };

  /**
   * Zegar po zmianie w ćwiczeniach: koniec ich części wchodzi albo schodzi (cofnięcie,
   * wyczyszczenie, zamiana). `w` — trening na dziś po tej zmianie.
   */
  const settleClock = (next: AppState, w: Workout, ids: ExerciseId[], now: number) => {
    if (next.session!.clock) settleExercises(next.session!, sessionSteps(next, w), ids, now);
  };

  const saveExercise = (id: ExerciseId, rows: SetResult[], effort: EffortKey) => {
    const next = clone(state);
    const now = Date.now();
    next.session!.res[id] = { rows, effort };
    next.session!.done[id] = true;
    delete next.session!.skip[id];
    forgetAsk(next.session!, id);
    // Widok listy nie ma „Zaczynam” ani „Start: …”: zegar rusza od startu sesji przy pierwszym
    // wyniku, a części dostają tylko koniec — bez przejść, bo ich początku nikt nie zaznaczył.
    startListClock(next.session!, now);
    settleClock(next, current!, [id], now);
    commit(next);
  };

  const clearExercise = (id: ExerciseId) => {
    const next = clone(state);
    const now = Date.now();
    delete next.session!.res[id];
    delete next.session!.done[id];
    forgetAsk(next.session!, id);
    settleClock(next, current!, [id], now);
    commit(next);
  };

  const skipExercise = (id: ExerciseId) => {
    const next = clone(state);
    const s = next.session!;
    const now = Date.now();
    if (s.skip[id]) delete s.skip[id];
    else {
      s.skip[id] = true;
      delete s.res[id];
      delete s.done[id];
      s.ask = (s.ask ?? []).filter((x) => x !== id);
    }
    // Pominięcie to nie trening — zegara nie startuje (inaczej powrót do prowadzenia ominąłby „Zaczynam”).
    settleClock(next, current!, [id], now);
    commit(next);
  };

  /** Cała część, która czeka na start, pominięta na dziś — bez przełączania, w przeciwieństwie do listy. */
  const skipPart = (ids: ExerciseId[]) => {
    const next = clone(state);
    const s = next.session!;
    ids.forEach((id) => {
      s.skip[id] = true;
      delete s.res[id];
      delete s.done[id];
    });
    forgetAsk(s, ...ids);
    settleClock(next, current!, ids, Date.now());
    commit(next);
  };

  /* ---------- prowadzenie: seria po serii ---------- */

  /** „Zaczynam”: zegar treningu rusza razem z pierwszą częścią — rozgrzewka już za tobą. */
  const beginSession = () => {
    const next = clone(state);
    const s = next.session!;
    const steps = sessionSteps(state, current!);
    startClock(s, Date.now(), steps[cursorOf(steps, s)]?.block ?? null);
    commit(next);
  };

  /** „Start: …” na karcie przejścia kończy przejście; zalecana przerwa była zaleceniem, nie blokadą. */
  const startNextPart = (block: number) => {
    const next = clone(state);
    startPart(next.session!, block, Date.now());
    skipRest(next.session!);
    commit(next);
  };

  /** Jedna seria zapisana, a przerwa po niej rusza od razu — liczona od chwili stuknięcia. */
  const logSet = (id: ExerciseId, row: SetResult, of: number, rest: RestPlan | null) => {
    const next = clone(state);
    const now = Date.now();
    addSet(next.session!, id, row, of);
    startRest(next.session!, rest, now);
    settleClock(next, current!, [id], now);
    commit(next);
  };

  const undoLastSet = (id: ExerciseId) => {
    const next = clone(state);
    const now = Date.now();
    undoSet(next.session!, id);
    skipRest(next.session!);
    settleClock(next, current!, [id], now);
    commit(next);
  };

  const rateExercise = (id: ExerciseId, effort: EffortKey) => {
    const next = clone(state);
    answerEffort(next.session!, id, effort);
    commit(next);
  };

  const restControl = (cmd: 'more' | 'skip') => {
    const next = clone(state);
    if (cmd === 'more') extendRest(next.session!, 30, Date.now());
    else skipRest(next.session!);
    commit(next);
  };

  const setSessionView = (view: 'guided' | 'list') => {
    const next = clone(state);
    next.cfg.view = view;
    commit(next);
  };

  /** Licznik w pasku: pokazany albo schowany. Zegar sesji liczy tak czy inaczej. */
  const setClockPref = (on: boolean) => {
    const next = clone(state);
    next.cfg.clock = on;
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
    await say(T.levelUp, <LevelUp before={before} after={after} />, {
      ok: T.next,
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
    setToastMsg(T.snackSaved(snackLabel(snack), n <= XP.snackCap ? XP.snack : null, pick(SNACK_SAVED, n + next.snacks.length)));
    void (async () => {
      if (fresh.length) await sayBadges(fresh, metrics(next), T.atSnack);
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
    setToastMsg(T.snackDeleted(revoked));
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
  const logCardio = (input: CardioInput, day: string, kg: number | null, from: AppState = state) => {
    const before = levelNow(from);
    const next = clone(from);
    if (kg !== null) setBodyWeight(next, kg, dayKey(Date.now()));
    const { entry, replaced } = addCardio(next, input, day);
    // Nowa liczba kroków na ten sam dzień bywa poprawką literówki w dół — wtedy cofa progi,
    // których historia już nie uzasadnia, tak jak usunięcie wpisu.
    const revoked = replaced ? revokeUnmet(next, badgeCtx(next), (d) => d.group === 'cardio') : 0;
    const fresh = syncBadges(next, badgeCtx(next));
    commit(next);
    const b = cardioBurn(next, entry);
    const device = deviceStepsOn(next, day);
    const dayXp = (s: AppState): number => cardioXp(minutesByDay(s)[day] ?? 0);
    const gained = dayXp(next) - dayXp(from);
    setToastMsg(
      `${T.logged(cardioLabel(entry))}${b ? ` · ${kcalText(b.active)}` : ''}` +
        (gained > 0 ? ` · +${gained} XP` : dayXp(next) >= XP.cardioCap ? T.noXpDay : '') +
        '.' +
        (replaced ? T.stepsReplaced : '') +
        (entry.kind === 'steps' && device && device.steps > entry.steps
          ? T.deviceMore(device.src === 'phone', device.steps.toLocaleString(LOCALE))
          : '') +
        (revoked ? T.revokedNew(revoked) : '') +
        (b ? '' : T.kcalLater),
    );
    void (async () => {
      if (fresh.length) await sayBadges(fresh, metrics(next), T.atEntry);
      await sayLevel(before, next);
    })();
  };

  /**
   * Paczka z zegarka. Kroki i przejazdy liczą się jak wpisy: dają kalorie, minuty ruchu,
   * doświadczenie i odznaki. Nowa paczka może też obniżyć kroki dnia (zegarek poprawił
   * licznik), więc progi, których historia już nie uzasadnia, wracają — jak przy poprawce wpisu.
   */
  const applyDevice = (merge: (s: AppState) => boolean, from: string) => {
    // Zaczyna od `live.current`: paczki zegarka i telefonu przychodzą jedna po drugiej, zanim
    // React przerysuje, a druga z wersji sprzed pierwszej skasowałaby pierwszą.
    const base = live.current ?? state;
    // Paczka, która była w drodze, gdy ruszał trening, poczeka: następne sprawdzenie po
    // treningu przyniesie ją jeszcze raz, a okno z odznaką nie wskoczy w środek serii.
    if (base.session) return;
    const before = levelNow(base);
    const next = clone(base);
    if (!merge(next)) return;
    revokeUnmet(next, badgeCtx(next), (d) => d.group === 'cardio');
    const fresh = syncBadges(next, badgeCtx(next));
    commit(next);
    void (async () => {
      if (fresh.length) await sayBadges(fresh, metrics(next), from);
      await sayLevel(before, next);
    })();
  };
  onWatch.current = (p) => applyDevice((s) => mergeWatch(s, p), T.fromWatch);
  onPhone.current = (p) => applyDevice((s) => mergePhone(s, p), T.fromPhone);

  const checkWatch = async (): Promise<PullResult> => {
    const r = await pullWatch(true);
    if (r.kind === 'ok') onWatch.current(r.payload);
    return r;
  };

  const checkPhone = async (): Promise<PhonePull> => {
    const r = await pullPhone(true);
    if (r.kind === 'ok') onPhone.current(r.payload);
    return r;
  };

  /** Usunięcie wpisu to poprawka pomyłki — cofa progi kroków i cardio, które dała. */
  const deleteCardio = (key: string) => {
    const next = clone(state);
    if (!removeCardio(next, key)) return;
    const revoked = revokeUnmet(next, badgeCtx(next), (d) => d.group === 'cardio');
    commit(next);
    setToastMsg(T.entryDeleted(revoked));
  };

  /** Ważenie — dzisiejsze z karty ważenia i profilu, z dowolnego dnia z dziennika jedzenia. */
  const setWeight = (kg: number, day: string = dayKey(Date.now()), from: AppState = state) => {
    // Pierwsze ważenie obowiązuje też wstecz — ruch sprzed niego nie ma innej wagi.
    const first = !from.body?.length;
    const next = clone(from);
    const b = setBodyWeight(next, kg, day);
    commit(next);
    const when =
      day === dayKey(Date.now())
        ? null
        : new Date(`${day}T12:00:00`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' });
    setToastMsg(
      T.weightSaved(when) +
        `${b.kg.toLocaleString(LOCALE)} kg. ` +
        (first
          ? T.kcalFirst
          : when
            ? T.kcalFromDay
            : T.kcalFromToday),
    );
  };

  const deleteWeight = (day: string) => {
    const next = clone(state);
    if (!removeBodyWeight(next, day)) return;
    commit(next);
    setToastMsg(T.weighDeleted);
  };

  const setHeight = (cm: number | null, from: AppState = state) => {
    const next = clone(from);
    if (cm === null) delete next.cfg.height;
    else next.cfg.height = cm;
    commit(next);
    setToastMsg(cm === null ? T.heightRemoved : T.heightSaved(cm));
  };

  // Zapisy z ekranów jedzenia: te same funkcje co w treningach, ale od najświeższego stanu
  // i z tymi samymi granicami — liczba spoza zakresu kończy się komunikatem, a nie wyjątkiem.
  bridgeWrites.current = {
    setWeight: (kg, day) => {
      if (!DAY.test(day)) return;
      if (!validWeight(kg)) setToastMsg(T.weightRange(WEIGHT_RANGE.min, WEIGHT_RANGE.max));
      else setWeight(kg, day, live.current ?? state);
    },
    setHeight: (cm) => {
      if (!validHeight(cm)) setToastMsg(T.heightRange(HEIGHT_RANGE.min, HEIGHT_RANGE.max));
      else setHeight(Math.round(cm), live.current ?? state);
    },
    setSteps: (day, steps) => {
      const from = live.current ?? state;
      // Ta sama liczba co już wpisana to nie nowy wpis — bez zastępowania i bez komunikatu.
      if (!DAY.test(day) || typedStepsOn(from, day) === steps) return;
      try {
        logCardio({ kind: 'steps', steps }, day, null, from);
      } catch (e) {
        setToastMsg(e instanceof Error ? e.message : T.stepsFailed);
      }
    },
    skipWeigh: () => {
      const next = clone(live.current ?? state);
      next.cfg.weighSkip = weighDay();
      commit(next);
    },
  };

  const cancelSession = async () => {
    const ok = await ask(
      T.abandonQ,
      <p>{T.abandonText}</p>,
      T.abandon,
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
    // Serie z prowadzenia bez zamknięcia ćwiczenia też są wynikiem — trening skończony w połowie
    // ćwiczenia zapisuje to, co zrobione (`settleOpen`).
    const hasRows = (id: ExerciseId) => !session.skip[id] && (session.res[id]?.rows.length ?? 0) > 0;
    const logged = w.items.filter((i) => session.done[i.ex] || hasRows(i.ex));
    const missing = w.items.filter((i) => !session.done[i.ex] && !session.skip[i.ex] && !hasRows(i.ex));

    if (!logged.length) {
      const ok = await ask(
        T.noSaveQ,
        <p>{T.noSaveText}</p>,
        T.end,
        { who: 'siwy', mood: 'calm' },
      );
      if (!ok) return;
      const next = clone(state);
      next.session = null;
      commit(next);
      return;
    }

    const blocks = blocksOf(w.items);
    // Czas do pytania liczony teraz; do zapisu — po „Zamknij”, bo do tej chwili trening trwa.
    const sofar = timeOf(session, blocks, Date.now());

    const spike = ratio !== null && ratio > 1.5;
    const blockJump = (d !== null && d >= 11 && d < 21) || spike || session.ready === 'low';
    const reason = spike
      ? T.reasonSpike
      : session.ready === 'low'
        ? T.reasonLow
        : T.reasonBreak;

    const ok = await ask(
      T.finishQ,
      <>
        {missing.length ? (
          <>
            <p>{T.loggedOf(logged.length, w.items.length)}</p>
            <ul>
              {missing.map((i) => (
                <li key={i.ex}>— {ex(i.ex).name}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>{T.allDone(logged.length)}</p>
        )}
        {sofar && <p style={{ marginTop: 12 }}>{T.workoutTime(durationText(sofar.secs))}</p>}
        {session.deload ? (
          <p style={{ marginTop: 12 }}>{T.deloadFinish}</p>
        ) : blockJump && (
          <p style={{ marginTop: 12 }}>{T.jumpsPaused(reason)}</p>
        )}
      </>,
      T.finishOk,
      { who: 'gustaw', mood: 'tired' },
    );
    if (!ok) return;

    const before = levelNow(state);
    const xpBefore = xpSummary(state).total;
    const time = timeOf(session, blocks, Date.now());
    const next = clone(state);
    settleOpen(next.session!);
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
      wid: w.id,
      ...(session.deload ? { deload: true } : {}),
      ready: session.ready,
      items: logged.map((i) => ({
        id: i.ex,
        sets: next.session!.res[i.ex]!.rows,
        effort: next.session!.res[i.ex]!.effort,
      })),
      ...(time ? { time } : {}),
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
      title: T.done(w.name),
      lines: [
        T.exercisesInSession(logged.length),
        ...(timed(time) ? [T.onTraining(durationText(time.secs))] : []),
        T.totals(m.workouts, m.reps.toLocaleString(LOCALE)),
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
            <p>{T.changes}</p>
            <ul>
              {changes.map((c, i) => (
                <li key={i}>
                  {c.type === 'level' ? '▲' : c.type === 'down' ? '▼' : '·'} {c.text}
                </li>
              ))}
            </ul>
          </>
        ) : session.deload ? (
          <p>{T.deloadSaved}</p>
        ) : (
          <p>{T.noChanges}</p>
        )}
        {time && <TimeSummary time={time} />}
        <p className="xpline">
          {T.xpLine(gained, after.level, after.title, after.level > before.level, after.toNext)}
        </p>
        {burn ? (
          <>
            <p className="xpline">{T.burnLine(kcalText(burn.active), Math.round(burn.secs / 60))}</p>
            <p className="kcal-split">
              {burn.items.map((i) => `${ex(i.id).name} ${kcalText(i.active).replace('≈ ', '')}`).join(' · ')}
            </p>
          </>
        ) : (
          <p className="kcal-split">{T.noWeight}</p>
        )}
        <div className="after">
          <ShareButton subject={subject} label={T.shareResult} />
          <ShareButton
            subject={progressSubject(m, rankNow(next), m.workouts)}
            label={T.shareAll}
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
    context = T.sameSession,
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
        top.ach.tiers.length > 1 ? T.tier(top.tier, top.ach.tiers.length) : T.oneOff,
        top.ach.desc,
      ],
      punch: punchline(m.tonnage, m.reps, top.tier),
    };

    await say(
      T.earned(hits.length),
      <div ref={medalBox}>
        <Celebrate hits={hits} context={context} />
        <div className="after">
          <ShareButton subject={subject} medalRef={medalBox} label={T.shareBadge} />
          <SupportLine seed={top.tier + m.workouts} compact />
        </div>
      </div>,
      { ok: T.nice, tone: 'celebrate-box', cast: { who: 'gustaw', mood: BAND_MOOD[bandFor(top.tier, top.ach.tiers.length)] } },
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
      setToastMsg(T.twoWeights);
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
      T.remeasureQ,
      <p>{T.remeasureText}</p>,
      T.remeasure,
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
    setToastMsg(T.remeasured);
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
      title: T.planStarted(t.name),
      text:
        (opts.start > set ? T.firstDates(opts.start) : '') +
        (banked ? T.bankedPlan(banked) : ''),
    });
    syncBadges(next, badgeCtx(next));
    commit(next);
    go('#/plan', { top: true, replace: true });

    const first = snapshot(next)?.stats.next;
    await say(
      T.planSet,
      <>
        <p>{T.planSetLine(t.name, opts.start, first ? first.date : null)}</p>
        <p style={{ marginTop: 10 }}>{T.seeded(seeded)}</p>
        <p style={{ marginTop: 10 }}>{opts.policy === 'shift' ? T.policyShift : T.policyStrict}</p>
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
      T.freqQ(days),
      <p>{T.freqText}</p>,
      T.changePlan,
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
      title: T.freqEvent(days),
      text: T.bankedCalendar(banked),
    });
    commit(next);
    setToastMsg(T.freqChanged(days));
  };

  /**
   * Zmiana dni treningowych od dziś. Terminy sprzed zmiany zostają — razem z punktami,
   * serią i odznakami — bo kalendarz przed dziś liczy się ze starych dni.
   */
  const changeWeekdays = (days: number[]) => {
    if (!state.plan || !days.length) return;
    const next = clone(state);
    const today = dayKey(Date.now());
    next.plan = withWeekdays(next.plan!, today, days);
    next.events.push({
      id: `plan-days:${today}:${days.join('')}`,
      date: today,
      kind: 'plan-swap',
      title: T.daysEvent(days.map((d) => WD_NAME[d - 1]).join(', ')),
      text: T.daysEventText,
    });
    commit(next);
    setToastMsg(T.daysChanged);
  };

  const changePolicy = (policy: PlanPolicy) => {
    if (!state.plan) return;
    const next = clone(state);
    next.plan!.policy = policy;
    commit(next);
    setToastMsg(policy === 'shift' ? T.policyShiftSet : T.policyStrictSet);
  };

  const extendPlan = (weeks: number) => {
    if (!state.plan) return;
    const next = clone(state);
    next.plan = withExtension(next.plan!, weeks);
    const today = dayKey(Date.now());
    next.events.push({
      id: `plan-extend:${today}:${next.plan.extraWeeks}`,
      date: today,
      kind: 'plan-swap',
      title: T.extendEvent(weeks),
      text: T.extendEventText,
    });
    commit(next);
    setToastMsg(T.extended(weeks));
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
      T.stopQ,
      <p>{T.stopText}</p>,
      T.stop,
    );
    if (!ok) return;
    const next = clone(state);
    const banked = bankPoints(next);
    next.events.push({
      id: `plan-stop:${next.plan!.templateId}:${dayKey(Date.now())}`,
      date: dayKey(Date.now()),
      kind: 'plan-stop',
      title: T.stopped,
      text: T.stoppedText(banked),
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
    setToastMsg(T.workoutSaved(w.name));
  };

  /**
   * Trening użyty w planie własnym albo w uruchomionym planie nie znika po cichu — plan
   * wskazywałby wtedy dzień bez treningu. Najpierw trzeba zmienić plan.
   */
  const deleteWorkout = async (w: Workout) => {
    if (state.session?.workout === w.id) {
      setToastMsg(T.workoutRunning(w.name));
      return;
    }
    const inPlans = (state.plans ?? []).filter((p) => p.cycle.includes(w.id));
    const activeT = state.plan ? planOf(state, state.plan.templateId) : undefined;
    if (inPlans.length || activeT?.cycle.includes(w.id)) {
      setToastMsg(
        T.workoutInPlan(w.name, [...new Set([...inPlans, ...(activeT ? [activeT] : [])].map((p) => T.q(p.name)))].join(', ')),
      );
      return;
    }
    const ok = await ask(T.deleteWorkoutQ, <p>{T.deleteWorkoutText(w.name)}</p>, T.delete);
    if (!ok) return;
    const next = clone(state);
    next.workouts = next.workouts.filter((x) => x.id !== w.id);
    commit(next);
    go('#/treningi', { replace: true }); // i18n-ignore: trasa
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
        ? T.planSavedActive
        : T.planSaved(t.name),
    );
  };

  const deletePlan = async (t: PlanTemplate) => {
    if (state.plan?.templateId === t.id) {
      setToastMsg(T.planIsActive);
      return;
    }
    const ok = await ask(T.deletePlanQ, <p>{T.deletePlanText(t.name)}</p>, T.delete);
    if (!ok) return;
    const next = clone(state);
    next.plans = (next.plans ?? []).filter((x) => x.id !== t.id);
    commit(next);
    go(PLANS_PATH, { replace: true });
  };

  /*
   * Jedna kopia zapasowa: trening, a gdy dziennik jedzenia ma cokolwiek — także on, pod `diet`.
   * O tym rozstrzyga zawartość bazy, nie znacznik diety: dziennik bez profilu (wpisy, plan z Excela)
   * też musi trafić do pliku. Dieta siedzi w IndexedDB, więc jej moduł ładuje się dopiero tutaj;
   * z pustym dziennikiem plik wygląda jak dawniej. Gdy bazy nie da się odczytać, trening i tak
   * idzie do pliku — a komunikat mówi, czego w nim brakuje.
   */
  const exportData = async () => {
    let diet: unknown = null;
    let dietLost = false;
    try {
      diet = await import('./food/backup').then((m) => m.dietBackup());
    } catch {
      dietLost = true;
    }
    const blob = new Blob([JSON.stringify(diet ? { ...state, diet } : state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    if (dietLost) setToastMsg(T.noDiet);
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
        forgetSections();
        const diet = (parsed as AppState & { diet?: unknown }).diet;
        if (!diet) {
          setToastMsg(T.loaded);
          return;
        }
        void import('./food/backup')
          .then((m) => m.restoreDiet(diet))
          .then(
            () => setToastMsg(T.loadedDiet),
            () => setToastMsg(T.loadedNoDiet),
          );
      } catch {
        void say(T.loadFailed, <p>{T.loadFailedText}</p>);
      }
    };
    r.readAsText(f);
  };

  const resetAll = async () => {
    const watch = !!garminKey();
    const phone = !!phoneKey();
    // Pytanie wymienia dziennik jedzenia, gdy baza naprawdę coś ma — znacznik diety nie widzi
    // dziennika bez profilu. Gdy bazy nie da się odczytać, nie ma czego wymieniać.
    const food = await import('./food/backup').then((m) => m.hasFoodData()).catch(() => false);
    const ok = await ask(
      T.resetQ,
      <p>{T.resetText(food, watch, phone)}</p>,
      T.resetAll,
      { who: 'siwy', mood: 'wise' },
    );
    if (!ok) return;
    await store.clear();
    if (watch) await forgetWatch();
    if (phone) await forgetPhone();
    // Model zegarka wybrany w sprawdzaniu — też dane tej osoby, choć nie trafia do kopii.
    forgetWatchModel();
    // Jedzenie też: inaczej stare ważenia z diety wróciłyby do dziennika wagi przy następnym wejściu.
    await import('./food/backup').then((m) => m.clearFood()).catch(() => undefined);
    forgetSections();
    commit(freshState());
  };

  /* ---------- pasek aplikacji ---------- */

  // W trakcie sesji pasek aplikacji pokazuje postęp, a nie statystyki sprzed tygodni — to jedyna
  // liczba, której ktoś w połowie treningu naprawdę szuka.
  // Z zegarem sesja idzie część po części, więc pasek mówi też, która to część.
  const sessionProgress = current
    ? (state.cfg.view ?? 'guided') === 'guided'
      ? (() => {
          const steps = sessionSteps(state, current);
          const done = steps.filter((st) => (state.session!.res[st.ex]?.rows.length ?? 0) >= st.set).length;
          const sets = T.setOf(Math.min(done + 1, steps.length), steps.length);
          if (!state.session!.clock) return sets;
          const blocks = blocksOf(current.items);
          const c = cursorOf(steps, state.session!);
          return T.partOf(c >= 0 ? steps[c]!.block : blocks.length, blocks.length, sets);
        })()
      : T.listProgress(Object.keys(state.session!.done).length, current.items.length)
    : null;

  const subline = [
    d === null
      ? T.firstWorkout
      : d === 0
        ? T.lastToday
        : d === 1
          ? T.lastYesterday
          : T.lastDaysAgo(d),
    rate !== null ? T.perWeek(rate.toFixed(1)) : null,
    ratio !== null ? T.loadRatio(ratio.toFixed(2)) : null,
  ].filter(Boolean);

  const today = dayKey(Date.now());
  const screen = screenOf(route);
  const inSession = view === 'train' && !!current;
  const title = inSession ? current!.name : screen.title;
  const subtitle = inSession
    ? sessionProgress
    : view === 'train'
      ? new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
      : null;
  // Klucz strony: nowy ekran wjeżdża od nowa, ten sam ekran z nowymi danymi — nie. Sekcje
  // jedzenia to osobne ekrany, a zmiana samego zapytania (filtry, otwarty produkt) — ten sam.
  const pageKey =
    route.kind === 'tab'
      ? `tab:${route.tab}`
      : route.kind === 'food'
        ? `food:${route.section}`
        : route.kind === 'diet'
          ? `diet:${route.page}`
          : route.kind === 'restaurants'
            ? `restaurants:${route.chain ?? ''}`
            : `${route.kind}:${'id' in route ? (route.id ?? '') : ''}`;

  // Ostrzeżenie o zapisie stoi na każdym ekranie z danymi, także w Jedzeniu: waga i kroki z diety
  // idą do tego samego zapisu. Pozostałe paski (skok obciążenia, „Trenowałeś dzisiaj”) mówią
  // o treningu i zostają na zakładkach treningowych.
  const saveBrokenBanner = (
    <Banner
      notice={{
        level: 'warn',
        title: T.saveBroken,
        text: T.saveBrokenText,
      }}
    />
  );

  const snoozeSupport = () => {
    const next = clone(state);
    next.supportSnooze = snoozeUntil(today);
    commit(next);
    setToastMsg(T.snoozed);
  };

  const showInstall = () =>
    void say(
      T.home,
      <InstallSteps place={installPlace ?? 'safari'} reminders={pushConfigured()} />,
      { ok: T.gotIt },
    );

  const hideInstall = () => {
    const next = clone(state);
    next.installHidden = today;
    commit(next);
    setToastMsg(T.installHidden);
  };

  return (
    <>
      <TopBar
        title={title}
        subtitle={subtitle}
        parent={inSession ? null : screen.parent}
        strip={strip}
        onSnooze={snoozeSupport}
        install={installStrip ? { onOpen: showInstall, onHide: hideInstall } : null}
        settings={!screen.parent && !inSession}
        onFeedback={apiConfigured() ? () => setFeedbackOpen(true) : undefined}
        onContact={inSession ? undefined : () => setContactOpen(true)}
        clock={inSession && state.cfg.clock !== false ? (state.session!.clock?.begin ?? null) : null}
      />
      {contactOpen && (
        <ContactDialog
          onClose={closeContact}
          onFeedback={
            apiConfigured()
              ? () => {
                  setContactOpen(false);
                  setFeedbackOpen(true);
                }
              : undefined
          }
        />
      )}
      {feedbackOpen && (
        <FeedbackDialog
          state={state}
          onClose={closeFeedback}
          onSent={() => {
            setFeedbackOpen(false);
            setToastMsg(T.thanks);
          }}
        />
      )}

      {/* Most do danych treningowych dla całej strony, nie tylko dla Jedzenia: karta jedzenia stoi też na ekranie Dziś. */}
      <BridgeContext.Provider value={bridge}>
      <main className="page" key={pageKey}>
      {view !== null && (
      <div className="wrap">
        {saveBroken && saveBrokenBanner}
        {state.notice && <Banner notice={state.notice} />}
        {ratio !== null && ratio > 1.5 && (
          <Banner
            notice={{
              level: 'warn',
              title: T.spike,
              text: T.spikeText(ratio.toFixed(2)),
            }}
          />
        )}
        {!state.session && d === 0 && state.log.length > 0 && (
          <Banner
            notice={{
              level: 'warn',
              title: T.trainedToday,
              text: T.trainedTodayText,
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
          edits={{ onWeekdays: changeWeekdays, onPolicy: changePolicy, onExtend: extendPlan, onStart: startSession }}
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
      {route.kind === 'promo' && <PromoPage onToast={setToastMsg} />}
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
          (state.cfg.view ?? 'guided') === 'guided' ? (
          <GuidedSession
            state={state}
            workout={current}
            onReady={(r: ReadyKey) => {
              const next = clone(state);
              next.session!.ready = r;
              commit(next);
            }}
            onBegin={beginSession}
            onStartPart={startNextPart}
            onSkipPart={skipPart}
            onClockPref={setClockPref}
            onLogSet={logSet}
            onUndo={undoLastSet}
            onEffort={rateExercise}
            onRest={restControl}
            onSkip={skipExercise}
            onFinish={() => void finishSession()}
            onList={() => setSessionView('list')}
            onToast={setToastMsg}
          />
          ) : (
          <SessionView
            state={state}
            onGuided={() => setSessionView('guided')}
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
          )
        ) : (
          <SessionHome
            state={state}
            today={todayPlan}
            statsLine={subline.join(' · ')}
            onStart={startSession}
            onWeigh={(kg) => setWeight(kg)}
            onWeighSkip={() => {
              const next = clone(state);
              next.cfg.weighSkip = dayKey(Date.now());
              commit(next);
            }}
          />
        ))}

      {view === 'prog' && (
        <ProfileView
          state={state}
          onAvatar={setAvatar}
          onWeight={(kg, day) => setWeight(kg, day)}
          onHeight={(cm) => setHeight(cm)}
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
          key={`${route.id ?? ''}:${route.from ?? ''}:${route.add ?? ''}`}
          state={state}
          id={route.id}
          from={route.from}
          add={route.add}
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

      {isFoodRoute(route) && (
        <>
          {saveBroken && <div className="wrap">{saveBrokenBanner}</div>}
          <LoadBoundary what={T.foodTab}>
            <Suspense fallback={<div className="empty">{pick(LOADING, daySeed())}</div>}>
              <FoodRoot route={route} />
            </Suspense>
          </LoadBoundary>
        </>
      )}

      {view === 'set' && (
        <SettingsView
          state={state}
          onFeedback={apiConfigured() ? () => setFeedbackOpen(true) : undefined}
          onReminders={setReminders}
          onWatchSync={checkWatch}
          onPhoneSync={checkPhone}
          onToast={setToastMsg}
          onClockPref={setClockPref}
          onIntro={() => setReplayIntro(true)}
          onInstall={installPlace ? showInstall : undefined}
          onWeights={setWeights}
          onStartWeight={setStartWeight}
          onExport={exportData}
          onImport={importData}
          onReset={() => void resetAll()}
          onRecalibrate={() => void recalibrate()}
        />
      )}

      </main>
      </BridgeContext.Provider>

      <nav className="tabbar" aria-label={T.nav}>
        {TABS.map((t) => {
          const on = activeTab(route) === t.key;
          return (
            <a
              key={t.key}
              // Trening i Jedzenie wracają do ostatniej sekcji — adres liczy się przy każdym renderze.
              href={tabHref(t.key, { hasPlan: !!state.plan })}
              aria-current={on ? 'page' : 'false'}
              onClick={(e) => {
                // Stuknięcie w zakładkę, na której się jest, przewija na górę — jak w iOS i Androidzie.
                // Na korzeniu dowolnej sekcji tej zakładki, bo sekcja to jej ekran główny; z podstrony
                // odnośnik prowadzi do ostatniej sekcji.
                if (!on || !isTabRoot(currentPath())) return;
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
      {/* Nowa wersja czeka na koniec treningu: przeładowanie w środku serii zgubiłoby miejsce. */}
      <UpdateBar hold={!!state.session} />
      <Modal req={req} />
      <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />
    </>
  );
}
