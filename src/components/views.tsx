import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ALL,
  GEAR_LABEL,
  READY,
  WEIGHTED,
  ex,
  gearOf,
  groupLabel,
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
import { ON_OFF, RemindersCard } from './Reminders';
import { LanguageCard } from './Language';
import { GarminCard } from './Garmin';
import { PhoneCard } from './Phone';
import { PromoCard } from './Promo';
import type { PullResult } from '../garmin';
import type { PhonePull } from '../phone';
import { SupportLine } from './Support';
import { ContactLinks } from './Contact';
import { Segmented } from './ui';
import { text } from '../i18n';
import type { AppState, EffortKey, ExerciseId, ReadyKey, ReminderPrefs, SetResult, Workout } from '../types';

const T = text({
  pl: {
    deload: 'Tydzień lżejszy',
    deloadText: (
      <>
        Mniej serii niż zwykle i bez testu „ile dasz radę”. Zostaw 2–3 powtórzenia zapasu — wynik
        trafi do historii, ale poziomy zostaną bez zmian.
      </>
    ) as ReactNode,
    guide: 'Prowadź mnie seria po serii',
    feel: 'Jak się dziś czujesz? Wpływa na dzisiejsze cele, nie na twoje poziomy.',
    prep: 'Przygotowanie stanowiska i rozgrzewka',
    finish: (done: number, total: number) => `Zamknij sesję (${done} z ${total} zapisanych)`,
    abandon: 'Porzuć sesję',
    load: 'Obciążenie w czasie',
    loadSoon: 'Wskaźnik pojawi się po dwóch tygodniach i czterech zapisanych treningach.',
    loadHigh: 'Powyżej 1,5 — skoki ciężaru wstrzymane.',
    loadLow: 'Poniżej 0,8 — trenujesz mniej niż przez ostatni miesiąc.',
    loadOk: 'W bezpiecznym zakresie.',
    loadHow: 'Tonaż z 7 dni podzielony przez średnią tygodniową z 28 dni.',
    loadSafe: '0,8–1,3 bezpiecznie',
    loadMax: '2,0',
    home: 'Aplikacja na ekranie początkowym',
    homeText: (
      <>
        Safari może skasować dane strony, której nie otwierasz przez tydzień. Aplikacja z ikony na ekranie
        początkowym ich nie traci.
      </>
    ) as ReactNode,
    homeHow: 'Jak dodać',
    clock: 'Czas treningu w pasku',
    clockText: (
      <>
        W trakcie sesji pasek na górze pokazuje, ile trwa trening — od „Zaczynam” do zamknięcia.
      </>
    ) as ReactNode,
    clockHint: 'Liczy się zawsze — przełącznik tylko pokazuje albo chowa licznik.',
    feedback: 'Uwagi i błędy',
    feedbackText: (
      <>
        Coś nie działa, czegoś brakuje, coś jest niejasne? Napisz — wiadomość trafia prosto do
        autora, a zrzut ekranu i ślad wizyty pomagają odtworzyć problem. To samo okno otwiera
        dymek w pasku na górze, z każdego ekranu.
      </>
    ) as ReactNode,
    write: 'Napisz do autora',
    contact: 'Kontakt',
    contactText: (
      <>
        Poza aplikacją: Instagram autora, w Polsce także serwer na Discordzie, i kawa dla autora —
        to samo okno otwiera „@” w pasku na górze.
      </>
    ) as ReactNode,
    kettlebells: 'Dostępne kettlebelle',
    kettlebellsText: (
      <>
        Wagi po przecinku. Progresja dobiera ciężary wyłącznie z tej listy — ale tylko dla
        ćwiczeń z kettlebellem. Sztanga, hantle i maszyny mają własne drabiny, bo skaczą
        inaczej: gryf od dwudziestki co 2,5–10 kg, stos maszyny co 5.
      </>
    ) as ReactNode,
    saveList: 'Zapisz listę',
    calibration: 'Kalibracja',
    calibrationText: (
      <>
        Nowe ćwiczenie zaczyna od jednej serii próbnej na lekkim obciążeniu i wchodzi po
        drabinie w górę, aż wynik wpadnie w zakres powtórzeń. Później co kilka sesji wraca test
        w ostatniej serii — po to, żeby aplikacja wyłapała, że jesteś już wyżej, zamiast czekać,
        aż dogoni to po jednym powtórzeniu na sesję.
      </>
    ) as ReactNode,
    inCalib: (n: number, total: number): ReactNode => (
      <>
        W fazie próbnej: <b>{n}</b> z{' '}
        {total} ćwiczeń.
      </>
    ),
    remeasure: 'Zmierz wszystkie poziomy od nowa',
    start: 'Poziomy startowe',
    startText: (
      <>
        Ręczna korekta, gdy znasz swój poziom i nie chcesz czekać na próbę. Ustawienie ciężaru
        zamyka fazę próbną tego ćwiczenia.
      </>
    ) as ReactNode,
    intro: 'Wprowadzenie',
    introText: 'Cztery ekrany o tym, jak aplikacja prowadzi trening. Można je otworzyć kiedykolwiek.',
    introShow: 'Pokaż wprowadzenie',
    backup: 'Kopia danych',
    backupText: 'Eksport zapisuje wszystko do pliku JSON. Import nadpisuje bieżące dane.',
    exportFile: 'Eksportuj plik',
    importFile: 'Importuj plik',
    how: 'Jak działa progresja',
    howLead: 'Silnik opiera się na kilku zasadach z literatury treningowej:',
    rules: [
      <>
        <b>Poziom z pomiaru, nie z tabelki.</b> Każde ćwiczenie zaczyna od serii próbnej i wchodzi
        po drabinie, aż wynik wpadnie w zakres powtórzeń. Potem co kilka sesji wraca test
        w ostatniej serii — bo sam przyrost po jednym powtórzeniu nigdy nie dogoniłby kogoś, kto
        wystartował kilka poziomów poniżej swoich możliwości.
      </>,
      <>
        <b>Nadwyżka się liczy.</b> Wynik wyższy od celu podnosi cel od razu do tego wyniku, a nie
        o jedno powtórzenie.
      </>,
      <>
        <b>Podwójna progresja.</b> Najpierw rosną powtórzenia w zakresie, dopiero potem ciężar.
        Metoda opisana po raz pierwszy w 1911 roku, wciąż standard.
      </>,
      <>
        <b>Zapas powtórzeń.</b> Cel zaliczony na styk, bez zapasu, nie daje awansu. Badania nad
        oceną zapasu pokazują, że ludzie mylą się średnio o jedno powtórzenie i są dokładniejsi
        blisko upadku — dlatego skala ma trzy stopnie, a nie dziesięć.
      </>,
      <>
        <b>Przejście ciężaru seria po serii.</b> Skok o rozmiar kettlebella to 16–33%
        obciążenia, czyli wielokrotnie więcej niż typowy skok na sztandze. Cięższy ciężar wchodzi
        więc najpierw do jednej serii, potem kolejnej, aż zastąpi wszystkie. Każdy sprzęt ma
        własną drabinę, więc na sztandze kroki są proporcjonalnie mniejsze.
      </>,
      <>
        <b>Powtórzenia po zmianie ciężaru</b> liczone są wzorem Epleya: 1RM = ciężar × (1 +
        powtórzenia / 30). Z szacowanego maksimum wychodzi, ile powtórzeń da się zrobić na nowym
        ciężarze.
      </>,
      <>
        <b>Balistyka inaczej niż siła.</b> Swingi to ruch wybuchowy — nie prowadzi się ich do
        granicy powtórzeń, tylko dokłada serie. Przysiady i wyciskanie to grindy, tam rosną
        powtórzenia.
      </>,
      <>
        <b>Obciążenie w czasie.</b> Aplikacja liczy stosunek tonażu z 7 dni do średniej z 28 dni.
        Zakres 0,8–1,3 uchodzi za bezpieczny, powyżej 1,5 wstrzymywane są skoki ciężaru. Wskaźnik
        bywa krytykowany, więc traktuj go jako sygnał ostrzegawczy, nie wyrocznię.
      </>,
      <>
        <b>Przerwa w treningach.</b> Badania nad roztrenowaniem pokazują, że nawet po 12 tygodniach
        przerwy siła spada tylko o 5–15%. Dlatego po dłuższej pauzie cofają się cele powtórzeń, a
        ciężar rusza dopiero po przerwie liczonej w miesiącach.
      </>,
    ] as ReactNode[],
    reset: 'Reset',
    resetText: 'Kasuje historię, poziomy i własne treningi. Nie da się tego cofnąć.',
    resetAll: 'Usuń wszystkie dane',
    local: 'Dane trzymane lokalnie. Aplikacja nie zastępuje fizjoterapeuty, dietetyka ani lekarza.',
    library: (n: number) => `Ćwiczeń w bibliotece: ${n}.`,
  },
  en: {
    deload: 'Lighter week',
    deloadText: (
      <>
        Fewer sets than usual and no “as many as you can” test. Leave 2–3 reps in reserve — the result goes into your
        history, but your levels stay the same.
      </>
    ),
    guide: 'Guide me set by set',
    feel: 'How do you feel today? It affects today’s targets, not your levels.',
    prep: 'Station set-up and warm-up',
    finish: (done: number, total: number) => `Finish session (${done} of ${total} logged)`,
    abandon: 'Abandon session',
    load: 'Load over time',
    loadSoon: 'The gauge appears after two weeks and four logged workouts.',
    loadHigh: 'Above 1.5 — weight jumps paused.',
    loadLow: 'Below 0.8 — you’re training less than over the past month.',
    loadOk: 'In the safe range.',
    loadHow: 'Tonnage from the last 7 days divided by the weekly average over 28 days.',
    loadSafe: '0.8–1.3 safe',
    loadMax: '2.0',
    home: 'App on your Home Screen',
    homeText: (
      <>
        Safari may delete the data of a site you haven’t opened for a week. The app opened from a Home Screen icon
        doesn’t lose it.
      </>
    ),
    homeHow: 'How to add it',
    clock: 'Workout time in the top bar',
    clockText: (
      <>During a session the bar at the top shows how long your workout has been going — from the start to the finish.</>
    ),
    clockHint: 'It always counts — the switch only shows or hides the timer.',
    feedback: 'Feedback and bugs',
    feedbackText: (
      <>
        Something broken, missing or unclear? Write in — your message goes straight to the author, and a screenshot
        and a trace of your visit help reproduce the problem. The speech bubble in the top bar opens the same window
        from any screen.
      </>
    ),
    write: 'Write to the author',
    contact: 'Contact',
    contactText: (
      <>
        Outside the app: the author’s Instagram, a Discord server in Poland, and a coffee for the author — the “@” in
        the top bar opens the same window.
      </>
    ),
    kettlebells: 'Your kettlebells',
    kettlebellsText: (
      <>
        Weights separated by commas. Progression picks weights only from this list — but only for kettlebell
        exercises. Barbells, dumbbells and machines have their own weight ladders because they jump differently: a 20
        kg bar in steps of 2.5–10 kg, a machine stack in steps of 5.
      </>
    ),
    saveList: 'Save list',
    calibration: 'Calibration',
    calibrationText: (
      <>
        A new exercise starts with one test set at a light weight and climbs the weight ladder until your result
        lands in the rep range. After that, every few sessions the last set becomes a test again — so the app notices
        you’ve moved up instead of catching up one rep per session.
      </>
    ),
    inCalib: (n: number, total: number): ReactNode => (
      <>
        In calibration: <b>{n}</b> of {total} exercises.
      </>
    ),
    remeasure: 'Re-measure all levels',
    start: 'Starting levels',
    startText: (
      <>
        A manual override for when you know your level and don’t want to wait for the test. Setting a weight ends
        calibration for that exercise.
      </>
    ),
    intro: 'Introduction',
    introText: 'Four screens on how the app guides your training. Open them any time.',
    introShow: 'Show introduction',
    backup: 'Data backup',
    backupText: 'Export saves everything to a JSON file. Import overwrites your current data.',
    exportFile: 'Export file',
    importFile: 'Import file',
    how: 'How progression works',
    howLead: 'The engine rests on a few principles from the training literature:',
    rules: [
      <>
        <b>Your level comes from a measurement, not a table.</b> Every exercise starts with a test set and climbs the
        weight ladder until your result lands in the rep range. Then every few sessions the last set becomes a test
        again — because adding one rep at a time would never catch up with someone who started several levels below
        what they can do.
      </>,
      <>
        <b>Extra reps count.</b> A result above the target raises the target straight to that result, not by one rep.
      </>,
      <>
        <b>Double progression.</b> Reps within the range go up first, then the weight. The method was first described
        in 1911 and is still the standard.
      </>,
      <>
        <b>Reps in reserve.</b> A target hit with nothing left in the tank doesn’t earn a step up. Studies on rating
        reps in reserve show people are off by about one rep on average, and more accurate close to failure — which
        is why the scale has three steps, not ten.
      </>,
      <>
        <b>Weight changes set by set.</b> Moving up one kettlebell size is 16–33% of the load, many times more than a
        typical jump on a barbell. So the heavier weight goes into one set first, then the next, until it replaces
        them all. Each type of kit has its own weight ladder, so the steps on a barbell are proportionally smaller.
      </>,
      <>
        <b>Reps after a weight change</b> are worked out with the Epley formula: 1RM = weight × (1 + reps / 30). The
        estimated max tells how many reps you can do with the new weight.
      </>,
      <>
        <b>Ballistics work differently from strength.</b> Swings are explosive — you don’t take them to the rep limit,
        you add sets. Squats and presses are grinds; there the reps go up.
      </>,
      <>
        <b>Load over time.</b> The app compares your tonnage from the last 7 days with the 28-day average. A range of
        0.8–1.3 is considered safe; above 1.5, weight jumps are paused. The measure has its critics, so treat it as a
        warning sign, not an oracle.
      </>,
      <>
        <b>Breaks from training.</b> Detraining studies show that even after 12 weeks off, strength drops by only
        5–15%. That’s why after a longer break the rep targets step back, and the weight only moves after a break
        measured in months.
      </>,
    ],
    reset: 'Reset',
    resetText: 'Deletes your history, levels and custom workouts. This can’t be undone.',
    resetAll: 'Delete all data',
    local: 'Data is stored locally. The app doesn’t replace a physiotherapist, dietitian or doctor.',
    library: (n: number) => `Exercises in the library: ${n}.`,
  },
});

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
          <b>{T.deload}</b>
          <p className="tight">{T.deloadText}</p>
        </div>
      )}
      <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={onGuided}>
        {T.guide}
      </button>
      <div className="segline">{T.feel}</div>
      <div className="seg">
        {(Object.keys(READY) as ReadyKey[]).map((k) => (
          <button key={k} aria-pressed={session.ready === k} onClick={() => onReady(k)}>
            {READY[k]}
          </button>
        ))}
      </div>

      {/* Otwarte, dopóki nic nie zapisano — potem zwija się, żeby nie odpychać serii w dół. */}
      <details className="prep prep-session" open={doneCount === 0}>
        <summary>{T.prep}</summary>
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
          {T.finish(doneCount, workout.items.length)}
        </button>
        <button className="btn ghost wide" onClick={onCancel}>
          {T.abandon}
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
        <h2 style={{ margin: '0 0 4px', fontSize: 15 }}>{T.load}</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>{T.loadSoon}</p>
      </div>
    );
  }
  const pos = Math.max(0, Math.min(100, (a / 2) * 100));
  const verdict =
    a > 1.5
      ? T.loadHigh
      : a < 0.8
        ? T.loadLow
        : T.loadOk;

  return (
    <div className="gauge">
      <h2 style={{ margin: '0 0 4px', fontSize: 15 }}>
        {T.load} — {a.toFixed(2)}
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>{T.loadHow}</p>
      <div className="gbar">
        <i style={{ left: '40%', right: '35%' }} />
        <b style={{ left: `${pos}%` }} />
      </div>
      <div className="gscale">
        <span>0</span>
        <span>{T.loadSafe}</span>
        <span>{T.loadMax}</span>
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
  onInstall,
  onReminders,
  onWatchSync,
  onPhoneSync,
  onToast,
  onFeedback,
  onClockPref,
}: {
  state: AppState;
  onFeedback?: (() => void) | undefined;
  /** Licznik czasu treningu w pasku: pokazany albo schowany. */
  onClockPref: (on: boolean) => void;
  onReminders: (p: ReminderPrefs) => void;
  onWatchSync: () => Promise<PullResult>;
  onPhoneSync: () => Promise<PhonePull>;
  onToast: (m: string) => void;
  onWeights: (list: number[]) => void;
  onStartWeight: (id: ExerciseId, w: number) => void;
  onExport: () => void;
  onImport: (f: File) => void;
  onReset: () => void;
  onRecalibrate: () => void;
  onIntro: () => void;
  /** Instrukcja „dodaj do ekranu początkowego” — tylko iPhone poza aplikacją z ikony. */
  onInstall?: (() => void) | undefined;
}) {
  const [text, setText] = useState(state.cfg.weights.join(', '));
  const groups = exercisesByGroup();

  return (
    <>
      {/* Polecenie na samej górze: ustawienia odwiedza ten, kto już aplikację zna i lubi. */}
      <PromoCard />
      <LanguageCard />
      {onInstall && (
        <div className="grp">
          <h2>{T.home}</h2>
          <p className="tight">{T.homeText}</p>
          <button className="btn ghost sm" onClick={onInstall}>
            {T.homeHow}
          </button>
        </div>
      )}
      <RemindersCard state={state} onPrefs={onReminders} onToast={onToast} />
      <GarminCard state={state} onSync={onWatchSync} onToast={onToast} onFeedback={onFeedback} />
      <PhoneCard state={state} onSync={onPhoneSync} onToast={onToast} />

      <div className="grp">
        <h2>{T.clock}</h2>
        <p className="tight">{T.clockText}</p>
        <Segmented
          label={T.clock}
          options={ON_OFF}
          value={state.cfg.clock === false ? 'off' : 'on'}
          onChange={(v) => onClockPref(v === 'on')}
        />
        <p className="hint">{T.clockHint}</p>
      </div>

      {onFeedback && (
        <div className="grp">
          <h2>{T.feedback}</h2>
          <p className="tight">{T.feedbackText}</p>
          <button className="btn ghost sm" onClick={onFeedback}>
            {T.write}
          </button>
        </div>
      )}

      <div className="grp">
        <h2>{T.contact}</h2>
        <p className="tight">{T.contactText}</p>
        <ContactLinks />
      </div>

      <div className="grp">
        <h2>{T.kettlebells}</h2>
        <p>{T.kettlebellsText}</p>
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
          {T.saveList}
        </button>
      </div>

      <div className="grp">
        <h2>{T.calibration}</h2>
        <p>{T.calibrationText}</p>
        <p className="tight">{T.inCalib(ALL.filter((id) => P(state, id).phase === 'calib').length, ALL.length)}</p>
        <div style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={onRecalibrate}>
            {T.remeasure}
          </button>
        </div>
      </div>

      <div className="grp">
        <h2>{T.start}</h2>
        <p>{T.startText}</p>
        {/* Biblioteka ma ponad sto ćwiczeń — bez zwijanych partii ta sekcja byłaby ścianą. */}
        {Object.entries(groups).map(([g, ids]) => {
          const weighted = ids.filter((id) => WEIGHTED.includes(id));
          if (!weighted.length) return null;
          return (
            <details className="gsel" key={g}>
              <summary>
                {groupLabel(g)} <i>{weighted.length}</i>
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
        <h2>{T.intro}</h2>
        <p>{T.introText}</p>
        <button className="btn ghost sm" onClick={onIntro}>
          {T.introShow}
        </button>
      </div>

      <div className="grp">
        <h2>{T.backup}</h2>
        <p>{T.backupText}</p>
        <div className="btnrow">
          <button className="btn" onClick={onExport}>
            {T.exportFile}
          </button>
          <label className="btn ghost" style={{ cursor: 'pointer' }}>
            {T.importFile}
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
        <h2>{T.how}</h2>
        <p className="tight">{T.howLead}</p>
        {T.rules.map((rule, i) => (
          <p key={i}>{rule}</p>
        ))}
      </div>

      <HealthCard />

      <div className="grp">
        <h2>{T.reset}</h2>
        <p>{T.resetText}</p>
        <button className="btn ghost" onClick={onReset}>
          {T.resetAll}
        </button>
      </div>

      <footer>
        {T.local}
        <br />
        {T.library(ALL.length)}
      </footer>
    </>
  );
}
