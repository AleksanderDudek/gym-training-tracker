import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  HEIGHT_RANGE,
  WEIGHT_RANGE,
  bodyOf,
  heightOf,
  latestWeight,
  validHeight,
  validWeight,
  weightOn,
} from '../engine/body';
import { cardioBurn, cardioDays, dayBurn } from '../engine/burn';
import { cardioOf, cardioOn, inputProblem, lastOf, normalize, sportOf, stepsOn } from '../engine/cardio';
import { RUN_MIN_KMH, STEP_CADENCE, WALK_MAX_KMH, cardioEnergy, roundKcal } from '../engine/energy';
import { CARDIO_EMPTY, daySeed, pick, plural } from '../engine/quips';
import { addDays, dayKey, weekdayOf } from '../engine/schedule';
import { cardioAddPath, cardioPath, go, goBack } from '../routing';
import { Segmented } from './ui';
import type { AppState, Cardio, CardioInput, CardioSport } from '../types';

/**
 * Kroki, bieżnia i rower — ruch mierzony gdzie indziej, wpisywany tutaj.
 *
 * Aplikacja w przeglądarce nie dostanie kroków z krokomierza telefonu, więc nie udaje, że
 * je mierzy. Droga jest ta sama co przy przekąskach: rodzaj → liczby z wyświetlacza → zapis,
 * a kalorie liczą się już w trakcie wpisywania, żeby dało się je porównać z bieżnią.
 */

export type LogCardio = (input: CardioInput, day: string, kg: number | null) => void;

const pl = (n: number, digits = 0): string =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Liczba z wyświetlacza: jedna cyfra po przecinku tylko wtedy, gdy jest. */
const decimal = (v: number): string => pl(v, Number.isInteger(v) ? 0 : 1);

/** „≈ 245 kcal”. Tylda zostaje zawsze — to szacunek, a nie pomiar. */
export const kcalText = (kcal: number): string => `≈ ${roundKcal(kcal).toLocaleString('pl-PL')} kcal`;

export const kmText = (km: number): string => `${pl(km, 1)} km`;

export const durText = (secs: number): string => {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};

const STEP_FORMS = ['krok', 'kroki', 'kroków'] as const;
export const stepsText = (n: number): string => `${n.toLocaleString('pl-PL')} ${plural(n, STEP_FORMS)}`;

/** „Bieżnia 6 km/h · 30 min · 3%”, „Rower 140 W · 45 min”, „8 421 kroków”. */
export function cardioLabel(c: CardioInput): string {
  switch (c.kind) {
    case 'steps':
      return stepsText(c.steps);
    case 'treadmill':
      return `Bieżnia ${decimal(c.kmh)} km/h · ${c.min} min${c.grade ? ` · ${decimal(c.grade)}%` : ''}`;
    case 'bike':
      return `Rower ${decimal(c.kmh)} km/h · ${c.min} min`;
    case 'ergo':
      return `Rower ${c.watts} W · ${c.min} min`;
  }
}

const paceWord = (kmh: number): string =>
  kmh < WALK_MAX_KMH ? 'marsz' : kmh < RUN_MIN_KMH ? 'szybki marsz albo trucht' : 'bieg';

/** Liczba z pola: przecinek albo kropka, bo polska klawiatura daje przecinek. Puste — NaN. */
const num = (s: string): number => {
  const t = s.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
};

const dm = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return `${dd}.${mm}`;
};

const WEEKDAY = ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

/* ---------------- Skróty ---------------- */

const SHORTCUTS: { sport: CardioSport; name: string; sub: string }[] = [
  { sport: 'steps', name: 'Kroki z telefonu', sub: 'liczba z całego dnia' },
  { sport: 'treadmill', name: 'Bieżnia', sub: 'prędkość, czas i nachylenie' },
  { sport: 'bike', name: 'Rower', sub: 'prędkość albo moc i czas' },
];

/** Trzy wejścia do formularza. Po zapisie przycisk mówi, co już dziś jest. */
function CardioShortcuts({ state, today }: { state: AppState; today: string }) {
  const todays = cardioOn(state, today);
  return (
    <div className="snack-exs">
      {SHORTCUTS.map((s) => {
        const mine = todays.filter((c) => sportOf(c) === s.sport);
        const now = mine.length
          ? s.sport === 'steps'
            ? `dziś ${stepsText(stepsOn(state, today))}`
            : `dziś ${mine.length}×`
          : null;
        return (
          <button
            key={s.sport}
            className={`snack-ex${now ? ' on' : ''}`}
            onClick={() => go(cardioAddPath(s.sport))}
            aria-label={`${s.name}${now ? `, ${now}` : ''}. Wpisz.`}
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
 * pustym dniu to wyrzut, a nie zaproszenie; tak samo jak przy przekąskach.
 */
export function CardioCard({ state }: { state: AppState }) {
  const today = dayKey(Date.now());
  const n = cardioOn(state, today).length;
  const d = dayBurn(state, today);
  const steps = stepsOn(state, today);

  return (
    <div className="grp snackcard">
      <div className="today-tag light">Kroki i cardio</div>
      {n ? (
        <>
          <h2 className="today-name">
            {steps
              ? `Dziś ${stepsText(steps)}${d ? ` · ${kcalText(d.cardio)}` : ''}`
              : d
                ? `Dziś ${kcalText(d.cardio)} z cardio`
                : `Dziś ${n} ${plural(n, ['wpis', 'wpisy', 'wpisów'])} cardio`}
          </h2>
          <p className="tight">
            {d
              ? `Kalorie ponad spoczynek${d.workouts ? `; z treningu dochodzi ${kcalText(d.workouts)}` : ''}.`
              : 'Kalorie policzę, gdy podasz wagę — zapyta o nią formularz.'}
          </p>
        </>
      ) : (
        <>
          <h2 className="today-name">Kroki, bieżnia, rower</h2>
          <p className="tight">
            Przepisz liczby z telefonu, bieżni albo licznika roweru — kalorie policzę z twojej wagi.
          </p>
        </>
      )}
      <CardioShortcuts state={state} today={today} />
      {cardioOf(state).length > 0 && (
        <a className="vidlink" href={cardioPath()}>
          Kroki i cardio — dziś, tydzień i historia →
        </a>
      )}
    </div>
  );
}

/* ---------------- Formularz ---------------- */

const SPORTS: { key: CardioSport; label: string }[] = [
  { key: 'steps', label: 'Kroki' },
  { key: 'treadmill', label: 'Bieżnia' },
  { key: 'bike', label: 'Rower' },
];

const LEAD: Record<CardioSport, string> = {
  steps:
    'Przepisz kroki z telefonu albo zegarka — liczbę z całego dnia. Kolejny wpis na ten sam dzień zastąpi poprzedni, więc wieczorem wystarczy wpisać stan licznika.',
  treadmill:
    'Średnia prędkość i czas z wyświetlacza bieżni. Nachylenie w procentach — puste znaczy płasko.',
  bike: 'Na zewnątrz — średnia prędkość z licznika. Na rowerze stacjonarnym wybierz moc: prędkość na jego wyświetlaczu to umowna liczba, a waty mówią, ile naprawdę pracy poszło.',
};

type When = 'today' | 'yesterday' | 'other';
type Fields = { steps: string; kmh: string; min: string; grade: string; watts: string; kg: string };

/**
 * Zapis kroków, bieżni albo roweru. Rodzaj przychodzi z adresu, ale da się go przełączyć
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
  const input: CardioInput | null =
    kind === 'steps'
      ? filled(f.steps)
        ? { kind: 'steps', steps: num(f.steps) }
        : null
      : kind === 'treadmill'
        ? filled(f.kmh, f.min)
          ? { kind: 'treadmill', kmh: num(f.kmh), min: num(f.min), grade: filled(f.grade) ? num(f.grade) : 0 }
          : null
        : bikeMode === 'kmh'
          ? filled(f.kmh, f.min)
            ? { kind: 'bike', kmh: num(f.kmh), min: num(f.min) }
            : null
          : filled(f.watts, f.min)
            ? { kind: 'ergo', watts: num(f.watts), min: num(f.min) }
            : null;
  const clean = input ? normalize(input) : null;
  const problem = clean ? inputProblem(clean) : null;
  // Droga i czas nie zależą od wagi, więc bez niej liczymy je dla dowolnej — kalorii wtedy nie pokazujemy.
  const preview = clean && !problem ? cardioEnergy(clean, kg ?? 70, heightOf(state)) : null;
  const prevSteps = kind === 'steps' && dayOk ? stepsOn(state, day) : 0;

  const lastSteps = lastOf(state, 'steps');
  const lastRun = lastOf(state, 'treadmill');
  const hintOf = (v: number | undefined): string => (v === undefined ? '' : `ostatnio ${decimal(v)}`);
  const lastTimed = kind === 'treadmill' ? lastRun : bikeMode === 'kmh' ? lastBike : lastErgo;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!dayOk) {
      onToast('Wybierz dzień — nie później niż dziś.');
      return;
    }
    if (!clean) {
      onToast(
        kind === 'steps' ? 'Wpisz liczbę kroków.' : bikeMode === 'watts' && kind === 'bike' ? 'Wpisz moc i czas.' : 'Wpisz prędkość i czas.',
      );
      return;
    }
    if (problem) {
      onToast(problem);
      return;
    }
    if (known === null && filled(f.kg) && !validWeight(typedKg)) {
      onToast(`Waga od ${WEIGHT_RANGE.min} do ${WEIGHT_RANGE.max} kg — sprawdź liczbę.`);
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
        <Segmented label="Rodzaj ruchu" options={SPORTS} value={kind} onChange={setKind} />
        {kind === 'bike' && (
          <Segmented
            label="Co pokazuje licznik"
            options={[
              { key: 'kmh', label: 'Prędkość, km/h' },
              { key: 'watts', label: 'Moc, W' },
            ]}
            value={bikeMode}
            onChange={setBikeMode}
          />
        )}
        <span className="seg-label" aria-hidden="true">
          kiedy
        </span>
        <Segmented
          label="Dzień"
          options={[
            { key: 'today', label: 'Dziś' },
            { key: 'yesterday', label: 'Wczoraj' },
            { key: 'other', label: 'Inny dzień' },
          ]}
          value={when}
          onChange={setWhen}
        />
        {when === 'other' && (
          <label className="fld">
            <span>dzień</span>
            <input type="date" max={today} value={other} onChange={(e) => setOther(e.target.value)} />
          </label>
        )}

        {kind === 'steps' && (
          <label className="fld cardio-main">
            <span>kroki z całego dnia</span>
            <input
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min={1}
              autoFocus
              placeholder={lastSteps ? `ostatnio ${lastSteps.steps.toLocaleString('pl-PL')}` : ''}
              value={f.steps}
              onChange={set('steps')}
            />
          </label>
        )}

        {kind !== 'steps' && (
          <div className="snack-row">
            {kind === 'bike' && bikeMode === 'watts' ? (
              <label className="fld">
                <span>średnia moc, W</span>
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
                <span>średnia prędkość, km/h</span>
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
              <span>czas, min</span>
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
            <span>nachylenie, % (puste — płasko)</span>
            <input
              type="text"
              inputMode="decimal"
              className="num"
              autoComplete="off"
              placeholder={lastRun?.grade ? `ostatnio ${decimal(lastRun.grade)}` : ''}
              value={f.grade}
              onChange={set('grade')}
            />
          </label>
        )}

        {known === null && (
          <label className="fld cardio-kg">
            <span>twoja waga, kg — z niej liczą się kalorie</span>
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
          <p className="tight cardio-note">
            Ten dzień ma już wpis: {stepsText(prevSteps)}. Nowa liczba go zastąpi — wpisz stan licznika
            z całego dnia.
          </p>
        )}

        {preview && clean && (
          <div className="cardio-preview" aria-live="polite">
            {kg !== null ? (
              <>
                <div className="snack-today-num">{kcalText(preview.active)}</div>
                <p className="tight">
                  ponad spoczynek
                  {clean.kind !== 'steps' &&
                    ` · razem ze spoczynkiem ${kcalText(preview.total)} — tę liczbę zwykle pokazuje ${clean.kind === 'treadmill' ? 'bieżnia' : 'rower'}`}
                </p>
              </>
            ) : (
              <p className="tight">Kalorie pokażę, gdy wpiszesz wagę. Ruch zapiszę i bez niej.</p>
            )}
            <p className="tight">
              {clean.kind === 'steps'
                ? `ok. ${kmText(preview.km ?? 0)} · ok. ${durText(preview.secs)} marszu przy ${STEP_CADENCE} krokach na minutę`
                : [
                    preview.km !== null ? kmText(preview.km) : null,
                    clean.kind === 'treadmill' ? paceWord(clean.kmh) : null,
                    `${pl(preview.met, 1)} MET`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
        )}
        {problem && <p className="tight cardio-note warn">{problem}</p>}

        <button className="btn wide" type="submit">
          Zapisz
        </button>
      </form>

      <div className="wrap">
        <p className="hint cardio-foot">
          {kind === 'steps'
            ? 'Spacer na bieżni z telefonem w kieszeni jest już w krokach. Wpisz jedno albo drugie — inaczej ten sam marsz policzy się dwa razy.'
            : 'Jeśli telefon był przy tobie, jego kroki mogą już zawierać ten ruch. Wpisz jedno albo drugie — inaczej policzy się dwa razy.'}
        </p>
      </div>
    </>
  );
}

/* ---------------- Historia ---------------- */

function CardioItem({ state, c, onDelete }: { state: AppState; c: Cardio; onDelete: (key: string) => void }) {
  const b = cardioBurn(state, c);
  // Droga nie zależy od wagi, więc stoi na liście także przed pierwszym ważeniem.
  const km = cardioEnergy(c, 70, heightOf(state)).km;
  return (
    <div className="cardio-item">
      <span className="cardio-name">{cardioLabel(c)}</span>
      <span className="snack-amt">
        {[km !== null ? kmText(km) : null, b ? kcalText(b.active) : null].filter(Boolean).join(' · ')}
      </span>
      <button className="snack-del" onClick={() => onDelete(c.key)} aria-label={`Usuń wpis: ${cardioLabel(c)}`}>
        ×
      </button>
    </div>
  );
}

/** Siedem dni jako pasek — kalorie z całego ruchu, żeby było widać, jak rozkłada się tydzień. */
function KcalWeek({ state, today }: { state: AppState; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="snack-week" role="list" aria-label="Kalorie z ruchu w ostatnich siedmiu dniach">
      {days.map((d) => {
        const b = dayBurn(state, d);
        const kcal = b ? roundKcal(b.total) : 0;
        return (
          <div
            key={d}
            role="listitem"
            className={`sw-day${kcal ? ' on' : ''}${d === today ? ' now' : ''}`}
            aria-label={`${WEEKDAY[weekdayOf(d)]} ${dm(d)}: ${kcal ? kcalText(b!.total) : 'bez ruchu'}`}
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
  const today = dayKey(Date.now());
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
        <p className="lead">
          Ruch zmierzony telefonem, zegarkiem, bieżnią albo rowerem — przepisany tutaj. Kalorie liczą
          się z twojej wagi i są szacunkiem: aktywne, czyli ponad to, co ciało spaliłoby w tym czasie
          w spoczynku.
        </p>
      </div>

      <div className="grp">
        <h2>Wpisz</h2>
        <p className="tight">Wybierz, skąd są liczby — resztę wpiszesz na następnym ekranie.</p>
        <CardioShortcuts state={state} today={today} />
        <p className="tight" style={{ marginTop: 8 }}>
          {latest
            ? `Kalorie liczone dla ${decimal(latest.kg)} kg (ważenie ${dm(latest.day)}). Wagę zmienisz w profilu.`
            : 'Bez wagi zapiszę drogę i czas, a kalorie policzę, gdy tylko ją podasz — także dla wcześniejszych wpisów.'}
        </p>
        <a className="vidlink" href="#/profil">
          {latest ? 'Waga i wzrost w profilu →' : 'Wpisz wagę w profilu →'}
        </a>
      </div>

      <div className="sect-label">Dziś</div>
      <div className="grp">
        {!todays.length && <p className="tight joke">{pick(CARDIO_EMPTY, daySeed())}</p>}
        <p className="tight">
          {todays.length
            ? `${stepsOn(state, today) ? `${stepsText(stepsOn(state, today))}. ` : ''}${d ? `Z kroków i cardio ${kcalText(d.cardio)}.` : ''}`
            : 'Dziś jeszcze bez wpisu. '}
          {d && (d.workouts || d.snacks)
            ? ` Z treningu ${kcalText(d.workouts)}${d.snacks ? `, z przekąsek ${kcalText(d.snacks)}` : ''}. Razem ${kcalText(d.total)} ponad spoczynek.`
            : ''}
        </p>
        {todays.map((c) => (
          <CardioItem key={c.key} state={state} c={c} onDelete={onDelete} />
        ))}
      </div>

      <div className="sect-label">Ostatnie siedem dni</div>
      <div className="grp">
        {latest ? (
          <KcalWeek state={state} today={today} />
        ) : (
          <p className="tight">Pasek kalorii pojawi się po pierwszym ważeniu.</p>
        )}
        <p className="tight" style={{ marginTop: 10 }}>
          {weekSteps ? `${stepsText(weekSteps)}, średnio ${stepsText(Math.round(weekSteps / 7))} dziennie. ` : ''}
          {latest ? `Z kroków i cardio ${kcalText(weekCardio)}` : ''}
          {latest && roundKcal(weekTotal) > roundKcal(weekCardio)
            ? `, razem z treningami i przekąskami ${kcalText(weekTotal)}.`
            : latest
              ? '.'
              : ''}
        </p>
      </div>

      {past.length > 0 && (
        <>
          <div className="sect-label">Wcześniej</div>
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
                Pokaż wszystkie dni ({past.length})
              </button>
            </div>
          )}
        </>
      )}

      <div className="grp" style={{ marginTop: 14 }}>
        <h2>Jak liczymy kalorie</h2>
        <p>
          <b>Kalorie aktywne.</b> Liczba mówi, ile ruch spalił ponad spoczynek — tak ACSM liczy wydatek
          przy planowaniu ruchu i tak zegarki podają „energię aktywną”. Bieżnia i rower zwykle pokazują
          sumę razem ze spoczynkiem, dlatego formularz podaje obie.
        </p>
        <p>
          <b>Kroki.</b> Droga to kroki razy długość kroku — 41% wzrostu, a bez wzrostu w profilu 70 cm.
          Koszt marszu idzie z równania ACSM: ponad spoczynek to 0,1 ml tlenu na kilogram na każdy metr,
          więc liczy się droga, a nie tempo.
        </p>
        <p>
          <b>Bieżnia.</b> Równania ACSM na marsz i bieg, z nachyleniem — tymi samymi wzorami liczą
          kalorie bieżnie. Między 6 a 8 km/h wynik przechodzi płynnie od marszu do biegu.
        </p>
        <p>
          <b>Rower.</b> Prędkość — tabela Compendium of Physical Activities 2024 (kody 01018–01060),
          połączona liniowo między przedziałami. Moc w watach — równanie ACSM dla cykloergometru;
          dokładniejsze, bo waty to praca, a prędkość zależy od wiatru, opon i roweru.
        </p>
        <p>
          <b>Trening siłowy.</b> Każde ćwiczenie ma wartość MET z Compendium dla swojego rodzaju pracy —
          od 2,8 dla deski do 9,8 dla swingów — a czas liczy się z serii, tempa i typowych przerw, nie
          z zegara sesji. Zegar mierzy też telefon odłożony na godzinę; serie mierzą pracę.
        </p>
        <p className="tight">
          To szacunek. Pomiar tlenu u konkretnej osoby potrafi odbiec o 20–30% — w obie strony.
        </p>
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
  onWeight: (kg: number) => void;
  onHeight: (cm: number | null) => void;
  onDeleteWeight: (day: string) => void;
  onToast: (m: string) => void;
}) {
  const latest = latestWeight(state);
  const [kg, setKg] = useState('');
  const [cm, setCm] = useState(state.cfg.height ? String(state.cfg.height) : '');
  const recent = bodyOf(state).slice(-5).reverse();

  const saveKg = (e: FormEvent) => {
    e.preventDefault();
    const v = num(kg);
    if (!validWeight(v)) {
      onToast(`Waga od ${WEIGHT_RANGE.min} do ${WEIGHT_RANGE.max} kg.`);
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
      onToast(`Wzrost od ${HEIGHT_RANGE.min} do ${HEIGHT_RANGE.max} cm.`);
      return;
    }
    onHeight(Math.round(v));
  };

  return (
    <div className="grp">
      <h2>Waga i wzrost</h2>
      <p className="tight">
        {latest
          ? `Ostatnie ważenie: ${decimal(latest.kg)} kg, ${dm(latest.day)}. Kalorie liczą się z wagi z dnia ruchu, więc nowe ważenie nie zmienia historii.`
          : 'Z wagi liczą się kalorie kroków, bieżni, roweru i treningów. Wystarczy wpisać ją raz i aktualizować co jakiś czas.'}
      </p>
      <form className="body-row" onSubmit={saveKg} noValidate>
        <label className="fld">
          <span>waga dziś, kg</span>
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
          Zapisz wagę
        </button>
      </form>
      <form className="body-row" onSubmit={saveCm} noValidate>
        <label className="fld">
          <span>wzrost, cm — do długości kroku (można pominąć)</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="170"
            value={cm}
            onChange={(e) => setCm(e.target.value)}
          />
        </label>
        <button className="btn sm ghost" type="submit">
          Zapisz wzrost
        </button>
      </form>
      {recent.length > 1 && (
        <div className="body-list" aria-label="Ostatnie ważenia">
          {recent.map((b) => (
            <div className="cardio-item" key={b.day}>
              <span className="cardio-name">{dm(b.day)}</span>
              <span className="snack-amt">{decimal(b.kg)} kg</span>
              <button
                className="snack-del"
                onClick={() => onDeleteWeight(b.day)}
                aria-label={`Usuń ważenie z ${dm(b.day)}`}
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
      <h2>Kroki i cardio</h2>
      <p className="tight">
        {count
          ? `Ostatnie 7 dni: ${stepsText(steps)}${kcal !== null ? `, ${kcalText(kcal)} z kroków, bieżni i roweru` : ''}. Wpisów od początku: ${count}.`
          : 'Jeszcze bez wpisów. Przepisz kroki z telefonu albo wynik z bieżni i roweru — kalorie policzą się z twojej wagi.'}
      </p>
      <div style={{ marginTop: 10 }}>
        <button className="btn ghost sm" onClick={() => go(count ? cardioPath() : cardioAddPath())}>
          {count ? 'Kroki i cardio — dziś i historia' : 'Wpisz pierwsze kroki'}
        </button>
      </div>
    </div>
  );
}
