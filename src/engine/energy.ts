import { EX } from '../data/exercises';
import { ISOLATION } from '../data/muscles';
import { say } from '../i18n';
import type { CardioInput, DanceMix, DanceStyle, ExerciseId } from '../types';

/**
 * Kalorie z ruchu.
 *
 * Wszystko idzie przez jedną wielkość: MET, czyli ile razy więcej energii niż w spoczynku.
 * Jeden MET to 3,5 ml tlenu na kilogram na minutę i w przybliżeniu 1 kcal na kilogram na
 * godzinę, więc kalorie to MET × waga × czas. Liczby MET pochodzą z dwóch źródeł:
 *
 * - **równania metaboliczne ACSM** — bieżnia (marsz i bieg, z nachyleniem) i rower stacjonarny
 *   z mocą w watach. To te same wzory, z których liczą kalorie same bieżnie i rowery,
 *   więc wynik da się porównać z wyświetlaczem;
 * - **Compendium of Physical Activities 2024** (pacompendium.com) — jazda na rowerze według
 *   prędkości, taniec i ćwiczenia siłowe. Kod aktywności stoi przy każdej liczbie.
 *
 * Aplikacja pokazuje kalorie **aktywne** — ponad to, co ciało spaliłoby w tym czasie, siedząc
 * (MET − 1). Tak liczy ACSM przy planowaniu wydatku energii i tak podaje „energię aktywną”
 * zegarek. Bieżnia i rower zwykle pokazują sumę razem ze spoczynkiem, dlatego formularz
 * podaje obie liczby. To szacunek: pomiar tlenu u konkretnej osoby potrafi odbiec o 20–30%.
 */

/** Tlen w spoczynku, ml/kg/min — definicja jednego MET-a. */
export const REST_VO2 = 3.5;

/** Kalorie aktywne, ponad spoczynek: (MET − 1) × kg × godziny. */
export const activeKcal = (met: number, kg: number, secs: number): number =>
  (Math.max(0, met - 1) * kg * secs) / 3600;

/** Kalorie razem ze spoczynkiem — tę liczbę pokazuje wyświetlacz bieżni i roweru. */
export const totalKcal = (met: number, kg: number, secs: number): number => (met * kg * secs) / 3600;

/**
 * Zaokrąglenie do wyświetlenia. Szacunek z dokładnością do kalorii udawałby precyzję, której
 * nie ma, więc większe liczby idą co 5; małe (przekąska, krótka seria) zostają co 1, bo
 * zaokrąglone do piątek zamieniłyby się w zera.
 */
export const roundKcal = (kcal: number): number =>
  kcal < 20 ? Math.round(kcal) : Math.round(kcal / 5) * 5;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const mPerMin = (kmh: number): number => (kmh * 1000) / 60;

/* ---------------- Bieżnia i kroki: równania ACSM ---------------- */

/** ACSM, marsz: VO2 = 0,1·v + 1,8·v·nachylenie + 3,5 (v w m/min, nachylenie jako ułamek). */
export const walkVO2 = (kmh: number, grade = 0): number =>
  0.1 * mPerMin(kmh) + 1.8 * mPerMin(kmh) * grade + REST_VO2;

/** ACSM, bieg: VO2 = 0,2·v + 0,9·v·nachylenie + 3,5. */
export const runVO2 = (kmh: number, grade = 0): number =>
  0.2 * mPerMin(kmh) + 0.9 * mPerMin(kmh) * grade + REST_VO2;

/**
 * Granice marszu i biegu. ACSM stosuje wzór na marsz do ok. 6 km/h, a na bieg od ok. 8 km/h;
 * pomiędzy każdy chodzi inaczej. Twarde przełączenie dawałoby skok z 4,8 na 8,6 MET przy
 * jednej dziesiątej km/h, więc w tym przedziale wynik przechodzi liniowo od jednego wzoru
 * do drugiego. Przy 7 km/h wychodzi 6,0 MET — trochę ponad bardzo szybki marsz, któremu
 * Compendium przy 6,4–7,1 km/h daje 5,5 (kod 17220).
 */
export const WALK_MAX_KMH = 6;
export const RUN_MIN_KMH = 8;

/** MET na bieżni. Nachylenie w procentach; w dół ACSM nie liczy, więc spadek traktujemy jak płasko. */
export function treadmillMet(kmh: number, gradePct = 0): number {
  const g = Math.max(0, gradePct) / 100;
  const t = clamp((kmh - WALK_MAX_KMH) / (RUN_MIN_KMH - WALK_MAX_KMH), 0, 1);
  const vo2 = walkVO2(kmh, g) * (1 - t) + runVO2(kmh, g) * t;
  return vo2 / REST_VO2;
}

/**
 * Długość kroku jako ułamek wzrostu — klasyczne 0,415 u mężczyzn i 0,413 u kobiet; bierzemy
 * środek. Bez wzrostu w profilu liczymy dla 170 cm, co daje krok 70 cm.
 */
export const STRIDE_RATIO = 0.414;
export const DEFAULT_HEIGHT = 170;
export const strideM = (heightCm?: number): number => ((heightCm ?? DEFAULT_HEIGHT) * STRIDE_RATIO) / 100;

/**
 * Kadencja przyjęta dla kroków z telefonu: 100 na minutę, próg marszu umiarkowanego.
 * Kalorie aktywne marszu prawie od niej nie zależą — we wzorze ACSM koszt ponad spoczynek
 * to 0,1 ml tlenu na kilogram na metr, więc liczy się droga, a nie tempo. Kadencja wyznacza
 * tylko czas, a czas wchodzi dopiero do sumy ze spoczynkiem.
 */
export const STEP_CADENCE = 100;

/* ---------------- Rower ---------------- */

/**
 * Compendium 2024, jazda na rowerze według prędkości (kody 01018–01060). Przedziały zamienione
 * na punkty w ich środkach i połączone liniowo — przedział „12–13,9 mph” jako próg dawałby
 * skok o 1,2 MET przy jednej dziesiątej km/h. Poza skrajnymi punktami wartość stoi w miejscu.
 */
export const BIKE_POINTS: readonly (readonly [kmh: number, met: number])[] = [
  [8.9, 3.5], //   5,5 mph, rekreacyjnie
  [15.1, 5.8], //  9,4 mph, rekreacyjnie
  [17.6, 6.8], // 10–11,9 mph, lekko
  [20.8, 8.0], // 12–13,9 mph, umiarkowanie
  [24.1, 10.0], // 14–15,9 mph, szybko
  [28.2, 12.0], // 16–19 mph, wyścigowo
  [33.8, 16.8], // ponad 20 mph, wyścigowo bez tunelu
];

export function bikeMet(kmh: number): number {
  const pts = BIKE_POINTS;
  if (kmh <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    if (kmh <= x1) {
      const [x0, y0] = pts[i - 1]!;
      return y0 + ((y1 - y0) * (kmh - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1]![1];
}

/**
 * ACSM, cykloergometr: VO2 = 1,8 · praca / masa + 3,5 + 3,5, gdzie praca w kgm/min to
 * waty × 6,12. Drugie 3,5 to koszt samego kręcenia bez oporu. Wzór zależy od wagi,
 * bo te same waty to ta sama praca — lżejszy wkłada w nie więcej względem swojej masy.
 * Tabela watów z Compendium daje przy 90–100 W 6,0 MET; wzór przy 100 W i 80 kg — 5,9.
 */
export const ergoMet = (watts: number, kg: number): number =>
  ((1.8 * watts * 6.12) / kg + 2 * REST_VO2) / REST_VO2;

/* ---------------- Zajęcia tańca ---------------- */

/**
 * MET samego tańca, z Compendium 2024. Para — salsa z partnerem (03090); bliżej zajęć w szkole
 * tańca niż towarzyski rekreacyjny (03042, 6,0), który zakłada taniec bez przerw. Solo —
 * balet, nowoczesny albo jazz na zajęciach (03010), najszerszy kod dla tańca bez partnera.
 */
export const DANCE_MET: Record<DanceStyle, number> = { pair: 4.8, solo: 5.0 };

/**
 * Część zajęć, która jest tańcem — środki przedziałów: cały czas w ruchu to 80–90%, pół na
 * pół 50%, dużo tłumaczenia 20–30%. Reszta to słuchanie instruktora i patrzenie, jak pokazuje.
 */
export const DANCE_SHARE: Record<DanceMix, number> = { full: 0.85, half: 0.5, talk: 0.25 };

/**
 * Słuchanie instruktora: stanie z przestępowaniem z nogi na nogę (Compendium 2024, 07041).
 * Spokojniej niż oddech po interwale (`RECOVERY_MET`), bo tu nie ma długu tlenowego do spłacenia.
 */
export const LISTEN_MET = 1.5;

/**
 * Średni MET zajęć — taniec i słuchanie ważone czasem. Kalorie są liniowe względem MET, więc
 * to samo, co policzyć oba kawałki osobno i dodać.
 */
export const danceMet = (style: DanceStyle, mix: DanceMix): number =>
  DANCE_SHARE[mix] * DANCE_MET[style] + (1 - DANCE_SHARE[mix]) * LISTEN_MET;

/* ---------------- Ruch wpisany ręcznie ---------------- */

export interface Burn {
  /** Czas ruchu w sekundach. Dla kroków — szacowany z kadencji. */
  secs: number;
  met: number;
  /** Kalorie ponad spoczynek. */
  active: number;
  /** Kalorie razem ze spoczynkiem. */
  total: number;
  /** Droga w km. Rower stacjonarny z mocą i taniec jej nie mają. */
  km: number | null;
}

const burn = (met: number, kg: number, secs: number, km: number | null): Burn => ({
  secs,
  met,
  active: activeKcal(met, kg, secs),
  total: totalKcal(met, kg, secs),
  km,
});

export function cardioEnergy(c: CardioInput, kg: number, heightCm?: number): Burn {
  switch (c.kind) {
    case 'steps':
      return stepsEnergy({ steps: c.steps, m: null, floors: null, parts: [], elsewhere: [] }, kg, heightCm);
    case 'treadmill':
      return burn(treadmillMet(c.kmh, c.grade), kg, c.min * 60, (c.kmh * c.min) / 60);
    case 'bike':
      return burn(bikeMet(c.kmh), kg, c.min * 60, (c.kmh * c.min) / 60);
    case 'ergo':
      return burn(ergoMet(c.watts, kg), kg, c.min * 60, null);
    case 'dance':
      return burn(danceMet(c.style, c.mix), kg, c.min * 60, null);
  }
}

/* ---------------- Kroki dnia z tym, co wie urządzenie ---------------- */

/**
 * Kadencja biegu, gdy trzeba zgadnąć, ile kroków dnia zabrał bieg, a urządzenie nie podało drogi
 * dnia: 160 na minutę, typowo dla biegaczy amatorów (150–170).
 */
export const RUN_CADENCE = 160;

/** Od tej prędkości odcinek liczy kroki kadencją biegu — środek przejścia z marszu w bieg. */
const RUN_STEP_KMH = (WALK_MAX_KMH + RUN_MIN_KMH) / 2;

/** Piętro według zegarków Garmin i Apple Zdrowie: ok. 3 m w górę (10 stóp). */
export const FLOOR_M = 3;

/**
 * ACSM, koszt wznoszenia w marszu: 1,8 ml tlenu na kilogram na każdy metr w górę — człon
 * nachylenia z równania na marsz (1,8 · v · nachylenie). Tylko w górę: schodzenia zegarek nie
 * podaje, a jego koszt jest kilka razy mniejszy.
 */
export const CLIMB_VO2_PER_M = 1.8;

/**
 * Średnia długość kroku dnia, przy której droga z urządzenia jest wiarygodna. Krótsza albo dłuższa
 * to błąd czujnika albo synchronizacji — wtedy droga idzie ze wzrostu. Bieg podnosi średnią
 * (krok biegowy to ok. metra), stąd górna granica wyżej niż sam marsz.
 */
export const STRIDE_LIMITS = [0.3, 1.5] as const;

/** Odcinek z własną drogą i czasem: bieg, marsz albo wędrówka zapisane na zegarku, albo bieżnia. */
export interface FootPart {
  m: number;
  sec: number;
}

/** Dzień kroków ze wszystkim, co poza liczbą wie o nim urządzenie. */
export interface StepsDay {
  steps: number;
  /** Droga dnia zmierzona przez urządzenie, m; `null` — liczona z kroków i wzrostu. */
  m: number | null;
  /** Piętra w górę, jak liczy je urządzenie. */
  floors: number | null;
  /** Aktywności pieszo z zegarka: każda liczy się swoją prędkością przez swój czas. */
  parts: readonly FootPart[];
  /**
   * Bieżnia wpisana osobno, której kroki urządzenie już policzyło. Jej kalorie liczy jej własny
   * wpis — tu tylko schodzi z drogi kroków, żeby nie policzyła się drugi raz.
   */
  elsewhere: readonly FootPart[];
}

export interface PartBurn {
  km: number;
  secs: number;
  kmh: number;
  met: number;
  active: number;
}

export interface StepsBurn extends Burn {
  /** Droga zwykłym marszem — to, co zostało po odcinkach. */
  walkKm: number;
  parts: PartBurn[];
  /** Wzniesienie z pięter, m, i jego kalorie. */
  climbM: number;
  climbKcal: number;
  /** Skąd droga: zmierzona przez urządzenie albo z długości kroku. */
  distance: 'device' | 'stride';
  /** Droga bieżni wpisanej osobno, która zeszła z kroków, km. */
  elsewhereKm: number;
}

const kmhOf = (p: FootPart): number => (p.m / p.sec) * 3.6;

/** Odcinek, który da się policzyć: jakaś droga, co najmniej minuta i ludzka prędkość pieszo. */
export const validPart = (p: FootPart): boolean =>
  p.m > 0 && p.sec >= 60 && kmhOf(p) >= 2 && kmhOf(p) <= 25;

/**
 * Kalorie z kroków dnia. Waga — z dnia ruchu. Droga — zmierzona przez urządzenie, gdy ją podało,
 * inaczej kroki razy krok ze wzrostu. Biegi, szybkie marsze i wędrówki z zegarka liczą się swoją
 * prędkością przez swój czas: bieg kosztuje na kilometr mniej więcej dwa razy tyle co marsz
 * (ACSM: 0,2 wobec 0,1 ml/kg/m), a marsz szybszy niż 6 km/h więcej niż spacer. Reszta drogi to
 * zwykły marsz, którego koszt na metr od tempa prawie nie zależy. Piętra dokładają wznoszenie.
 */
export function stepsEnergy(d: StepsDay, kg: number, heightCm?: number): StepsBurn {
  const stride = strideM(heightCm);
  const walkKmh = (stride * STEP_CADENCE * 60) / 1000;
  const parts = d.parts.filter(validPart);
  const elsewhere = d.elsewhere.filter(validPart);
  const taken = [...parts, ...elsewhere];
  const avg = d.m !== null && d.steps > 0 ? d.m / d.steps : null;
  const device = avg !== null && avg >= STRIDE_LIMITS[0] && avg <= STRIDE_LIMITS[1];
  // Bez drogi z urządzenia odcinki zabierają swoje kroki: bieg kadencją biegu, marsz swoją drogą.
  const stepsOf = (p: FootPart): number => (kmhOf(p) >= RUN_STEP_KMH ? (p.sec / 60) * RUN_CADENCE : p.m / stride);
  const restM = device
    ? Math.max(0, d.m! - taken.reduce((s, p) => s + p.m, 0))
    : Math.max(0, d.steps - taken.reduce((s, p) => s + stepsOf(p), 0)) * stride;

  const walkMet = treadmillMet(walkKmh);
  const walkSecs = restM / (walkKmh / 3.6);
  const partBurns: PartBurn[] = parts.map((p) => {
    const met = treadmillMet(kmhOf(p));
    return { km: p.m / 1000, secs: p.sec, kmh: kmhOf(p), met, active: activeKcal(met, kg, p.sec) };
  });
  const climbM = Math.max(0, d.floors ?? 0) * FLOOR_M;
  // Tlen na kalorie tak jak w MET: 3,5 ml/kg/min przez godzinę to 1 kcal na kilogram.
  const climbKcal = (CLIMB_VO2_PER_M * climbM * kg) / (REST_VO2 * 60);

  const secs = walkSecs + parts.reduce((s, p) => s + p.sec, 0);
  const active = activeKcal(walkMet, kg, walkSecs) + partBurns.reduce((s, p) => s + p.active, 0) + climbKcal;
  const total =
    totalKcal(walkMet, kg, walkSecs) +
    parts.reduce((s, p, i) => s + totalKcal(partBurns[i]!.met, kg, p.sec), 0) +
    climbKcal;
  return {
    secs,
    met: secs > 0 ? (total * 3600) / (kg * secs) : walkMet,
    active,
    total,
    km: restM / 1000 + partBurns.reduce((s, p) => s + p.km, 0),
    walkKm: restM / 1000,
    parts: partBurns,
    climbM,
    climbKcal,
    distance: device ? 'device' : 'stride',
    elsewhereKm: elsewhere.reduce((s, p) => s + p.m, 0) / 1000,
  };
}

/* ---------------- Ćwiczenia siłowe ---------------- */

/**
 * Jak ćwiczenie spala energię. MET z Compendium dla treningu oporowego to średnia z całej
 * sesji — razem z przerwami między seriami — więc czas liczy się z serii **i** przerw.
 * Wyjątkiem jest ruch ciągły (skakanka, ergometr, liny): tam MET opisuje samą pracę,
 * a przerwa idzie osobno, spokojniej (`restMet`).
 */
export interface EnergyProfile {
  met: number;
  /** Sekundy na powtórzenie. Ćwiczenia na czas mają sekundy wprost w wyniku. */
  tempo: number;
  /** Przerwa po serii w sekundach — typowa dla tego rodzaju pracy. */
  rest: number;
  /** MET przerwy przy ruchu ciągłym. Brak — przerwa liczy się po `met`. */
  restMet?: number;
  /** Kod aktywności w Compendium 2024. */
  code: string;
  /** Rodzaj pracy słowem — do opisu, skąd liczba. */
  label: string;
}

/** Oddech po interwale: między staniem w spokoju (1,3) a lekką krzątaniną (2,5). */
const RECOVERY_MET = 2;

const KB_BALLISTIC: EnergyProfile = { met: 9.8, tempo: 1.5, rest: 45, code: '02058', label: say('swingi kettlebell', 'kettlebell swings') };
const BALLISTIC: EnergyProfile = { met: 7.5, tempo: 2.5, rest: 60, code: '02020', label: say('ruch wybuchowy, intensywnie', 'explosive work, vigorous') };
const HEAVY: EnergyProfile = { met: 5.0, tempo: 3, rest: 120, code: '02052', label: say('przysiady i martwe ciągi', 'squats and deadlifts') };
const RESISTANCE: EnergyProfile = { met: 3.5, tempo: 3, rest: 75, code: '02054', label: say('trening oporowy, wiele ćwiczeń', 'resistance training, multiple exercises') };
const CALISTHENICS: EnergyProfile = { met: 3.8, tempo: 2.5, rest: 75, code: '02022', label: say('ćwiczenia z masą ciała', 'bodyweight exercises') };
const LIGHT: EnergyProfile = { met: 2.8, tempo: 2.5, rest: 45, code: '02024', label: say('brzuch, deska, łydki', 'abs, plank, calves') };
/** Compendium nie ma spaceru farmera; najbliżej jest noszenie ładunku 7–11 kg. */
const CARRY: EnergyProfile = { met: 6.0, tempo: 1, rest: 60, code: '17027', label: say('noszenie ciężaru', 'carrying a load') };

const continuous = (met: number, code: string, label: string): EnergyProfile => ({
  met,
  tempo: 1,
  rest: 60,
  restMet: RECOVERY_MET,
  code,
  label,
});

/** Ruch ciągły: MET samej pracy. Sanie nie mają własnego kodu — idą jak liny, intensywna kalistenika. */
const CONTINUOUS: Record<ExerciseId, EnergyProfile> = {
  rower: continuous(7.3, '02070', say('ergometr wioślarski', 'rowing ergometer')),
  bike: continuous(8.0, '01228', say('rower stacjonarny, 126–150 W', 'stationary bike, 126–150 W')),
  jumprope: continuous(11.0, '02068', say('skakanka', 'skipping rope')),
  ropes: continuous(7.5, '02020', say('liny bojowe', 'battle ropes')),
  sled: continuous(7.5, '02020', say('sanie', 'sled')),
  sled_drag: continuous(7.5, '02020', say('sanie', 'sled')),
};

const KB_BALLISTIC_IDS = new Set<ExerciseId>(['swing2', 'swing1', 'clean_kb', 'snatch_kb']);

/** Burpee jest w katalogu ćwiczeniem z masą ciała, ale Compendium wymienia je wprost przy 02020. */
const BALLISTIC_IDS = new Set<ExerciseId>(['burpee']);

const LIGHT_IDS = new Set<ExerciseId>([
  'dead_hang',
  'plank',
  'plank_side',
  'hollow',
  'copenhagen',
  'core',
  'deadbug',
  'calf',
  'calf1',
  'tibialis',
  'crunch_cable',
  'pallof',
  'russian',
]);

/** Grupy, w których grind to ciężki wielostawowy ruch nóg albo całego ciała. */
// i18n-ignore: nazwy grup z biblioteki ćwiczeń — klucze, nie tekst
const HEAVY_GROUPS = new Set(['Zawias biodrowy', 'Przysiad', 'Całe ciało']);

/** Wyjątki w tych grupach: izolacja na maszynie albo wyciągu. */
const ISOLATION_IDS = new Set<ExerciseId>(['legcurl', 'legext', 'pullthrough']);

/**
 * Tempo inne niż typowe dla rodzaju. Turecki wstaw to pół minuty na powtórzenie, a kompleks
 * to trzy ruchy w jednym — liczone po 3 sekundy wychodziłyby dziesięć razy za krótko.
 */
const TEMPO: Record<ExerciseId, number> = {
  clean_kb: 2,
  snatch_kb: 2,
  thruster: 2.5,
  wallball: 3,
  clean_jerk: 5,
  boxjump: 4,
  burpee: 4,
  tgu: 30,
  complex: 8,
  nordic: 4,
  pistol: 3.5,
  hspu: 3,
  lunge_walk: 2.5,
};

export function profileOf(id: ExerciseId): EnergyProfile {
  const e = EX[id];
  const base: EnergyProfile =
    CONTINUOUS[id] ??
    (KB_BALLISTIC_IDS.has(id)
      ? KB_BALLISTIC
      : !e
        ? RESISTANCE
        : e.mode === 'ballistic' || BALLISTIC_IDS.has(id)
          ? BALLISTIC
          : LIGHT_IDS.has(id)
            ? LIGHT
            : e.mode === 'carry'
              ? CARRY
              : e.mode === 'grind'
                ? HEAVY_GROUPS.has(e.group) && !ISOLATION_IDS.has(id)
                  ? HEAVY
                  : RESISTANCE
                : CALISTHENICS);
  const tempo = TEMPO[id];
  // Przerwa: wielostawowe 2 minuty, izolacje krócej — tak zaleca ACSM (2009): 2–3 minuty przy
  // ciężkich ruchach wielostawowych, 1–2 przy dodatkowych.
  const rest = base === RESISTANCE && !ISOLATION.has(id) ? 120 : base.rest;
  return tempo || rest !== base.rest ? { ...base, tempo: tempo ?? base.tempo, rest } : base;
}

export interface SetsBurn {
  /** Czas razem z przerwami, w sekundach. */
  secs: number;
  /** Sam czas pracy. */
  work: number;
  active: number;
}

/**
 * Kalorie z serii jednego ćwiczenia. Czas pracy bierze się z powtórzeń i tempa (albo wprost
 * z sekund), razy dwa przy ruchu na stronę; po każdej serii liczy się typowa przerwa.
 * Przekąska to jedna seria bez przerwy (`withRest = false`) — nikt nie odpoczywa po
 * dziesięciu przysiadach przy czajniku, tylko wraca do biurka.
 */
export function setsEnergy(
  id: ExerciseId,
  sets: readonly { reps: number }[],
  kg: number,
  withRest = true,
  /** Przerwa po serii, gdy trening ma własną — inaczej typowa dla rodzaju pracy. */
  restSecs?: number,
): SetsBurn {
  const e = EX[id];
  if (!e) return { secs: 0, work: 0, active: 0 };
  const p = profileOf(id);
  const sides = e.side ? 2 : 1;
  let work = 0;
  let n = 0;
  sets.forEach((s) => {
    const amount = Math.max(0, s.reps || 0);
    if (!amount) return;
    n++;
    work += (e.unit === 'secs' ? amount : amount * p.tempo) * sides;
  });
  const rest = withRest ? n * (restSecs ?? p.rest) : 0;
  return {
    secs: work + rest,
    work,
    active: activeKcal(p.met, kg, work) + activeKcal(p.restMet ?? p.met, kg, rest),
  };
}
