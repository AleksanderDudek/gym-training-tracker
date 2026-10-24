import { text } from '../i18n';
import type { Cap, Short } from '../watches/types';

/**
 * Kilka słów wspólnych dla karty zegarka i ekranu kroków (główna paczka) oraz leniwego
 * sprawdzania modelu (`WatchCheck`). Plik celowo mały i bez listy zegarków: karta w ustawieniach
 * nie może wciągnąć listy do głównej paczki — wystarczą jej te słowa i zapamiętany model.
 */

/** „a, b i c” / „a, b ani c” — ostatnią parę łączy podane słowo. */
const join = (xs: readonly string[], last: string): string =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')}${last}${xs.at(-1)}`;

export const W = text({
  pl: {
    /** Mianownik: „Przyjdą same: …, stres i Body Battery”. */
    cap: { stress: 'stres', bodyBattery: 'Body Battery', rides: 'przejazdy rowerem' } as Record<Cap, string>,
    /** Dopełniacz po przeczeniu: „nie udostępnia … stresu ani przejazdów rowerem”. */
    capNot: { stress: 'stresu', bodyBattery: 'Body Battery', rides: 'przejazdów rowerem' } as Record<Cap, string>,
    steps: 'kroki',
    hr: 'tętno',
    and: (xs: readonly string[]) => join(xs, ' i '),
    nor: (xs: readonly string[]) => join(xs, ' ani '),
    /** Krótka odpowiedź: wiersz listy, podpowiedź pola i „Wybrany model: … — …”. */
    short: {
      ok: 'obsługiwany',
      part: 'bez części danych',
      no: 'nieobsługiwany',
      notYet: 'jeszcze nie',
      other: 'to nie Garmin',
    } as Record<Short, string>,
  },
  en: {
    cap: { stress: 'stress', bodyBattery: 'Body Battery', rides: 'bike rides' },
    capNot: { stress: 'stress', bodyBattery: 'Body Battery', rides: 'bike rides' },
    steps: 'steps',
    hr: 'heart rate',
    and: (xs: readonly string[]) => join(xs, ' and '),
    nor: (xs: readonly string[]) => join(xs, ' or '),
    short: {
      ok: 'supported',
      part: 'without some data',
      no: 'not supported',
      notYet: 'not yet',
      other: 'not a Garmin',
    },
  },
});

/** Kolejność danych w zdaniach o brakach — ta sama na karcie, w ustawieniach i na ekranie kroków. */
export const CAPS: readonly Cap[] = ['stress', 'bodyBattery', 'rides'];

/** Czego model nie udostępnia aplikacjom — „stresu, Body Battery ani przejazdów rowerem”. */
export const lacksText = (caps: readonly Cap[]): string =>
  W.nor(CAPS.filter((c) => caps.includes(c)).map((c) => W.capNot[c]));
