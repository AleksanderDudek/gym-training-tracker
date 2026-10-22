/**
 * Warstwa humoru.
 *
 * Trzy zasady, których ten plik pilnuje:
 *
 * 1. Żart nigdy nie stoi tam, gdzie człowiek szuka informacji. Cele serii, ciężary, terminy
 *    i ostrzeżenia o przeciążeniu zostają suche — dowcip idzie obok, nie zamiast.
 * 2. Nigdy kosztem użytkownika. Opuszczony termin i słaby wynik są kwitowane łagodnie;
 *    śmiejemy się z siłowni, z liczb i z samej aplikacji, nie z tego, kto ćwiczy.
 * 3. Ten sam żart dwa razy przestaje być żartem, więc teksty są losowane ziarnem — tym
 *    samym w obrębie jednego ekranu, innym przy kolejnym treningu. Losowanie przy każdym
 *    renderze migałoby tekstem w trakcie czytania.
 */

import { say, text } from '../i18n';

/** Deterministyczny wybór z listy. To samo ziarno daje ten sam tekst. */
export function pick<T>(list: readonly T[], seed: number): T {
  // i18n-ignore: błąd programisty, nie tekst dla użytkownika
  if (!list.length) throw new Error('Pusta lista tekstów.');
  const i = Math.abs(Math.trunc(seed)) % list.length;
  return list[i]!;
}

/** Numer dnia w roku — ziarno dla tekstów, które mają zmieniać się raz na dobę. */
export const daySeed = (now: number = Date.now()): number =>
  Math.floor(now / 86_400_000);

/* ---------------- Odmiana ---------------- */

/** Trzy formy rzeczownika po liczebniku: 1, 2–4, reszta. */
export type Forms = readonly [string, string, string];

export function plural(n: number, forms: Forms): string {
  const abs = Math.abs(Math.round(n));
  if (abs === 1) return forms[0];
  const last = abs % 10;
  const teen = abs % 100 >= 12 && abs % 100 <= 14;
  return !teen && last >= 2 && last <= 4 ? forms[1] : forms[2];
}

/** Angielskie formy w kształcie polskich: pojedyncza i mnoga, mnoga także za „2–4”. */
const two = (one: string, other: string): Forms => [one, other, other];

/**
 * Liczba przy rzeczowniku zawsze całkowita. Ułamek wymusiłby w polszczyźnie dopełniacz
 * liczby pojedynczej („3,8 żubra”), czyli czwartą formę dla każdej jednostki — a i tak
 * porównanie jest z natury przybliżone, więc miejsce po przecinku niczego nie wnosi.
 */
const whole = (n: number): number => Math.max(1, Math.round(n));

/* ---------------- Porównania masy ---------------- */

interface MassUnit {
  kg: number;
  forms: Forms;
}

/**
 * Rzeczy o znanej masie, od worka cementu po lokomotywę. Maluch stoi tu nie przez przypadek:
 * sześćset kilogramów to liczba, którą w Polsce każdy potrafi sobie wyobrazić.
 */
const MASS: MassUnit[] = [
  { kg: 25, forms: text<Forms>({ pl: ['worek cementu', 'worki cementu', 'worków cementu'], en: two('bag of cement', 'bags of cement') }) },
  { kg: 70, forms: text<Forms>({ pl: ['pralka', 'pralki', 'pralek'], en: two('washing machine', 'washing machines') }) },
  { kg: 100, forms: text<Forms>({ pl: ['żeliwna wanna', 'żeliwne wanny', 'żeliwnych wanien'], en: two('cast-iron bath', 'cast-iron baths') }) },
  { kg: 300, forms: text<Forms>({ pl: ['fortepian', 'fortepiany', 'fortepianów'], en: two('grand piano', 'grand pianos') }) },
  { kg: 600, forms: text<Forms>({ pl: ['maluch', 'maluchy', 'maluchów'], en: two('classic Mini', 'classic Minis') }) },
  { kg: 800, forms: text<Forms>({ pl: ['żubr', 'żubry', 'żubrów'], en: two('bison', 'bison') }) },
  { kg: 1_500, forms: text<Forms>({ pl: ['hipopotam', 'hipopotamy', 'hipopotamów'], en: two('hippo', 'hippos') }) },
  { kg: 6_000, forms: text<Forms>({ pl: ['słoń', 'słonie', 'słoni'], en: two('elephant', 'elephants') }) },
  { kg: 12_000, forms: text<Forms>({ pl: ['autobus miejski', 'autobusy miejskie', 'autobusów miejskich'], en: two('double-decker bus', 'double-decker buses') }) },
  { kg: 50_000, forms: text<Forms>({ pl: ['czołg', 'czołgi', 'czołgów'], en: two('tank', 'tanks') }) },
  { kg: 100_000, forms: text<Forms>({ pl: ['lokomotywa', 'lokomotywy', 'lokomotyw'], en: two('locomotive', 'locomotives') }) },
  { kg: 4_000_000, forms: text<Forms>({ pl: ['wieża Eiffla', 'wieże Eiffla', 'wież Eiffla'], en: two('Eiffel Tower', 'Eiffel Towers') }) },
];

/**
 * Jednostka, przy której liczba wypada najbliżej kilku sztuk.
 *
 * Nie największa, która się mieści: „1,2 hipopotama” jest prawdziwe i martwe, a „3 maluchy”
 * widać od razu. Nie najmniejsza: „8 400 worków cementu” to już tylko liczba. Wybór idzie
 * po skali logarytmicznej, bo od czwórki równie daleko jest do jedynki, co do szesnastki.
 */
const SWEET = Math.log(4);

function best<T extends { kg?: number; secs?: number }>(
  units: T[],
  total: number,
  size: (u: T) => number,
): T | null {
  const fits = units.filter((u) => total / size(u) >= 1);
  if (!fits.length) return null;
  return fits.reduce((a, b) =>
    Math.abs(Math.log(total / size(b)) - SWEET) < Math.abs(Math.log(total / size(a)) - SWEET)
      ? b
      : a,
  );
}

/** Masa przełożona na przedmioty o znanym ciężarze. */
export function massJoke(kg: number): string | null {
  if (!Number.isFinite(kg) || kg < 20) return null;
  const u = best(MASS, kg, (x) => x.kg) ?? MASS[0]!;
  const n = whole(kg / u.kg);
  return `${n} ${plural(n, u.forms)}`;
}

/* ---------------- Porównania czasu i powtórzeń ---------------- */

// Biernik, nie mianownik: zdanie brzmi „zajęłoby to godzinę”, a nie „zajęłoby to godzina”.
// Różni się wyłącznie liczba pojedyncza, ale to właśnie ona wypada najczęściej.
const HOURS = text<Forms>({ pl: ['godzinę', 'godziny', 'godzin'], en: two('hour', 'hours') });
const MINUTES = text<Forms>({ pl: ['minutę', 'minuty', 'minut'], en: two('minute', 'minutes') });

const T = text({
  pl: {
    hoursAndMinutes: (hours: string, minutes: string) => `${hours} i ${minutes}`,
    reps: (time: string) => `po jednym na sekundę zajęłoby to ${time}`,
  },
  en: {
    hoursAndMinutes: (hours: string, minutes: string) => `${hours} and ${minutes}`,
    reps: (time: string) => `at one a second, that would take ${time}`,
  },
});

const clock = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h && m) return T.hoursAndMinutes(`${h} ${plural(h, HOURS)}`, `${m} ${plural(m, MINUTES)}`);
  if (h) return `${h} ${plural(h, HOURS)}`;
  return `${Math.max(1, m)} ${plural(Math.max(1, m), MINUTES)}`;
};

/** Powtórzenia jako czas: po jednym na sekundę, bez przerw i bez litości. */
export function repsJoke(reps: number): string | null {
  if (!Number.isFinite(reps) || reps < 60) return null;
  return T.reps(clock(reps));
}

interface TimeUnit {
  secs: number;
  forms: Forms;
}

const TIMES: TimeUnit[] = [
  { secs: 120, forms: text<Forms>({ pl: ['mycie zębów', 'mycia zębów', 'myć zębów'], en: two('round of tooth-brushing', 'rounds of tooth-brushing') }) },
  { secs: 300, forms: text<Forms>({ pl: ['jajko na miękko', 'jajka na miękko', 'jajek na miękko'], en: two('soft-boiled egg', 'soft-boiled eggs') }) },
  { secs: 2_520, forms: text<Forms>({ pl: ['odcinek serialu', 'odcinki serialu', 'odcinków serialu'], en: two('TV episode', 'TV episodes') }) },
  { secs: 5_400, forms: text<Forms>({ pl: ['mecz piłki', 'mecze piłki', 'meczów piłki'], en: two('football match', 'football matches') }) },
  { secs: 10_620, forms: text<Forms>({ pl: ['Władca Pierścieni', 'Władcy Pierścieni', 'Władców Pierścieni'], en: two('Lord of the Rings film', 'Lord of the Rings films') }) },
];

/** Czas pod obciążeniem przełożony na rzeczy, które trwają tyle samo. */
export function timeJoke(secs: number): string | null {
  if (!Number.isFinite(secs) || secs < 120) return null;
  const u = best(TIMES, secs, (x) => x.secs) ?? TIMES[0]!;
  const n = whole(secs / u.secs);
  return `${n} ${plural(n, u.forms)}`;
}

/* ---------------- Teksty ---------------- */

/** Podpisy pod zdobytą odznaką. Sucho, bez wykrzykników. */
export const CHEERS: readonly string[] = text({
  pl: [
    'Nikt nie bije braw. Aplikacja bije brawo.',
    'Odznaka nie zmieści się na lodówce, ale istnieje.',
    'Ktoś musiał to zrobić. Wyszło na ciebie.',
    'Zaliczone. Historia raczej tego nie odnotuje, ale my tak.',
    'Twoje mięśnie nie wiedzą o odznakach. To ich strata.',
    'Odznaka zdobyta. Kawa smakuje tak samo, ale jakoś lepiej.',
    'Punkty przyznane. Kurs ich nie rośnie, wartość sentymentalna owszem.',
    'Gratulacje. Wręczenie odbyło się w pełnej dyskrecji.',
  ],
  en: [
    'Nobody’s clapping. The app is clapping.',
    'The badge won’t fit on the fridge, but it exists.',
    'Someone had to do it. It turned out to be you.',
    'Done. History probably won’t record it, but we have.',
    'Your muscles don’t know about badges. Their loss.',
    'Badge earned. The coffee tastes the same, only somehow better.',
    'Points awarded. Their market value isn’t rising; their sentimental value is.',
    'Congratulations. The ceremony was held in complete discretion.',
  ],
});

/** Nagłówki okna po zamkniętej sesji. */
export const SAVED: readonly string[] = text({
  pl: [
    'Zapisane. Mięśnie dowiedzą się jutro.',
    'Zapisane. Liczby nie kłamią, nogi też nie będą.',
    'Zaliczone. Pot wyparował, dane zostały.',
    'Zapisane. Nikt nie patrzył, aplikacja patrzyła.',
    'Gotowe. Kanapa czeka i jest w pełni zasłużona.',
    'Zapisane. Ciężar wrócił na miejsce, ty też możesz.',
  ],
  en: [
    'Saved. Your muscles will find out tomorrow.',
    'Saved. The numbers don’t lie, and tomorrow your legs won’t either.',
    'Done. The sweat’s gone, the data stays.',
    'Saved. Nobody was watching. The app was.',
    'Finished. The sofa is waiting, and fully deserved.',
    'Saved. The kettlebell has gone home. You can too.',
  ],
});

/** Dzień bez terminu. Odpoczynek jest częścią planu, nie wymówką. */
export const REST: readonly string[] = text({
  pl: [
    'Dziś wolne. Kanapa też jest sprzętem treningowym.',
    'Plan nie ma na dziś terminu. Mięśnie mają.',
    'Dzień bez terminu. Siła rośnie w przerwie, nie w trakcie.',
    'Wolne. Najtrudniejszy trening to ten, którego się nie robi za wcześnie.',
  ],
  en: [
    'Day off. The sofa counts as gym equipment too.',
    'Nothing on the plan today. Your muscles have plenty on.',
    'Nothing due today. Strength grows during the break, not the workout.',
    'Day off. The hardest workout is the one you don’t do too soon.',
  ],
});

/** Zaległy termin. Łagodnie: wstyd nikogo jeszcze nie wzmocnił. */
export const LATE: readonly string[] = text({
  pl: [
    'Termin przesunął się sam. Bywa.',
    'Spóźnione liczy się bardziej niż nieodbyte.',
    'Kalendarz się nie obraził. Czeka.',
  ],
  en: [
    'The deadline moved all by itself. It happens.',
    'Late counts for far more than never.',
    'The calendar isn’t offended. It’s waiting.',
  ],
});

/** Pusta półka odznak. */
export const EMPTY_SHELF: readonly string[] = text({
  pl: [
    'Pusto jak w szatni o siódmej rano.',
    'Półka czeka. Na razie kurzy się honorowo.',
    'Nic tu nie ma. To się da naprawić jednym treningiem.',
  ],
  en: [
    'Emptier than the changing room at 7 a.m.',
    'The shelf is waiting. For now it gathers dust with honour.',
    'Nothing here yet. One workout will fix that.',
  ],
});

/** Dopisek w dymku po zapisanej przekąsce. Krótko — dymek znika po trzech sekundach. */
export const SNACK_SAVED: readonly string[] = text({
  pl: [
    'Krzesło odpoczywa.',
    'Biurko nic nie widziało.',
    'Przekąska bez kalorii.',
    'Stawy dziękują, klawiatura tęskni.',
    'Kawa może poczekać minutę.',
    'Ruch zapisany. Winda obrażona.',
  ],
  en: [
    'The chair gets a break.',
    'The desk saw nothing.',
    'A snack with zero calories.',
    'Your joints say thanks; the keyboard misses you.',
    'The coffee can wait a minute.',
    'Movement logged. The lift is offended.',
  ],
});

/** Pusty dzień przekąsek. Zaprasza, nie wypomina. */
export const SNACK_EMPTY: readonly string[] = text({
  pl: [
    'Dziesięć przysiadów przy czajniku też się liczy.',
    'Minuta deski w przerwie na reklamy to już przekąska.',
    'Pompki przy biurku. Nikt nie patrzy, a jak patrzy — zazdrości.',
  ],
  en: [
    'Ten squats while the kettle boils still count.',
    'A minute of plank during the adverts is already a snack.',
    'Desk press-ups. Nobody’s watching, and if they are, they’re jealous.',
  ],
});

/**
 * Pusty dzień kroków i cardio. Żart idzie z bieżni, roweru, parkietu i telefonu — nigdy z wagi ani
 * z jedzenia: obok stoją kalorie i masa ciała, a to najłatwiejsze miejsce, żeby komuś dokuczyć.
 */
export const CARDIO_EMPTY: readonly string[] = text({
  pl: [
    'Telefon liczy kroki po cichu, nawet w drodze po pilota. Szkoda, żeby się marnowały.',
    'Bieżnia: jedyne miejsce, w którym idzie się godzinę i nie gubi drogi.',
    'Rower stacjonarny nigdzie nie jedzie, ale kalorie z niego są jak najbardziej prawdziwe.',
    'Parkiet czeka. Instruktor już liczy: pięć, sześć, siedem, osiem.',
  ],
  en: [
    'Your phone counts steps quietly, even on the way to the remote. Shame to let them go to waste.',
    'The treadmill: the only place you can walk for an hour and never get lost.',
    'The exercise bike goes nowhere, but the calories it burns are perfectly real.',
    'The dance floor is waiting. The instructor’s already counting: five, six, seven, eight.',
  ],
});

/**
 * Poranne przypomnienie w dniu treningu z planu. Zaproszenie, nie rozkaz: o 7:30 ktoś jeszcze
 * pije kawę, a trening może zrobić wieczorem — liczy się dzień, nie godzina.
 */
export const REMINDER_MORNING: readonly string[] = text({
  pl: [
    'Plan ma dziś termin. Zrobiony do północy liczy się w pełni.',
    'Siwy już grzeje kawę. Trening poczeka, aż wypijesz swoją.',
    'Dziś dzień treningu. Ciężary leżą tam, gdzie zawsze — cierpliwe jak trener.',
    'Termin na dziś. Jeden trening bliżej końca planu.',
  ],
  en: [
    'The plan has a session due today. Done by midnight, it counts in full.',
    'The coach is already warming up his coffee. The workout can wait until you’ve had yours.',
    'Training day today. The weights are where they always are — patient as the coach.',
    'Session due today. One workout closer to the end of the plan.',
  ],
});

/**
 * Wieczorne przypomnienie o krokach i ruchu z dnia. Pyta o liczby z telefonu i zegarka,
 * nigdy o to, czy ktoś się ruszał — dzień bez ruchu też jest dniem.
 */
export const REMINDER_EVENING: readonly string[] = text({
  pl: [
    'Ile kroków pokazuje telefon? Wpisz je, a minuty ruchu i XP policzą się same.',
    'Bieżnia, rower, taniec? Minuta wpisu — kalorie i odznaki zrobią resztę.',
    'Przepisz kroki z dzisiaj, zanim licznik w telefonie wyzeruje się o północy.',
    'Krótki wpis na koniec dnia: kroki z telefonu i to, co było poza treningiem.',
  ],
  en: [
    'How many steps does your phone show? Enter them and the active minutes and XP add up by themselves.',
    'Treadmill, bike, dancing? A minute to log it — calories and badges do the rest.',
    'Copy today’s steps over before your phone resets its counter at midnight.',
    'A quick note to end the day: steps from your phone and anything you did outside training.',
  ],
});

/**
 * Poranne przypomnienie o ważeniu. Pyta o liczbę i mówi, jak ważyć, żeby liczby dało się
 * porównać — nigdy nie ocenia, ile wyjdzie, i nie wspomina o jedzeniu ani o sylwetce.
 */
export const REMINDER_WEIGH: readonly string[] = text({
  pl: [
    'Ważenie po przebudzeniu, przed śniadaniem — jedna liczba do aplikacji, średnia z tygodnia policzy się sama.',
    'Waga rano, na tej samej wadze i o tej samej porze. Wpis zajmie kilka sekund.',
    'Poranna liczba z wagi: z kolejnych dni powstaje średnia, która mówi więcej niż jeden ranek.',
    'Stań na wadze, zanim dzień się rozkręci, i wpisz wynik na ekranie Dziś.',
  ],
  en: [
    'Weigh in after waking, before breakfast — one number into the app, and the weekly average works itself out.',
    'Morning weigh-in, same scales, same time. Logging it takes a few seconds.',
    'The morning number from the scales: day by day it builds an average that says more than any single morning.',
    'Step on the scales before the day gets going and enter the result on the Today screen.',
  ],
});

/** Awans postaci. Żart o goryla i o stadzie, nigdy o tym, ile komuś brakowało. */
export const LEVEL_UP: readonly string[] = text({
  pl: [
    'Grzbiet jeszcze nie srebrny, ale ambicje już tak.',
    'Awans bez rozmowy kwalifikacyjnej. Wystarczył ruch.',
    'Stado zauważyło. Banan w drodze.',
    'Poziom wyżej. Schody jakby niższe.',
    'Nikt tego nie dał za darmo. Każdy punkt jest wypocony.',
  ],
  en: [
    'The back’s not silver yet, but the ambition already is.',
    'Promoted without an interview. Moving was enough.',
    'The troop has noticed. A banana is on its way.',
    'One level up. The stairs look lower somehow.',
    'Nobody handed you this. Every point was sweated for.',
  ],
});

/** Ekran wczytywania. */
export const LOADING: readonly string[] = text({
  pl: [
    'Rozgrzewam liczydło…',
    'Szukam twoich kilogramów…',
    'Odkurzam hantle…',
    'Liczę, ile już podniosłeś…',
  ],
  en: [
    'Warming up the abacus…',
    'Looking for your kilos…',
    'Dusting off the dumbbells…',
    'Counting how much you’ve lifted…',
  ],
});

/** Podtytuły legitymacji dorobku — stoją nad nazwą stopnia. */
export const PROGRESS_TITLES: readonly string[] = text({
  pl: [
    'stan posiadania',
    'bilans otwarcia',
    'dorobek bez retuszu',
    'stan na dziś',
    'suma wszystkich serii',
  ],
  en: [
    'assets on record',
    'opening balance',
    'track record, unretouched',
    'as of today',
    'sum of all sets',
  ],
});

/**
 * Wiersze o wsparciu. Widoczne, ale nigdy blokujące.
 *
 * Żart idzie z aplikacji i z autora, nigdy z czytającego — nikt nie ma poczuć, że jest
 * coś winien. Stąd brak liczników, pasków „do celu” i zdań o tym, jak bardzo autor
 * potrzebuje. Kawa jest puentą, nie prośbą.
 */
export const SUPPORT: readonly string[] = text({
  pl: [
    'Aplikacja jest bezpłatna. Kawa autora już nie.',
    'Zero reklam, zero kont, zero abonamentu. Kawa opcjonalna.',
    'Za tę aplikację nikt nie płaci. Autor też nie, ale kawę pije.',
    'Darmowe na zawsze. Wdzięczność przyjmowana w kubkach.',
    'Nie ma tu reklam. Jest za to link do kawy i czyste sumienie.',
    'Tu nie ma wersji premium. Jest wersja z kawą i wersja bez.',
    'Twoje dane zostają u ciebie. Kawa może zostać u autora.',
    'Ta aplikacja nie pyta o mail. Pyta najwyżej o małą czarną.',
    'Serwera nie ma, więc nic nie kosztuje. Kawa kosztuje tyle, co kawa.',
    'Progresja liniowa, cennik płaski: zero.',
    'Autor nie potrzebuje twoich danych. Kofeiny — bywa, że tak.',
    'Jeden przycisk, jedna kawa, zero newsletterów.',
    'Ta aplikacja nie ma inwestorów. Ma ekspres i dobre chęci.',
    'Nie zbieramy ciasteczek. Kawa do ciasteczka mile widziana.',
  ],
  en: [
    'The app is free. The author’s coffee isn’t.',
    'No ads, no accounts, no subscription. Coffee optional.',
    'Nobody pays for this app. Not even the author — but he does drink coffee.',
    'Free for good. Gratitude accepted in mugs.',
    'There are no ads here. Just a coffee link and a clear conscience.',
    'There’s no premium version. There’s a version with coffee and one without.',
    'Your data stays with you. A coffee could stay with the author.',
    'This app doesn’t ask for your email. At most it asks for an espresso.',
    'There’s no server, so it costs nothing. Coffee costs what coffee costs.',
    'Linear progression, flat pricing: zero.',
    'The author doesn’t need your data. Caffeine — sometimes.',
    'One button, one coffee, zero newsletters.',
    'This app has no investors. It has an espresso machine and good intentions.',
    'No cookies collected here. A coffee to go with one is always welcome.',
  ],
});

/**
 * Pasek wsparcia pod paskiem aplikacji — w głosie Trenera Siwego, tak jak żarty o espresso
 * w dużym banerze. Stary srebrnogrzbiety częstuje kawą jak radą: z klasą, z przymrużeniem oka,
 * nigdy z pozycji kogoś, kto czegoś potrzebuje, i nigdy kosztem czytającego. Najwyżej dwa
 * krótkie wiersze na telefonie — pasek ma zostać cienki.
 */
export const SUPPORT_SHORT: readonly string[] = text({
  pl: [
    'Siwy przyjmuje wpłaty także w espresso.',
    'Stary goryl pije małą czarną. Z klasą.',
    'Siwy trzyma filiżankę małym palcem.',
    'Kawa nigdy nie jest porażką. Siwy sprawdził.',
    'Srebrny grzbiet rośnie latami. I na espresso.',
    'Stado działa na bananach i małej czarnej.',
    'Espresso w nagrodę? Siwy nie odmówi.',
  ],
  en: [
    'The coach also accepts payment in espresso.',
    'The old gorilla takes his coffee black. With class.',
    'The coach holds his cup with his little finger raised.',
    'Coffee is never a failure. The coach checked.',
    'A silver back takes years to grow. And espresso.',
    'The troop runs on bananas and black coffee.',
    'Espresso as a reward? The coach won’t say no.',
  ],
});

/**
 * Rada dnia od Trenera Siwego.
 *
 * Kolejność jest tu całym pomysłem: najpierw coś wartościowego za darmo, potem lekki
 * żart o kawie. Nigdy prośba z pozycji kogoś, kto czegoś potrzebuje — trener częstuje
 * wiedzą, a espresso jest uśmiechem w odpowiedzi. Rada zmienia się co dzień, więc jutro
 * warto zajrzeć nawet bez kawy.
 */
export interface CoachTip {
  tip: string;
  joke: string;
  /** Mina trenera do tej rady. */
  mood: 'coffee' | 'wise' | 'approve' | 'calm' | 'wink';
}

export const COACH_TIPS: readonly CoachTip[] = [
  {
    tip: say('Dokładaj ciężar dopiero wtedy, gdy ostatnie powtórzenie idzie czysto.', 'Add weight only once your last rep moves cleanly.'),
    joke: say('Ta rada jest za darmo. Espresso do niej — w pełni dobrowolne.', 'This tip is free. The espresso to go with it is entirely optional.'),
    mood: 'wise',
  },
  {
    tip: say('Sen to najtańszy suplement na siłowni.', 'Sleep is the cheapest supplement in the gym.'),
    joke: say('Drugi w kolejce? Kawa, którą ktoś postawił autorowi.', 'Second cheapest? A coffee someone bought the author.'),
    mood: 'coffee',
  },
  {
    tip: say('Rozgrzewka to nie strata czasu. To odsetki od progresu.', 'A warm-up isn’t wasted time. It’s interest on your progress.'),
    joke: say('Siwy przyjmuje wpłaty także w espresso.', 'The coach also accepts payment in espresso.'),
    mood: 'wink',
  },
  {
    tip: say('Opuszczony trening to nie porażka. Porażka to się poddać.', 'A missed workout isn’t failure. Giving up is.'),
    joke: say('Kawa za to nigdy nie jest porażką. Siwy sprawdził.', 'Coffee, on the other hand, is never a failure. The coach checked.'),
    mood: 'calm',
  },
  {
    tip: say('Technika przed ciężarem. Zawsze.', 'Form before weight. Always.'),
    joke: say('Autor też koduje technicznie. Najlepiej po espresso.', 'The author codes with good form too. Ideally after an espresso.'),
    mood: 'approve',
  },
  {
    tip: say('Najlepszy plan to ten, który naprawdę robisz.', 'The best plan is the one you actually do.'),
    joke: say('Najlepsza kawa to ta, którą ktoś postawił. Tak mówią stare goryle.', 'The best coffee is one somebody else bought. So say the old gorillas.'),
    mood: 'coffee',
  },
  {
    tip: say('Srebrny grzbiet nie rośnie w tydzień. Progres też nie.', 'A silver back doesn’t grow in a week. Neither does progress.'),
    joke: say('Siwy pracował na niego latami. I na kawie.', 'The coach worked on his for years. Fuelled by coffee.'),
    mood: 'wink',
  },
  {
    tip: say('Przerwa między seriami też jest częścią serii. Odmierz ją, nie zgaduj.', 'The rest between sets is part of the set. Time it, don’t guess.'),
    joke: say('Espresso mieści się dokładnie w dwóch takich przerwach.', 'An espresso fits exactly into two of those rests.'),
    mood: 'calm',
  },
  {
    tip: say('Ciężar, którym nie panujesz w dole ruchu, nie jest jeszcze twój.', 'A weight you can’t control at the bottom of the move isn’t yours yet.'),
    joke: say('Filiżanka za to jest. Trener trzyma ją małym palcem w górze.', 'The cup, however, is. The coach holds it with his little finger raised.'),
    mood: 'coffee',
  },
  {
    tip: say('Zapisuj wynik od razu po serii. Pamięć dorabia sobie powtórzenia.', 'Log your result straight after the set. Memory likes to add reps.'),
    joke: say('Kawa niczego nie dorabia. Po prostu jest.', 'Coffee doesn’t add anything. It just is.'),
    mood: 'wise',
  },
  {
    tip: say('Dwa treningi w tygodniu przez rok biją sześć przez miesiąc.', 'Two workouts a week for a year beat six a week for a month.'),
    joke: say('Jedno espresso raz na jakiś czas też działa lepiej niż żadne.', 'One espresso now and then works better than none, too.'),
    mood: 'approve',
  },
  {
    tip: say('Ból stawu to nie zakwas. Ten pierwszy jest sygnałem, żeby przerwać.', 'Joint pain isn’t muscle soreness. The first is a signal to stop.'),
    joke: say('A ten drugi — powodem, żeby usiąść z kawą.', 'The second is a reason to sit down with a coffee.'),
    mood: 'wise',
  },
];

/* ---------------- Blankiety ---------------- */

/** Sentencja pod nagłówkiem dokumentu. Dyplomy mają łacinę, ten też — mniej więcej. */
export const MOTTOS: readonly string[] = text({
  pl: [
    'PER ASPERA AD ZAKWASY',
    'VENI, VIDI, PRZYSIAD',
    'IN SERIA VERITAS',
    'MENS SANA IN CORPORE ZMĘCZONE',
    'ALEA IACTA EST — SERIA OSTATNIA',
    'AUDACES FORTUNA IUVAT, RESZTA ROBI CARDIO',
  ],
  en: [
    'PER ASPERA AD ACHES',
    'VENI, VIDI, SQUATI',
    'IN REPS VERITAS',
    'MENS SANA IN CORPORE KNACKERED',
    'ALEA IACTA EST — LAST SET',
    'AUDACES FORTUNA IUVAT, THE REST DO CARDIO',
  ],
});

/** Napis w pieczęci: pierwszy wiersz duży, drugi drobny. */
export const STAMPS: readonly (readonly [string, string])[] = [
  [say('ZROBIONE', 'DONE'), say('bez świadków', 'no witnesses')],
  [say('ZALICZONE', 'PASSED'), say('komisja spała', 'the panel was asleep')],
  [say('POTWIERDZONE', 'CONFIRMED'), say('nikt nie sprawdzał', 'nobody checked')],
  [say('WAŻNE', 'VALID'), say('do odwołania', 'until further notice')],
  [say('PRZYJĘTO', 'APPROVED'), say('bez zastrzeżeń', 'no objections')],
];

/** Kto podpisał dokument. Żaden z tych urzędów nie istnieje. */
export const SIGNATORIES: readonly string[] = text({
  pl: [
    'Komisja ds. Powtórzeń',
    'Główny Inspektor Zakwasów',
    'Urząd Miar i Ciężarów',
    'Departament Dnia Nóg',
    'Krajowy Rejestr Serii',
    'Inspektorat Techniki i Pochyleń',
  ],
  en: [
    'Board of Repetitions',
    'Chief Inspector of Sore Muscles',
    'Office of Weights and Measures',
    'Department of Leg Day',
    'National Register of Sets',
    'Inspectorate of Form and Incline',
  ],
});

/* ---------------- Wpisy do mediów społecznościowych ---------------- */

/**
 * Zakończenia wpisu. Zaproszenie ma brzmieć jak rzucone mimochodem, a nie jak baner
 * reklamowy — nikt nie udostępnia postów, które wyglądają na sponsorowane. Każde mówi jednak,
 * czym jest aplikacja i że kosztuje zero: obcy człowiek pod wpisem nie wie, co to GYM TRACKER,
 * a „kliknij, żeby się dowiedzieć” klika mało kto.
 */
export const CTA: readonly string[] = text({
  pl: [
    'Liczy to za mnie GYM TRACKER — sam wie, kiedy dołożyć ciężar. Na razie za darmo:',
    'Progresję prowadzi mi aplikacja, na razie za darmo — gdyby ktoś pytał:',
    'Wszystko liczy GYM TRACKER, nie ja: serie, przerwy i kiedy dołożyć. Za darmo:',
    'Jak ktoś też chce trening, który sam wie, kiedy dołożyć — na razie za darmo:',
    'Dla ciekawskich: aplikacja sama pilnuje serii i ciężarów. Na razie za darmo:',
  ],
  en: [
    'GYM TRACKER does the maths for me — it knows when to add weight. Free for now:',
    'An app runs my progression, free for now — in case anyone asks:',
    'GYM TRACKER keeps count, not me: sets, rests and when to add weight. Free:',
    'If you want training that knows when to add weight too — free for now:',
    'For the curious: the app keeps track of sets and weights by itself. Free for now:',
  ],
});

/** Potwierdzenia w dymku. */
export const TOASTS: readonly string[] = text({
  pl: [
    'Zapisane.',
    'Przyjęte.',
    'Zanotowane.',
  ],
  en: [
    'Saved.',
    'Got it.',
    'Noted.',
  ],
});
