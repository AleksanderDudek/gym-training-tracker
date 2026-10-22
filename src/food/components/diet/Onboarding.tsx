import { dietPath } from '../../../routing';
import { LOADING, daySeed, pick } from '../../../engine/quips';
import { text } from '../../../i18n';

const T = text({
  pl: {
    what: 'Dziennik jedzenia',
    tag: 'Zacznij od profilu diety',
    lead: 'Zapisujesz, co zjadłeś, a dziennik liczy bilans dnia: kalorie, białko, węglowodany i tłuszcz wobec Twojego celu — i mówi, czego brakuje, a czego jest za dużo.',
    bullets: [
      'Plan z Excela odhaczasz, zamieniasz na coś o podobnej kaloryczności albo pomijasz.',
      'Bez planu dostajesz propozycję dnia z tego, co jest w sklepach w pobliżu i w domu.',
      'Cel dnia dopasowuje się do tygodnia, a postęp pokazuje prognozę wagi.',
    ],
    data: 'Cel kalorii liczę z profilu diety. Wagę, wzrost i kroki biorę z treningów — wpisujesz je raz. Wszystko zostaje na tym urządzeniu.',
    cta: 'Ustaw profil diety',
    workbook: 'Masz arkusz z planem? Wczytasz go w profilu diety — parametry z panelu i posiłki przyjdą razem.',
  },
  en: {
    what: 'Food diary',
    tag: 'Start with your diet profile',
    lead: 'You log what you eat and the diary keeps the day’s balance: calories, protein, carbs and fat against your goal — and tells you what’s missing and what’s too much.',
    bullets: [
      'Tick off your Excel plan, swap items for something with similar calories, or skip them.',
      'Without a plan you get a suggested day from what’s in shops nearby and at home.',
      'The day’s goal follows your week, and Progress shows a weight forecast.',
    ],
    data: 'I work out your calorie goal from the diet profile. Weight, height and steps come from training — you enter them once. Everything stays on this device.',
    cta: 'Set up your diet profile',
    workbook: 'Got a workbook with a plan? Import it in the diet profile — the panel settings and meals come in together.',
  },
});

/** Czekanie na IndexedDB — ten sam żart co przy wczytywaniu zakładki, żeby ekran nie mrugał dwoma tekstami. */
export function Loading() {
  return <div className="empty">{pick(LOADING, daySeed())}</div>;
}

/**
 * Pierwsze wejście w dziennik bez profilu diety. W Produktach PL formularz profilu stawał od razu
 * w miejscu dnia; tu dziennik najpierw mówi, co robi i co z niego będzie, a profil to osobna
 * podstrona — jedno wyjście, nic, co bez profilu i tak by nie działało.
 */
export function Onboarding({ what = T.what }: { what?: string }) {
  return (
    <>
      <div className="grp fd-diet-onboard">
        <div className="today-tag light">{T.tag}</div>
        <h2 className="today-name">{what}</h2>
        <p className="tight">{T.lead}</p>
        <ul className="fd-diet-bullets">
          {T.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="tight">{T.data}</p>
        <div className="actions">
          <a className="btn wide" href={dietPath('profile')}>
            {T.cta}
          </a>
        </div>
        <p className="tight">{T.workbook}</p>
      </div>
    </>
  );
}
