import { SUPPORT_URL } from '../engine/share';
import { COACH_TIPS, daySeed, pick } from '../engine/quips';
import { Gorilla } from './Gorilla';
import { Icon } from './icons';

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

/** Kubek w nagłówku. Zawsze widoczny, nigdy nie zajmuje drogi. */
export function SupportButton() {
  return (
    <a
      className="gearbtn coffeebtn"
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Postaw autorowi kawę"
      title="Postaw autorowi kawę"
    >
      <Icon name="coffee" size={21} />
    </a>
  );
}
