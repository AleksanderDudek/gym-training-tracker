import { SUPPORT_URL } from '../engine/share';
import { SUPPORT, daySeed, pick } from '../engine/quips';
import { Icon } from './icons';

/**
 * Wsparcie autora.
 *
 * Trzy zasady, na których to stoi: nigdy nie blokuje drogi (żadnego okna, które trzeba
 * zamknąć, żeby iść dalej), nigdy nie pojawia się w trakcie treningu i nigdy nie prosi
 * dwa razy na tym samym ekranie. Miejsca są stałe: ekran startowy, góra podsumowania po
 * zamkniętej sesji, koniec wprowadzenia, Osiągnięcia i Ustawienia.
 *
 * Budowa jest zawsze ta sama — jedna linijka i jeden przycisk — zmienia się tylko oprawa.
 * `quiet` to zdanie z odnośnikiem, `card` i `block` to szara karta, `banner` jako jedyny
 * ma kolor i stoi tam, gdzie wzrok i tak przystaje.
 */
export function SupportLine({
  tone = 'quiet',
  seed = daySeed(),
}: {
  tone?: 'quiet' | 'card' | 'block' | 'banner';
  /** Ziarno tekstu — ten sam ekran ma pokazywać ten sam wiersz. */
  seed?: number;
}) {
  const line = pick(SUPPORT, seed);

  // Baner: jedyny wariant w kolorze. Stoi w dwóch miejscach, gdzie wzrok i tak przystaje —
  // na ekranie startowym i na górze podsumowania sesji — i nadal niczego nie zasłania.
  if (tone === 'banner')
    return (
      <div className="supportbanner">
        <Icon name="coffee" size={26} />
        <div>
          <p className="supportbanner-line">{line}</p>
          <a className="btn sm coffee" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Postaw kawę
          </a>
        </div>
      </div>
    );

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
