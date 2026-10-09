/** Sposób, w jaki ćwiczenie się progresuje. */
export type Mode =
  | 'grind' // rosną powtórzenia, potem ciężar
  | 'ballistic' // ruch wybuchowy: rosną serie, potem ciężar
  | 'carry' // rośnie czas, potem ciężar
  | 'stage' // masa ciała: rosną powtórzenia, potem etap trudności
  | 'body'; // masa ciała: rosną powtórzenia, potem serie

export type Unit = 'reps' | 'secs';

/**
 * Sprzęt decyduje o drabinie ciężaru. Sztanga idzie co 2,5–10 kg i zaczyna od gryfu,
 * kettlebell skacze co 4 kg, stos maszyny co 5 — jedna wspólna lista dawałaby ciężary,
 * których nie da się nałożyć.
 */
export type Gear = 'kettlebell' | 'dumbbell' | 'barbell' | 'machine' | 'band' | 'bodyweight';
export type EffortKey = 'easy' | 'solid' | 'max';
export type ReadyKey = 'low' | 'ok' | 'high';
export type StageKey = 'pullup' | 'pushup' | 'core' | 'pistol' | 'hspu';
export type ExerciseId = string;

export interface ExerciseDefaults {
  sets: number;
  minSets?: number;
  maxSets?: number;
  target: number;
  min: number;
  max: number;
  /** Ciężar startowy w kg. Brak oznacza ćwiczenie z masą ciała. */
  w?: number;
}

export interface Exercise {
  name: string;
  group: string;
  /** Sprzęt — wybiera drabinę ciężaru. Brak oznacza kettlebell, tak jak w pierwszej wersji. */
  gear?: Gear;
  mode: Mode;
  unit: Unit;
  /** Powtórzenia liczone osobno na każdą stronę. */
  side?: boolean;
  stages?: StageKey;
  def: ExerciseDefaults;
  hint: string;
}

/**
 * Faza pracy nad ćwiczeniem. `calib` to dochodzenie do poziomu startowego serią prób,
 * `work` to normalna progresja.
 */
export type Phase = 'calib' | 'work';

/** Trwające przejście na cięższy kettlebell — wchodzi seria po serii. */
export interface Transition {
  to: number;
  heavySets: number;
  reps: number;
}

export interface HistoryPoint {
  d: string;
  w: number | null;
  reps: number[];
  eff: EffortKey;
  e1rm: number | null;
}

/** Stan progresji pojedynczego ćwiczenia. */
export interface Progress {
  sets: number;
  target: number;
  min: number;
  max: number;
  minSets: number;
  maxSets: number;
  weight: number | null;
  stage: number | null;
  trans: Transition | null;
  /** Szacowany ciężar maksymalny na jedno powtórzenie. */
  e1rm: number | null;
  stalls: number;
  maxHolds: number;
  /** Faza: dochodzenie do poziomu startowego albo normalna progresja. */
  phase: Phase;
  /** Ile prób kalibracyjnych już poszło — zabezpieczenie przed kręceniem się w kółko. */
  calibRuns: number;
  /** Czy w najbliższej sesji ostatnia seria jest testem „ile dasz radę”. */
  probe: boolean;
  /** Sesje od ostatniego testu. */
  sinceProbe: number;
  /** Sesje z rzędu zamknięte na „Łatwo” — sygnał, że obciążenie jest za małe. */
  easyRun: number;
  hist: HistoryPoint[];
}

export interface SetResult {
  reps: number;
  w: number | null;
}

export interface ExerciseResult {
  rows: SetResult[];
  effort: EffortKey;
}

export interface Session {
  workout: string;
  started: string;
  ready: ReadyKey;
  /**
   * Sesja z tygodnia lżejszego w planie. Mniej serii, a wynik nie rusza poziomów ani w górę,
   * ani w dół — lżejszy tydzień ma dać odpocząć, a nie zostać źle oceniony.
   */
  deload?: boolean;
  res: Record<ExerciseId, ExerciseResult>;
  done: Record<ExerciseId, boolean>;
  skip: Record<ExerciseId, boolean>;
  /**
   * Zamiany na dziś: ćwiczenie z treningu → zamiennik (maszyna zajęta, brak sprzętu).
   * Sam trening zostaje bez zmian; wynik i progresja idą do ćwiczenia naprawdę zrobionego.
   */
  swap?: Record<ExerciseId, ExerciseId>;
}

export interface LogItem {
  id: ExerciseId;
  sets: SetResult[];
  effort: EffortKey;
}

export interface LogEntry {
  date: string;
  workout: string;
  ready: ReadyKey;
  items: LogItem[];
}

/**
 * Przekąska ruchowa: jedna seria jednego ćwiczenia poza treningiem — dziesięć przysiadów
 * przy biurku, deska w przerwie na kawę. Nie rusza poziomów ćwiczeń ani kalendarza planu,
 * bo dziesięć pompek nie jest treningiem; liczy się za to do odznak ćwiczeń i do punktów
 * doświadczenia postaci.
 */
export interface Snack {
  /** Klucz do usuwania. Znacznik czasu nie wystarczy — dwa szybkie stuknięcia bywają w tej samej ms. */
  key: string;
  /** Chwila zapisu, ISO. */
  at: string;
  ex: ExerciseId;
  /** Powtórzenia albo sekundy — zależnie od jednostki ćwiczenia. Przy ruchu na stronę: na stronę. */
  reps: number;
  /** Ciężar, jeśli był. Przekąska z masą ciała albo bez sprzętu ma `null`. */
  w: number | null;
}

/**
 * Ruch liczony gdzie indziej i wpisywany ręcznie: kroki z telefonu albo zegarka, bieżnia,
 * rower i zajęcia tańca. Aplikacja nie mierzy tego sama — przeglądarka nie ma dostępu do
 * krokomierza systemu — więc wpis to liczby przepisane z innego urządzenia albo z zegara
 * na ścianie sali, a kalorie liczą się z nich.
 */
export type CardioSport = 'steps' | 'treadmill' | 'bike' | 'dance';

/** Taniec w parze (salsa, bachata, towarzyski, swing) albo solo (jazz, nowoczesny, balet, hip-hop). */
export type DanceStyle = 'pair' | 'solo';

/**
 * Ile z zajęć to taniec, a ile słuchanie instruktora: cały czas w ruchu, pół na pół albo
 * głównie tłumaczenie. Zajęć nie mierzy żaden wyświetlacz, ale to każdy pamięta.
 */
export type DanceMix = 'full' | 'half' | 'talk';

/**
 * Co przepisano z urządzenia. Rower ma dwa warianty, bo licznik na zewnątrz pokazuje
 * prędkość, a rower stacjonarny — moc; prędkość na jego wyświetlaczu to umowna liczba.
 */
export type CardioInput =
  | { kind: 'steps'; steps: number }
  /** Nachylenie w procentach, jak na wyświetlaczu bieżni. Zero to płasko. */
  | { kind: 'treadmill'; kmh: number; min: number; grade: number }
  | { kind: 'bike'; kmh: number; min: number }
  | { kind: 'ergo'; watts: number; min: number }
  /** Czas całych zajęć — razem z tłumaczeniem, które `mix` potem odejmuje. */
  | { kind: 'dance'; style: DanceStyle; mix: DanceMix; min: number };

export type Cardio = CardioInput & {
  /** Klucz do usuwania — jak w przekąskach, ze znacznika czasu i numeru w tej samej ms. */
  key: string;
  /** Dzień ruchu, `yyyy-mm-dd`. Kroki wpisuje się często dzień później, więc to nie chwila zapisu. */
  day: string;
  /** Chwila zapisu, ISO — do kolejności na liście. */
  at: string;
  /** Wpis wyprowadzony z danych zegarka — nie leży w zapisie i nie da się go usunąć. */
  src?: 'watch';
};

/** Masa ciała z jednego dnia. Kalorie liczą się z wagi, która obowiązywała w dniu ruchu. */
export interface BodyWeight {
  /** `yyyy-mm-dd`. Jeden wpis na dzień — kolejny tego samego dnia go zastępuje. */
  day: string;
  kg: number;
}

/** Dzień z krokomierza zegarka. */
export interface WatchDay {
  /** `yyyy-mm-dd` według zegara zegarka. */
  day: string;
  steps: number;
  /** Droga w metrach, jak liczy ją zegarek. */
  m: number | null;
  floors: number | null;
  /** Minuty intensywności z zegarka. */
  active: number | null;
}

/** Aktywność zapisana na zegarku. Connect IQ podaje tylko rodzaj, start, czas i drogę. */
export interface WatchActivity {
  /** Start, sekundy od 1970. Klucz aktywności. */
  start: number;
  /** `Activity.Sport` (numeracja FIT): 1 bieg, 2 rower, 11 marsz… */
  sport: number;
  sec: number;
  m: number | null;
}

/** Zdrowie z zegarka w jednym dniu. `null` — zegarek tego nie mierzy albo leżał na stole. */
export interface WatchHealth {
  day: string;
  /** Średnie tętno spoczynkowe z 7 dni, tak jak podaje je zegarek. */
  rhr: number | null;
  hrMin: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  /** Średni stres dnia, 0–100. */
  stress: number | null;
  /** Body Battery: najniżej i najwyżej w ciągu dnia, 0–100. */
  bbMin: number | null;
  bbMax: number | null;
  /** Wynik snu z ostatniej nocy, 0–100. */
  sleep: number | null;
}

export interface WatchData {
  /** Czas wysłania ostatniej przyjętej paczki, s od 1970. Starsza paczka nic nie zmienia. */
  t: number;
  /** Kiedy ta przeglądarka ją odebrała, ISO. */
  got: string;
  days: WatchDay[];
  acts: WatchActivity[];
  health: WatchHealth[];
}

/**
 * Rodzaj treningu. Mówi, czego od niego oczekiwać, i steruje doradcą: od treningu „push”
 * nikt nie oczekuje ciągnięcia, a od całego ciała — tak.
 */
export type WorkoutKind =
  | 'full'
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'glutes'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'light';

/**
 * Sprzęt treningu: bez sprzętu (podłoga, ściana, krzesło, stół), kettlebell z masą ciała
 * albo pełna siłownia.
 */
export type WorkoutGear = 'none' | 'kb' | 'gym';

/**
 * Profil: trening ogólnorozwojowy z akcentem na jeden cel — podciąganie, chwyt, piłka nożna,
 * bieganie, padel i tenis albo zdrowe plecy.
 */
export type ProfileKey = 'podciaganie' | 'chwyt' | 'pilka' | 'bieganie' | 'padel' | 'plecy';

export interface Workout {
  id: string;
  name: string;
  /**
   * Ćwiczenia po kolei. `pair` — „na zmianę z poprzednim”: seria jednego, przerwa, seria
   * drugiego, przerwa, aż oba skończą serie. `circuit` — stacja obwodu: sąsiednie stacje idą
   * runda po rundzie. Brak obu oznacza serie pod rząd.
   */
  items: { ex: ExerciseId; pair?: boolean; circuit?: boolean }[];
  /** Przerwa po serii w sekundach dla serii pod rząd. Brak — z rodzaju ćwiczenia. */
  rest?: number;
  /** Przerwa po rundzie obwodu w sekundach. Brak — dwie minuty. */
  roundRest?: number;
  /** Brak u treningów zapisanych przed rodzajami — doradca stosuje wtedy tylko zasady ogólne. */
  kind?: WorkoutKind;
  gear?: WorkoutGear;
  /** Jedno–dwa zdania: dla kogo i po co. */
  desc?: string;
  /** Trening z profilu — ogólnorozwojowy z akcentem. */
  profile?: ProfileKey;
}

export interface Notice {
  level: 'warn' | 'good';
  title: string;
  text: string;
}

/** Płeć służy wyłącznie do doboru ciężarów startowych — program jest ten sam. */
export type Sex = 'f' | 'm' | 'any';

export type PlanLevel = 'zero' | 'base' | 'strong';

/**
 * Skąd plan: konfigurator klasyczny (poziom × płeć × częstotliwość), plan z celem
 * (30/60/90 dni) albo ułożony samodzielnie.
 */
export type PlanKind = 'classic' | 'goal' | 'own';

/** Gotowy plan treningowy: rotacja treningów rozpisana na tygodnie. */
export interface PlanTemplate {
  id: string;
  name: string;
  level: PlanLevel;
  sex: Sex;
  daysPerWeek: number;
  weeks: number;
  /** Mnożnik ciężarów startowych względem domyślnych obciążeń ćwiczeń. */
  loadFactor: number;
  /** Rotacja treningów. Sesja n dostaje `cycle[n % cycle.length]`. */
  cycle: string[];
  /** Dni tygodnia, 1 = poniedziałek … 7 = niedziela. */
  weekdays: number[];
  desc: string;
  /** Brak oznacza plan klasyczny — tak wyglądały wszystkie plany przed planami z celem. */
  kind?: PlanKind;
  /** Tygodnie lżejsze (deload), numerowane od 1. */
  deload?: number[];
  /** Co ile tygodni lżejszy — zapamiętane w planie własnym, żeby edycja długości go nie gubiła. 0 — wcale. */
  deloadEvery?: number;
  /** Cel jednym zdaniem. */
  goal?: string;
  /** Czego się spodziewać po tym czasie — uczciwie, z badań, bez obietnic z reklamy. */
  expect?: string;
  gear?: WorkoutGear;
  /** Etykieta długości („30 dni”) — tygodnie i tak liczą się z `weeks`. */
  days?: number;
  /** Plan ogólnorozwojowy z profilem. */
  profile?: ProfileKey;
}

/** Co się dzieje z treningiem, którego termin przepadł. */
export type PlanPolicy =
  /** Rotacja czeka: kolejny termin dostaje ten trening, który przepadł. */
  | 'shift'
  /** Rotacja idzie z kalendarzem: opuszczony trening przepada. */
  | 'fixed';

/** Plan uruchomiony przez użytkownika. */
export interface ActivePlan {
  templateId: string;
  /** Dzień startu, `yyyy-mm-dd`. */
  start: string;
  /** Dni tygodnia wybrane ręcznie. Brak albo pusta lista oznacza dni z szablonu. */
  weekdays?: number[];
  /** Brak oznacza `shift` — tak zachowują się plany zapisane przed tą opcją. */
  policy?: PlanPolicy;
  /** Sesje odhaczone ręcznie — poza tymi, które wynikają z historii treningów. */
  ticked: Record<number, true>;
  /**
   * Zmiany dni treningowych w trakcie planu, rosnąco po dniu. Każda działa od swojego dnia —
   * terminy sprzed niej zostają takie, jakie były, więc punkty i odznaki się nie przepisują.
   */
  changes?: { from: string; weekdays: number[] }[];
  /** Tygodnie dołożone na końcu ponad długość szablonu. */
  extraWeeks?: number;
}

/** Ustawienia wybrane w katalogu przy uruchamianiu planu. */
export interface PlanOptions {
  /** Dzień startu, `yyyy-mm-dd`. */
  start: string;
  weekdays: number[];
  policy: PlanPolicy;
  /** Mnożnik ciężarów startowych wybrany przy starcie. Brak — ten z szablonu. */
  loadFactor?: number;
}

/**
 * Stan terminu. `open` to termin po czasie, ale wciąż do nadrobienia w oknie łaski;
 * dopiero `missed` liczy się jako opuszczony.
 */
export type DayStatus = 'done' | 'open' | 'missed' | 'today' | 'future';

/** Jeden dzień rozpisanego planu. */
export interface PlannedDay {
  index: number;
  date: string;
  weekday: number;
  week: number;
  workout: string;
  /** Dni przerwy od poprzedniego treningu w planie. */
  gap: number;
  status: DayStatus;
  /** Dzień, w którym termin faktycznie zrealizowano. */
  filled: string | null;
  /** Ile dni po terminie. 0 znaczy w terminie. */
  late: number;
  /** Termin z tygodnia lżejszego. */
  deload: boolean;
  /** Skąd wiadomo, że termin zrealizowany: z historii treningów czy z ręcznego odhaczenia. */
  source: 'log' | 'tick' | null;
}

/** Rodzaj wpisu w dzienniku. */
export type EventKind =
  | 'plan-start'
  | 'plan-stop'
  | 'plan-swap'
  | 'done'
  | 'late'
  | 'extra'
  | 'missed'
  | 'badge'
  | 'week';

/** Jedno zdarzenie w dzienniku planu. */
export interface PlanEvent {
  /** Klucz idempotentny — to samo zdarzenie nie wpada dwa razy. */
  id: string;
  /** Dzień zdarzenia, `yyyy-mm-dd`. */
  date: string;
  kind: EventKind;
  title: string;
  text?: string;
  points?: number;
}

/** Rodzina odznak. Każda ma kilka progów, więc jedna rzecz ma ciąg dalszy zamiast końca. */
export type AchGroup =
  /** Sumy z całej historii: treningi, serie, powtórzenia, tonaż. */
  | 'dorobek'
  /** Rekordy z okna czasu: najlepszy dzień, tydzień, miesiąc, kwartał, półrocze, rok. */
  | 'szczyty'
  /** Objętość w rozbiciu na partie ruchu. */
  | 'partie'
  /** Regularność i trzymanie poziomu w dłuższym czasie. */
  | 'utrzymanie'
  /** Przekąski ruchowe: ile, jak często, jak różnorodnie. */
  | 'przekaski'
  /** Kroki, bieżnia, rower i taniec: suma, dni z celem, tygodnie według WHO, ciąg dni w ruchu. */
  | 'cardio'
  /** Odznaki pojedynczego ćwiczenia: dzień, tydzień, miesiąc i suma — z treningów i przekąsek. */
  | 'cwiczenia'
  /** Terminy planu: seria, realizacja, domknięte tygodnie. */
  | 'terminy';

export interface Achievement {
  /** Identyfikator rodziny. Klucz konkretnego progu to `id:numer`. */
  id: string;
  group: AchGroup;
  name: string;
  desc: string;
  /** Napis na medalu, gdy rodzina nie ma piktogramu — zwykle długość okna, np. „30D”. */
  mark: string;
  /** Nazwa piktogramu z rejestru odznak. Brak oznacza medal z napisem. */
  art?: string;
  /** Puenta. Stoi obok opisu, nigdy zamiast niego — żart nie może zjeść informacji. */
  quip?: string;
  /** Progi rosnąco. Jeden próg oznacza odznakę zerojedynkową. */
  tiers: number[];
  /** Jednostka dopisywana do progu, np. „powtórzeń”. */
  unit?: string;
}

/** Zdobyty próg razem z rodziną, do której należy. */
export interface AchievementHit {
  ach: Achievement;
  /** Numer progu liczony od jedynki. */
  tier: number;
  threshold: number;
}

/**
 * Trwały dorobek. Punkty z trwającego planu liczą się na bieżąco z kalendarza,
 * więc zapisywać trzeba tylko to, czego nie da się odtworzyć: dorobek z planów
 * zamkniętych i daty odblokowania odznak.
 */
export interface Award {
  /** Punkty z wcześniejszych, już zamkniętych planów. */
  banked: number;
  /** Klucz progu (`rodzina:numer`) i dzień jego zdobycia. */
  badges: Record<string, string>;
}

export interface AppState {
  cfg: {
    /** Drabina kettlebli. Osobne pole, bo to jedyna lista, którą użytkownik sam edytuje. */
    weights: number[];
    /** Drabiny pozostałego sprzętu. Brak oznacza wartości domyślne. */
    ladders?: Partial<Record<Gear, number[]>>;
    /** Postać, która rośnie razem z punktami doświadczenia. Brak oznacza Gustawa. */
    avatar?: 'gustaw' | 'gosia';
    /** Wzrost w cm — tylko do długości kroku. Brak oznacza przeciętne 170 cm. */
    height?: number;
    /**
     * Które przypomnienia wysyłać, gdy na tym telefonie są włączone. Sama subskrypcja należy
     * do urządzenia i w zapisie jej nie ma — import danych na innym telefonie przenosi tylko wybór.
     */
    reminders?: ReminderPrefs;
  };
  prog: Record<ExerciseId, Progress>;
  workouts: Workout[];
  /** Plany ułożone samodzielnie. Gotowe plany mieszkają w kodzie, nie w zapisie. */
  plans?: PlanTemplate[];
  session: Session | null;
  log: LogEntry[];
  /** Przekąski ruchowe — osobno od dziennika, bo dziennik to treningi, a plan liczy się z niego. */
  snacks: Snack[];
  /** Kroki, bieżnia, rower i taniec wpisane ręcznie. Osobno od dziennika — to nie trening siłowy. */
  cardio: Cardio[];
  /** Waga ciała w czasie, rosnąco po dniu. Z niej liczą się kalorie. */
  body: BodyWeight[];
  /** Dane z zegarka Garmin: liczby, nie wpisy — wpisy ruchu wyprowadza z nich `cardioOf`. */
  watch?: WatchData;
  plan: ActivePlan | null;
  notice: Notice | null;
  /** Dziennik zdarzeń, których nie da się odtworzyć z kalendarza. */
  events: PlanEvent[];
  award: Award;
  /** Dzień, w którym wprowadzenie zostało przejrzane albo pominięte. */
  introSeen?: string;
  /** Do którego dnia (`yyyy-mm-dd`, bez niego) schowany jest pasek wsparcia na górze. */
  supportSnooze?: string;
}

/** Przypomnienia: rano w dni treningu z planu, wieczorem o krokach i ruchu z dnia. */
export interface ReminderPrefs {
  morning: boolean;
  evening: boolean;
}

/** Pojedyncza zmiana poziomu po zamkniętym treningu. */
export interface Change {
  type: 'reps' | 'level' | 'down' | 'hold' | 'held' | 'cap';
  text: string;
}

/** Jedna przepisana seria: ile powtórzeń i jakim ciężarem. */
export interface PlannedSet {
  w: number | null;
  reps: number;
  heavy?: boolean;
  /** Seria bez sztywnego celu: robisz tyle, ile dasz radę, zostawiając zapas. */
  amrap?: boolean;
}

export type View = 'train' | 'prog' | 'work' | 'set';

/** Zakładka w dolnej nawigacji. */
export type TabKey = View | 'atlas' | 'plan' | 'ach';

/** Trasa aplikacji. Podstrona ćwiczenia ma własny adres, więc da się ją wysłać komuś linkiem. */
export type Route =
  | { kind: 'tab'; tab: TabKey }
  | { kind: 'atlas' }
  | { kind: 'exercise'; id: ExerciseId }
  /** Historia jednego ćwiczenia w profilu — inna strona niż jego opis w atlasie. */
  | { kind: 'exstats'; id: ExerciseId }
  /** Przekąski ruchowe: dzisiejsze, tydzień i historia. */
  | { kind: 'snacks' }
  /** Zapis jednej przekąski. Z identyfikatorem — od razu z tym ćwiczeniem, bez wyboru. */
  | { kind: 'snackAdd'; id?: ExerciseId | undefined }
  /** Podgląd treningu: ćwiczenia, serie, mięśnie, doradca i start. */
  | { kind: 'workout'; id: string }
  /** Kreator treningu: nowy, kopia gotowego (`from`) albo edycja własnego (`id`). */
  | { kind: 'workoutEdit'; id?: string | undefined; from?: string | undefined }
  /** Katalog planów: z celem, klasyczny i własne. */
  | { kind: 'plans' }
  /** Konfigurator klasycznego planu z kettlebell. */
  | { kind: 'planClassic' }
  /** Podgląd planu z celem albo własnego razem ze startem. */
  | { kind: 'planDetail'; id: string }
  /** Kreator planu: nowy albo edycja własnego. */
  | { kind: 'planEdit'; id?: string | undefined }
  /** Kroki, bieżnia, rower i taniec: dziś, tydzień, historia i kalorie. */
  | { kind: 'cardio' }
  /** Zapis kroków, bieżni, roweru albo zajęć tańca. Bez rodzaju — kroki, bo to najczęstszy wpis. */
  | { kind: 'cardioAdd'; sport?: CardioSport | undefined };

/** Materiał wideo pokazujący technikę ćwiczenia. */
export interface VideoRef {
  /** Identyfikator filmu w YouTube. */
  id: string;
  title: string;
  channel: string;
  /** Język nagrania — na karcie stoi znacznik, żeby nikt nie klikał w ślepo. */
  lang: 'pl' | 'en';
  /** Długość w sekundach. */
  secs: number;
}

/** Dwie listy filmów dla jednego ćwiczenia. */
export interface ExerciseVideos {
  /** Najpopularniejsze nagrania techniki, bez względu na sprzęt. */
  main: VideoRef[];
  /** To samo ćwiczenie w wariancie z kettlebell. */
  kb: VideoRef[];
}
