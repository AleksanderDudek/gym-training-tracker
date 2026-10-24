import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  HEIGHT_RANGE,
  WEIGHT_RANGE,
  bodyOf,
  weightTrend,
  heightOf,
  latestWeight,
  validHeight,
  validWeight,
  weightOn,
} from '../engine/body';
import { cardioBurn, cardioDays, dayBurn } from '../engine/burn';
import {
  BASE_STEPS,
  WHO_WEEK_MIN,
  activeMinutes,
  cardioOf,
  cardioOn,
  deviceStepsOn,
  inputProblem,
  lastOf,
  minutesByDay,
  normalize,
  entryEnergy,
  sportOf,
  stepsDayOf,
  stepsOn,
  typedStepsOn,
  weekMinutes,
} from '../engine/cardio';
import { phoneWeightOffer, recentPhoneDays } from '../engine/phone';
import { PHONE_NOTE, WATCH_NOTE } from './Health';
import { DeviceLine, LateNotes, onAnyCheck, useNow } from './DeviceStatus';
import { garminConfigured, watchConnected, watchStatus } from '../garmin';
import { phoneConnected, phoneStatus } from '../phone';
import { rememberedWatch } from '../watches/remember';
import { lacksText } from './WatchCheck.words';
import { XP, cardioXp } from '../engine/xp';
import {
  DANCE_SHARE,
  RUN_MIN_KMH,
  STEP_CADENCE,
  WALK_MAX_KMH,
  cardioEnergy,
  roundKcal,
  stepsEnergy,
} from '../engine/energy';
import { CARDIO_EMPTY, daySeed, pick } from '../engine/quips';
import { LOCALE } from '../i18n';
import { addDays, dayKey, weekdayOf } from '../engine/schedule';
import { WATCH_PATH, cardioAddPath, cardioPath, go, goBack } from '../routing';
import { Segmented, Trendline } from './ui';
import type { AppState, Cardio, CardioInput, CardioSport, DanceMix, DanceStyle, WatchHealth } from '../types';
import { T } from './Cardio.text';

/**
 * Kroki, bieżnia, rower i taniec — ruch mierzony gdzie indziej, wpisywany tutaj.
 *
 * Aplikacja w przeglądarce nie dostanie kroków z krokomierza telefonu, więc nie udaje, że
 * je mierzy. Droga jest ta sama co przy przekąskach: rodzaj → liczby z wyświetlacza → zapis,
 * a kalorie liczą się już w trakcie wpisywania, żeby dało się je porównać z bieżnią.
 */

export type LogCardio = (input: CardioInput, day: string, kg: number | null) => void;

const pl = (n: number, digits = 0): string =>
  n.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Liczba z wyświetlacza: jedna cyfra po przecinku tylko wtedy, gdy jest. */
const decimal = (v: number): string => pl(v, Number.isInteger(v) ? 0 : 1);

/** „≈ 245 kcal”. Tylda zostaje zawsze — to szacunek, a nie pomiar. */
export const kcalText = (kcal: number): string => `≈ ${roundKcal(kcal).toLocaleString(LOCALE)} kcal`;

export const kmText = (km: number): string => `${pl(km, 1)} km`;

export const durText = (secs: number): string => {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};

export const stepsText = (n: number): string => T.steps(n);

const DANCE_NAME: Record<DanceStyle, string> = T.danceName;

/** Odcinek z zegarka słowem, po prędkości: od środka przejścia marsz–bieg to już bieg. */
const partWord = (kmh: number): string =>
  kmh >= (WALK_MAX_KMH + RUN_MIN_KMH) / 2 ? T.run : kmh > WALK_MAX_KMH ? T.brisk : T.walk;

/**
 * Skąd kalorie kroków dnia, gdy urządzenie wiedziało więcej niż samą liczbę: „droga z zegarka
 * 12,0 km · bieg 6,0 km w 30 min (12,0 km/h) · 10 pięter · bez 5,0 km bieżni”. `null` przy samym
 * szacunku z kroków i wzrostu — wtedy nie ma czego rozpisywać.
 */
export function stepsDetail(state: AppState, c: Cardio): string | null {
  if (c.kind !== 'steps') return null;
  const d = stepsDayOf(state, c);
  // Droga i odcinki nie zależą od wagi — rozpis stoi także przed pierwszym ważeniem.
  const b = stepsEnergy(d, 70, heightOf(state));
  const floors = Math.round(b.climbM / 3);
  const parts = [
    b.distance === 'device' && d.m !== null ? T.deviceDistance(c.src === 'phone' ? 'phone' : 'watch', kmText(d.m / 1000)) : null,
    ...b.parts.map((p) => T.part(partWord(p.kmh), kmText(p.km), durText(p.secs), pl(p.kmh, 1))),
    floors > 0 ? T.floors(floors) : null,
    b.elsewhereKm > 0 ? T.elsewhere(kmText(b.elsewhereKm)) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Podział zajęć słowami użytkownika. Przedziały zamiast jednej liczby, bo tak się to pamięta;
 * w rachunku stoją ich środki (`DANCE_SHARE`).
 */
const MIX: Record<DanceMix, { name: string; share: string; short: string }> = T.mix;

/** „Bieżnia 6 km/h · 30 min · 3%”, „Rower 140 W · 45 min”, „8 421 kroków”, „Taniec w parze · 60 min · pół na pół”. */
export function cardioLabel(c: CardioInput): string {
  switch (c.kind) {
    case 'steps':
      return stepsText(c.steps);
    case 'treadmill':
      return T.treadmillLabel(decimal(c.kmh), c.min, c.grade ? decimal(c.grade) : null);
    case 'bike':
      return T.bikeLabel(decimal(c.kmh), c.min);
    case 'ergo':
      return T.ergoLabel(c.watts, c.min);
    case 'dance':
      return `${DANCE_NAME[c.style]} · ${c.min} min · ${MIX[c.mix].short}`;
  }
}

const paceWord = (kmh: number): string =>
  kmh < WALK_MAX_KMH ? T.walk : kmh < RUN_MIN_KMH ? T.briskOrJog : T.run;

/** Liczba z pola: przecinek albo kropka, bo polska klawiatura daje przecinek. Puste — NaN. */
const num = (s: string): number => {
  const t = s.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
};

const dm = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return T.dm(dd!, mm!);
};

const WEEKDAY = T.weekday;

const baseSteps = BASE_STEPS.toLocaleString(LOCALE);

/**
 * Minuty ruchu dnia i doświadczenie z nich. Przy suficie zdanie mówi wprost, że kolejny wpis
 * doda już tylko kalorie i postęp odznak — żeby nikt nie wpisywał dalej po punkty.
 */
function moveLine(state: AppState, day: string): string {
  const m = Math.floor(minutesByDay(state)[day] ?? 0);
  if (!m) return T.noMinutes(baseSteps);
  const xp = cardioXp(m);
  return T.minutes(m, xp, xp >= XP.cardioCap);
}

/**
 * Bieżący tydzień od poniedziałku na tle zalecenia WHO. Pasek zielony, bo zieleń znaczy tu
 * postęp — jak w punktach planu i paskach odznak.
 */
function WhoWeek({ state, today }: { state: AppState; today: string }) {
  const m = Math.floor(weekMinutes(state, today));
  const done = m >= WHO_WEEK_MIN;
  return (
    <>
      <div
        className="rank-bar"
        role="progressbar"
        aria-label={T.whoAria}
        aria-valuemin={0}
        aria-valuemax={WHO_WEEK_MIN}
        aria-valuenow={Math.min(m, WHO_WEEK_MIN)}
      >
        <i style={{ width: `${Math.max(2, Math.min(100, Math.round((m / WHO_WEEK_MIN) * 100)))}%` }} />
      </div>
      <p className="tight" style={{ marginBottom: 12 }}>
        {done ? T.whoDone(m, WHO_WEEK_MIN) : T.whoLeft(m, WHO_WEEK_MIN)}
      </p>
    </>
  );
}

/* ---------------- Link do sprawdzenia zegarka ---------------- */

/** Schowany „Nie pokazuj więcej” — tylko w tej przeglądarce. */
const LINK_HIDDEN = 'gt-watch-link-hidden';

const linkHidden = (): boolean => {
  try {
    return localStorage.getItem(LINK_HIDDEN) === '1';
  } catch {
    return false;
  }
};

/**
 * Cichy link do „Czy mój zegarek jest obsługiwany?” — tam, gdzie ktoś przepisuje kroki. Tylko gdy
 * build zna serwer (jest karta zegarka), a ani zegarek, ani telefon nie są połączone; raz schowany
 * nie wraca. Bez pamięci przeglądarki chowa się do końca wizyty.
 */
function WatchLink() {
  const [hidden, setHidden] = useState(linkHidden);
  if (hidden || !garminConfigured() || watchConnected() || phoneConnected()) return null;
  const hide = () => {
    try {
      localStorage.setItem(LINK_HIDDEN, '1');
    } catch {
      // Tryb prywatny albo zablokowana pamięć — link zniknie tylko na tę wizytę.
    }
    setHidden(true);
  };
  return (
    <p className="wc-entry">
      <a className="vidlink" href={WATCH_PATH}>
        {T.watchCheck}
      </a>
      <button type="button" className="wc-entry-x" aria-label={T.watchCheckHide} onClick={hide}>
        ×
      </button>
    </p>
  );
}

/* ---------------- Skróty ---------------- */

const SHORTCUTS: { sport: CardioSport; name: string; sub: string }[] = (
  ['steps', 'treadmill', 'bike', 'dance'] as const
).map((sport) => ({ sport, ...T.shortcuts[sport] }));

/** Wejścia do formularza, po jednym na rodzaj. Po zapisie przycisk mówi, co już dziś jest. */
function CardioShortcuts({ state, today }: { state: AppState; today: string }) {
  const todays = cardioOn(state, today);
  return (
    <div className="snack-exs">
      {SHORTCUTS.map((s) => {
        const mine = todays.filter((c) => sportOf(c) === s.sport);
        const now = mine.length
          ? s.sport === 'steps'
            ? T.today(stepsText(stepsOn(state, today)))
            : T.today(`${mine.length}×`)
          : null;
        return (
          <button
            key={s.sport}
            className={`snack-ex${now ? ' on' : ''}`}
            onClick={() => go(cardioAddPath(s.sport))}
            aria-label={T.shortcutAria(s.name, now)}
          >
            <span className="snack-ex-name">{s.name}</span>
            <span className={now ? 'snack-ex-now' : 'snack-ex-sub'}>{now ?? s.sub}</span>
            <span className="snack-ex-go" aria-hidden="true">
              +
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Karta na ekranie Dziś ---------------- */

/**
 * Karta pod przekąską. Licznik dnia wchodzi dopiero z pierwszym wpisem — zero kroków przy
 * pustym dniu to wyrzut, a nie zaproszenie; tak samo jak przy przekąskach. O połączeniu
 * z zegarkiem i telefonem mówi tylko wtedy, gdy dane się spóźniają.
 */
export function CardioCard({ state }: { state: AppState }) {
  const now = useNow(onAnyCheck);
  const today = dayKey(now);
  const n = cardioOn(state, today).length;
  const d = dayBurn(state, today);
  const steps = stepsOn(state, today);

  return (
    <div className="grp snackcard">
      <div className="today-tag light">{T.tag}</div>
      {n ? (
        <>
          <h2 className="today-name">
            {steps
              ? T.cardSteps(stepsText(steps), d ? kcalText(d.cardio) : null)
              : d
                ? T.cardKcal(kcalText(d.cardio))
                : T.cardEntries(n)}
          </h2>
          <p className="tight">{d ? T.cardBurn(d.workouts ? kcalText(d.workouts) : null) : T.cardNoKg}</p>
          <p className="tight">{moveLine(state, today)}</p>
        </>
      ) : (
        <>
          <h2 className="today-name">{T.cardEmpty}</h2>
          <p className="tight">{T.cardEmptyText}</p>
        </>
      )}
      <LateNotes state={state} now={now} />
      <CardioShortcuts state={state} today={today} />
      {cardioOf(state).length > 0 && (
        <a className="vidlink" href={cardioPath()}>
          {T.cardLink}
        </a>
      )}
    </div>
  );
}

/* ---------------- Formularz ---------------- */

const SPORTS: { key: CardioSport; label: string }[] = (['steps', 'treadmill', 'bike', 'dance'] as const).map(
  (key) => ({ key, label: T.sports[key] }),
);

const LEAD: Record<CardioSport, string> = T.lead;

const DANCE_STYLES: { key: DanceStyle; label: string }[] = (['pair', 'solo'] as const).map((key) => ({
  key,
  label: T.danceStyles[key],
}));

const MIX_OPTIONS = (Object.keys(MIX) as DanceMix[]).map((key) => ({
  key,
  label: (
    <>
      {MIX[key].name}
      <small>{MIX[key].share}</small>
    </>
  ),
}));

type When = 'today' | 'yesterday' | 'other';
type Fields = { steps: string; kmh: string; min: string; grade: string; watts: string; kg: string };

/**
 * Zapis kroków, bieżni, roweru albo zajęć tańca. Rodzaj przychodzi z adresu, ale da się go przełączyć
 * na miejscu — bez zmiany adresu, żeby „wstecz” po zapisie wracało tam, skąd ktoś przyszedł,
 * a nie do poprzedniego rodzaju. Pola są puste: podpowiedź mówi tylko, ile było ostatnio.
 */
export function CardioEntry({
  state,
  sport,
  onLog,
  onToast,
}: {
  state: AppState;
  sport: CardioSport;
  onLog: LogCardio;
  onToast: (m: string) => void;
}) {
  const today = dayKey(Date.now());
  const yesterday = addDays(today, -1);
  const lastBike = lastOf(state, 'bike');
  const lastErgo = lastOf(state, 'ergo');
  const [kind, setKind] = useState<CardioSport>(sport);
  // Kto ostatnio wpisywał waty, ten pewnie znów stoi przy rowerze stacjonarnym.
  const [bikeMode, setBikeMode] = useState<'kmh' | 'watts'>(
    lastErgo && (!lastBike || lastErgo.at > lastBike.at) ? 'watts' : 'kmh',
  );
  // Taniec i podział zajęć z ostatniego wpisu — ta sama szkoła zwykle uczy tak samo co tydzień.
  const lastDance = lastOf(state, 'dance');
  const [danceStyle, setDanceStyle] = useState<DanceStyle>(lastDance?.style ?? 'pair');
  const [danceMix, setDanceMix] = useState<DanceMix>(lastDance?.mix ?? 'half');
  const [when, setWhen] = useState<When>('today');
  const [other, setOther] = useState(addDays(today, -2));
  const [f, setF] = useState<Fields>({ steps: '', kmh: '', min: '', grade: '', watts: '', kg: '' });
  const set = (k: keyof Fields) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const day = when === 'today' ? today : when === 'yesterday' ? yesterday : other;
  const dayOk = /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today;
  const known = weightOn(state, day);
  const typedKg = num(f.kg);
  const kg = known ?? (validWeight(typedKg) ? typedKg : null);

  const filled = (...xs: string[]): boolean => xs.every((x) => x.trim() !== '');
  const inputOf = (): CardioInput | null => {
    switch (kind) {
      case 'steps':
        return filled(f.steps) ? { kind: 'steps', steps: num(f.steps) } : null;
      case 'treadmill':
        return filled(f.kmh, f.min)
          ? { kind: 'treadmill', kmh: num(f.kmh), min: num(f.min), grade: filled(f.grade) ? num(f.grade) : 0 }
          : null;
      case 'bike':
        if (bikeMode === 'kmh') return filled(f.kmh, f.min) ? { kind: 'bike', kmh: num(f.kmh), min: num(f.min) } : null;
        return filled(f.watts, f.min) ? { kind: 'ergo', watts: num(f.watts), min: num(f.min) } : null;
      case 'dance':
        return filled(f.min) ? { kind: 'dance', style: danceStyle, mix: danceMix, min: num(f.min) } : null;
    }
  };
  const input = inputOf();
  const clean = input ? normalize(input) : null;
  const problem = clean ? inputProblem(clean) : null;
  // Droga i czas nie zależą od wagi, więc bez niej liczymy je dla dowolnej — kalorii wtedy nie pokazujemy.
  const preview = clean && !problem ? cardioEnergy(clean, kg ?? 70, heightOf(state)) : null;
  // Wpis ręczny zastępuje się nowym; liczba z zegarka albo telefonu zostaje i wygrywa, jeśli jest wyższa.
  const prevSteps = kind === 'steps' && dayOk ? typedStepsOn(state, day) : 0;
  const device = kind === 'steps' && dayOk ? deviceStepsOn(state, day) : null;
  const deviceRides = kind === 'bike' && dayOk ? cardioOn(state, day).filter((c) => c.src && sportOf(c) === 'bike') : [];
  const mins =
    clean && !problem ? Math.floor(activeMinutes(state, { ...clean, key: '', day, at: '' })) : 0;
  const minsText =
    !clean || problem
      ? null
      : clean.kind === 'steps'
        ? mins
          ? T.minsSteps(mins, baseSteps)
          : T.minsStepsNone(baseSteps)
        : clean.kind === 'dance'
          ? mins
            ? T.minsDance(mins)
            : T.minsDanceNone
          : !mins
            ? T.minsLight
            : mins > clean.min
              ? T.minsVigorous(mins)
              : T.mins(mins);

  const lastSteps = lastOf(state, 'steps');
  const lastRun = lastOf(state, 'treadmill');
  const hintOf = (v: number | undefined): string => (v === undefined ? '' : T.last(decimal(v)));
  const lastTimed =
    kind === 'dance' ? lastDance : kind === 'treadmill' ? lastRun : bikeMode === 'kmh' ? lastBike : lastErgo;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!dayOk) {
      onToast(T.pickDay);
      return;
    }
    if (!clean) {
      onToast(
        kind === 'steps'
          ? T.enterSteps
          : kind === 'dance'
            ? T.enterDance
            : bikeMode === 'watts' && kind === 'bike'
              ? T.enterWatts
              : T.enterKmh,
      );
      return;
    }
    if (problem) {
      onToast(problem);
      return;
    }
    if (known === null && filled(f.kg) && !validWeight(typedKg)) {
      onToast(T.kgCheck(WEIGHT_RANGE.min, WEIGHT_RANGE.max));
      return;
    }
    onLog(clean, day, known === null && validWeight(typedKg) ? typedKg : null);
    goBack('#/sesja');
  };

  return (
    <>
      <div className="wrap">
        <p className="lead">{LEAD[kind]}</p>
      </div>

      <form className="grp cardio-entry" onSubmit={save} noValidate>
        <Segmented label={T.kindLabel} options={SPORTS} value={kind} onChange={setKind} />
        {kind === 'bike' && (
          <Segmented
            label={T.bikeShows}
            options={[
              { key: 'kmh', label: T.speedKmh },
              { key: 'watts', label: T.powerW },
            ]}
            value={bikeMode}
            onChange={setBikeMode}
          />
        )}
        {kind === 'dance' && (
          <>
            <Segmented label={T.dance} options={DANCE_STYLES} value={danceStyle} onChange={setDanceStyle} />
            <span className="seg-label" aria-hidden="true">
              {T.mixSeg}
            </span>
            <Segmented
              label={T.mixLabel}
              options={MIX_OPTIONS}
              value={danceMix}
              onChange={setDanceMix}
            />
          </>
        )}
        <span className="seg-label" aria-hidden="true">
          {T.when}
        </span>
        <Segmented
          label={T.dayLabel}
          options={[
            { key: 'today', label: T.todayOpt },
            { key: 'yesterday', label: T.yesterdayOpt },
            { key: 'other', label: T.otherOpt },
          ]}
          value={when}
          onChange={setWhen}
        />
        {when === 'other' && (
          <label className="fld">
            <span>{T.dayField}</span>
            <input type="date" max={today} value={other} onChange={(e) => setOther(e.target.value)} />
          </label>
        )}

        {kind === 'steps' && (
          <label className="fld cardio-main">
            <span>{T.stepsField}</span>
            <input
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min={1}
              autoFocus
              placeholder={lastSteps ? T.last(lastSteps.steps.toLocaleString(LOCALE)) : ''}
              value={f.steps}
              onChange={set('steps')}
            />
          </label>
        )}
        {/* Kto przepisuje kroki, ten najpewniej ma zegarek, który mógłby wysyłać je sam. */}
        {kind === 'steps' && <WatchLink />}

        {kind === 'dance' && (
          <label className="fld cardio-main">
            <span>{T.danceField}</span>
            <input
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min={1}
              autoFocus
              placeholder={hintOf(lastDance?.min)}
              value={f.min}
              onChange={set('min')}
            />
          </label>
        )}

        {kind !== 'steps' && kind !== 'dance' && (
          <div className="snack-row">
            {kind === 'bike' && bikeMode === 'watts' ? (
              <label className="fld">
                <span>{T.wattsField}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  autoFocus
                  placeholder={hintOf(lastErgo?.watts)}
                  value={f.watts}
                  onChange={set('watts')}
                />
              </label>
            ) : (
              <label className="fld">
                <span>{T.kmhField}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="num"
                  autoComplete="off"
                  autoFocus
                  placeholder={hintOf(kind === 'treadmill' ? lastRun?.kmh : lastBike?.kmh)}
                  value={f.kmh}
                  onChange={set('kmh')}
                />
              </label>
            )}
            <label className="fld">
              <span>{T.minField}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder={hintOf(lastTimed?.min)}
                value={f.min}
                onChange={set('min')}
              />
            </label>
          </div>
        )}

        {kind === 'treadmill' && (
          <label className="fld">
            <span>{T.gradeField}</span>
            <input
              type="text"
              inputMode="decimal"
              className="num"
              autoComplete="off"
              placeholder={lastRun?.grade ? T.last(decimal(lastRun.grade)) : ''}
              value={f.grade}
              onChange={set('grade')}
            />
          </label>
        )}

        {known === null && (
          <label className="fld cardio-kg">
            <span>{T.kgField}</span>
            <input
              type="text"
              inputMode="decimal"
              className="num"
              autoComplete="off"
              value={f.kg}
              onChange={set('kg')}
            />
          </label>
        )}

        {prevSteps > 0 && (
          <p className="tight cardio-note">{T.prevSteps(stepsText(prevSteps))}</p>
        )}
        {device && (
          <p className="tight cardio-note">{T.deviceSteps(device.src, stepsText(device.steps))}</p>
        )}
        {deviceRides.length > 0 && (
          <p className="tight cardio-note">
            {T.deviceRides(
              deviceRides.some((c) => c.src === 'watch') ? 'watch' : 'phone',
              deviceRides.map((c) => cardioLabel(c)).join(', '),
            )}
          </p>
        )}

        {preview && clean && (
          <div className="cardio-preview" aria-live="polite">
            {kg !== null ? (
              <>
                <div className="snack-today-num">{kcalText(preview.active)}</div>
                <p className="tight">
                  {T.aboveRest}
                  {clean.kind !== 'steps' &&
                    clean.kind !== 'dance' &&
                    T.withRest(kcalText(preview.total), clean.kind === 'treadmill' ? 'treadmill' : 'bike')}
                </p>
              </>
            ) : (
              <p className="tight">{T.noKgPreview}</p>
            )}
            <p className="tight">
              {clean.kind === 'steps'
                ? T.stepsPreview(kmText(preview.km ?? 0), durText(preview.secs), STEP_CADENCE)
                : clean.kind === 'dance'
                  ? T.dancePreview(Math.round(clean.min * DANCE_SHARE[clean.mix]), pl(preview.met, 1))
                  : [
                    preview.km !== null ? kmText(preview.km) : null,
                    clean.kind === 'treadmill' ? paceWord(clean.kmh) : null,
                    `${pl(preview.met, 1)} MET`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
            {minsText && <p className="tight">{minsText}</p>}
          </div>
        )}
        {problem && <p className="tight cardio-note warn">{problem}</p>}

        <button className="btn wide" type="submit">
          {T.save}
        </button>
      </form>

      <div className="wrap">
        <p className="hint cardio-foot">
          {kind === 'steps'
            ? T.footSteps
            : kind === 'dance'
              ? T.footDance
              : kind === 'treadmill'
                ? T.footTreadmill
                : T.footBike}
        </p>
      </div>
    </>
  );
}

/* ---------------- Historia ---------------- */

function CardioItem({ state, c, onDelete }: { state: AppState; c: Cardio; onDelete: (key: string) => void }) {
  const b = cardioBurn(state, c);
  // Droga nie zależy od wagi, więc stoi na liście także przed pierwszym ważeniem.
  const km = entryEnergy(state, c, 70).km;
  const detail = stepsDetail(state, c);
  // Wpis z zegarka albo telefonu nie ma krzyżyka: nie leży w zapisie, a urządzenie przyśle go znowu.
  return (
    <div className="cardio-item">
      <span className="cardio-name">
        {cardioLabel(c)}
        {c.src && <small className="watch-src"> · {T.fromSrc[c.src]}</small>}
        {detail && <small className="cardio-detail">{detail}</small>}
      </span>
      <span className="snack-amt">
        {[km !== null ? kmText(km) : null, b ? kcalText(b.active) : null].filter(Boolean).join(' · ')}
      </span>
      {c.src ? (
        <span aria-hidden="true" />
      ) : (
        <button className="snack-del" onClick={() => onDelete(c.key)} aria-label={T.deleteEntry(cardioLabel(c))}>
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Zdrowie z zegarka: siedem dni, najnowszy na górze. Same liczby, bez oceny — ta należy do lekarza.
 * Nad nimi, gdy zegarek jest połączony, jedna linia stanu połączenia — tu najczęściej widać, że
 * czegoś brakuje, więc tu też trzeba powiedzieć dlaczego.
 */
function WatchHealthDays({ state, today, now }: { state: AppState; today: string; now: number }) {
  const rows = Array.from({ length: 7 }, (_, i) => addDays(today, -i))
    .map((d) => state.watch?.health.find((h) => h.day === d))
    .filter((h): h is WatchHealth => !!h);
  const linked = watchConnected();
  if (!rows.length && !linked) return null;
  const range = (a: number | null, b: number | null): string =>
    a === null || b === null ? String(a ?? b) : a === b ? String(a) : `${a}–${b}`;
  // Model wybrany w sprawdzaniu, który części danych nie udostępnia — zanim ktoś zacznie ich szukać.
  const mine = rememberedWatch();
  return (
    <>
      <div className="sect-label">{T.fromWatch}</div>
      {linked && (
        <div className="wrap">
          <DeviceLine device="watch" status={watchStatus(state, now)} now={now} />
        </div>
      )}
      {mine?.lacks && (
        <div className="wrap">
          <p className="hint">{T.watchGaps(mine.name, lacksText(mine.lacks))}</p>
        </div>
      )}
      {rows.map((h) => (
        <div className="h-item" key={h.day}>
          <div className="h-date">{dm(h.day)}</div>
          <div className="h-detail">
            {[
              h.rhr !== null ? T.rhr(h.rhr) : null,
              h.hrMin !== null || h.hrMax !== null ? T.hr(range(h.hrMin, h.hrMax), h.hrAvg) : null,
              h.stress !== null ? T.stress(h.stress) : null,
              h.bbMin !== null || h.bbMax !== null ? `Body Battery ${range(h.bbMin, h.bbMax)}` : null,
              h.sleep !== null ? T.sleepScore(h.sleep) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="streak" />
        </div>
      ))}
      {rows.length > 0 && (
        <div className="wrap">
          <p className="hint" style={{ marginTop: 8 }}>
            {WATCH_NOTE}
          </p>
        </div>
      )}
    </>
  );
}

/** „7 h 12 min” — sen w minutach. */
export const sleepText = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

/** Zdrowie z telefonu: siedem dni, najnowszy na górze. Same liczby, bez oceny — jak z zegarka. Nad nimi linia stanu. */
function PhoneHealthDays({ state, today, now }: { state: AppState; today: string; now: number }) {
  const rows = recentPhoneDays(state, today, 7)
    .slice(0, 7)
    .map((h) => ({
      day: h.day,
      text: [
        h.rhr !== null ? T.rhr(h.rhr) : null,
        h.hrMin !== null || h.hrMax !== null
          ? T.hr(
              `${h.hrMin === null || h.hrMax === null ? (h.hrMin ?? h.hrMax) : h.hrMin === h.hrMax ? h.hrMin : `${h.hrMin}–${h.hrMax}`}`,
              h.hrAvg,
            )
          : null,
        h.sleep !== null && h.sleep > 0 ? T.sleep(sleepText(h.sleep)) : null,
        h.kg !== null ? T.weight(decimal(h.kg)) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }))
    .filter((r) => r.text);
  const linked = phoneConnected();
  if (!rows.length && !linked) return null;
  return (
    <>
      <div className="sect-label">{T.fromPhone}</div>
      {linked && (
        <div className="wrap">
          <DeviceLine device="phone" status={phoneStatus(state, now)} now={now} />
        </div>
      )}
      {rows.map((r) => (
        <div className="h-item" key={r.day}>
          <div className="h-date">{dm(r.day)}</div>
          <div className="h-detail">{r.text}</div>
          <div className="streak" />
        </div>
      ))}
      {rows.length > 0 && (
        <div className="wrap">
          <p className="hint" style={{ marginTop: 8 }}>
            {PHONE_NOTE}
          </p>
        </div>
      )}
    </>
  );
}

/** Siedem dni jako pasek — kalorie z całego ruchu, żeby było widać, jak rozkłada się tydzień. */
function KcalWeek({ state, today }: { state: AppState; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="snack-week" role="list" aria-label={T.kcalWeekAria}>
      {days.map((d) => {
        const b = dayBurn(state, d);
        const kcal = b ? roundKcal(b.total) : 0;
        return (
          <div
            key={d}
            role="listitem"
            className={`sw-day${kcal ? ' on' : ''}${d === today ? ' now' : ''}`}
            aria-label={`${WEEKDAY[weekdayOf(d)]} ${dm(d)}: ${kcal ? kcalText(b!.total) : T.noMove}`}
          >
            <b>{kcal || '·'}</b>
            <span>{WEEKDAY[weekdayOf(d)]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Kroki i cardio: dziś, tydzień, historia i to, jak liczymy. */
export function CardioPage({
  state,
  onDelete,
}: {
  state: AppState;
  onDelete: (key: string) => void;
}) {
  const [allHistory, setAllHistory] = useState(false);
  const now = useNow(onAnyCheck);
  const today = dayKey(now);
  const todays = cardioOn(state, today);
  const d = dayBurn(state, today);
  const latest = latestWeight(state);

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekSteps = week.reduce((s, x) => s + stepsOn(state, x), 0);
  const weekBurn = week.map((x) => dayBurn(state, x));
  const weekCardio = weekBurn.reduce((s, b) => s + (b?.cardio ?? 0), 0);
  const weekTotal = weekBurn.reduce((s, b) => s + (b?.total ?? 0), 0);

  const past = cardioDays(state).filter((x) => x < today);
  const shown = allHistory ? past : past.slice(0, 14);

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.pageLead}</p>
      </div>

      <div className="grp">
        <h2>{T.log}</h2>
        <p className="tight">{T.logHint}</p>
        <CardioShortcuts state={state} today={today} />
        <WatchLink />
        <p className="tight" style={{ marginTop: 8 }}>
          {latest ? T.kgFor(decimal(latest.kg), dm(latest.day)) : T.noKg}
        </p>
        <a className="vidlink" href="#/profil">
          {latest ? T.kgLink : T.noKgLink}
        </a>
      </div>

      <div className="sect-label">{T.todayLabel}</div>
      <div className="grp">
        {!todays.length && <p className="tight joke">{pick(CARDIO_EMPTY, daySeed())}</p>}
        <p className="tight">
          {todays.length
            ? `${stepsOn(state, today) ? T.todaySteps(stepsText(stepsOn(state, today))) : ''}${d ? T.todayKcal(kcalText(d.cardio)) : ''}`
            : T.todayNone}
          {d && (d.workouts || d.snacks)
            ? T.todayRest(kcalText(d.workouts), d.snacks ? kcalText(d.snacks) : null, kcalText(d.total))
            : ''}
        </p>
        {todays.length > 0 && <p className="tight">{moveLine(state, today)}</p>}
        {todays.map((c) => (
          <CardioItem key={c.key} state={state} c={c} onDelete={onDelete} />
        ))}
      </div>

      <div className="sect-label">{T.week}</div>
      <div className="grp">
        <WhoWeek state={state} today={today} />
        {latest ? (
          <KcalWeek state={state} today={today} />
        ) : (
          <p className="tight">{T.weekNoKg}</p>
        )}
        <p className="tight" style={{ marginTop: 10 }}>
          {weekSteps ? T.weekSteps(stepsText(weekSteps), stepsText(Math.round(weekSteps / 7))) : ''}
          {latest ? T.weekKcal(kcalText(weekCardio)) : ''}
          {latest && roundKcal(weekTotal) > roundKcal(weekCardio)
            ? T.weekTotal(kcalText(weekTotal))
            : latest
              ? '.'
              : ''}
        </p>
      </div>

      <WatchHealthDays state={state} today={today} now={now} />
      <PhoneHealthDays state={state} today={today} now={now} />

      {past.length > 0 && (
        <>
          <div className="sect-label">{T.earlier}</div>
          {shown.map((x) => {
            const list = cardioOn(state, x);
            const kcal = list.reduce((s, c) => s + (cardioBurn(state, c)?.active ?? 0), 0);
            return (
              <div className="h-item" key={x}>
                <div className="h-date">{dm(x)}</div>
                <div className="h-detail">{list.map((c) => cardioLabel(c)).join(' · ')}</div>
                <div className="streak">{latest ? kcalText(kcal) : list.length}</div>
              </div>
            );
          })}
          {past.length > shown.length && (
            <div className="wrap">
              <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setAllHistory(true)}>
                {T.showAll(past.length)}
              </button>
            </div>
          )}
        </>
      )}

      <div className="grp" style={{ marginTop: 14 }}>
        <h2>{T.howTitle}</h2>
        {T.how(baseSteps, XP.cardioPerMin, XP.cardioCap)}
      </div>
    </>
  );
}

/* ---------------- Profil: waga, wzrost i podsumowanie ---------------- */

/**
 * Waga i wzrost. Ważenie idzie do dziennika z datą, więc nowa liczba nie przelicza historii:
 * spacer sprzed pół roku liczy się z wagą sprzed pół roku.
 */
export function BodyCard({
  state,
  onWeight,
  onHeight,
  onDeleteWeight,
  onToast,
}: {
  state: AppState;
  /** Ważenie z karty jest dzisiejsze; ważenie z telefonu ma swój dzień. */
  onWeight: (kg: number, day?: string) => void;
  onHeight: (cm: number | null) => void;
  onDeleteWeight: (day: string) => void;
  onToast: (m: string) => void;
}) {
  const latest = latestWeight(state);
  const [kg, setKg] = useState('');
  const [cm, setCm] = useState(state.cfg.height ? String(state.cfg.height) : '');
  const recent = bodyOf(state).slice(-5).reverse();
  // Wykres z ostatnich 30 ważeń i średnia z tygodnia — dzień do dnia waga skacze z wodą.
  const weights = bodyOf(state).slice(-30).map((b) => b.kg);
  const today = dayKey(Date.now());
  const trend = weightTrend(state, today);
  const offer = phoneWeightOffer(state, today);

  const saveKg = (e: FormEvent) => {
    e.preventDefault();
    const v = num(kg);
    if (!validWeight(v)) {
      onToast(T.kgRange(WEIGHT_RANGE.min, WEIGHT_RANGE.max));
      return;
    }
    onWeight(v);
    setKg('');
  };

  const saveCm = (e: FormEvent) => {
    e.preventDefault();
    if (!cm.trim()) {
      onHeight(null);
      return;
    }
    const v = num(cm);
    if (!validHeight(v)) {
      onToast(T.cmRange(HEIGHT_RANGE.min, HEIGHT_RANGE.max));
      return;
    }
    onHeight(Math.round(v));
  };

  return (
    <div className="grp">
      <h2>{T.body}</h2>
      <p className="tight">
        {latest
          ? T.bodyLast(decimal(latest.kg), dm(latest.day), trend.avg !== null ? decimal(trend.avg) : null)
          : T.bodyNone}
      </p>
      {offer && (
        <div className="cardio-note phone-weight">
          <p className="tight">{T.phoneOffer(decimal(offer.kg), dm(offer.day))}</p>
          <button className="btn sm ghost" onClick={() => onWeight(offer.kg, offer.day)}>
            {T.phoneOfferBtn}
          </button>
        </div>
      )}
      {weights.length >= 3 && (
        <Trendline values={weights} label={T.trend(weights.length)} noun={T.trendNoun} fmt={(v) => decimal(v)} />
      )}
      <form className="body-row" onSubmit={saveKg} noValidate>
        <label className="fld">
          <span>{T.kgToday}</span>
          <input
            type="text"
            inputMode="decimal"
            className="num"
            autoComplete="off"
            placeholder={latest ? decimal(latest.kg) : ''}
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
        </label>
        <button className="btn sm" type="submit">
          {T.saveKg}
        </button>
      </form>
      <form className="body-row" onSubmit={saveCm} noValidate>
        <label className="fld">
          <span>{T.cmField}</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="170"
            value={cm}
            onChange={(e) => setCm(e.target.value)}
          />
        </label>
        <button className="btn sm ghost" type="submit">
          {T.saveCm}
        </button>
      </form>
      {recent.length > 1 && (
        <div className="body-list" aria-label={T.recentAria}>
          {recent.map((b) => (
            <div className="cardio-item" key={b.day}>
              <span className="cardio-name">{dm(b.day)}</span>
              <span className="snack-amt">{decimal(b.kg)} kg</span>
              <button
                className="snack-del"
                onClick={() => onDeleteWeight(b.day)}
                aria-label={T.deleteWeight(dm(b.day))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kroki i cardio w profilu: ostatni tydzień jednym zdaniem i wejście do pełnego ekranu. */
export function CardioSummary({ state }: { state: AppState }) {
  const today = dayKey(Date.now());
  const count = cardioOf(state).length;
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const steps = week.reduce((s, x) => s + stepsOn(state, x), 0);
  const kcal = latestWeight(state) ? week.reduce((s, x) => s + (dayBurn(state, x)?.cardio ?? 0), 0) : null;

  return (
    <div className="grp">
      <h2>{T.tag}</h2>
      <p className="tight">
        {count
          ? T.summary(
              stepsText(steps),
              kcal !== null ? kcalText(kcal) : null,
              Math.floor(weekMinutes(state, today)),
              WHO_WEEK_MIN,
              count,
            )
          : T.summaryNone}
      </p>
      <div style={{ marginTop: 10 }}>
        <button className="btn ghost sm" onClick={() => go(count ? cardioPath() : cardioAddPath())}>
          {count ? T.summaryBtn : T.summaryFirst}
        </button>
      </div>
    </div>
  );
}
