import type { ReactNode } from 'react';
import { plural } from '../engine/quips';
import { pluralEn, text } from '../i18n';
import type { Short } from '../watches/types';

/**
 * Teksty sprawdzania modelu zegarka („Czy mój zegarek jest obsługiwany?”), oba języki. Nazwy
 * produktów (Forerunner®, „GYM TRACKER Zdrowie”) zostają, jak są; argumenty `name` to nazwy z listy.
 * Zdania z listą danych biorą słowa z `WatchCheck.words.ts`. Wersja Connect IQ nigdy nie stoi
 * w nagłówku — tylko w uzasadnieniu i w „Więcej”.
 */

const cap1 = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const T = text({
  pl: {
    /* ---- pole ---- */
    label: 'Jaki masz zegarek?',
    placeholder: 'np. Forerunner 265, fēnix 7, Venu 3',
    check: 'Sprawdź',
    clear: 'Wyczyść',
    /** Czytnik ekranu, pół sekundy po ostatnim znaku. */
    count: (n: number) =>
      n ? `${n} ${plural(n, ['podpowiedź', 'podpowiedzi', 'podpowiedzi'])}` : 'Brak podpowiedzi — naciśnij Sprawdź.',
    /** Pod podpowiedziami, gdy pasuje więcej, niż widać. */
    moreHits: (n: number) => `i ${n} więcej — dopisz numer modelu`,
    popular: 'Popularne:',
    where: 'Gdzie znajdę nazwę modelu?',
    whereText:
      'Aplikacja Garmin Connect pokazuje nazwę na liście urządzeń. Na zegarku szukaj jej w ustawieniach, w części o systemie (menu różni się między modelami). Stoi też na pudełku.',
    all: (n: number) => `Wszystkie obsługiwane zegarki — ${n} ${plural(n, ['model', 'modele', 'modeli'])}`,
    /** Nagłówek linii Legacy na pełnej liście: zegarki z bohaterami mają same imiona. */
    legacy: 'Legacy (Marvel, Star Wars)',
    source: 'Lista według danych Garmina z października 2026.',
    prompt: 'Wpisz nazwę modelu, np. Forerunner 265 albo Venu 3.',

    /* ---- wynik: nagłówek ---- */
    verdict: {
      ok: 'Obsługiwany',
      part: 'Obsługiwany, bez części danych',
      no: 'Nieobsługiwany',
      notYet: 'Jeszcze nieobsługiwany',
      other: 'To nie Garmin',
    } as Record<Short, string>,
    asian: 'wersja azjatycka',
    sameWatch: (name: string) => `W Connect IQ to ten sam zegarek co ${name}.`,

    /* ---- obsługiwany ---- */
    arrive: (list: string) => `Przyjdą same: ${list}.`,
    lacks: (list: string) => `Ten model nie udostępnia aplikacjom ${list}.`,
    ciqLine: (ciq: string) => `Connect IQ ${ciq}.`,
    newest: (list: string, many: boolean) =>
      `${cap1(list)} ${many ? 'przyjdą' : 'przyjdzie'}, gdy zegarek ma najnowsze oprogramowanie — starsze wersje nie udostępniają ${many ? 'ich' : 'tego'} aplikacjom.`,
    howUpdate:
      'Aktualizacja: zsynchronizuj zegarek z aplikacją Garmin Connect — nowe oprogramowanie przychodzi samo i instaluje się, gdy zegarka nie używasz. Można też podłączyć go kablem do komputera z programem Garmin Express.',
    bothWays:
      'Sen i wagę przyniesie telefon — karta „Zdrowie z telefonu”. Oba połączenia mogą działać naraz, kroki się nie zdublują.',
    /** Gdy z zegarka nie przyjdą przejazdy: telefon je ma (treningi z Garmin Connect). */
    bothWaysRides:
      'Przejazdy rowerem, sen i wagę przyniesie telefon — karta „Zdrowie z telefonu”. Oba połączenia mogą działać naraz, kroki się nie zdublują.',
    connect: 'Połącz zegarek',
    more: 'Więcej',
    same: (names: string, more: number) =>
      `Tak samo: ${names}${more ? ` i ${more} ${plural(more, ['inny', 'inne', 'innych'])}` : ''}.`,
    /** Podobna nazwa, inna odpowiedź — pytanie, nazwa jest przyciskiem. */
    otherQuestion: (name: ReactNode, short: string): ReactNode => (
      <>
        Masz może {name}? To inny model — {short}.
      </>
    ),
    asianNote: (list: string) =>
      `Kupiony w Azji (wersja APAC, bez polskiego w menu)? Według danych Garmina ta wersja może nie przysyłać: ${list}.`,
    asianCard: (have: string, none: string, many: boolean) =>
      `To wersja azjatycka (APAC). Według danych Garmina ma starsze oprogramowanie: przyjdą ${have}, ale ${none} ${many ? 'mogą' : 'może'} nie przychodzić. Wersja europejska jest obsługiwana w pełni.`,
    regionalNote: 'Wersja azjatycka (APAC) tego modelu nie jest obsługiwana — sklep Connect IQ pokaże ją jako niezgodną.',
    feedback: 'Coś nie działa? Napisz do autora',

    /* ---- nieobsługiwany ---- */
    oldCiq: (name: string, ciq: string) =>
      `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} ma Connect IQ ${ciq}, a potrzeba co najmniej 3.2 — dopiero od tej wersji aplikacja może zapisywać dane w tle. Nowszej wersji Garmin dla tego modelu nie wydał.`,
    noBackground: (name: string, ciq: string) =>
      `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} ma Connect IQ ${ciq} — to za mało dla aplikacji, która sama wysyła dane w tle.`,
    noApps: (name: string) =>
      `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} obsługuje tylko tarcze zegarka, bez aplikacji Connect IQ.`,
    noCiq: (name: string) => `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} nie obsługuje aplikacji Connect IQ.`,
    band: (name: string) => `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} to opaska bez aplikacji Connect IQ.`,
    bike: (name: string) =>
      `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} to licznik rowerowy, a aplikacja działa na zegarkach.`,
    handheld: (name: string) =>
      `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} to nawigacja turystyczna, a aplikacja działa na zegarkach.`,
    scale: (name: string) => `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} to waga.`,
    regional:
      'Ta wersja azjatycka (APAC) nie jest obsługiwana: Garmin nie opisał jej dla twórców aplikacji, więc sklep Connect IQ pokaże ją jako niezgodną. Wersja europejska jest obsługiwana w pełni.',
    notYet: 'Ten zegarek jest nowszy niż lista modeli, z którą zbudowano aplikację na zegarek. Obsługa jest planowana.',
    brand: (name: string) => `${name} to nie Garmin — aplikacja na zegarek działa tylko z zegarkami Garmin.`,
    apple: 'Apple Watch zapisuje kroki, tętno i treningi w Apple Zdrowie na iPhonie.',
    brandBike: (name: string) =>
      `${name} to licznik rowerowy innej firmy, a aplikacja GYM TRACKER działa tylko na zegarkach Garmin.`,

    /* ---- zamiast tego: telefon ---- */
    instead: 'Zamiast tego — telefon',
    /** `from`: null — Garmin Connect; nazwa — aplikacja innej marki; '' — aplikacja bez znanej nazwy. */
    viaAndroid: (from: string | null) =>
      `Android: ${from === null ? 'w Garmin Connect włącz udostępnianie do Health Connect (Ustawienia → Połączone aplikacje)' : `w aplikacji ${from || 'zegarka'} włącz zapisywanie do Health Connect (jeśli ma taką opcję)`}, a potem połącz telefon w karcie „Zdrowie z telefonu”. ${from === null ? 'Przyjdą kroki, sen, tętno, waga i treningi.' : 'Przyjdzie to, co ta aplikacja tam zapisuje.'}`,
    viaIos: (from: string | null) =>
      `iPhone: ${from === null ? 'w Garmin Connect włącz udostępnianie do Apple Zdrowie (Ustawienia → Połączone aplikacje)' : `w aplikacji ${from || 'zegarka'} włącz zapisywanie do Apple Zdrowie (jeśli ma taką opcję)`}, a potem połącz telefon w karcie „Zdrowie z telefonu”.`,
    viaIosApple: 'iPhone: połącz telefon w karcie „Zdrowie z telefonu” — dane z Apple Watch są już w Apple Zdrowie.',
    iosNotYet:
      'iPhone: aplikacja GYM TRACKER Zdrowie na iPhone’a jeszcze nie jest gotowa — na razie kroki wpiszesz ręcznie, to kilka sekund dziennie.',
    byHand: 'Na razie kroki wpiszesz ręcznie — to kilka sekund dziennie.',
    toPhone: '„Zdrowie z telefonu” →',
    toSteps: 'Wpisz kroki →',

    /* ---- nie wiem ---- */
    unknown: (q: string) => `Nie znam „${q}”`,
    unknownText:
      'Może to nowy model albo inna pisownia. Sprawdź nazwę w Garmin Connect albo przejrzyj pełną listę niżej.',
    near: 'Najbliżej:',
    guess: (q: string) => `Nie znam dokładnie „${q}”. Czy chodzi o:`,
    storeList: 'Zgodne urządzenia w Connect IQ Store',
    write: 'Napisz do autora',
    line: (what: string) => `${what}: modele się różnią — wybierz swój.`,
    /** Grupy w widoku linii — te same słowa co odpowiedzi. */
    group: {
      ok: 'Obsługiwane',
      part: 'Obsługiwane, bez części danych',
      no: 'Nieobsługiwane',
      notYet: 'Jeszcze nieobsługiwane',
      other: 'Inne marki',
    } as Record<Short, string>,
  },
  en: {
    label: 'Which watch do you have?',
    placeholder: 'e.g. Forerunner 265, fēnix 7, Venu 3',
    check: 'Check',
    clear: 'Clear',
    count: (n: number) => (n ? `${n} ${pluralEn(n, 'suggestion', 'suggestions')}` : 'No suggestions — press Check.'),
    moreHits: (n: number) => `and ${n} more — add the model number`,
    popular: 'Popular:',
    where: 'Where do I find the model name?',
    whereText:
      'The Garmin Connect app shows the name in your device list. On the watch, look in the settings, in the system section (menus vary between models). It’s on the box too.',
    all: (n: number) => `All supported watches — ${n} ${pluralEn(n, 'model', 'models')}`,
    legacy: 'Legacy (Marvel, Star Wars)',
    source: 'List based on Garmin’s data from October 2026.',
    prompt: 'Type a model name, e.g. Forerunner 265 or Venu 3.',

    verdict: {
      ok: 'Supported',
      part: 'Supported, without some data',
      no: 'Not supported',
      notYet: 'Not supported yet',
      other: 'Not a Garmin',
    },
    asian: 'Asian version',
    sameWatch: (name: string) => `In Connect IQ it’s the same watch as ${name}.`,

    arrive: (list: string) => `These arrive by themselves: ${list}.`,
    lacks: (list: string) => `This model doesn’t share ${list} with apps.`,
    ciqLine: (ciq: string) => `Connect IQ ${ciq}.`,
    newest: (list: string, many: boolean) =>
      `${cap1(list)} ${many ? 'arrive' : 'arrives'} once the watch has its latest software — older versions don’t share ${many ? 'them' : 'it'} with apps.`,
    howUpdate:
      'To update: sync the watch with the Garmin Connect app — new software arrives by itself and installs while you’re not using the watch. You can also connect it by cable to a computer with Garmin Express.',
    bothWays:
      'Sleep and weight come through your phone — the “Health from your phone” card. Both connections can run at once; steps won’t count twice.',
    bothWaysRides:
      'Bike rides, sleep and weight come through your phone — the “Health from your phone” card. Both connections can run at once; steps won’t count twice.',
    connect: 'Connect watch',
    more: 'More',
    same: (names: string, more: number) => `Same answer: ${names}${more ? ` and ${more} more` : ''}.`,
    otherQuestion: (name: ReactNode, short: string): ReactNode => (
      <>
        Do you have the {name}? That’s a different model — {short}.
      </>
    ),
    asianNote: (list: string) =>
      `Bought in Asia (APAC version, no Polish in the menus)? According to Garmin’s data that version may not send: ${list}.`,
    asianCard: (have: string, none: string, _many: boolean) =>
      `This is the Asian version (APAC). According to Garmin’s data it has older software: ${have} arrive, but ${none} may not. The European version is fully supported.`,
    regionalNote: 'The Asian (APAC) version of this model isn’t supported — the Connect IQ Store shows it as incompatible.',
    feedback: 'Something not working? Write to the author',

    oldCiq: (name: string, ciq: string) =>
      `The GYM TRACKER watch app doesn’t run on it: the ${name} has Connect IQ ${ciq}, and 3.2 or newer is needed — only from that version can an app save data in the background. Garmin hasn’t released a newer version for this model.`,
    noBackground: (name: string, ciq: string) =>
      `The GYM TRACKER watch app doesn’t run on it: the ${name} has Connect IQ ${ciq} — not enough for an app that sends data in the background by itself.`,
    noApps: (name: string) =>
      `The GYM TRACKER watch app doesn’t run on it: the ${name} only supports watch faces, no Connect IQ apps.`,
    noCiq: (name: string) => `The GYM TRACKER watch app doesn’t run on it: the ${name} doesn’t support Connect IQ apps.`,
    band: (name: string) =>
      `The GYM TRACKER watch app doesn’t run on it: the ${name} is a fitness band with no Connect IQ apps.`,
    bike: (name: string) =>
      `The GYM TRACKER watch app doesn’t run on it: the ${name} is a bike computer, and the app runs on watches.`,
    handheld: (name: string) =>
      `The GYM TRACKER watch app doesn’t run on it: the ${name} is a handheld GPS, and the app runs on watches.`,
    scale: (name: string) => `The GYM TRACKER watch app doesn’t run on it: the ${name} is a scale.`,
    regional:
      'This Asian (APAC) version isn’t supported: Garmin hasn’t described it for app makers, so the Connect IQ Store shows it as incompatible. The European version is fully supported.',
    notYet: 'This watch is newer than the model list the watch app was built with. Support is planned.',
    brand: (name: string) => `${name} isn’t a Garmin — the watch app works with Garmin watches only.`,
    apple: 'Apple Watch saves steps, heart rate and workouts to Apple Health on your iPhone.',
    brandBike: (name: string) =>
      `${name} is another brand’s bike computer, and the GYM TRACKER app runs on Garmin watches only.`,

    instead: 'Instead — your phone',
    viaAndroid: (from: string | null) =>
      `Android: ${from === null ? 'in Garmin Connect, turn on sharing with Health Connect (Settings → Connected Apps)' : `in ${from ? `the ${from} app` : 'the watch’s app'}, turn on saving to Health Connect (if it has that option)`}, then connect your phone in the “Health from your phone” card. ${from === null ? 'Steps, sleep, heart rate, weight and workouts arrive.' : 'Whatever that app saves there arrives.'}`,
    viaIos: (from: string | null) =>
      `iPhone: ${from === null ? 'in Garmin Connect, turn on sharing with Apple Health (Settings → Connected Apps)' : `in ${from ? `the ${from} app` : 'the watch’s app'}, turn on saving to Apple Health (if it has that option)`}, then connect your phone in the “Health from your phone” card.`,
    viaIosApple: 'iPhone: connect your phone in the “Health from your phone” card — Apple Watch data is already in Apple Health.',
    iosNotYet:
      'iPhone: the GYM TRACKER Zdrowie app for iPhone isn’t ready yet — for now, type in your steps; it takes a few seconds a day.',
    byHand: 'For now, type in your steps — it takes a few seconds a day.',
    toPhone: '“Health from your phone” →',
    toSteps: 'Type in steps →',

    unknown: (q: string) => `I don’t know “${q}”`,
    unknownText:
      'It may be a new model or a different spelling. Check the name in Garmin Connect or look through the full list below.',
    near: 'Closest:',
    guess: (q: string) => `I don’t know exactly “${q}”. Did you mean:`,
    storeList: 'Compatible devices in the Connect IQ Store',
    write: 'Write to the author',
    line: (what: string) => `${what}: the models differ — pick yours.`,
    group: {
      ok: 'Supported',
      part: 'Supported, without some data',
      no: 'Not supported',
      notYet: 'Not supported yet',
      other: 'Other brands',
    },
  },
});
