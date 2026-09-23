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

/** Deterministyczny wybór z listy. To samo ziarno daje ten sam tekst. */
export function pick<T>(list: readonly T[], seed: number): T {
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
  { kg: 25, forms: ['worek cementu', 'worki cementu', 'worków cementu'] },
  { kg: 70, forms: ['pralka', 'pralki', 'pralek'] },
  { kg: 100, forms: ['żeliwna wanna', 'żeliwne wanny', 'żeliwnych wanien'] },
  { kg: 300, forms: ['fortepian', 'fortepiany', 'fortepianów'] },
  { kg: 600, forms: ['maluch', 'maluchy', 'maluchów'] },
  { kg: 800, forms: ['żubr', 'żubry', 'żubrów'] },
  { kg: 1_500, forms: ['hipopotam', 'hipopotamy', 'hipopotamów'] },
  { kg: 6_000, forms: ['słoń', 'słonie', 'słoni'] },
  { kg: 12_000, forms: ['autobus miejski', 'autobusy miejskie', 'autobusów miejskich'] },
  { kg: 50_000, forms: ['czołg', 'czołgi', 'czołgów'] },
  { kg: 100_000, forms: ['lokomotywa', 'lokomotywy', 'lokomotyw'] },
  { kg: 4_000_000, forms: ['wieża Eiffla', 'wieże Eiffla', 'wież Eiffla'] },
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
const HOURS: Forms = ['godzinę', 'godziny', 'godzin'];
const MINUTES: Forms = ['minutę', 'minuty', 'minut'];

const clock = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h && m) return `${h} ${plural(h, HOURS)} i ${m} ${plural(m, MINUTES)}`;
  if (h) return `${h} ${plural(h, HOURS)}`;
  return `${Math.max(1, m)} ${plural(Math.max(1, m), MINUTES)}`;
};

/** Powtórzenia jako czas: po jednym na sekundę, bez przerw i bez litości. */
export function repsJoke(reps: number): string | null {
  if (!Number.isFinite(reps) || reps < 60) return null;
  return `po jednym na sekundę zajęłoby to ${clock(reps)}`;
}

interface TimeUnit {
  secs: number;
  forms: Forms;
}

const TIMES: TimeUnit[] = [
  { secs: 120, forms: ['mycie zębów', 'mycia zębów', 'myć zębów'] },
  { secs: 300, forms: ['jajko na miękko', 'jajka na miękko', 'jajek na miękko'] },
  { secs: 2_520, forms: ['odcinek serialu', 'odcinki serialu', 'odcinków serialu'] },
  { secs: 5_400, forms: ['mecz piłki', 'mecze piłki', 'meczów piłki'] },
  { secs: 10_620, forms: ['Władca Pierścieni', 'Władcy Pierścieni', 'Władców Pierścieni'] },
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
export const CHEERS: readonly string[] = [
  'Nikt nie bije braw. Aplikacja bije brawo.',
  'Odznaka nie zmieści się na lodówce, ale istnieje.',
  'Ktoś musiał to zrobić. Wyszło na ciebie.',
  'Zaliczone. Historia raczej tego nie odnotuje, ale my tak.',
  'Twoje mięśnie nie wiedzą o odznakach. To ich strata.',
  'Odznaka zdobyta. Kawa smakuje tak samo, ale jakoś lepiej.',
  'Punkty przyznane. Kurs ich nie rośnie, wartość sentymentalna owszem.',
  'Gratulacje. Wręczenie odbyło się w pełnej dyskrecji.',
];

/** Nagłówki okna po zamkniętej sesji. */
export const SAVED: readonly string[] = [
  'Zapisane. Mięśnie dowiedzą się jutro.',
  'Zapisane. Liczby nie kłamią, nogi też nie będą.',
  'Zaliczone. Pot wyparował, dane zostały.',
  'Zapisane. Nikt nie patrzył, aplikacja patrzyła.',
  'Gotowe. Kanapa czeka i jest w pełni zasłużona.',
  'Zapisane. Ciężar wrócił na miejsce, ty też możesz.',
];

/** Dzień bez terminu. Odpoczynek jest częścią planu, nie wymówką. */
export const REST: readonly string[] = [
  'Dziś wolne. Kanapa też jest sprzętem treningowym.',
  'Plan nie ma na dziś terminu. Mięśnie mają.',
  'Dzień bez terminu. Siła rośnie w przerwie, nie w trakcie.',
  'Wolne. Najtrudniejszy trening to ten, którego się nie robi za wcześnie.',
];

/** Zaległy termin. Łagodnie: wstyd nikogo jeszcze nie wzmocnił. */
export const LATE: readonly string[] = [
  'Termin przesunął się sam. Bywa.',
  'Spóźnione liczy się bardziej niż nieodbyte.',
  'Kalendarz się nie obraził. Czeka.',
];

/** Pusta półka odznak. */
export const EMPTY_SHELF: readonly string[] = [
  'Pusto jak w szatni o siódmej rano.',
  'Półka czeka. Na razie kurzy się honorowo.',
  'Nic tu nie ma. To się da naprawić jednym treningiem.',
];

/** Ekran wczytywania. */
export const LOADING: readonly string[] = [
  'Rozgrzewam liczydło…',
  'Szukam twoich kilogramów…',
  'Odkurzam hantle…',
  'Liczę, ile już podniosłeś…',
];

/** Podtytuły legitymacji dorobku — stoją nad nazwą stopnia. */
export const PROGRESS_TITLES: readonly string[] = [
  'stan posiadania',
  'bilans otwarcia',
  'dorobek bez retuszu',
  'stan na dziś',
  'suma wszystkich serii',
];

/**
 * Wiersze o wsparciu. Widoczne, ale nigdy blokujące.
 *
 * Żart idzie z aplikacji i z autora, nigdy z czytającego — nikt nie ma poczuć, że jest
 * coś winien. Stąd brak liczników, pasków „do celu” i zdań o tym, jak bardzo autor
 * potrzebuje. Kawa jest puentą, nie prośbą.
 */
export const SUPPORT: readonly string[] = [
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
];

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
    tip: 'Dokładaj ciężar dopiero wtedy, gdy ostatnie powtórzenie idzie czysto.',
    joke: 'Ta rada jest za darmo. Espresso do niej — w pełni dobrowolne.',
    mood: 'wise',
  },
  {
    tip: 'Sen to najtańszy suplement na siłowni.',
    joke: 'Drugi w kolejce? Kawa, którą ktoś postawił autorowi.',
    mood: 'coffee',
  },
  {
    tip: 'Rozgrzewka to nie strata czasu. To odsetki od progresu.',
    joke: 'Siwy przyjmuje wpłaty także w espresso.',
    mood: 'wink',
  },
  {
    tip: 'Opuszczony trening to nie porażka. Porażka to się poddać.',
    joke: 'Kawa za to nigdy nie jest porażką. Siwy sprawdził.',
    mood: 'calm',
  },
  { tip: 'Technika przed ciężarem. Zawsze.', joke: 'Autor też koduje technicznie. Najlepiej po espresso.', mood: 'approve' },
  {
    tip: 'Najlepszy plan to ten, który naprawdę robisz.',
    joke: 'Najlepsza kawa to ta, którą ktoś postawił. Tak mówią stare goryle.',
    mood: 'coffee',
  },
  {
    tip: 'Srebrny grzbiet nie rośnie w tydzień. Progres też nie.',
    joke: 'Siwy pracował na niego latami. I na kawie.',
    mood: 'wink',
  },
  {
    tip: 'Przerwa między seriami też jest częścią serii. Odmierz ją, nie zgaduj.',
    joke: 'Espresso mieści się dokładnie w dwóch takich przerwach.',
    mood: 'calm',
  },
  {
    tip: 'Ciężar, którym nie panujesz w dole ruchu, nie jest jeszcze twój.',
    joke: 'Filiżanka za to jest. Trener trzyma ją małym palcem w górze.',
    mood: 'coffee',
  },
  {
    tip: 'Zapisuj wynik od razu po serii. Pamięć dorabia sobie powtórzenia.',
    joke: 'Kawa niczego nie dorabia. Po prostu jest.',
    mood: 'wise',
  },
  {
    tip: 'Dwa treningi w tygodniu przez rok biją sześć przez miesiąc.',
    joke: 'Jedno espresso raz na jakiś czas też działa lepiej niż żadne.',
    mood: 'approve',
  },
  {
    tip: 'Ból stawu to nie zakwas. Ten pierwszy jest sygnałem, żeby przerwać.',
    joke: 'A ten drugi — powodem, żeby usiąść z kawą.',
    mood: 'wise',
  },
];

/* ---------------- Blankiety ---------------- */

/** Sentencja pod nagłówkiem dokumentu. Dyplomy mają łacinę, ten też — mniej więcej. */
export const MOTTOS: readonly string[] = [
  'PER ASPERA AD ZAKWASY',
  'VENI, VIDI, PRZYSIAD',
  'IN SERIA VERITAS',
  'MENS SANA IN CORPORE ZMĘCZONE',
  'ALEA IACTA EST — SERIA OSTATNIA',
  'AUDACES FORTUNA IUVAT, RESZTA ROBI CARDIO',
];

/** Napis w pieczęci: pierwszy wiersz duży, drugi drobny. */
export const STAMPS: readonly (readonly [string, string])[] = [
  ['ZROBIONE', 'bez świadków'],
  ['ZALICZONE', 'komisja spała'],
  ['POTWIERDZONE', 'nikt nie sprawdzał'],
  ['WAŻNE', 'do odwołania'],
  ['PRZYJĘTO', 'bez zastrzeżeń'],
];

/** Kto podpisał dokument. Żaden z tych urzędów nie istnieje. */
export const SIGNATORIES: readonly string[] = [
  'Komisja ds. Powtórzeń',
  'Główny Inspektor Zakwasów',
  'Urząd Miar i Ciężarów',
  'Departament Dnia Nóg',
  'Krajowy Rejestr Serii',
  'Inspektorat Techniki i Pochyleń',
];

/* ---------------- Wpisy do mediów społecznościowych ---------------- */

/**
 * Zakończenia wpisu. Zaproszenie ma brzmieć jak rzucone mimochodem, a nie jak baner
 * reklamowy — nikt nie udostępnia postów, które wyglądają na sponsorowane.
 */
export const CTA: readonly string[] = [
  'Jak ktoś chce sobie policzyć swoje — GYM TRACKER, za darmo:',
  'Liczy to za mnie darmowa apka, gdyby ktoś pytał:',
  'Wszystko liczy GYM TRACKER, nie ja:',
  'Jak ktoś też lubi patrzeć, jak liczby rosną:',
  'Dla ciekawskich, czym to liczę:',
];

/** Potwierdzenia w dymku. */
export const TOASTS: readonly string[] = [
  'Zapisane.',
  'Przyjęte.',
  'Zanotowane.',
];
