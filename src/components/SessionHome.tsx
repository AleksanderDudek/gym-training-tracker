import { Component, lazy, Suspense, type ReactNode } from 'react';
import { ex } from '../data/exercises';
import { go } from '../routing';
import { LATE, REST, daySeed, pick } from '../engine/quips';
import { SupportLine } from './Support';
import { CharacterStrip } from './Character';
import { SnackCard } from './Snacks';
import { CardioCard, kcalText } from './Cardio';
import { plannedBurn } from '../engine/burn';
import { dayKey } from '../engine/schedule';
import { BoostCard } from './Boost';
import { WeighCard } from './Weigh';
import { hasDiet } from '../food/dietFlag';
import { FoodCardPlaceholder } from '../food/FoodCardPlaceholder';
import { trail } from '../trail';
import type { AppState, Workout } from '../types';
import { LANG, pluralEn, text } from '../i18n';

const T = text({
  pl: {
    days: (n: number): string => (n === 1 ? 'jutro' : `za ${n} dni`),
    leadDue: 'Plan ma na dziś konkretny trening. Zacznij go jednym przyciskiem albo wybierz coś innego.',
    leadRest: (quip: string) => `${quip} Możesz też zrobić sesję dodatkową.`,
    leadNone: 'Nie masz planu, więc decydujesz sam. Plan robiłby to za ciebie i nigdy by nie zapomniał.',
    late: 'Termin do nadrobienia',
    planned: 'Dziś według planu',
    deloadTag: ' · tydzień lżejszy',
    exercises: (n: number, names: string) => `${n} ćwiczeń · ${names}`,
    wasLate: (late: number, quip: string) =>
      `Termin był ${late === 1 ? 'wczoraj' : `${late} dni temu`}. ${quip} Nadrobienie wciąż się liczy, tylko taniej.`,
    full: 'Zrobiony dziś liczy się w pełni.',
    points: (n: number) => ` Do wzięcia ${n} pkt.`,
    deload:
      'Tydzień lżejszy: mniej serii (z trzech zostają dwie) i bez serii „ile dasz radę”. Zostaw 2–3 powtórzenia zapasu — wynik trafi do historii, ale nie zmieni poziomów.',
    burn: (min: number, kcal: string) => `Na twoim poziomie to ok. ${min} min serii z przerwami i ${kcal} ponad spoczynek.`,
    start: (name: string) => `Zacznij: ${name}`,
    restDay: 'Dzień bez terminu',
    next: (when: string) => `Następny termin ${when}`,
    today: 'dzisiaj',
    noMore: 'Plan nie ma już terminów',
    nextLine: (date: string, name: string | undefined) => `${date} — ${name ?? ''}. Przerwa też pracuje: w niej rośnie siła.`,
    noPlan: 'Bez planu',
    nobody: 'Nikt nie pilnuje terminów',
    planPitch:
      'Plan rozpisuje od 4 do 48 tygodni na konkretne dni, liczy realizację i sam decyduje, który trening wypada następny — także wtedy, gdy poprzedni się nie odbył. Nie obraża się i nie przypomina o sobie w nocy.',
    setPlan: 'Ustaw plan',
    pickAny: 'Wybierz dowolny trening',
  },
  en: {
    days: (n: number): string => (n === 1 ? 'tomorrow' : `in ${n} days`),
    leadDue: 'Your plan has a workout for today. Start it with one tap or pick something else.',
    leadRest: (quip: string) => `${quip} You can also do an extra session.`,
    leadNone: 'You have no plan, so it’s your call. A plan would do this for you and never forget.',
    late: 'Workout to make up',
    planned: 'Today, as planned',
    deloadTag: ' · lighter week',
    exercises: (n: number, names: string) => `${n} ${pluralEn(n, 'exercise', 'exercises')} · ${names}`,
    wasLate: (late: number, quip: string) =>
      `The deadline was ${late === 1 ? 'yesterday' : `${late} days ago`}. ${quip} Making it up still counts, just for fewer points.`,
    full: 'Done today, it counts in full.',
    points: (n: number) => ` ${n} pts up for grabs.`,
    deload:
      'Lighter week: fewer sets (two instead of three) and no “as many as you can” set. Leave 2–3 reps in reserve — the result goes into your history but won’t change your levels.',
    burn: (min: number, kcal: string) => `At your level that’s about ${min} min of sets with rests and ${kcal} above resting.`,
    start: (name: string) => `Start: ${name}`,
    restDay: 'No deadline today',
    next: (when: string) => `Next deadline ${when}`,
    today: 'today',
    noMore: 'The plan has no more deadlines',
    nextLine: (date: string, name: string | undefined) => `${date} — ${name ?? ''}. Rest works too: that’s when strength grows.`,
    noPlan: 'No plan',
    nobody: 'Nobody’s keeping an eye on deadlines',
    planPitch:
      'A plan lays out 4 to 48 weeks on specific days, tracks how you’re doing and decides which workout comes next — even when the previous one didn’t happen. It doesn’t sulk and won’t nag you at night.',
    setPlan: 'Set up a plan',
    pickAny: 'Pick any workout',
  },
});

/**
 * Karta jedzenia z osobnej paczki (Dexie, dziennik). Wczytywana tylko u kogoś, kto prowadzi dietę
 * (`gt:diet`) — u reszty kod jedzenia nie wczytuje się ani nie uruchamia (leży najwyżej w zapasie
 * service workera na pracę offline).
 */
const TodayFoodCard = lazy(() => import('../food/TodayFoodCard'));

/**
 * Karta jedzenia jest dodatkiem do ekranu Dziś: gdy jej paczka nie przyjdzie (brak sieci przed
 * pierwszym wczytaniem) albo IndexedDB odmówi, karta znika po cichu, a reszta ekranu zostaje.
 */
class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    // Po cichu dla ekranu, ale nie dla śladu do uwag — tak jak `LoadBoundary`.
    trail.error(error instanceof Error ? error.message : String(error));
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** Co plan mówi na dziś. `due` to termin do zrobienia, `rest` to dzień bez terminu. */
export interface TodayPlan {
  kind: 'due' | 'rest' | 'none';
  /** Trening z terminu — tylko dla `due`. */
  workout?: Workout;
  /** Ile dni po terminie. Zero znaczy dzisiaj. */
  late?: number;
  /** Termin z tygodnia lżejszego. */
  deload?: boolean;
  points?: number;
  /** Data i nazwa najbliższego terminu — dla `rest`. */
  nextDate?: string;
  nextName?: string;
  nextIn?: number;
}

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return LANG === 'pl' ? `${dd}.${mm}` : `${dd}/${mm}`;
};

const days = (n: number): string => T.days(n);

/**
 * Ekran Dziś. Odpowiada na jedno pytanie: co robię dzisiaj. Lista wszystkich treningów
 * jest jego podstroną — tutaj jest jedna rekomendacja i jedno wyjście w bok, bo ekran
 * z ośmioma równorzędnymi przyciskami nie podpowiada niczego.
 */
export function SessionHome({
  state,
  today,
  statsLine,
  onStart,
  onWeigh,
  onWeighSkip,
}: {
  state: AppState;
  today: TodayPlan;
  /** Ostatni trening, tempo i obciążenie jednym wierszem — to, co wisiało w starym nagłówku. */
  statsLine: string;
  onStart: (id: string) => void;
  onWeigh: (kg: number) => void;
  onWeighSkip: () => void;
}) {
  const w = today.workout;
  const burn = w ? plannedBurn(state, w) : null;

  return (
    <>
      <div className="wrap">
        <p className="statline">{statsLine}</p>
        <p className="lead">
          {today.kind === 'due'
            ? T.leadDue
            : today.kind === 'rest'
              ? T.leadRest(pick(REST, daySeed()))
              : T.leadNone}
        </p>
        <CharacterStrip state={state} />
      </div>

      {today.kind === 'due' && w && (
        <div className="grp today">
          <div className="today-tag">
            {today.late ? T.late : T.planned}
            {today.deload ? T.deloadTag : ''}
          </div>
          <h2 className="today-name">{w.name}</h2>
          <p className="tight">{T.exercises(w.items.length, w.items.map((i) => ex(i.ex).name).join(' · '))}</p>
          <p className="tight" style={{ marginTop: 6 }}>
            {today.late ? T.wasLate(today.late, pick(LATE, today.late)) : T.full}
            {today.points ? T.points(today.points) : ''}
          </p>
          {today.deload && (
            <p className="tight" style={{ marginTop: 6 }}>
              {T.deload}
            </p>
          )}
          {burn && (
            <p className="tight" style={{ marginTop: 6 }}>
              {T.burn(Math.round(burn.secs / 60), kcalText(burn.active))}
            </p>
          )}
          <div className="actions">
            <button className="btn wide" onClick={() => onStart(w.id)}>
              {T.start(w.name)}
            </button>
          </div>
        </div>
      )}

      {today.kind === 'rest' && (
        <div className="grp">
          <div className="today-tag light">{T.restDay}</div>
          <h2 className="today-name">
            {today.nextDate ? T.next(today.nextIn === 0 ? T.today : days(today.nextIn ?? 1)) : T.noMore}
          </h2>
          {today.nextDate && <p className="tight">{T.nextLine(shortDate(today.nextDate), today.nextName)}</p>}
        </div>
      )}

      {today.kind === 'rest' && <BoostCard state={state} today={dayKey(Date.now())} onStart={onStart} />}

      {today.kind === 'none' && (
        <div className="grp">
          <div className="today-tag light">{T.noPlan}</div>
          <h2 className="today-name">{T.nobody}</h2>
          <p className="tight">{T.planPitch}</p>
          <div className="actions">
            <button className="btn ghost wide" onClick={() => go('#/plan')}>
              {T.setPlan}
            </button>
          </div>
        </div>
      )}

      <div className="wrap">
        <div className="actions">
          <button
            className={`btn wide${today.kind === 'due' ? ' ghost' : ''}`}
            // i18n-ignore: trasa
            onClick={() => go('#/treningi')}
          >
            {T.pickAny}
          </button>
        </div>
      </div>

      {/*
        Ważenie pod treningiem, przed przekąską: kto przyszedł trenować, najpierw widzi trening,
        a rano zaraz pod nim — prośbę o jedną liczbę z wagi.
      */}
      <WeighCard state={state} today={dayKey(Date.now())} onWeigh={onWeigh} onSkip={onWeighSkip} />
      {/*
        Jedzenie pod ważeniem, nad przekąską i krokami: rano jedna liczba z wagi, potem dziennik,
        do którego wraca się kilka razy dziennie — a przekąska i cardio to dodatki do dnia.
      */}
      {hasDiet() && (
        <QuietBoundary>
          {/* Zaślepka o wysokości karty, póki paczka jedzenia idzie: przekąska i cardio nie skaczą w dół. */}
          <Suspense fallback={<FoodCardPlaceholder />}>
            <TodayFoodCard />
          </Suspense>
        </QuietBoundary>
      )}
      {/* Przekąska pod treningiem, nie nad nim: kto przyszedł trenować, najpierw widzi trening. */}
      <SnackCard state={state} />
      <CardioCard state={state} />

      <div className="wrap">
        {/*
          Baner stoi pod obiema drogami wyjścia z ekranu, nie nad nimi: kto przyszedł
          trenować, ten najpierw widzi przycisk startu. Kto się rozgląda — widzi radę dnia
          i kawę.
        */}
        <SupportLine />
      </div>
    </>
  );
}
