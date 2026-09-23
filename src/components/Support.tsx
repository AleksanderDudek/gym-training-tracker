import { SUPPORT_URL } from '../engine/share';

/**
 * Wsparcie autora.
 *
 * Trzy zasady, na których to stoi: nigdy nie blokuje drogi (żadnego okna, które trzeba
 * zamknąć, żeby iść dalej), nigdy nie pojawia się w trakcie treningu, i zawsze wygląda
 * tak samo — jedna linijka i jeden przycisk. Miejsce ma stałe: podsumowanie po zamkniętej
 * sesji, koniec wprowadzenia i ustawienia. Kto nie chce, ten tego nie zauważy; kto chce,
 * ten wie, gdzie szukać.
 */
export function SupportLine({ tone = 'quiet' }: { tone?: 'quiet' | 'card' }) {
  if (tone === 'card')
    return (
      <div className="grp">
        <h3>Wsparcie</h3>
        <p className="tight">
          Aplikacja jest bezpłatna i zostanie bezpłatna. Nie ma kont, reklam ani śledzenia,
          a dane nie opuszczają twojej przeglądarki. Jeśli się przydaje, możesz postawić kawę —
          w dowolnej kwocie i tylko wtedy, gdy masz ochotę.
        </p>
        <a className="btn sm" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
          Postaw kawę
        </a>
      </div>
    );

  return (
    <p className="support">
      Aplikacja jest bezpłatna.{' '}
      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
        Możesz postawić kawę
      </a>{' '}
      — jeśli masz ochotę.
    </p>
  );
}
