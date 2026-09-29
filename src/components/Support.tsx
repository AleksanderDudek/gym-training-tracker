import { SUPPORT_URL } from '../engine/share';
import { COACH_TIPS, SUPPORT_SHORT, daySeed, pick } from '../engine/quips';
import { addDays } from '../engine/schedule';
import { Gorilla } from './Gorilla';
import type { CoachMood } from './Gorilla';
import type { AppState } from '../types';

/**
 * Wsparcie autora — z Trenerem Siwym.
 *
 * Dwa miejsca, jeden styl: cienki pasek pod paskiem aplikacji i duży baner na dole zakładek
 * (decyzja autora — oba zostają). Zasady bez zmian: nigdy nie blokuje drogi (żadnego okna do
 * zamknięcia) i nigdy nie pojawia się w trakcie treningu.
 *
 * Zmienia się kolejność. Najpierw trener daje radę dnia — coś, co ma wartość samo w sobie
 * i po co można wrócić jutro, bo rada będzie inna. Dopiero potem pada żart o espresso
 * i przycisk. Nikt tu nie prosi z pozycji potrzebującego: stary srebrnogrzbiety częstuje
 * wiedzą, a kawa jest uśmiechem w odpowiedzi. Cała powierzchnia jest jednym odnośnikiem,
 * więc nie trzeba trafiać w przycisk.
 */
export function SupportLine({
  seed = daySeed(),
  compact = false,
}: {
  /** Ziarno rady — ten sam ekran ma pokazywać tę samą radę przez cały dzień. */
  seed?: number;
  /** Wersja w linii: głowa trenera, sam żart i przycisk. Do ustawień i wprowadzenia. */
  compact?: boolean;
}) {
  const t = pick(COACH_TIPS, seed);

  return (
    <a className={`mbanner${compact ? ' compact' : ''}`} href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
      <span className="mbanner-art" aria-hidden="true">
        <Gorilla who="siwy" mood={t.mood} {...(compact ? { crop: 'face' as const, size: 56 } : { size: 150 })} />
      </span>
      <span className="mbanner-body">
        {!compact && <span className="mbanner-eyebrow">Rada dnia · Trener Siwy</span>}
        {!compact && <span className="mbanner-tip">{t.tip}</span>}
        <span className="mbanner-line">{t.joke}</span>
        {/*
          Etykieta krótsza niż w systemie projektowym („Postaw Siwemu espresso”): przy
          szerokości telefonu tamta łamała się na dwa wiersze i przycisk rósł do 64 px.
          Nadpis nad radą i tak mówi, czyja to rada, więc imię w przycisku było powtórzeniem.
        */}
        <span className="btn sm coffee">Postaw espresso</span>
        {!compact && <span className="mbanner-url">buycoffee.to/uriel · otwiera się w nowej karcie</span>}
      </span>
    </a>
  );
}

/** Na ile dni × chowa pasek wsparcia. Tydzień: dość, żeby odpocząć, za mało, żeby zapomnieć. */
export const SNOOZE_DAYS = 7;

/** Dzień, do którego pasek zostaje schowany po stuknięciu w ×. */
export const snoozeUntil = (today: string): string => addDays(today, SNOOZE_DAYS);

/** Czy pasek wsparcia jest teraz schowany. */
export const supportSnoozed = (state: AppState, today: string): boolean =>
  !!state.supportSnooze && today < state.supportSnooze;

/** Miny Siwego w pasku — te, które dobrze wyglądają w samej twarzy. */
const STRIP_MOODS: readonly CoachMood[] = ['wink', 'coffee', 'approve', 'calm'];

/**
 * Cienki pasek wsparcia pod paskiem aplikacji. Zastąpił kubek w nagłówku; duży baner na dole
 * zakładek zostaje obok niego — pasek przypomina, baner zamyka ekran radą dnia.
 *
 * Wygląda i mówi jak duży baner Trenera Siwego, tylko w jednym wierszu: jego twarz, żart
 * o espresso w jego stylu i ten sam przycisk „Postaw espresso”. Stoi pod paskiem aplikacji,
 * nie nad nim — na samej górze zostaje tytuł ekranu, a prośba jest drugą rzeczą, nie pierwszą.
 * Przykleja się razem z paskiem i niczego nie zasłania. Cały jest jednym odnośnikiem, a ×
 * chowa go na tydzień: prośba, której nie da się odsunąć, przestaje być prośbą. W trakcie
 * treningu go nie ma — wtedy liczy się tylko seria.
 */
export function SupportStrip({ onSnooze }: { onSnooze: () => void }) {
  const seed = daySeed();
  return (
    <div className="strip">
      <a className="strip-link" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
        <span className="strip-face" aria-hidden="true">
          <Gorilla who="siwy" mood={pick(STRIP_MOODS, seed)} crop="face" size={30} />
        </span>
        <span className="strip-text">{pick(SUPPORT_SHORT, seed)}</span>
        <span className="strip-cta">
          <span className="cta-long">Postaw espresso</span>
          <span className="cta-short">Espresso</span>
        </span>
      </a>
      <button
        className="strip-close"
        onClick={onSnooze}
        aria-label={`Schowaj pasek wsparcia na ${SNOOZE_DAYS} dni`}
        title={`Schowaj na ${SNOOZE_DAYS} dni`}
      >
        ×
      </button>
    </div>
  );
}
