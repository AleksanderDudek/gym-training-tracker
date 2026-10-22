import type { CSSProperties, ReactNode } from 'react';
import { text } from '../i18n';

/**
 * Zastrzeżenie zdrowotne — jedno źródło tekstu dla wprowadzenia, ustawień, startu planu,
 * podglądu treningu i kalorii.
 *
 * Krótka wersja stoi wszędzie tam, gdzie zapada decyzja o wysiłku; pełna — w ustawieniach.
 * Pełna mówi nie tylko „nie zastępujemy lekarza”, ale też kiedy z nim porozmawiać przed
 * startem i kiedy przerwać trening — zastrzeżenie, z którego nic nie wynika, nikogo nie chroni.
 * Lista sytuacji idzie za kwestionariuszem PAR-Q+ i zaleceniami ACSM (Riebe i in., 2015).
 */

const T = text({
  pl: {
    short:
      'GYM TRACKER pomaga planować i zapisywać trening, ale nie zastępuje fizjoterapeuty, dietetyka ani konsultacji lekarskiej.',
    watch:
      'Liczby z czujników zegarka, pokazane bez oceny: tętno spoczynkowe to średnia z ostatnich 7 dni, stres i Body Battery w skali 0–100. Pomiar na nadgarstku bywa niedokładny. Jeśli coś cię niepokoi, porozmawiaj z lekarzem.',
    phone:
      'Liczby z Apple Zdrowie albo Health Connect, pokazane bez oceny: tętno spoczynkowe dnia, sen z nocy, która skończyła się tego dnia, i ostatnie ważenie dnia. Ich dokładność zależy od urządzenia, które je zapisało. Jeśli coś cię niepokoi, porozmawiaj z lekarzem.',
    title: 'Zdrowie i bezpieczeństwo',
    doctor: (
      <>
        <b>Zanim zaczniesz, porozmawiaj z lekarzem,</b> jeśli masz chorobę serca, nadciśnienie,
        cukrzycę albo inną chorobę przewlekłą, jesteś w ciąży lub po porodzie, wracasz po urazie
        albo operacji, czujesz ból w klatce piersiowej przy wysiłku albo zdarzają ci się zawroty
        głowy i omdlenia.
      </>
    ) as ReactNode,
    stop: (
      <>
        <b>Przerwij trening</b> przy bólu w klatce piersiowej, duszności większej niż zwykła
        zadyszka, zawrotach głowy, kołataniu serca albo ostrym bólu stawu czy kręgosłupa — innym niż
        znajome zmęczenie mięśni. Ból, który wraca, warto pokazać fizjoterapeucie.
      </>
    ) as ReactNode,
    kcal: (
      <>
        <b>Kalorie są szacunkiem,</b> a nie zaleceniem żywieniowym. Ile i co jeść, ustala się
        z dietetykiem. Sylwetka w atlasie i filmy pokazują tor ruchu, ale nie zastąpią instruktora,
        który zobaczy twoją technikę.
      </>
    ) as ReactNode,
  },
  en: {
    short:
      'GYM TRACKER helps you plan and log your training, but it doesn’t replace a physiotherapist, a dietitian or medical advice.',
    watch:
      'Numbers from your watch’s sensors, shown without judgement: resting heart rate is the average of the last 7 days; stress and Body Battery are on a 0–100 scale. Wrist readings can be inaccurate. If something worries you, talk to a doctor.',
    phone:
      'Numbers from Apple Health or Health Connect, shown without judgement: the day’s resting heart rate, sleep from the night that ended that day, and the day’s last weigh-in. Their accuracy depends on the device that recorded them. If something worries you, talk to a doctor.',
    title: 'Health and safety',
    doctor: (
      <>
        <b>Talk to a doctor before you start</b> if you have heart disease, high blood pressure, diabetes or another
        chronic condition, are pregnant or have recently given birth, are coming back from an injury or surgery, feel
        chest pain during exercise, or have dizzy spells or fainting.
      </>
    ),
    stop: (
      <>
        <b>Stop training</b> if you feel chest pain, shortness of breath beyond ordinary puffing, dizziness, heart
        palpitations or sharp pain in a joint or your spine — anything other than familiar muscle fatigue. Pain that
        keeps coming back is worth showing to a physiotherapist.
      </>
    ),
    kcal: (
      <>
        <b>Calories are an estimate,</b> not nutritional advice. How much and what to eat is something to work out
        with a dietitian. The figure in the atlas and the videos show the movement path, but they can’t replace an
        instructor who can see your technique.
      </>
    ),
  },
});

export const HEALTH_SHORT = T.short;

/**
 * Pod liczbami zdrowia z zegarka. Pokazujemy je bez oceny — „za wysokie” albo „w normie”
 * mówi lekarz, nie aplikacja.
 */
export const WATCH_NOTE = T.watch;

/** Pod liczbami z telefonu — ta sama zasada co przy zegarku, inne źródła liczb. */
export const PHONE_NOTE = T.phone;

export function HealthNote({ style }: { style?: CSSProperties }) {
  return (
    <p className="hint health-note" style={style}>
      {HEALTH_SHORT}
    </p>
  );
}

export function HealthCard() {
  return (
    <div className="grp">
      <h2>{T.title}</h2>
      <p className="tight">{HEALTH_SHORT}</p>
      <p className="tight">{T.doctor}</p>
      <p className="tight">{T.stop}</p>
      <p className="tight">{T.kcal}</p>
    </div>
  );
}
