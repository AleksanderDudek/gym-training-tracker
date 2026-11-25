import { KINDS_BY_AREA, parseAssignment } from '@gymtracker/link';
import type { Area, AssignmentKind, FormBody, HabitItem, HabitsBody, MealDay, MealsBody, PlannedMeal } from '@gymtracker/link';
import { autoDeload } from '@gt/engine/design';
import { GROUP_LABELS, MARKERS } from '@gt/food/labs/markers';
import { RECIPES } from '@gt/food/recipes/catalog';
import { INGREDIENTS } from '@gt/food/recipes/ingredients';
import { scale, sumMacros } from '@gt/food/recipes/macros';
import type { Macros } from '@gt/food/recipes/macros';
import { text } from '@gt/i18n';
import type { ExerciseId, Workout } from '@gt/types';
import { bodyReady } from '../../components/Editors';
import { HABIT_PRESETS } from '../../components/editors/HabitsEditor';
import { toAssignment } from '../assign';
import { saveLibraryItem } from '../data';
import type { LibraryBody, LibraryItem, ProgramStep, SendableBody } from '../data';
import { FORM_TEMPLATES } from '../forms';
import type { TemplateKey } from '../forms';

/**
 * „Dodaj przykłady” — przykładowa biblioteka, żeby prowadzący zobaczył każdy rodzaj w działaniu, zanim
 * napisze własny: trzy treningi z atlasu GYM TRACKERa, plan na 8 tygodni, cele, badania, dwa zalecenia,
 * pięć gotowych formularzy (+ jednorazowe podsumowanie tygodnia do programu), dwie listy nawyków, dwa
 * jadłospisy z przepisów GYM TRACKERa i program „Start z prowadzącym — 4 tygodnie”, który odsyła do
 * elementów zapisanych w tej samej partii.
 *
 * **Każdy element przechodzi to samo sprawdzenie co wysyłka** (`bodyReady` i `parseAssignment` w obszarze,
 * który pozwala na ten rodzaj) — przykład, którego nie dałoby się wysłać, byłby gorszy niż żaden.
 * Treść jest w języku tej wizyty (`text`); przepisy, nazwy badań i gotowe nawyki biorą nazwy z katalogów
 * GYM TRACKERa, więc w obu językach to te same rzeczy, które zobaczy podopieczny.
 *
 * **Makro posiłków** liczy się z typowych wartości składników przepisu (ta sama podstawa, na której
 * katalog sprawdza przepisy), na porcję, plus proste dodatki („+ 2 kromki chleba żytniego”), i jest
 * zaokrąglone tak, jak wpisałby je prowadzący: kcal do dziesiątek, gramy do całości.
 */

/* ── Treść ─────────────────────────────────────────────────────────────────────────── */

type Extra = 'bread' | 'banana' | 'rice' | 'buckwheat' | 'potatoes' | 'nuts' | 'apple' | 'fruit' | 'roll' | 'salad';

/** Dodatki do posiłku: nazwa do uwagi i wartości, jakie wpisuje prowadzący (zaokrąglone). */
const EXTRA_MACROS: Record<Extra, Macros> = {
  bread: { kcal: 170, protein: 5, carbs: 32, fat: 1 },
  banana: { kcal: 100, protein: 1, carbs: 25, fat: 0 },
  rice: { kcal: 195, protein: 4, carbs: 43, fat: 0 },
  buckwheat: { kcal: 165, protein: 6, carbs: 32, fat: 1 },
  potatoes: { kcal: 190, protein: 5, carbs: 42, fat: 0 },
  nuts: { kcal: 130, protein: 3, carbs: 3, fat: 12 },
  apple: { kcal: 80, protein: 0, carbs: 20, fat: 0 },
  fruit: { kcal: 80, protein: 1, carbs: 18, fat: 0 },
  roll: { kcal: 150, protein: 5, carbs: 28, fat: 2 },
  salad: { kcal: 120, protein: 1, carbs: 6, fat: 10 },
};

const C = text({
  pl: {
    workoutA: {
      name: 'Całe ciało A',
      desc: 'Siłownia, około 45 minut z rozgrzewką. Przysiad, wyciskanie, wiosłowanie i zawias biodrowy — podstawa planu na 3 treningi w tygodniu. Każda seria z 1–2 powtórzeniami zapasu.',
    },
    workoutB: {
      name: 'Całe ciało B',
      desc: 'Siłownia, około 45 minut z rozgrzewką. Martwy ciąg, wyciskanie nad głowę, ściąganie drążka i praca na jednej nodze. Na zmianę z treningiem A.',
    },
    mobility: {
      name: 'Mobilność 15 min',
      desc: 'Bez sprzętu, około 15 minut. Na dzień bez treningu albo jako rozgrzewka: spokojne tempo, pełny zakres ruchu, swobodny oddech.',
    },
    plan: {
      name: 'Całe ciało — 8 tygodni',
      goal: 'Siła i sylwetka przy redukcji: 3 treningi w tygodniu, A i B na zmianę.',
      desc: 'Poniedziałek, środa, piątek. Ciężar w górę, gdy wszystkie serie wychodzą z zapasem; co 4. tydzień lżejszy. Dzień po treningu: spacer albo „Mobilność 15 min”.',
    },
    targets: {
      title: 'Redukcja — cele na start',
      note: 'Cele na pierwsze 4 tygodnie. Kroki liczą się wszystkie, także spacer z psem. Jeśli waga będzie spadać szybciej niż 0,7 kg na tydzień albo zabraknie sił na treningi, podniesiemy kalorie.',
    },
    labs: {
      title: 'Pakiet podstawowy',
      fasting: 'Rano, na czczo (8–12 godzin bez jedzenia).',
      note: 'Punkt wyjścia przed zmianą diety i treningu. Zdjęcie wydruku dodaj w GYM TRACKERze (Badania) — zobaczę wyniki u siebie. Wyniki omawia lekarz; ja dopasuję do nich plan.',
    },
    sleep: {
      title: 'Sen i regeneracja',
      text: 'Postępy robią się między treningami, nie na nich. Przez najbliższe dwa tygodnie zadbaj o sen tak samo jak o trening: stała pora, ciemno, chłodno, bez ekranu przed snem. Jeśli po nocy budzisz się zmęczony mimo 7–8 godzin, napisz mi — zmienimy obciążenia.',
      checklist: [
        'Stała pora wstawania, także w weekend (± 1 godzina)',
        'Ostatnia kawa najpóźniej 8 godzin przed snem',
        'Godzina bez telefonu i laptopa przed snem',
        'Chłodna, zaciemniona sypialnia (ok. 18–19 °C)',
        'Dzień po ciężkim treningu: spacer zamiast drugiego treningu',
      ],
    },
    squat: {
      title: 'Technika przysiadu',
      text: 'Kilka wskazówek do przysiadu ze sztangą. Nagraj jedną serię z boku i wyślij mi w wiadomości — poprawimy szczegóły. Jeśli coś boli (nie: męczy), przerwij ćwiczenie i napisz.',
      checklist: [
        'Stopy na szerokość bioder lub trochę szerzej, palce lekko na zewnątrz',
        'Wdech i napięcie brzucha przed każdym powtórzeniem',
        'Kolana idą w kierunku palców stóp',
        'Schodzisz tak nisko, jak pozwala prosty odcinek lędźwiowy',
        'Ciężar na całej stopie — pięta zostaje na ziemi',
        'W dół spokojnie (2–3 sekundy), w górę zdecydowanie',
      ],
    },
    weekly: {
      title: 'Podsumowanie tygodnia',
      intro: 'Krótko o minionym tygodniu — 2 minuty. Na tej podstawie poprawiamy plan na następny.',
    },
    habitsDaily: {
      title: 'Codzienne nawyki',
      note: 'Odhaczaj wieczorem. Nie musi być idealnie — liczy się większość dni.',
    },
    habitsRecovery: {
      title: 'Suplementy i regeneracja',
      note: 'Dawkę witaminy D ustal z lekarzem na podstawie wyniku badania. Kreatynę możesz brać o dowolnej porze, także w dni bez treningu.',
      walk: 'Spacer po obiedzie',
      walkDose: '15 min',
    },
    slots: ['Śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja'],
    days: ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'],
    extras: {
      bread: '+ 2 kromki chleba żytniego',
      banana: '+ banan',
      rice: '+ 150 g ugotowanego ryżu',
      buckwheat: '+ 150 g ugotowanej kaszy gryczanej',
      potatoes: '+ 250 g ziemniaków',
      nuts: '+ garść orzechów (20 g)',
      apple: '+ jabłko',
      fruit: '+ miseczka owoców sezonowych',
      roll: '+ bułka grahamka',
      salad: '+ surówka z łyżką oliwy',
    } as Record<Extra, string>,
    mealsCut: {
      title: 'Redukcja 2000 kcal — 7 dni',
      note: 'Posiłki możesz zamieniać w obrębie dnia, a cały dzień — z innym dniem. Obiady z dwóch porcji: druga na następny dzień albo do zamrażarki. Pij wodę do każdego posiłku.',
    },
    mealsQuick: {
      title: 'Szybko i białkowo 2100 kcal — 7 dni',
      note: 'Na dni z treningiem i bez czasu na gotowanie: każdy posiłek w 20 minut albo szybciej. Dodatki (pieczywo, owoce, ryż) możesz zamieniać między sobą.',
    },
    program: {
      title: 'Start z prowadzącym — 4 tygodnie',
      note: 'Pierwszy miesiąc współpracy. Dzień 1: wywiad, codzienne nawyki i plan treningowy; dzień 2: jadłospis; dzień 4: zalecenie o śnie; na koniec każdego tygodnia krótkie podsumowanie. Uruchom w poniedziałek, a tygodnie zaczną się od poniedziałku.',
    },
  },
  en: {
    workoutA: {
      name: 'Full body A',
      desc: 'Gym, about 45 minutes with a warm-up. Squat, press, row and hip hinge — the base of a 3-day plan. Leave 1–2 reps in reserve on every set.',
    },
    workoutB: {
      name: 'Full body B',
      desc: 'Gym, about 45 minutes with a warm-up. Deadlift, overhead press, lat pulldown and single-leg work. Alternates with workout A.',
    },
    mobility: {
      name: 'Mobility 15 min',
      desc: 'No equipment, about 15 minutes. For a rest day or as a warm-up: calm pace, full range of motion, easy breathing.',
    },
    plan: {
      name: 'Full body — 8 weeks',
      goal: 'Strength and shape during a cut: 3 workouts a week, A and B in turn.',
      desc: 'Monday, Wednesday, Friday. Add weight when every set has reps to spare; every 4th week is lighter. The day after: a walk or “Mobility 15 min”.',
    },
    targets: {
      title: 'Cut — starting targets',
      note: 'Targets for the first 4 weeks. Every step counts, walking the dog too. If your weight drops faster than 0.7 kg a week or you run out of energy for training, we will raise calories.',
    },
    labs: {
      title: 'Basic panel',
      fasting: 'In the morning, fasting (8–12 hours without food).',
      note: 'A starting point before changing diet and training. Add a photo of the printout in GYM TRACKER (Labs) and I will see the results. A doctor discusses the results; I adjust the plan to them.',
    },
    sleep: {
      title: 'Sleep and recovery',
      text: 'Progress happens between workouts, not during them. For the next two weeks, look after your sleep as you do your training: regular hours, dark, cool, no screens before bed. If you wake up tired despite 7–8 hours, message me and we will change the loads.',
      checklist: [
        'Same wake-up time, weekends too (± 1 hour)',
        'Last coffee at least 8 hours before bed',
        'An hour without phone and laptop before bed',
        'Cool, dark bedroom (about 18–19 °C)',
        'The day after a hard workout: a walk instead of another workout',
      ],
    },
    squat: {
      title: 'Squat technique',
      text: 'A few cues for the barbell squat. Film one set from the side and send it to me in a message — we will fix the details. If something hurts (not: is tiring), stop the exercise and message me.',
      checklist: [
        'Feet hip-width or slightly wider, toes turned out a little',
        'Breathe in and brace before every rep',
        'Knees track over the toes',
        'Go as low as you can with a neutral lower back',
        'Weight on the whole foot — heels stay down',
        'Down slowly (2–3 seconds), up with intent',
      ],
    },
    weekly: {
      title: 'Weekly summary',
      intro: 'A short look back at the week — 2 minutes. We adjust next week’s plan from it.',
    },
    habitsDaily: {
      title: 'Daily habits',
      note: 'Tick them in the evening. It does not have to be perfect — most days is what counts.',
    },
    habitsRecovery: {
      title: 'Supplements and recovery',
      note: 'Agree the vitamin D dose with your doctor based on your test result. Creatine can be taken at any time of day, rest days too.',
      walk: 'Walk after lunch',
      walkDose: '15 min',
    },
    slots: ['Breakfast', 'Lunch', 'Afternoon snack', 'Dinner'],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    extras: {
      bread: '+ 2 slices of rye bread',
      banana: '+ a banana',
      rice: '+ 150 g cooked rice',
      buckwheat: '+ 150 g cooked buckwheat',
      potatoes: '+ 250 g potatoes',
      nuts: '+ a handful of nuts (20 g)',
      apple: '+ an apple',
      fruit: '+ a bowl of seasonal fruit',
      roll: '+ a wholemeal roll',
      salad: '+ a side salad with a spoon of olive oil',
    } as Record<Extra, string>,
    mealsCut: {
      title: 'Cut 2000 kcal — 7 days',
      note: 'Swap meals within a day, or a whole day with another day. Lunches make two servings: the second for the next day or the freezer. Drink water with every meal.',
    },
    mealsQuick: {
      title: 'Quick and high-protein 2100 kcal — 7 days',
      note: 'For training days with no time to cook: every meal in 20 minutes or less. Swap the sides (bread, fruit, rice) as you like.',
    },
    program: {
      title: 'Start with your coach — 4 weeks',
      note: 'The first month of coaching. Day 1: interview, daily habits and the training plan; day 2: meal plan; day 4: advice on sleep; at the end of each week a short summary. Launch it on a Monday and the weeks start on Mondays.',
    },
  },
});

/* ── Elementy ──────────────────────────────────────────────────────────────────────── */

/** Klucz elementu w partii — program odsyła do nich, zanim baza nada numery. */
export type ExampleKey =
  | 'workoutA'
  | 'workoutB'
  | 'mobility'
  | 'plan'
  | 'targets'
  | 'labs'
  | 'sleep'
  | 'squat'
  | `form-${TemplateKey}`
  | 'form-weekly'
  | 'habitsDaily'
  | 'habitsRecovery'
  | 'mealsCut'
  | 'mealsQuick'
  | 'program';

export interface ExampleItem {
  key: ExampleKey;
  title: string;
  body: LibraryBody;
}

const shortId = () => crypto.randomUUID().slice(0, 8);
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function workout(name: string, desc: string, kind: Workout['kind'], gear: Workout['gear'], ids: ExerciseId[], extra: Partial<Workout> = {}): Workout {
  return { id: `w-${shortId()}`, name, desc, kind, gear, items: ids.map((ex) => ({ ex })), ...extra };
}

/** Wartości przepisu na porcję z typowych wartości składników (podstawa testów katalogu). */
function recipeMacros(id: string): Macros {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) throw new Error(`demo: nie ma przepisu ${id}`); // i18n-ignore: błąd programisty, nie tekst interfejsu
  const total = sumMacros(r.items.map((i) => scale(INGREDIENTS[i.ingredient].typical, i.grams)));
  const n = r.servings ?? 1;
  return { kcal: total.kcal / n, protein: total.protein / n, carbs: total.carbs / n, fat: total.fat / n };
}

/** Posiłek tak, jak wpisałby go prowadzący: przepis z katalogu, dodatki w uwadze, kcal do dziesiątek, gramy do całości. */
function plannedMeal(slot: string, recipeId: string, extras: readonly Extra[]): PlannedMeal {
  const r = RECIPES.find((x) => x.id === recipeId)!;
  const m = sumMacros([recipeMacros(recipeId), ...extras.map((x) => EXTRA_MACROS[x])]);
  return {
    slot,
    name: r.name,
    recipe: r.id,
    kcal: Math.round(m.kcal / 10) * 10,
    protein: Math.round(m.protein),
    carbs: Math.round(m.carbs),
    fat: Math.round(m.fat),
    note: extras.map((x) => C.extras[x]).join(' '),
  };
}

/** Przepis z katalogu GYM TRACKERa i dodatki do niego. */
type MealSpec = [recipe: string, ...extras: Extra[]];
type DaySpec = [MealSpec, MealSpec, MealSpec, MealSpec];

function mealPlan(title: string, note: string, days: DaySpec[]): MealsBody {
  const out: MealDay[] = days.map((d, i) => ({ label: C.days[i]!, meals: d.map(([recipe, ...extras], j) => plannedMeal(C.slots[j]!, recipe, extras)) }));
  return { kind: 'meals', title, note, start: null, days: out };
}

/** Około 2000 kcal i ponad 140 g białka dziennie (cele „Redukcja — cele na start”). */
const CUT: DaySpec[] = [
  [['owsianka-nocna', 'banana'], ['kurczak-curry'], ['skyr-maliny', 'nuts'], ['salatka-grecka-z-kurczakiem', 'bread']],
  [['omlet-twarozek', 'bread'], ['burrito-bowl'], ['kefir-shake', 'apple'], ['placki-z-cukinii', 'fruit']],
  [['nalesniki-bialkowe-mieszanka', 'banana'], ['losos-brokuly', 'potatoes'], ['skyr-maliny', 'nuts'], ['tortilla-z-tunczykiem-i-twarogiem', 'fruit']],
  [['tosty-twarozek-rzodkiewka', 'fruit'], ['chili-indyk', 'rice'], ['shake-truskawkowy', 'banana'], ['wrap-grecki-z-kurczakiem']],
  [['placki-twarogowe'], ['dorsz-pomidory', 'buckwheat'], ['kawa-proteinowa', 'banana'], ['zapiekanka-z-serka-wiejskiego', 'bread']],
  [['jajecznica-z-serkiem-wiejskim'], ['pulpety-indyk', 'potatoes'], ['jogurt-jablko', 'nuts'], ['losos-serek', 'bread']],
  [['owsianka-pieczona-z-malinami', 'banana'], ['kurczak-pieczony', 'potatoes'], ['sernik-proteinowy', 'apple'], ['jajka-sos-szczypiorkowy', 'bread']],
];

/** Około 2100 kcal, każdy przepis w 20 minut albo szybciej. */
const QUICK: DaySpec[] = [
  [['jajecznica-z-serkiem-wiejskim', 'fruit'], ['makaron-tunczyk', 'salad'], ['napoj-banan', 'nuts'], ['wrap-grecki-z-kurczakiem', 'apple']],
  [['placuszki-szpinakowo-bananowe'], ['kurczak-papryka', 'rice', 'salad'], ['kefir-shake', 'banana'], ['tortilla-z-tunczykiem-i-twarogiem', 'apple']],
  [['owsianka-nocna', 'banana', 'nuts'], ['burrito-bowl'], ['serek-bulka'], ['salatka-grecka-z-kurczakiem', 'bread']],
  [['placki-twarogowe', 'fruit'], ['stek-z-chimichurri', 'potatoes'], ['baton-napoj', 'apple'], ['omlet-ze-szparagami', 'bread']],
  [['tosty-twarozek-rzodkiewka', 'banana', 'nuts'], ['krewetki-czosnkowe', 'rice', 'salad'], ['skyr-maliny', 'nuts'], ['placuszki-z-serka-z-mozzarella']],
  [['nalesniki-bialkowe-mieszanka', 'banana', 'nuts'], ['konjac-kurczak-pomidory', 'bread', 'salad'], ['kawa-proteinowa', 'roll'], ['wrap-grecki-z-kurczakiem', 'fruit']],
  [['omlet-twarozek', 'bread', 'fruit'], ['burrito-bowl', 'salad'], ['jogurt-borowki', 'nuts', 'banana'], ['jajecznica-losos', 'roll']],
];

const habit = (i: number, patch: Partial<HabitItem> = {}): HabitItem => ({ ...HABIT_PRESETS[i]!, days: [...HABIT_PRESETS[i]!.days], ...patch });

/** Formularz z gotowego szablonu (`lib/forms.ts`) — ta sama treść, którą daje kreator. */
const template = (key: TemplateKey): FormBody => {
  const t = FORM_TEMPLATES.find((x) => x.key === key)!;
  return { ...t.body, questions: t.body.questions.map((q) => ({ ...q, options: [...q.options] })) };
};

/**
 * Cała przykładowa biblioteka w kolejności zapisu; program na końcu, z krokami odsyłającymi do kluczy
 * (`itemId` = klucz) — `addExamples` podmienia je na numery z bazy. Treningi dostają świeże numery przy
 * każdym wywołaniu, więc druga partia (kopie) nie miesza się z pierwszą w planie.
 */
export function exampleLibrary(): ExampleItem[] {
  const a = workout(C.workoutA.name, C.workoutA.desc, 'full', 'gym', ['squat_back', 'bench_db', 'row_cable', 'rdl_db', 'lateral', 'deadbug']);
  const b = workout(C.workoutB.name, C.workoutB.desc, 'full', 'gym', ['deadlift', 'ohp_db', 'latpulldown', 'bulgarian', 'facepull', 'pallof']);
  const mob = workout(C.mobility.name, C.mobility.desc, 'light', 'none', ['lunge_bw', 'glutebridge', 'y_raise', 'deadbug', 'plank_side'], { rest: 30 });
  const checkin = template('checkin');
  const items: ExampleItem[] = [
    { key: 'workoutA', title: a.name, body: { kind: 'workout', workout: a, videos: {} } },
    { key: 'workoutB', title: b.name, body: { kind: 'workout', workout: b, videos: {} } },
    { key: 'mobility', title: mob.name, body: { kind: 'workout', workout: mob, videos: {} } },
    {
      key: 'plan',
      title: C.plan.name,
      body: {
        kind: 'plan',
        plan: {
          id: `p-${shortId()}`,
          name: C.plan.name,
          level: 'base',
          sex: 'any',
          daysPerWeek: 3,
          weeks: 8,
          loadFactor: 1,
          cycle: [a.id, b.id],
          weekdays: [1, 3, 5],
          desc: C.plan.desc,
          goal: C.plan.goal,
          kind: 'own',
          gear: 'gym',
          deloadEvery: 4,
          deload: autoDeload(8, 4),
        },
      },
    },
    {
      key: 'targets',
      title: C.targets.title,
      body: { kind: 'targets', kcal: 2000, protein: 140, steps: 10000, workoutsPerWeek: 3, weightGoal: null, weeklyRate: -0.5, note: C.targets.note },
    },
    {
      key: 'labs',
      title: C.labs.title,
      body: {
        kind: 'labs',
        by: null,
        note: C.labs.note,
        tests: [
          { name: GROUP_LABELS.cbc, note: '' },
          { name: GROUP_LABELS.lipids, note: C.labs.fasting },
          { name: MARKERS.glucose!.name, note: C.labs.fasting },
          { name: MARKERS.tsh!.name, note: '' },
          { name: MARKERS.vitD!.name, note: '' },
          { name: MARKERS.ferritin!.name, note: '' },
        ],
      },
    },
    { key: 'sleep', title: C.sleep.title, body: { kind: 'note', title: C.sleep.title, text: C.sleep.text, checklist: [...C.sleep.checklist] } },
    { key: 'squat', title: C.squat.title, body: { kind: 'note', title: C.squat.title, text: C.squat.text, checklist: [...C.squat.checklist] } },
    ...FORM_TEMPLATES.map((t): ExampleItem => ({ key: `form-${t.key}`, title: t.body.title, body: template(t.key) })),
    {
      // Program wysyła podsumowanie co tydzień sam (dni 6, 13, 20, 27) — więc jednorazowe: cotygodniowy
      // formularz wysłany cztery razy wracałby czterokrotnie w każdym tygodniu.
      key: 'form-weekly',
      title: C.weekly.title,
      body: { ...checkin, title: C.weekly.title, intro: C.weekly.intro, repeat: 'once', weekday: null, intake: false },
    },
    {
      key: 'habitsDaily',
      title: C.habitsDaily.title,
      body: { kind: 'habits', title: C.habitsDaily.title, note: C.habitsDaily.note, until: null, items: [habit(0), habit(1), habit(4), habit(7), habit(6)] } satisfies HabitsBody,
    },
    {
      key: 'habitsRecovery',
      title: C.habitsRecovery.title,
      body: {
        kind: 'habits',
        title: C.habitsRecovery.title,
        note: C.habitsRecovery.note,
        until: null,
        items: [habit(2), habit(3), habit(5, { days: [1, 3, 5, 7] }), { label: C.habitsRecovery.walk, dose: C.habitsRecovery.walkDose, when: 'midday', days: [...ALL_DAYS] }],
      } satisfies HabitsBody,
    },
    { key: 'mealsCut', title: C.mealsCut.title, body: mealPlan(C.mealsCut.title, C.mealsCut.note, CUT) },
    { key: 'mealsQuick', title: C.mealsQuick.title, body: mealPlan(C.mealsQuick.title, C.mealsQuick.note, QUICK) },
  ];
  const step = (day: number, time: string, itemId: ExampleKey): ProgramStep => ({ day, time, itemId });
  items.push({
    key: 'program',
    title: C.program.title,
    body: {
      kind: 'program',
      note: C.program.note,
      steps: [
        step(0, '07:00', 'form-intake'),
        step(0, '07:00', 'habitsDaily'),
        step(0, '07:00', 'plan'),
        step(1, '07:00', 'mealsCut'),
        step(3, '18:00', 'sleep'),
        ...[6, 13, 20, 27].map((d) => step(d, '18:00', 'form-weekly')),
      ],
    },
  });
  return items;
}

/* ── Sprawdzenie i zapis ───────────────────────────────────────────────────────────── */

const AREAS: Area[] = ['training', 'nutrition', 'rehab', 'insight'];

/** Pierwszy obszar, w którym ten rodzaj da się wysłać. */
export const exampleArea = (kind: AssignmentKind): Area => AREAS.find((a) => KINDS_BY_AREA[a].includes(kind))!;

/**
 * Czy element przejdzie wysyłkę tak jak z okna „Wyślij”: `bodyReady` i `parseAssignment` (to samo co
 * telefon) w obszarze, który pozwala na ten rodzaj. Plan — razem z treningami z tej samej partii.
 */
export function exampleSendable(item: ExampleItem, batch: readonly ExampleItem[]): boolean {
  if (!bodyReady(item.body)) return false;
  if (item.body.kind === 'program') return item.body.steps.every((s) => batch.some((x) => x.key === s.itemId && x.body.kind !== 'program'));
  const library = batch.map((x, i): LibraryItem => ({ id: `x${i}`, kind: x.body.kind, title: x.title, body: x.body, createdAt: '', updatedAt: '' }));
  const body = toAssignment(item.body as SendableBody, library, '');
  return parseAssignment({ v: 1, id: 'check', area: exampleArea(body.kind), sentAt: Date.now(), from: { name: 'Demo', profession: 'trainer' }, body }) !== null;
}

/**
 * Zapisuje przykładową bibliotekę: najpierw elementy, potem program z numerami z bazy. Zanim cokolwiek
 * zapisze, sprawdza całą partię — przykład, który nie przeszedłby wysyłki, nie trafia do biblioteki.
 */
export async function addExamples(
  coachId: string,
  opts: { save?: typeof saveLibraryItem; onProgress?: (done: number, total: number) => void } = {},
): Promise<LibraryItem[]> {
  const save = opts.save ?? saveLibraryItem;
  const batch = exampleLibrary();
  const bad = batch.filter((x) => !exampleSendable(x, batch)).map((x) => x.key);
  if (bad.length) throw new Error(`demo: ${bad.join(', ')}`); // i18n-ignore: błąd programisty, nie tekst interfejsu
  const ids = new Map<string, string>();
  const out: LibraryItem[] = [];
  opts.onProgress?.(0, batch.length);
  for (const x of batch) {
    const body: LibraryBody =
      x.body.kind === 'program' ? { ...x.body, steps: x.body.steps.map((s) => ({ ...s, itemId: ids.get(s.itemId) ?? s.itemId })) } : x.body;
    const saved = await save(coachId, { title: x.title, body });
    ids.set(x.key, saved.id);
    out.push(saved);
    opts.onProgress?.(out.length, batch.length);
  }
  return out;
}
