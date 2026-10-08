import type { CSSProperties } from 'react';

/**
 * Zastrzeżenie zdrowotne — jedno źródło tekstu dla wprowadzenia, ustawień, startu planu,
 * podglądu treningu i kalorii.
 *
 * Krótka wersja stoi wszędzie tam, gdzie zapada decyzja o wysiłku; pełna — w ustawieniach.
 * Pełna mówi nie tylko „nie zastępujemy lekarza”, ale też kiedy z nim porozmawiać przed
 * startem i kiedy przerwać trening — zastrzeżenie, z którego nic nie wynika, nikogo nie chroni.
 * Lista sytuacji idzie za kwestionariuszem PAR-Q+ i zaleceniami ACSM (Riebe i in., 2015).
 */

export const HEALTH_SHORT =
  'GYM TRACKER pomaga planować i zapisywać trening, ale nie zastępuje fizjoterapeuty, dietetyka ani konsultacji lekarskiej.';

/**
 * Pod liczbami zdrowia z zegarka. Pokazujemy je bez oceny — „za wysokie” albo „w normie”
 * mówi lekarz, nie aplikacja.
 */
export const WATCH_NOTE =
  'Liczby z czujników zegarka, pokazane bez oceny: tętno spoczynkowe to średnia z ostatnich 7 dni, stres i Body Battery w skali 0–100, sen — wynik snu z zegarka. Pomiar na nadgarstku bywa niedokładny. Jeśli coś cię niepokoi, porozmawiaj z lekarzem.';

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
      <h2>Zdrowie i bezpieczeństwo</h2>
      <p className="tight">{HEALTH_SHORT}</p>
      <p className="tight">
        <b>Zanim zaczniesz, porozmawiaj z lekarzem,</b> jeśli masz chorobę serca, nadciśnienie,
        cukrzycę albo inną chorobę przewlekłą, jesteś w ciąży lub po porodzie, wracasz po urazie
        albo operacji, czujesz ból w klatce piersiowej przy wysiłku albo zdarzają ci się zawroty
        głowy i omdlenia.
      </p>
      <p className="tight">
        <b>Przerwij trening</b> przy bólu w klatce piersiowej, duszności większej niż zwykła
        zadyszka, zawrotach głowy, kołataniu serca albo ostrym bólu stawu czy kręgosłupa — innym niż
        znajome zmęczenie mięśni. Ból, który wraca, warto pokazać fizjoterapeucie.
      </p>
      <p className="tight">
        <b>Kalorie są szacunkiem,</b> a nie zaleceniem żywieniowym. Ile i co jeść, ustala się
        z dietetykiem. Sylwetka w atlasie i filmy pokazują tor ruchu, ale nie zastąpią instruktora,
        który zobaczy twoją technikę.
      </p>
    </div>
  );
}
