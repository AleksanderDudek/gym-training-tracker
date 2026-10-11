import { dietPath } from '../../../routing';
import { LOADING, daySeed, pick } from '../../../engine/quips';

/** Czekanie na IndexedDB — ten sam żart co przy wczytywaniu zakładki, żeby ekran nie mrugał dwoma tekstami. */
export function Loading() {
  return <div className="empty">{pick(LOADING, daySeed())}</div>;
}

/**
 * Pierwsze wejście w dziennik bez profilu diety. W Produktach PL formularz profilu stawał od razu
 * w miejscu dnia; tu dziennik najpierw mówi, co robi i co z niego będzie, a profil to osobna
 * podstrona — jedno wyjście, nic, co bez profilu i tak by nie działało.
 */
export function Onboarding({ what = 'Dziennik jedzenia' }: { what?: string }) {
  return (
    <>
      <div className="grp fd-onboard">
        <div className="today-tag light">Zacznij od profilu diety</div>
        <h2 className="today-name">{what}</h2>
        <p className="tight">
          Zapisujesz, co zjadłeś, a dziennik liczy bilans dnia: kalorie, białko, węglowodany i tłuszcz wobec Twojego
          celu — i mówi, czego brakuje, a czego jest za dużo.
        </p>
        <ul className="fd-bullets">
          <li>Plan z Excela odhaczasz, zamieniasz na coś o podobnej kaloryczności albo pomijasz.</li>
          <li>Bez planu dostajesz propozycję dnia z tego, co jest w sklepach w pobliżu i w domu.</li>
          <li>Cel dnia dopasowuje się do tygodnia, a postęp pokazuje prognozę wagi.</li>
        </ul>
        <p className="tight">
          Cel kalorii liczę z profilu diety. Wagę, wzrost i kroki biorę z treningów — wpisujesz je raz. Wszystko zostaje
          na tym urządzeniu.
        </p>
        <div className="actions">
          <a className="btn wide" href={dietPath('profile')}>
            Ustaw profil diety
          </a>
        </div>
        <p className="tight">
          Masz arkusz z planem? Wczytasz go w profilu diety — parametry z panelu i posiłki przyjdą razem.
        </p>
      </div>
    </>
  );
}
