import { ex } from '../data/exercises';
import { go } from '../routing';
import { LATE, REST, daySeed, pick } from '../engine/quips';
import { SupportLine } from './Support';
import type { Workout } from '../types';

/** Co plan mówi na dziś. `due` to termin do zrobienia, `rest` to dzień bez terminu. */
export interface TodayPlan {
  kind: 'due' | 'rest' | 'none';
  /** Trening z terminu — tylko dla `due`. */
  workout?: Workout;
  /** Ile dni po terminie. Zero znaczy dzisiaj. */
  late?: number;
  points?: number;
  /** Data i nazwa najbliższego terminu — dla `rest`. */
  nextDate?: string;
  nextName?: string;
  nextIn?: number;
}

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return `${dd}.${mm}`;
};

const days = (n: number): string => (n === 1 ? 'jutro' : `za ${n} dni`);

/**
 * Ekran startowy sesji. Odpowiada na jedno pytanie: co robię dzisiaj. Lista wszystkich
 * treningów mieszka w zakładce Treningi — tutaj jest jedna rekomendacja i jedno wyjście
 * w bok, bo ekran z ośmioma równorzędnymi przyciskami nie podpowiada niczego.
 */
export function SessionHome({
  today,
  lastLabel,
  onStart,
}: {
  today: TodayPlan;
  /** Jednozdaniowe podsumowanie ostatniego treningu. */
  lastLabel: string | null;
  onStart: (id: string) => void;
}) {
  const w = today.workout;

  return (
    <>
      <div className="wrap">
        <h2>Twoja sesja</h2>
        <p className="lead">
          {today.kind === 'due'
            ? 'Plan ma na dziś konkretny trening. Zacznij go jednym przyciskiem albo wybierz coś innego.'
            : today.kind === 'rest'
              ? `${pick(REST, daySeed())} Możesz też zrobić sesję dodatkową.`
              : 'Nie masz planu, więc decydujesz sam. Plan robiłby to za ciebie i nigdy by nie zapomniał.'}
        </p>
      </div>

      {today.kind === 'due' && w && (
        <div className="grp today">
          <div className="today-tag">
            {today.late ? 'Termin do nadrobienia' : 'Dziś według planu'}
          </div>
          <h3 className="today-name">{w.name}</h3>
          <p className="tight">
            {w.items.length} ćwiczeń · {w.items.map((i) => ex(i.ex).name).join(' · ')}
          </p>
          <p className="tight" style={{ marginTop: 6 }}>
            {today.late
              ? `Termin był ${today.late === 1 ? 'wczoraj' : `${today.late} dni temu`}. ${pick(LATE, today.late)} Nadrobienie wciąż się liczy, tylko taniej.`
              : 'Zrobiony dziś liczy się w pełni.'}
            {today.points ? ` Do wzięcia ${today.points} pkt.` : ''}
          </p>
          <div className="actions">
            <button className="btn wide" onClick={() => onStart(w.id)}>
              Zacznij: {w.name}
            </button>
          </div>
        </div>
      )}

      {today.kind === 'rest' && (
        <div className="grp">
          <div className="today-tag light">Dzień bez terminu</div>
          <h3 className="today-name">
            {today.nextDate
              ? `Następny termin ${today.nextIn === 0 ? 'dzisiaj' : days(today.nextIn ?? 1)}`
              : 'Plan nie ma już terminów'}
          </h3>
          {today.nextDate && (
            <p className="tight">
              {shortDate(today.nextDate)} — {today.nextName}. Przerwa też pracuje: w niej rośnie siła.
            </p>
          )}
        </div>
      )}

      {today.kind === 'none' && (
        <div className="grp">
          <div className="today-tag light">Bez planu</div>
          <h3 className="today-name">Nikt nie pilnuje terminów</h3>
          <p className="tight">
            Plan rozpisuje dwanaście tygodni na konkretne dni, liczy realizację i sam decyduje,
            który trening wypada następny — także wtedy, gdy poprzedni się nie odbył. Nie obraża
            się i nie przypomina o sobie w nocy.
          </p>
          <div className="actions">
            <button className="btn ghost wide" onClick={() => go('#/plan')}>
              Ustaw plan
            </button>
          </div>
        </div>
      )}

      <div className="wrap">
        <div className="actions">
          <button
            className={`btn wide${today.kind === 'due' ? ' ghost' : ''}`}
            onClick={() => go('#/treningi')}
          >
            Wybierz dowolny trening
          </button>
        </div>
        {/*
          Baner stoi pod obiema drogami wyjścia z ekranu, nie nad nimi: kto przyszedł
          trenować, ten najpierw widzi przycisk startu. Kto się rozgląda — widzi kawę.
        */}
        <SupportLine tone="banner" />
        {lastLabel && <p className="disclaimer">{lastLabel}</p>}
      </div>
    </>
  );
}
