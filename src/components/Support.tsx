import { SUPPORT_URL } from '../engine/share';
import { COACH_TIPS, SUPPORT_SHORT, daySeed, pick } from '../engine/quips';
import { addDays } from '../engine/schedule';
import { Gorilla } from './Gorilla';
import { Icon } from './icons';
import type { AppState } from '../types';

/**
 * Wsparcie autora — z Trenerem Siwym.
 *
 * Trzy zasady bez zmian: nigdy nie blokuje drogi (żadnego okna do zamknięcia), nigdy nie
 * pojawia się w trakcie treningu i nigdy nie prosi dwa razy na tym samym ekranie.
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

/**
 * Cienki pasek wsparcia na górze aplikacji. Jedyna stała prośba — zastąpił kubek w nagłówku
 * i banery na dole zakładek, więc żaden ekran nie prosi dwa razy.
 *
 * Przykleja się razem z paskiem aplikacji i niczego nie zasłania. Cały jest jednym odnośnikiem,
 * a × chowa go na tydzień: prośba, której nie da się odsunąć, przestaje być prośbą. W trakcie
 * treningu go nie ma — wtedy liczy się tylko seria.
 */
export function SupportStrip({ onSnooze }: { onSnooze: () => void }) {
  return (
    <div className="strip">
      <a className="strip-link" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
        <span className="strip-ico" aria-hidden="true">
          <Icon name="coffee" size={17} />
        </span>
        <span className="strip-text">{pick(SUPPORT_SHORT, daySeed())}</span>
        <span className="strip-cta">Postaw kawę</span>
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

/**
 * Rada dnia bez prośby. Na ekranie Dziś rada zostaje — ma wartość sama w sobie i to po nią
 * wraca się jutro — ale prośba o kawę stoi już na górze, w pasku wsparcia, więc tu jej nie ma.
 */
export function TipCard({ seed = daySeed() }: { seed?: number }) {
  const t = pick(COACH_TIPS, seed);
  return (
    <div className="tipcard">
      <span className="tipcard-art" aria-hidden="true">
        <Gorilla who="siwy" mood={t.mood} size={112} />
      </span>
      <span className="tipcard-body">
        <span className="mbanner-eyebrow">Rada dnia · Trener Siwy</span>
        <span className="tipcard-tip">{t.tip}</span>
      </span>
    </div>
  );
}
