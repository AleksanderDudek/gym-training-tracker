import { SUPPORT_URL } from '../engine/share';
import { SUPPORT, daySeed, pick } from '../engine/quips';
import { Icon } from './icons';

/**
 * Wsparcie autora.
 *
 * Trzy zasady, na których to stoi: nigdy nie blokuje drogi (żadnego okna, które trzeba
 * zamknąć, żeby iść dalej), nigdy nie pojawia się w trakcie treningu i nigdy nie prosi
 * dwa razy na tym samym ekranie.
 *
 * Wariant jest jeden — kolorowy baner — bo trzy warianty szarej karty znaczyły tyle, co
 * żaden: prośba schowana w tle jest prośbą, której nikt nie widzi. Miejsca są stałe:
 * ekran startowy, góra podsumowania sesji, okno zdobytej odznaki, Plan, Treningi, Profil,
 * Osiągnięcia, Atlas, Ustawienia i koniec wprowadzenia. Jeden na ekran, nigdy dwa.
 */
export function SupportLine({ seed = daySeed() }: { seed?: number }) {
  const line = pick(SUPPORT, seed);

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
