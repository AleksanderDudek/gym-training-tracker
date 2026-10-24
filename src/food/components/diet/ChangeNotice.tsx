import { useState } from 'react';
import { text } from '../../../i18n';
import { dietPath } from '../../../routing';
import { dismissNotice, resolveFloor } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { noticeNotes } from '../../diet/upgrade';
import { formatNumber } from '../../lib/format';
import { useKcalShown } from './kcalShown';

const n = (value: number) => formatNumber(Math.round(value), 0);

const T = text({
  pl: {
    title: 'Liczenie kalorii jest teraz prostsze',
    one: (target: string) => `Jeden cel na każdy dzień: ${target} kcal. Nie zmienia się w ciągu dnia ani po północy.`,
    onePlain: 'Jeden cel na każdy dzień. Nie zmienia się w ciągu dnia ani po północy.',
    two: 'Kroki i treningi nie zmieniają już celu. Kalorie z ruchu to szacunek z dużym błędem, a Twój zwykły ruch jest już w celu.',
    three: 'Nadwyżka z jednego dnia nie obniża kolejnych, a ±100 kcal to wciąż cel — jeden dzień nie zmienia trendu.',
    four: 'W poniedziałki sprawdzam wagę i zapisy z ostatnich 4 tygodni. Gdy się nie zgadzają, zmieniam cel o 100 kcal i mówię dlaczego. Gdy wychodzi, że spalasz mniej, niż liczyłem, zanim obniżę cel, pytam.',
    fourPlain:
      'W poniedziałki sprawdzam wagę i zapisy z ostatnich 4 tygodni. Gdy się nie zgadzają, podnoszę cel i mówię dlaczego — nigdy go nie obniżam.',
    five: '„Cheat meal” to teraz „Większy posiłek”, a porównanie tygodni na stronie Postęp pokazuje tylko pewne wnioski.',
    age: 'Poniżej 18 lat nie liczę kalorii ani nie ustawiam deficytu — dziennik pokazuje białko i podpowiada posiłki.',
    bmi: (target: string) => `Przy BMI poniżej 18,5 nie prowadzę deficytu — cel to teraz utrzymanie: ${target} kcal.`,
    hardMin: (min: string) => `Poprzedni cel był niższy niż ${min} kcal — mniej nie ustawiam. Cel to teraz ${min} kcal.`,
    belowFloor: (floor: string) => `Twój cel jest niższy niż Twoja podstawowa przemiana materii (${floor} kcal).`,
    raise: (floor: string) => `Podnieś do ${floor} kcal`,
    keepDoctor: 'Zostaw — ustalony z lekarzem albo dietetykiem',
    gotIt: 'Rozumiem',
    settings: 'Ustawienia w profilu diety',
  },
  en: {
    title: 'Calorie counting is simpler now',
    one: (target: string) => `One target for every day: ${target} kcal. It doesn’t change during the day or after midnight.`,
    onePlain: 'One target for every day. It doesn’t change during the day or after midnight.',
    two: 'Steps and workouts no longer change the target. Calories from activity are a rough estimate, and your usual activity is already in the target.',
    three: 'A surplus on one day no longer lowers the next ones, and ±100 kcal is still on target — one day doesn’t change the trend.',
    four: 'On Mondays I look at your weight and logs from the last 4 weeks. If they don’t match, I change the target by 100 kcal and tell you why. If it looks like you burn less than I assumed, I ask before lowering it.',
    fourPlain:
      'On Mondays I look at your weight and logs from the last 4 weeks. If they don’t match, I raise the target and tell you why — I never lower it.',
    five: '“Cheat meal” is now “Bigger meal”, and the week comparison on the Progress page shows only clear findings.',
    age: 'Under 18 I don’t count calories or set a deficit — the diary shows protein and suggests meals.',
    bmi: (target: string) => `With a BMI under 18.5 I don’t keep a deficit — your target is now maintenance: ${target} kcal.`,
    hardMin: (min: string) => `Your previous target was below ${min} kcal — I don’t set less. Your target is now ${min} kcal.`,
    belowFloor: (floor: string) => `Your target is below your basal metabolic rate (${floor} kcal).`,
    raise: (floor: string) => `Raise to ${floor} kcal`,
    keepDoctor: 'Keep it — agreed with a doctor or dietitian',
    gotIt: 'Got it',
    settings: 'Settings in your diet profile',
  },
});

/**
 * What the upgrade changed for this person, beyond the five bullets everyone gets (`noticeNotes`):
 * a safety rule that moved the target (under 18, a BMI under 18.5, the hard minimum), and a kept
 * target under the BMR floor, which needs a choice. Without calories only the age line is left.
 */
function personal(p: Profile, kgNow: number, shown: boolean): { bullet: string | null; floor: number | null } {
  const notes = noticeNotes(p, kgNow);
  if (notes.age) return { bullet: T.age, floor: null };
  if (!shown) return { bullet: null, floor: null };
  const bullet = notes.bmi ? T.bmi(n(p.dailyKcal)) : notes.hardMin !== null ? T.hardMin(n(notes.hardMin)) : null;
  return { bullet, floor: notes.floor };
}

interface Props {
  profile: Profile;
  today: string;
  /** The weight the floor is worked out at: the display trend today, else the start weight. */
  kgNow: number;
}

/**
 * The one-time notice after the upgrade to one target a day (spec §4.2), on today's diary while
 * `notice === 'show'`: what changed in five sentences, anything a safety rule changed for this
 * person, and „Rozumiem”. A kept target under the BMR floor gets its two choices here; unanswered,
 * the Monday check raises it by 100 kcal a week. Without calories on screen the numbers drop out.
 */
export function ChangeNotice({ profile, today, kgNow }: Props) {
  const shown = useKcalShown();
  const [busy, setBusy] = useState(false);
  const { bullet, floor } = personal(profile, kgNow, shown);

  const act = (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void work().finally(() => setBusy(false));
  };

  return (
    <section className="grp fd-diet-notice" aria-labelledby="fd-diet-notice-title">
      <h2 id="fd-diet-notice-title">{T.title}</h2>
      <ul className="fd-diet-bullets">
        <li>{shown ? T.one(n(profile.dailyKcal)) : T.onePlain}</li>
        <li>{T.two}</li>
        <li>{T.three}</li>
        <li>{shown ? T.four : T.fourPlain}</li>
        <li>{T.five}</li>
        {bullet && <li>{bullet}</li>}
      </ul>
      {floor !== null && (
        <div className="fd-diet-floorchoice">
          <p className="tight">{T.belowFloor(n(floor))}</p>
          <div className="actions">
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => act(() => resolveFloor('raise', { today, kgNow }))}>
              {T.raise(n(floor))}
            </button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => act(() => resolveFloor('keep', { today, kgNow }))}>
              {T.keepDoctor}
            </button>
          </div>
        </div>
      )}
      <div className="actions fd-diet-noticeacts">
        <button type="button" className="btn sm" disabled={busy} onClick={() => act(() => dismissNotice({ weightKg: kgNow, today }))}>
          {T.gotIt}
        </button>
        <a className="fd-diet-link" href={dietPath('profile')}>
          {T.settings}
        </a>
      </div>
    </section>
  );
}
