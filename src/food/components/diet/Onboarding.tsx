import { dietPath } from '../../../routing';
import { LOADING, daySeed, pick } from '../../../engine/quips';
import { text } from '../../../i18n';

const T = text({
  pl: {
    what: 'Dziennik jedzenia',
    tag: 'Zacznij od profilu diety',
    lead: 'Zapisujesz, co jesz, a dziennik pokazuje, ile zostało na dziś — kalorii i białka.',
    bullets: [
      'Plan z Excela odhaczasz, zamieniasz na coś o podobnej kaloryczności albo pomijasz.',
      'Bez planu dostajesz propozycję dnia z tego, co jest w sklepach w pobliżu i w domu.',
      'Cel jest jeden na cały dzień, a co tydzień dopasowuję go do Twojej wagi.',
    ],
    data: 'Cel liczę z kilku odpowiedzi w profilu diety. Wagę, wzrost i kroki biorę z treningów — wpisujesz je raz. Wszystko zostaje na tym urządzeniu.',
    cta: 'Ustaw profil diety',
    plain: 'Bez liczenia kalorii',
    plainHint: 'Dziennik pokaże białko i podpowie posiłki, bez kalorii. Zmienisz to w profilu.',
    workbook: 'Masz arkusz z planem? Wczytasz go w profilu diety — parametry z panelu i posiłki przyjdą razem.',
  },
  en: {
    what: 'Food diary',
    tag: 'Start with your diet profile',
    lead: 'You log what you eat, and the diary shows what’s left for today — calories and protein.',
    bullets: [
      'Tick off your Excel plan, swap items for something with similar calories, or skip them.',
      'Without a plan you get a suggested day from what’s in shops nearby and at home.',
      'There’s one target for the whole day, and every week I fit it to your weight.',
    ],
    data: 'I work out your target from a few answers in the diet profile. Weight, height and steps come from training — you enter them once. Everything stays on this device.',
    cta: 'Set up your diet profile',
    plain: 'No calorie counting',
    plainHint: 'The diary shows protein and suggests meals, without calories. You can change it in the profile.',
    workbook: 'Got a workbook with a plan? Import it in the diet profile — the panel settings and meals come in together.',
  },
});

/** `tryb` w adresie profilu diety: profil otwiera się z „Bez liczenia kalorii” włączonym. */
export const PLAIN_MODE = 'bez-liczb';

/** Czekanie na IndexedDB — ten sam żart co przy wczytywaniu zakładki, żeby ekran nie mrugał dwoma tekstami. */
export function Loading() {
  return <div className="empty">{pick(LOADING, daySeed())}</div>;
}

/**
 * Pierwsze wejście w dziennik bez profilu diety. W Produktach PL formularz profilu stawał od razu
 * w miejscu dnia; tu dziennik najpierw mówi, co robi i co z niego będzie, a profil to osobna
 * podstrona. Dwa wyjścia: profil z liczeniem kalorii albo bez nich (białko i propozycje posiłków) —
 * nie każdy chce liczyć kalorie, a to drugie jest równie widoczne.
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
          <a className="btn ghost wide" href={`${dietPath('profile')}?tryb=${PLAIN_MODE}`}>
            {T.plain}
          </a>
        </div>
        <p className="tight fd-diet-soft">{T.plainHint}</p>
        <p className="tight">{T.workbook}</p>
      </div>
    </>
  );
}
