import { BUILTIN, EFFORT, EX, READY, groupLabel } from '../data/exercises';
import { bodyOf, heightOf, weightOn } from '../engine/body';
import { ON_FOOT, cardioOf, entryEnergy } from '../engine/cardio';
import { MEASURES, measuresOf } from '../engine/measures';
import { snacksOf } from '../engine/snacks';
import { localDayOf } from '../engine/watch';
import { clock, day, dec, int, writeXlsx } from '../engine/xlsx';
import type { XBook, XCell, XColumn, XSheet } from '../engine/xlsx';
import { LANG, LOCALE, num, pluralEn, text } from '../i18n';
import { plural } from '../engine/quips';
import type { AppState, Cardio, DanceMix, DanceStyle, LogEntry, MeasureKey } from '../types';
import { mealOf } from './diet/copy';
import { db as defaultDb } from './diet/db';
import type { DayRow, DietDb, Entry } from './diet/db';
import { CAFFEINE_PER_100, drinksOf, hydration, sweetValues } from './diet/drinks';
import type { DrinkKind } from './diet/drinks';
import type { FoodSet } from './diet/foods';
import { entryParts, gramsOf, recipeOf } from './diet/parts';
import { DIET_PROFILES } from './diet/profiles';
import { hidesKcal, targetOn } from './diet/target';
import type { Extra, Profile, Sex } from './diet/types';
import { cleanDay, cleanEntry, cleanProfile, cleanRows, cleanSet } from './diet/validate';
import { waterTargetMl } from './diet/water';
import { GROUP_LABELS, MARKERS } from './labs/markers';
import { loadPrefs, loadReports } from './labs/store';
import type { LabPrefs, LabReport } from './labs/types';
import { judge } from './labs/verdict';

export { XLSX_MIME } from '../engine/xlsx';

/**
 * Raport dla dietetyka albo lekarza: jeden plik .xlsx z tym, co zapisano — dzień po dniu, wpis
 * po wpisie, seria po serii, wynik po wyniku. Same fakty z zapisu, bez zaleceń: kalorie i makro
 * z etykiet albo wpisane, godziny wpisów, napoje, treningi z godzinami, ruch, pomiary i badania
 * z zakresami z wydruku. Szacunki (kofeina, napój słodzony, danie ze zdjęcia, kalorie ruchu)
 * są nazwane szacunkami w nagłówku albo w kolumnie źródła.
 *
 * Moduł ładuje się dynamicznie z ustawień, razem z Dexie (jak `food/csv.ts`). Bez profilu diety
 * raport też powstaje: treningi, ruch, pomiary i badania; arkusze bez danych w zakresie wypadają,
 * a „Informacje” mówią, których nie ma.
 *
 * Czas: dziennik jedzenia trzyma daty i godziny lokalne (zegar telefonu). Trening zapisuje chwilę
 * zamknięcia (ISO, UTC) i czas trwania — w raporcie to godzina lokalna rozpoczęcia (zamknięcie
 * minus czas) i zakończenia, a dzień to dzień lokalny rozpoczęcia. Aplikacja w historii treningów
 * liczy dzień w UTC (`dayKey`), więc trening między północą a 1:00–2:00 stoi tu dzień później
 * niż w historii — tu jest dzień z zegara, który widział trenujący.
 */

export type ReportRange = '30' | '90' | 'all';

export const REPORT_RANGES: readonly ReportRange[] = ['30', '90', 'all'];

const T = text({
  pl: {
    title: 'GYM TRACKER — raport dla dietetyka lub lekarza',
    sheets: {
      info: 'Informacje',
      days: 'Dni',
      food: 'Jedzenie',
      parts: 'Składniki',
      drinks: 'Napoje',
      workouts: 'Treningi',
      sets: 'Serie',
      move: 'Ruch',
      body: 'Pomiary',
      labs: 'Badania',
      devices: 'Urządzenia',
    },
    infoCols: ['Pozycja', 'Wartość'],
    days: [
      'Data',
      'Dzień tygodnia',
      'kcal',
      'Cel kcal',
      'Białko (g)',
      'Cel białka (g)',
      'Węglowodany (g)',
      'Tłuszcz (g)',
      'Błonnik (g)',
      'Cukry (g)',
      'Sól (g)',
      'Wpisy jedzenia',
      'Wpisy bez makro',
      'Pierwszy wpis',
      'Ostatni wpis',
      'Okno jedzenia (h)',
      'Napoje (ml)',
      'Woda (ml)',
      'Kofeina (mg, szacunek)',
      'Dziennik dnia',
      'Waga (kg)',
      'Kroki',
      'Treningi',
      'Trening (min)',
      'Cardio (min)',
      'Przekąski ruchowe',
      'Notatka dnia',
    ],
    food: [
      'Data',
      'Godzina',
      'Pora (wg godziny)',
      'Nazwa',
      'Ilość',
      'Gramy',
      'Źródło danych',
      'Kod EAN',
      'kcal',
      'Białko (g)',
      'Węglowodany (g)',
      'Tłuszcz (g)',
      'Błonnik (g)',
      'Cukry (g)',
      'Sól (g)',
    ],
    parts: ['Data', 'Godzina', 'Wpis', 'Rodzaj', 'Składnik', 'Gramy', 'Ilość', 'Kod EAN'],
    drinks: ['Data', 'Godzina', 'Rodzaj', 'ml', 'Kofeina (mg, szacunek)', 'kcal (szacunek)', 'Cukry (g, szacunek)'],
    workouts: [
      'Data',
      'Rozpoczęcie',
      'Zakończenie',
      'Czas (min)',
      'Trening',
      'Tydzień lżejszy',
      'Samopoczucie przed',
      'Ćwiczenia',
      'Serie',
      'Powtórzenia',
      'Sekundy (ćwiczenia na czas)',
      'Objętość (kg × powt.)',
      'Notatka',
    ],
    sets: [
      'Data',
      'Rozpoczęcie',
      'Trening',
      'Ćwiczenie',
      'Partia',
      'Seria',
      'Powtórzenia',
      'Sekundy',
      'Ciężar (kg)',
      'Wysiłek',
      'Zapas powtórzeń',
      'Notatka do ćwiczenia',
    ],
    move: [
      'Data',
      'Godzina',
      'Rodzaj',
      'Kroki',
      'Minuty',
      'Prędkość (km/h)',
      'Nachylenie (%)',
      'Moc (W)',
      'Taniec',
      'Droga (km)',
      'Ćwiczenie',
      'Powtórzenia',
      'Sekundy',
      'Ciężar (kg)',
      'kcal ruchu (szacunek)',
      'Źródło',
    ],
    body: ['Data', 'Waga (kg)', 'BMI', 'Talia (cm)', 'Biodra (cm)', 'Klatka (cm)', 'Ramię (cm)', 'Udo (cm)'],
    labs: [
      'Data pobrania',
      'Laboratorium',
      'Grupa',
      'Badanie',
      'Wynik',
      'Znak (< >)',
      'Wynik opisowy',
      'Jednostka',
      'Wynik z wydruku',
      'Zakres od',
      'Zakres do',
      'Źródło zakresu',
      'Względem zakresu',
      'Względem celu z wytycznych',
      'Wprowadzono z',
    ],
    devices: [
      'Data',
      'Źródło',
      'Kroki',
      'Droga (km)',
      'Piętra',
      'Minuty intensywne',
      'Tętno spoczynkowe',
      'Tętno min.',
      'Tętno średnie',
      'Tętno maks.',
      'Stres (0–100)',
      'Body Battery min.',
      'Body Battery maks.',
      'Sen (wynik 0–100)',
      'Sen (min)',
      'Waga (kg)',
    ],
    meals: { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja' },
    source: {
      product: 'Produkt (etykieta)',
      recipe: 'Przepis (katalog aplikacji)',
      plan: 'Plan posiłków',
      custom: 'Własne jedzenie (wpisane)',
      set: 'Zestaw',
      restaurant: 'Restauracja (dane sieci)',
      dish: 'Danie ze zdjęcia (szacunek)',
      quick: 'Szybki wpis (wpisany ręcznie)',
      sweet: 'Napój słodzony (szacunek)',
    },
    partKind: { recipe: 'Przepis', set: 'Zestaw' },
    drink: {
      water: 'Woda',
      zero: 'Napój bez cukru',
      coffee: 'Kawa',
      tea: 'Herbata',
      sweet: 'Napój słodzony',
      other: 'Inny napój',
    } as Record<DrinkKind, string>,
    complete: { full: 'Cały dzień zapisany', partial: 'Nie wszystko zapisane' },
    yes: 'tak',
    sport: {
      steps: 'Kroki',
      treadmill: 'Bieżnia',
      bike: 'Rower',
      ergo: 'Rower stacjonarny',
      dance: 'Taniec',
      snack: 'Przekąska ruchowa',
      run: 'Bieg (w krokach dnia)',
      walk: 'Marsz (w krokach dnia)',
      hike: 'Wędrówka (w krokach dnia)',
    },
    dance: { pair: 'w parze', solo: 'solo' } as Record<DanceStyle, string>,
    mix: { full: 'cały czas w ruchu', half: 'pół na pół', talk: 'głównie tłumaczenie' } as Record<DanceMix, string>,
    src: { manual: 'wpisane ręcznie', watch: 'zegarek', phone: 'telefon' },
    labSource: { pdf: 'PDF', photo: 'zdjęcie wydruku', text: 'wklejony tekst', manual: 'wpisane ręcznie' },
    rangeFrom: { lab: 'z wydruku laboratorium', app: 'typowy dla dorosłych (aplikacja)' },
    level: { low: 'poniżej zakresu', ok: 'w zakresie', high: 'powyżej zakresu', unknown: 'bez zakresu' },
    target: { below: 'poniżej celu', above: 'powyżej celu' },
    qual: { neg: 'ujemny', trace: 'ślad', pos: 'dodatni' },
    sex: { M: 'mężczyzna', K: 'kobieta' } as Record<Sex, string>,
    info: {
      report: 'Raport',
      reportValue: 'Dane zapisane w aplikacji GYM TRACKER: jedzenie, napoje, treningi, ruch, pomiary i wyniki badań.',
      created: 'Utworzono',
      range: 'Zakres',
      rangeValue: (r: ReportRange, from: string | null, to: string) =>
        r === 'all' ? (from ? `wszystkie zapisane dane: ${from} – ${to}` : 'wszystkie zapisane dane') : `ostatnie ${r} dni: ${from} – ${to}`,
      person: 'Osoba',
      sex: 'Płeć',
      age: 'Wiek (lata)',
      height: 'Wzrost (cm)',
      startWeight: 'Waga na starcie diety (kg)',
      targetWeight: 'Waga docelowa (kg)',
      dietStart: 'Początek prowadzenia diety',
      diet: 'Profil diety',
      pace: 'Planowane tempo (kg na tydzień, + to spadek)',
      kcalToday: 'Dzienny cel kcal (dziś)',
      macrosToday: 'Dzienne cele makro (dziś)',
      macros: (p: number, c: number, f: number) => `białko ${p} g, węglowodany ${c} g, tłuszcz ${f} g`,
      water: 'Cel napojów (ml na dzień)',
      pregnancy: 'Ciąża lub karmienie',
      agreed: 'Cel uzgodniony z lekarzem lub dietetykiem',
      noCount: 'Tryb „bez liczenia kalorii”',
      noCountValue: 'włączony — cele kcal i makro nie są pokazywane; zjedzone kcal są w arkuszach jak wpisano',
      fast: 'Okno jedzenia (post przerywany)',
      noProfile: 'Profil diety',
      noProfileValue: 'nie ustawiony — w pliku nie ma celów jedzenia, a dziennik jedzenia jest pusty albo bez celów',
      contents: 'Arkusze w pliku',
      rows: (n: number) => `${n} ${plural(n, ['wiersz', 'wiersze', 'wierszy'])}`,
      missing: 'Bez danych w zakresie',
      notes: 'Objaśnienia',
      legend: [
        'Pusta komórka znaczy „nie wiadomo” albo „nie zapisano” — nigdy zero.',
        'Daty i godziny są według zegara telefonu (czas lokalny). Kolumny dat i godzin to prawdziwe daty arkusza — dają się sortować i filtrować.',
        'kcal i makro: z etykiety produktu, z danych sieci restauracji, z katalogu przepisów aplikacji albo wpisane ręcznie. „Szacunek” w źródle albo w nagłówku znaczy liczbę policzoną przez aplikację, nie zmierzoną.',
        'Dni: makro, błonnik, cukry i sól to sumy z wpisów, które je znają. Gdy część wpisów ich nie ma („Wpisy bez makro”), suma jest wartością minimalną.',
        'Dni → „Dziennik dnia”: czy osoba zaznaczyła, że zapisała cały dzień albo nie wszystko. Puste — nie zaznaczyła.',
        'Pora posiłku to przedział godzin z wpisu (śniadanie 4:00–10:59, obiad 11:00–16:59, kolacja potem), nie nazwa nadana przez osobę.',
        'Składniki: z czego był przepis albo własny zestaw — gramy dla zjedzonych porcji według dzisiejszego katalogu przepisów.',
        'Napoje: kofeina to szacunek z ilości (kawa 40 mg, herbata 20 mg na 100 ml — USDA FoodData Central). Napój słodzony jest liczony jak cola (42 kcal i 10,6 g cukru na 100 ml) i trafia też do „Jedzenia”.',
        'Treningi: godzina rozpoczęcia to zakończenie minus czas z zegara sesji; trening zapisany bez zegara ma tylko godzinę zakończenia.',
        'Ruch: kroki to suma dnia (bez godziny); przy zegarku i telefonie zostaje najwyższa liczba z trzech źródeł. Biegi i marsze z zegarka są już w krokach dnia. kcal ruchu to szacunek z MET i wagi z dnia ruchu (ponad spoczynek).',
        'Badania: zakres z wydruku laboratorium, a bez niego typowy zakres dla dorosłych z aplikacji. „Względem zakresu” to porównanie liczby z zakresem, nie ocena zdrowia.',
        'Urządzenia: liczby przysłane przez zegarek Garmin albo Apple Zdrowie / Health Connect, bez zmian.',
      ],
      note: 'Uwaga',
      noteValue:
        'Dane wpisała osoba korzystająca z aplikacji albo przysłał jej zegarek lub telefon. Aplikacja nie jest wyrobem medycznym; plik nie zawiera diagnozy ani zaleceń.',
    },
  },
  en: {
    title: 'GYM TRACKER — report for a dietitian or doctor',
    sheets: {
      info: 'About',
      days: 'Days',
      food: 'Food',
      parts: 'Ingredients',
      drinks: 'Drinks',
      workouts: 'Workouts',
      sets: 'Sets',
      move: 'Activity',
      body: 'Measurements',
      labs: 'Lab results',
      devices: 'Devices',
    },
    infoCols: ['Item', 'Value'],
    days: [
      'Date',
      'Weekday',
      'kcal',
      'kcal target',
      'Protein (g)',
      'Protein target (g)',
      'Carbs (g)',
      'Fat (g)',
      'Fibre (g)',
      'Sugars (g)',
      'Salt (g)',
      'Food entries',
      'Entries without macros',
      'First entry',
      'Last entry',
      'Eating window (h)',
      'Drinks (ml)',
      'Water (ml)',
      'Caffeine (mg, estimate)',
      'Day log',
      'Weight (kg)',
      'Steps',
      'Workouts',
      'Workout (min)',
      'Cardio (min)',
      'Movement snacks',
      'Day note',
    ],
    food: [
      'Date',
      'Time',
      'Meal (by time)',
      'Name',
      'Amount',
      'Grams',
      'Data source',
      'EAN code',
      'kcal',
      'Protein (g)',
      'Carbs (g)',
      'Fat (g)',
      'Fibre (g)',
      'Sugars (g)',
      'Salt (g)',
    ],
    parts: ['Date', 'Time', 'Entry', 'Kind', 'Ingredient', 'Grams', 'Amount', 'EAN code'],
    drinks: ['Date', 'Time', 'Kind', 'ml', 'Caffeine (mg, estimate)', 'kcal (estimate)', 'Sugars (g, estimate)'],
    workouts: [
      'Date',
      'Start',
      'End',
      'Duration (min)',
      'Workout',
      'Lighter week',
      'Feeling before',
      'Exercises',
      'Sets',
      'Reps',
      'Seconds (timed exercises)',
      'Volume (kg × reps)',
      'Note',
    ],
    sets: [
      'Date',
      'Start',
      'Workout',
      'Exercise',
      'Muscle group',
      'Set',
      'Reps',
      'Seconds',
      'Weight (kg)',
      'Effort',
      'Reps in reserve',
      'Exercise note',
    ],
    move: [
      'Date',
      'Time',
      'Kind',
      'Steps',
      'Minutes',
      'Speed (km/h)',
      'Incline (%)',
      'Power (W)',
      'Dance',
      'Distance (km)',
      'Exercise',
      'Reps',
      'Seconds',
      'Weight (kg)',
      'Activity kcal (estimate)',
      'Source',
    ],
    body: ['Date', 'Weight (kg)', 'BMI', 'Waist (cm)', 'Hips (cm)', 'Chest (cm)', 'Arm (cm)', 'Thigh (cm)'],
    labs: [
      'Collection date',
      'Laboratory',
      'Group',
      'Test',
      'Result',
      'Sign (< >)',
      'Qualitative result',
      'Unit',
      'Result as printed',
      'Range from',
      'Range to',
      'Range source',
      'Against the range',
      'Against the guideline target',
      'Entered from',
    ],
    devices: [
      'Date',
      'Source',
      'Steps',
      'Distance (km)',
      'Floors',
      'Intensity minutes',
      'Resting heart rate',
      'Heart rate min.',
      'Heart rate average',
      'Heart rate max.',
      'Stress (0–100)',
      'Body Battery min.',
      'Body Battery max.',
      'Sleep (score 0–100)',
      'Sleep (min)',
      'Weight (kg)',
    ],
    meals: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' },
    source: {
      product: 'Product (label)',
      recipe: 'Recipe (app catalogue)',
      plan: 'Meal plan',
      custom: 'Own food (typed in)',
      set: 'Set',
      restaurant: 'Restaurant (chain data)',
      dish: 'Dish from a photo (estimate)',
      quick: 'Quick entry (typed in)',
      sweet: 'Sweetened drink (estimate)',
    },
    partKind: { recipe: 'Recipe', set: 'Set' },
    drink: {
      water: 'Water',
      zero: 'Sugar-free drink',
      coffee: 'Coffee',
      tea: 'Tea',
      sweet: 'Sweetened drink',
      other: 'Other drink',
    },
    complete: { full: 'Whole day logged', partial: 'Not everything logged' },
    yes: 'yes',
    sport: {
      steps: 'Steps',
      treadmill: 'Treadmill',
      bike: 'Bike',
      ergo: 'Exercise bike',
      dance: 'Dance',
      snack: 'Movement snack',
      run: 'Run (in the day’s steps)',
      walk: 'Walk (in the day’s steps)',
      hike: 'Hike (in the day’s steps)',
    },
    dance: { pair: 'partner', solo: 'solo' },
    mix: { full: 'moving all the time', half: 'half and half', talk: 'mostly instruction' },
    src: { manual: 'typed in', watch: 'watch', phone: 'phone' },
    labSource: { pdf: 'PDF', photo: 'photo of a printout', text: 'pasted text', manual: 'typed in' },
    rangeFrom: { lab: 'from the lab printout', app: 'typical adult range (app)' },
    level: { low: 'below the range', ok: 'within the range', high: 'above the range', unknown: 'no range' },
    target: { below: 'below the target', above: 'above the target' },
    qual: { neg: 'negative', trace: 'trace', pos: 'positive' },
    sex: { M: 'male', K: 'female' },
    info: {
      report: 'Report',
      reportValue: 'Data saved in the GYM TRACKER app: food, drinks, workouts, activity, measurements and lab results.',
      created: 'Created',
      range: 'Range',
      rangeValue: (r: ReportRange, from: string | null, to: string) =>
        r === 'all' ? (from ? `all saved data: ${from} – ${to}` : 'all saved data') : `last ${r} days: ${from} – ${to}`,
      person: 'Person',
      sex: 'Sex',
      age: 'Age (years)',
      height: 'Height (cm)',
      startWeight: 'Weight at the start of the diet (kg)',
      targetWeight: 'Target weight (kg)',
      dietStart: 'Diet tracking started',
      diet: 'Diet profile',
      pace: 'Planned pace (kg a week, + is a loss)',
      kcalToday: 'Daily kcal target (today)',
      macrosToday: 'Daily macro targets (today)',
      macros: (p: number, c: number, f: number) => `protein ${p} g, carbs ${c} g, fat ${f} g`,
      water: 'Drinks target (ml a day)',
      pregnancy: 'Pregnancy or breastfeeding',
      agreed: 'Target agreed with a doctor or dietitian',
      noCount: '“No calorie counting” mode',
      noCountValue: 'on — kcal and macro targets are not shown; eaten kcal are in the sheets as logged',
      fast: 'Eating window (intermittent fasting)',
      noProfile: 'Diet profile',
      noProfileValue: 'not set up — the file has no food targets, and the food diary is empty or has no targets',
      contents: 'Sheets in the file',
      rows: (n: number) => `${n} ${pluralEn(n, 'row', 'rows')}`,
      missing: 'No data in the range',
      notes: 'Notes',
      legend: [
        'An empty cell means “unknown” or “not logged” — never zero.',
        'Dates and times follow the phone’s clock (local time). Date and time columns are real spreadsheet dates — they sort and filter.',
        'kcal and macros: from the product label, the restaurant chain’s data, the app’s recipe catalogue or typed in. “Estimate” in the source or the header means a number the app calculated, not one that was measured.',
        'Days: macros, fibre, sugars and salt are sums over the entries that know them. When some entries lack them (“Entries without macros”), the sum is a minimum.',
        'Days → “Day log”: whether the person marked the day as fully logged or not. Empty — not marked.',
        'The meal is the time band of the entry (breakfast 4:00–10:59, lunch 11:00–16:59, dinner after), not a name the person gave it.',
        'Ingredients: what a recipe or an own set was made of — grams for the servings eaten, by today’s recipe catalogue.',
        'Drinks: caffeine is estimated from the amount (coffee 40 mg, tea 20 mg per 100 ml — USDA FoodData Central). A sweetened drink counts as cola (42 kcal and 10.6 g sugar per 100 ml) and is also in “Food”.',
        'Workouts: the start time is the end minus the session clock; a workout saved without the clock has only its end time.',
        'Activity: steps are the day’s total (no time); with a watch and a phone the highest of the three sources counts. Runs and walks from the watch are already in the day’s steps. Activity kcal are estimated from METs and the weight on that day (above rest).',
        'Lab results: the range printed by the lab, or without one the app’s typical adult range. “Against the range” compares the number with the range; it is not a health assessment.',
        'Devices: numbers sent by a Garmin watch or Apple Health / Health Connect, unchanged.',
      ],
      note: 'Note',
      noteValue:
        'The data was entered by the person using the app or sent by their watch or phone. The app is not a medical device; the file contains no diagnosis or advice.',
    },
  },
});

/* ---------------- Pomocnicze ---------------- */

const WEEKDAY = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', timeZone: 'UTC' });
const weekday = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAY.format(new Date(Date.UTC(y!, m! - 1, d!)));
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const minutesOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/**
 * Liczba w „Informacjach” jako tekst w formacie języka: to opis, nie dane do sortowania, a liczba
 * w szerokiej kolumnie objaśnień stałaby przy prawym brzegu, daleko od swojej etykiety.
 */
const numText = (n: number | null | undefined, digits: number): string | null => (finite(n) ? num(n, digits) : null);
/** Gramy jako zwykła liczba (do 0,1 g): „80”, a nie „80,0”. */
const grams = (g: number | null): XCell => (finite(g) ? Math.round(g * 10) / 10 : null);

/** Suma tego, co wpisy znają; żaden nie zna — `null` (nie zero). */
function knownSum(values: readonly (number | null | undefined)[]): number | null {
  const known = values.filter(finite);
  return known.length ? known.reduce((s, v) => s + v, 0) : null;
}

const eanOf = (key: string | undefined): string | null => {
  const code = key?.startsWith('product:') ? key.slice('product:'.length) : '';
  return /^\d{8,14}$/.test(code) ? code : null;
};

/** Nazwa treningu w języku wizyty: gotowy z biblioteki, własny z zapisu, inaczej nazwa z dziennika. */
const workoutName = (state: AppState, e: LogEntry): string =>
  BUILTIN.find((w) => w.id === e.wid)?.name ?? state.workouts.find((w) => w.id === e.wid)?.name ?? e.workout;

/** Początek i koniec treningu w czasie lokalnym. Bez zegara sesji początku nie znamy. */
function workoutTimes(e: LogEntry): { day: string; start: Date | null; end: Date } | null {
  const end = new Date(e.date);
  if (!Number.isFinite(end.getTime())) return null;
  const secs = e.time?.secs;
  const start = finite(secs) && secs >= 0 ? new Date(end.getTime() - secs * 1000) : null;
  return { day: localDayOf(start ?? end), start, end };
}

/* ---------------- Dane wejściowe ---------------- */

export interface ReportData {
  state: AppState;
  /** Profil diety po `cleanProfile`; `null` — nie ustawiony. */
  profile: Profile | null;
  entries: readonly Entry[];
  days: readonly DayRow[];
  /** Własne zestawy po identyfikatorze (składniki wpisów „set:…”). */
  sets: ReadonlyMap<number, FoodSet>;
  labs: readonly LabReport[];
  labPrefs: LabPrefs | null;
}

export interface ReportOptions {
  range: ReportRange;
  now: Date;
}

export interface ReportSummary {
  /** Arkusze w pliku z liczbą wierszy danych (bez nagłówka), w kolejności pliku. */
  sheets: { name: string; rows: number }[];
  /** Wiersze danych razem, bez „Informacji”. */
  rows: number;
}

type Key = keyof typeof T.sheets;

const cols = (headers: readonly string[], widths: Partial<Record<number, number>> = {}): XColumn[] =>
  headers.map((header, i) => ({ header, ...(widths[i] && { width: widths[i] }) }));

/* ---------------- Składanie arkuszy ---------------- */

export function buildReport(data: ReportData, opts: ReportOptions): { book: XBook; summary: ReportSummary } {
  const { state, profile } = data;
  const today = localDayOf(opts.now);
  const from = opts.range === 'all' ? null : localDayOf(new Date(opts.now.getFullYear(), opts.now.getMonth(), opts.now.getDate() - Number(opts.range) + 1));
  const inRange = (date: string | null | undefined): date is string => !!date && date <= today && (from === null || date >= from);
  const sex: Sex | null = profile?.sex ?? data.labPrefs?.sex ?? null;
  const heightCm = profile?.heightCm ?? heightOf(state) ?? null;
  const showTargets = !!profile && !hidesKcal(profile);

  // Wpisy słodzonych napojów: liczą się jako jedzenie, ale ich źródło to szacunek z napoju.
  const dayRows = data.days.filter((d) => inRange(d.date));
  const sweetIds = new Set(dayRows.flatMap((d) => drinksOf(d).flatMap((x) => (x.entryId ? [x.entryId] : []))));
  const entries = data.entries
    .filter((e) => inRange(e.date))
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || (a.id ?? 0) - (b.id ?? 0));
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const log = state.log
    .map((e) => ({ e, t: workoutTimes(e) }))
    .filter((x): x is { e: LogEntry; t: NonNullable<ReturnType<typeof workoutTimes>> } => !!x.t && inRange(x.t.day))
    .sort((a, b) => a.t.end.getTime() - b.t.end.getTime());
  const cardio = cardioOf(state).filter((c) => inRange(c.day));
  const snacks = snacksOf(state)
    .map((s) => ({ s, at: new Date(s.at) }))
    .filter((x) => Number.isFinite(x.at.getTime()) && inRange(localDayOf(x.at)))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const weights = bodyOf(state).filter((b) => inRange(b.day));
  const measures = measuresOf(state).filter((m) => inRange(m.day));
  const reports = data.labs.filter((r) => inRange(r.date)).slice().sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0));

  /* Dni */
  const dates = new Set<string>([
    ...byDate.keys(),
    ...dayRows.filter((d) => drinksOf(d).length || d.note?.trim() || d.partial !== undefined).map((d) => d.date),
    ...weights.map((w) => w.day),
    ...log.map((x) => x.t.day),
    ...cardio.map((c) => c.day),
    ...snacks.map((x) => localDayOf(x.at)),
  ]);
  const rowOf = new Map(dayRows.map((d) => [d.date, d]));
  const kgOn = new Map(weights.map((w) => [w.day, w.kg]));
  const daysSheet: XCell[][] = [...dates].sort().map((date) => {
    const list = byDate.get(date) ?? [];
    const row = rowOf.get(date);
    const drinks = drinksOf(row);
    const h = hydration(drinks);
    const target = showTargets && profile && date >= profile.startDate ? targetOn(profile, date) : null;
    const proteinTarget =
      target !== null && profile ? DIET_PROFILES[profile.dietProfile].targets(target, profile.targetWeightKg).protein.target : null;
    const extra = (k: Extra) => knownSum(list.map((e) => e[k]));
    const times = list.map((e) => e.time).sort();
    const first = times[0];
    const last = times[times.length - 1];
    const workouts = log.filter((x) => x.t.day === date);
    const secs = knownSum(workouts.map((x) => x.e.time?.secs));
    const cardioMin = knownSum(cardio.filter((c) => c.day === date && c.kind !== 'steps').map((c) => (c.kind === 'steps' ? null : c.min)));
    const steps = cardio.filter((c): c is Extract<Cardio, { kind: 'steps' }> => c.day === date && c.kind === 'steps');
    const snackCount = snacks.filter((x) => localDayOf(x.at) === date).length;
    return [
      day(date),
      weekday(date),
      list.length ? int(list.reduce((s, e) => s + e.kcal, 0)) : null,
      int(target),
      dec(knownSum(list.map((e) => e.protein)), 1),
      int(proteinTarget),
      dec(knownSum(list.map((e) => e.carbs)), 1),
      dec(knownSum(list.map((e) => e.fat)), 1),
      dec(extra('fiber'), 1),
      dec(extra('sugars'), 1),
      dec(extra('salt'), 2),
      list.length ? int(list.length) : null,
      list.length ? int(list.filter((e) => e.protein === null || e.carbs === null || e.fat === null).length) : null,
      clock(first),
      clock(last),
      first && last && list.length > 1 ? dec((minutesOf(last) - minutesOf(first)) / 60, 1) : null,
      drinks.length ? int(h.total) : null,
      drinks.length ? int(h.byKind.find((k) => k.kind === 'water')?.ml ?? 0) : null,
      drinks.length ? int(h.caffeineMg) : null,
      row?.partial === true ? T.complete.partial : row?.partial === false ? T.complete.full : null,
      dec(kgOn.get(date), 2),
      steps.length ? int(steps.reduce((s, c) => s + c.steps, 0)) : null,
      workouts.length ? workouts.map((x) => workoutName(state, x.e)).join(', ') : null,
      secs === null ? null : dec(secs / 60, 1),
      int(cardioMin),
      snackCount ? int(snackCount) : null,
      row?.note?.trim() || null,
    ];
  });

  /* Jedzenie i składniki */
  const foodSheet: XCell[][] = entries.map((e) => [
    day(e.date),
    clock(e.time),
    T.meals[mealOf(e.time)],
    e.name,
    e.amountLabel || null,
    grams(gramsOf(e.amountLabel)),
    e.id !== undefined && sweetIds.has(e.id) ? T.source.sweet : T.source[e.source],
    eanOf(e.key),
    int(e.kcal),
    dec(e.protein, 1),
    dec(e.carbs, 1),
    dec(e.fat, 1),
    dec(e.fiber, 1),
    dec(e.sugars, 1),
    dec(e.salt, 2),
  ]);
  const partsSheet: XCell[][] = entries.flatMap((e) => {
    const kind = recipeOf(e.key) ? 'recipe' : e.key?.startsWith('set:') && data.sets.has(Number(e.key.slice(4))) ? 'set' : null;
    if (!kind) return [];
    return entryParts(e, data.sets).map((p) => [
      day(e.date),
      clock(e.time),
      e.name,
      T.partKind[kind],
      p.name,
      grams(p.grams),
      p.amountLabel || null,
      eanOf(p.key),
    ]);
  });

  /* Napoje */
  const drinksSheet: XCell[][] = dayRows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((d) =>
      drinksOf(d).map((x) => {
        const caffeine = CAFFEINE_PER_100[x.kind];
        const sweet = x.kind === 'sweet' ? sweetValues(x.ml) : null;
        const zeroKcal = x.kind === 'water' || x.kind === 'zero';
        return [
          day(d.date),
          clock(x.at),
          T.drink[x.kind] ?? x.kind,
          int(x.ml),
          caffeine !== undefined ? int((x.ml * caffeine) / 100) : x.kind === 'water' ? int(0) : null,
          sweet ? int(sweet.kcal) : zeroKcal ? int(0) : null,
          sweet ? dec(sweet.sugars, 1) : zeroKcal ? dec(0, 1) : null,
        ];
      }),
    );

  /* Treningi i serie */
  const workoutsSheet: XCell[][] = log.map(({ e, t }) => {
    let sets = 0;
    let reps = 0;
    let secs = 0;
    let volume: number | null = null;
    for (const item of e.items) {
      const timed = EX[item.id]?.unit === 'secs';
      for (const s of item.sets) {
        sets++;
        if (timed) secs += s.reps;
        else {
          reps += s.reps;
          if (finite(s.w) && s.w > 0) volume = (volume ?? 0) + s.reps * s.w;
        }
      }
    }
    return [
      day(t.day),
      clock(t.start ? hhmm(t.start) : null),
      clock(hhmm(t.end)),
      finite(e.time?.secs) ? dec(e.time.secs / 60, 1) : null,
      workoutName(state, e),
      e.deload ? T.yes : null,
      READY[e.ready] ?? null,
      int(e.items.length),
      int(sets),
      reps ? int(reps) : null,
      secs ? int(secs) : null,
      volume === null ? null : int(volume),
      e.note?.trim() || null,
    ];
  });
  const setsSheet: XCell[][] = log.flatMap(({ e, t }) =>
    e.items.flatMap((item) => {
      const exercise = EX[item.id];
      const timed = exercise?.unit === 'secs';
      const effort = EFFORT[item.effort];
      return item.sets.map((s, i) => [
        day(t.day),
        clock(t.start ? hhmm(t.start) : null),
        workoutName(state, e),
        exercise?.name ?? item.id,
        exercise ? groupLabel(exercise.group) : null,
        int(i + 1),
        timed ? null : int(s.reps),
        timed ? int(s.reps) : null,
        dec(s.w, 2),
        effort?.label ?? null,
        effort ? (item.effort === 'easy' ? '3+' : item.effort === 'solid' ? '1–2' : '0') : null,
        item.note?.trim() || null,
      ]);
    }),
  );

  /* Ruch */
  const moveRows: { at: string; cells: XCell[] }[] = [];
  for (const c of cardio) {
    const kg = weightOn(state, c.day);
    const burn = entryEnergy(state, c, kg ?? 70);
    const at = new Date(c.at);
    const timeOk = c.kind !== 'steps' && Number.isFinite(at.getTime());
    moveRows.push({
      at: `${c.day} ${timeOk ? hhmm(at) : ''}`,
      cells: [
        day(c.day),
        timeOk ? clock(hhmm(at)) : null,
        T.sport[c.kind],
        c.kind === 'steps' ? int(c.steps) : null,
        c.kind === 'steps' ? null : int(c.min),
        c.kind === 'treadmill' || c.kind === 'bike' ? dec(c.kmh, 1) : null,
        c.kind === 'treadmill' ? dec(c.grade, 1) : null,
        c.kind === 'ergo' ? int(c.watts) : null,
        c.kind === 'dance' ? `${T.dance[c.style]}, ${T.mix[c.mix]}` : null,
        dec(burn.km, 2),
        null,
        null,
        null,
        null,
        kg === null ? null : int(burn.active),
        T.src[c.src ?? 'manual'],
      ],
    });
  }
  for (const a of state.watch?.acts ?? []) {
    if (!ON_FOOT.has(a.sport)) continue;
    const at = new Date(a.start * 1000);
    if (!Number.isFinite(at.getTime()) || !inRange(localDayOf(at))) continue;
    moveRows.push({
      at: `${localDayOf(at)} ${hhmm(at)}`,
      cells: [
        day(localDayOf(at)),
        clock(hhmm(at)),
        a.sport === 1 ? T.sport.run : a.sport === 17 ? T.sport.hike : T.sport.walk,
        null,
        dec(a.sec / 60, 1),
        a.m && a.sec ? dec((a.m / a.sec) * 3.6, 1) : null,
        null,
        null,
        null,
        finite(a.m) ? dec(a.m / 1000, 2) : null,
        null,
        null,
        null,
        null,
        null,
        T.src.watch,
      ],
    });
  }
  for (const { s, at } of snacks) {
    const exercise = EX[s.ex];
    const timed = exercise?.unit === 'secs';
    moveRows.push({
      at: `${localDayOf(at)} ${hhmm(at)}`,
      cells: [
        day(localDayOf(at)),
        clock(hhmm(at)),
        T.sport.snack,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        exercise?.name ?? s.ex,
        timed ? null : int(s.reps),
        timed ? int(s.reps) : null,
        dec(s.w, 2),
        null,
        T.src.manual,
      ],
    });
  }
  const moveSheet = moveRows.sort((a, b) => a.at.localeCompare(b.at)).map((r) => r.cells);

  /* Pomiary */
  const bodyDays = new Map<string, { kg?: number; m?: Partial<Record<MeasureKey, number>> }>();
  for (const w of weights) bodyDays.set(w.day, { kg: w.kg });
  for (const m of measures) bodyDays.set(m.day, { ...bodyDays.get(m.day), m });
  const bodySheet: XCell[][] = [...bodyDays.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => [
      day(date),
      dec(d.kg, 2),
      d.kg !== undefined && heightCm ? dec(d.kg / (heightCm / 100) ** 2, 1) : null,
      ...MEASURES.map((k) => dec(d.m?.[k], 1)),
    ]);

  /* Badania */
  const labsSheet: XCell[][] = reports.flatMap((r) =>
    r.results.map((x) => {
      const marker = MARKERS[x.marker];
      // Bez płci zakres z katalogu nie ma zastosowania — zostaje tylko ten z wydruku.
      const v = marker && (sex || x.ref) ? judge(marker, x, sex ?? 'K') : null;
      const range = v?.range ?? x.ref;
      const f = 10 ** ((marker?.digits ?? 2) + 2);
      return [
        day(r.date),
        r.lab,
        marker ? GROUP_LABELS[marker.group] : null,
        marker ? (marker.short && marker.short !== marker.name ? `${marker.name} (${marker.short})` : marker.name) : x.marker,
        finite(x.value) ? Math.round(x.value * f) / f : null,
        x.cmp,
        x.qual ? T.qual[x.qual] : null,
        marker?.unit || null,
        x.printed || null,
        finite(range?.[0]) ? range?.[0] : null,
        finite(range?.[1]) ? range?.[1] : null,
        v?.from ? T.rangeFrom[v.from] : null,
        v ? T.level[v.level] : T.level.unknown,
        v?.target ? T.target[v.target] : null,
        T.labSource[r.source],
      ];
    }),
  );

  /* Urządzenia */
  const deviceRows: { key: string; cells: XCell[] }[] = [];
  const watch = state.watch;
  if (watch) {
    const health = new Map(watch.health.map((h) => [h.day, h]));
    const watchDays = new Set([...watch.days.map((d) => d.day), ...health.keys()]);
    for (const date of watchDays) {
      if (!inRange(date)) continue;
      const d = watch.days.find((x) => x.day === date);
      const h = health.get(date);
      deviceRows.push({
        key: `${date} 1`,
        cells: [
          day(date),
          T.src.watch,
          int(d?.steps),
          finite(d?.m) ? dec(d.m / 1000, 2) : null,
          int(d?.floors),
          int(d?.active),
          int(h?.rhr),
          int(h?.hrMin),
          int(h?.hrAvg),
          int(h?.hrMax),
          int(h?.stress),
          int(h?.bbMin),
          int(h?.bbMax),
          int(h?.sleep),
          null,
          null,
        ],
      });
    }
  }
  for (const d of state.phone?.days ?? []) {
    if (!inRange(d.day)) continue;
    deviceRows.push({
      key: `${d.day} 2`,
      cells: [
        day(d.day),
        T.src.phone,
        int(d.steps),
        finite(d.m) ? dec(d.m / 1000, 2) : null,
        int(d.floors),
        int(d.active),
        int(d.rhr),
        int(d.hrMin),
        int(d.hrAvg),
        int(d.hrMax),
        null,
        null,
        null,
        null,
        int(d.sleep),
        dec(d.kg, 2),
      ],
    });
  }
  const devicesSheet = deviceRows.sort((a, b) => a.key.localeCompare(b.key)).map((r) => r.cells);

  /* Kolejność i pominięcia */
  const data10: { key: Key; columns: XColumn[]; rows: XCell[][]; wrap?: number[] }[] = [
    { key: 'days', columns: cols(T.days, { 1: 13, 22: 30, 26: 40 }), rows: daysSheet, wrap: [26] },
    { key: 'food', columns: cols(T.food, { 3: 36, 6: 24 }), rows: foodSheet },
    { key: 'parts', columns: cols(T.parts, { 2: 30, 4: 30 }), rows: partsSheet },
    { key: 'drinks', columns: cols(T.drinks), rows: drinksSheet },
    { key: 'workouts', columns: cols(T.workouts, { 4: 28, 12: 40 }), rows: workoutsSheet, wrap: [12] },
    { key: 'sets', columns: cols(T.sets, { 2: 28, 3: 30, 11: 40 }), rows: setsSheet, wrap: [11] },
    { key: 'move', columns: cols(T.move, { 2: 24 }), rows: moveSheet },
    { key: 'body', columns: cols(T.body), rows: bodySheet },
    { key: 'labs', columns: cols(T.labs, { 3: 34, 8: 20, 11: 24 }), rows: labsSheet },
    { key: 'devices', columns: cols(T.devices), rows: devicesSheet },
  ];
  const present = data10.filter((s) => s.rows.length > 0);
  const missing = data10.filter((s) => s.rows.length === 0);

  /* Informacje */
  const first = [...dates, ...reports.map((r) => r.date), ...measures.map((m) => m.day)].sort()[0] ?? null;
  const info: XCell[][] = [
    [T.info.report, T.info.reportValue],
    [T.info.created, `${today} ${hhmm(opts.now)}`],
    [T.info.range, T.info.rangeValue(opts.range, from ?? first, today)],
    [T.info.sex, sex ? T.sex[sex] : null],
    [T.info.age, numText(profile?.age ?? data.labPrefs?.age, 0)],
    [T.info.height, numText(heightCm, 0)],
  ];
  if (profile) {
    const kcal = targetOn(profile, today);
    const m = DIET_PROFILES[profile.dietProfile].targets(kcal, profile.targetWeightKg);
    info.push(
      [T.info.dietStart, profile.startDate],
      [T.info.startWeight, numText(profile.startWeightKg, 2)],
      [T.info.targetWeight, numText(profile.targetWeightKg, 2)],
      [T.info.diet, DIET_PROFILES[profile.dietProfile].label],
      [T.info.pace, numText(profile.goalPace, 2)],
    );
    if (showTargets)
      info.push([T.info.kcalToday, numText(kcal, 0)], [T.info.macrosToday, T.info.macros(m.protein.target, m.carbs.target, m.fat.target)]);
    else info.push([T.info.noCount, T.info.noCountValue]);
    info.push([T.info.water, numText(waterTargetMl(profile), 0)]);
    if (profile.pregnancy) info.push([T.info.pregnancy, T.yes]);
    if (profile.belowFloorOk) info.push([T.info.agreed, T.yes]);
    if (profile.fastPlan) info.push([T.info.fast, profile.fastPlan]);
  } else info.push([T.info.noProfile, T.info.noProfileValue]);
  info.push(
    [T.info.contents, present.map((s) => `${T.sheets[s.key]}: ${T.info.rows(s.rows.length)}`).join('; ') || null],
    [T.info.missing, missing.map((s) => T.sheets[s.key]).join(', ') || null],
    ...T.info.legend.map((line, i): XCell[] => [i === 0 ? T.info.notes : null, line]),
    [T.info.note, T.info.noteValue],
  );

  const sheets: XSheet[] = [
    { name: T.sheets.info, columns: cols(T.infoCols, { 0: 46, 1: 90 }), rows: info, filter: false, wrap: [1] },
    ...present.map((s) => ({ name: T.sheets[s.key], columns: s.columns, rows: s.rows, ...(s.wrap && { wrap: s.wrap }) })),
  ];
  return {
    book: { title: T.title, created: opts.now, sheets },
    summary: {
      sheets: sheets.map((s) => ({ name: s.name, rows: s.rows.length })),
      rows: present.reduce((n, s) => n + s.rows.length, 0),
    },
  };
}

/** `gym-tracker-raport-2026-11-03.xlsx` (po angielsku `…-report-…`), dzień lokalny. */
export const reportName = (now: Date): string => `gym-tracker-${LANG === 'pl' ? 'raport' : 'report'}-${localDayOf(now)}.xlsx`;

/**
 * Raport z bazy jedzenia i stanu treningów. Każdy wiersz przechodzi przez te same sita co kopia
 * zapasowa (`clean…`), więc zepsuty wiersz wypada, zamiast zepsuć plik. Rzuca, gdy bazy nie da
 * się otworzyć — ekran mówi o tym wprost.
 */
export async function reportFromDb(
  state: AppState,
  range: ReportRange,
  database: DietDb = defaultDb,
  now: Date = new Date(),
): Promise<{ bytes: Uint8Array; name: string; summary: ReportSummary }> {
  const today = localDayOf(now);
  const [row, entries, days, sets, labs, prefs] = await Promise.all([
    database.profile.get('me'),
    database.entries.toArray(),
    database.days.toArray(),
    database.sets.toArray(),
    loadReports(database),
    loadPrefs(database),
  ]);
  const last = bodyOf(state).at(-1)?.kg;
  const profile = row ? cleanProfile(row, { today, ...(last !== undefined && { weightKg: last }) }) : null;
  const cleanSets = new Map<number, FoodSet>();
  for (const s of sets) {
    const clean = cleanSet(s);
    if (clean && finite(s.id)) cleanSets.set(s.id, clean);
  }
  const { book, summary } = buildReport(
    {
      state,
      profile,
      entries: cleanRows(entries, cleanEntry).rows,
      days: cleanRows(days, cleanDay).rows,
      sets: cleanSets,
      labs,
      labPrefs: prefs,
    },
    { range, now },
  );
  return { bytes: writeXlsx(book), name: reportName(now), summary };
}
