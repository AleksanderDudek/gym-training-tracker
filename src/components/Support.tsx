import { SUPPORT_URL } from '../engine/share';
import { SUPPORT, daySeed, pick } from '../engine/quips';
import { Icon } from './icons';

/**
 * Wsparcie autora.
 *
 * Trzy zasady, na których to stoi: nigdy nie blokuje drogi (żadnego okna, które trzeba
 * zamknąć, żeby iść dalej), nigdy nie pojawia się w trakcie treningu, i zawsze wygląda
 * tak samo — jedna linijka i jeden przycisk. Miejsce ma stałe: podsumowanie po zamkniętej
 * sesji, koniec wprowadzenia i ustawienia. Kto nie chce, ten tego nie zauważy; kto chce,
 * ten wie, gdzie szukać.
 */
export function SupportLine({
  tone = 'quiet',
  seed = daySeed(),
}: {
  tone?: 'quiet' | 'card' | 'block';
  /** Ziarno tekstu — ten sam ekran ma pokazywać ten sam wiersz. */
  seed?: number;
}) {
  const line = pick(SUPPORT, seed);

  if (tone === 'block')
    return (
      <div className="supportblock">
        <Icon name="coffee" size={26} />
        <div>
          <p className="supportblock-line">{line}</p>
          <a className="btn sm" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Postaw kawę
          </a>
        </div>
      </div>
    );

  if (tone === 'card')
    return (
      <div className="grp">
        <h3>
          <Icon name="coffee" size={19} /> Wsparcie
        </h3>
        <p className="tight">{line}</p>
        <p className="tight">
          Nie ma kont, reklam ani śledzenia, a dane nie opuszczają twojej przeglądarki.
          Kwota dowolna, moment dowolny, obowiązku zero.
        </p>
        <a className="btn sm" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
          Postaw kawę
        </a>
      </div>
    );

  return (
    <p className="support">
      {line}{' '}
      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
        Postaw kawę
      </a>
    </p>
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
