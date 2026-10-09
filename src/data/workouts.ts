import type { Workout, WorkoutKind } from '../types';

/**
 * Biblioteka gotowych treningów.
 *
 * Trzy zestawy sprzętu: bez sprzętu (podłoga, ściana, krzesło i solidny stół), kettlebell
 * z masą ciała i siłownia (sztanga, hantle, maszyny, wyciągi — kettlebell też się znajdzie).
 * W każdym trzy rodziny:
 *
 * - **podziały** — push/pull/nogi i góra/dół, do planów na cztery–sześć dni w tygodniu;
 * - **całe ciało** — do planów na dwa–trzy dni, zalecane przez ACSM na początek;
 * - **partie** — pośladki, klatka, plecy, barki, ramiona i brzuch, gdy ktoś ma konkretny cel.
 *
 * Każdy trening przechodzi przez doradcę bez ostrzeżeń — pilnuje tego test. W praktyce
 * znaczy to: żadna partia nie dostaje w jednej sesji więcej niż ok. dziesięciu serii,
 * ruchy wielostawowe idą przed izolacjami, a brzuch, łydki i spacery na końcu.
 *
 * **Pary na zmianę** zapisuje `'a+b'`: seria a, przerwa, seria b, przerwa — aż oba skończą
 * serie. Każdy trening był przejrzany pod tym kątem (`engine/structure.ts` mówi, na jakich
 * zasadach): ruch wybuchowy i ciężki ruch ze sztangą zawsze sam; para tylko z ćwiczeń, które
 * nie męczą tej samej partii; na siłowni para trzyma najwyżej jedno stanowisko — ten sam
 * wyciąg, tę samą suwnicę albo maszynę z hantlami obok. Dni samego pchania i samego brzucha
 * zostają bez par: tam każda para męczyłaby te same mięśnie.
 */

const w = (
  id: string,
  name: string,
  kind: WorkoutKind,
  gear: Workout['gear'],
  desc: string,
  items: string[],
): Workout => ({
  id,
  name,
  kind,
  gear,
  desc,
  items: items.flatMap((x) => {
    const [a, b] = x.split('+');
    return b ? [{ ex: a! }, { ex: b, pair: true }] : [{ ex: a! }];
  }),
});

export const LIBRARY: Workout[] = [
  /* ---------------- Siłownia: podziały ---------------- */
  w(
    'push-gym',
    'Push — klatka, barki, triceps',
    'push',
    'gym',
    'Dzień pchania z układu push/pull/nogi. Dwa wyciskania na klatkę, jedno nad głowę, potem izolacje.',
    ['bench', 'bench_incline', 'ohp_db', 'fly_cable+pushdown', 'lateral'],
  ),
  w(
    'pull-gym',
    'Pull — plecy i biceps',
    'pull',
    'gym',
    'Dzień ciągnięcia: z góry i poziomo sztangą, tył barków, a biceps dwoma uginaniami na koniec.',
    ['latpulldown', 'row_bb', 'facepull+curl_db', 'curl_hammer'],
  ),
  w(
    'legs-gym',
    'Nogi — przysiad i zawias',
    'legs',
    'gym',
    'Oba wzorce nóg: kolano (przysiad, suwnica) i biodro (RDL), tył uda, łydki i brzuch na koniec.',
    ['squat_back', 'rdl_bb', 'legpress+calf_press', 'legcurl', 'legraise_hang'],
  ),
  w(
    'upper-gym',
    'Góra — pchanie i ciągnięcie',
    'upper',
    'gym',
    'Górna połowa w równowadze: każde pchanie ma swoje ciągnięcie. Do układu góra/dół.',
    ['bench', 'row_bb', 'ohp_db+latpulldown', 'lateral+curl_db', 'pushdown'],
  ),
  w(
    'lower-gym',
    'Dół — siła nóg i pośladków',
    'lower',
    'gym',
    'Martwy ciąg, przysiad bułgarski i hip thrust, potem prostowanie nóg, łydki i unoszenie nóg w zwisie.',
    ['deadlift', 'bulgarian', 'hipthrust', 'legext', 'calf_seated', 'legraise_hang'],
  ),
  w(
    'full-gym',
    'Całe ciało — siłownia A',
    'full',
    'gym',
    'Przysiad, wyciskanie, wiosłowanie i RDL w jednej sesji. Do planu na dwa–trzy dni w tygodniu.',
    ['squat_back', 'bench', 'row_cable+rdl_db', 'ohp_db+plank'],
  ),
  w(
    'full-gym-b',
    'Całe ciało — siłownia B',
    'full',
    'gym',
    'Druga połowa pary: martwy ciąg, wyciskanie żołnierskie, podciąganie i przysiad bułgarski.',
    ['deadlift', 'ohp_bb', 'chinup+bulgarian', 'pallof'],
  ),

  /* ---------------- Siłownia: partie ---------------- */
  w(
    'glutes-gym',
    'Pośladki — siłownia',
    'glutes',
    'gym',
    'Hip thrust i przysiad bułgarski, do tego odwodzenie na bok pośladka. Ok. dziesięciu serii — tyle naraz jeszcze się opłaca.',
    ['hipthrust', 'bulgarian', 'legcurl', 'abduction+plank_side'],
  ),
  w(
    'chest-gym',
    'Klatka — siłownia',
    'chest',
    'gym',
    'Płasko, na skosie i rozpiętki, a do każdego pchania ciągnięcie: wiosłowanie i face pull trzymają barki w miejscu.',
    ['bench', 'bench_incline', 'row_cable', 'fly_cable+facepull'],
  ),
  w(
    'back-gym',
    'Plecy — siłownia',
    'back',
    'gym',
    'Szerokość z drążka, grubość z wiosłowania, tył barków i prostowniki na koniec.',
    ['latpulldown', 'row_bb', 'row_cable', 'facepull', 'hyper'],
  ),
  w(
    'shoulders-gym',
    'Barki — siłownia',
    'shoulders',
    'gym',
    'Wszystkie trzy aktony: przód z wyciskań, bok z unoszenia, tył z face pulla. Kaptury na koniec.',
    ['ohp_bb', 'arnold', 'lateral+facepull', 'shrug'],
  ),
  w(
    'arms-gym',
    'Ramiona — biceps i triceps',
    'arms',
    'gym',
    'Wąskie wyciskanie na start, potem uginania i prostowania na zmianę. Dodatek, nie podstawa planu.',
    ['bench_close', 'skullcrusher+curl_bb', 'pushdown+curl_hammer', 'curl_preacher'],
  ),
  w(
    'core-gym',
    'Brzuch i core — siłownia',
    'core',
    'gym',
    'Unoszenie nóg, kółko, Pallof press i spacer farmera. Krótki — do dołożenia albo na dzień lżejszy.',
    ['legraise_hang', 'abwheel', 'pallof+farmer'],
  ),

  /*
   * ---------------- Bez sprzętu ----------------
   *
   * Bez drążka ciągnięcia jest mało, więc zamiast osobnego dnia pull są treningi góry
   * z wiosłowaniem pod stołem i unoszeniem w literę Y. Progresja idzie powtórzeniami
   * i etapami trudności (pompki, przysiad jednonóż, core), a nie ciężarem.
   */
  w(
    'full-none',
    'Całe ciało bez sprzętu A',
    'full',
    'none',
    'Przysiad, pompki, wiosłowanie pod stołem, mostek i deska. Podłoga i solidny stół — nic więcej.',
    ['squat_air+pushup', 'row_inverted+glutebridge', 'plank'],
  ),
  w(
    'full-none-b',
    'Całe ciało bez sprzętu B',
    'full',
    'none',
    'Wykrok wsteczny, pompki w podporze przodem, wiosłowanie pod stołem, wyprosty i dead bug.',
    ['lunge_bw+pushup_pike', 'row_inverted+hyper', 'deadbug'],
  ),
  w(
    'full-none-c',
    'Całe ciało bez sprzętu C',
    'full',
    'none',
    'Burpee na rozgrzanie, przysiad bułgarski z nogą na krześle, pompki diamentowe, wiosłowanie i hollow.',
    ['burpee', 'split_bw+pushup_diamond', 'row_inverted', 'y_raise+hollow'],
  ),
  w(
    'upper-none',
    'Góra bez sprzętu',
    'upper',
    'none',
    'Pompki i wiosłowanie pod stołem na zmianę, pompki w podporze, na krześle i litera Y na tył barków.',
    ['pushup+row_inverted', 'pushup_pike+y_raise', 'dip_bench'],
  ),
  w(
    'lower-none',
    'Dół bez sprzętu',
    'lower',
    'none',
    'Przysiad, przysiad bułgarski na krześle, mostek jednonóż, nordic curl ze stopami pod kanapą i łydki.',
    ['squat_air', 'split_bw', 'glutebridge1', 'nordic+calf1'],
  ),
  w(
    'push-none',
    'Push bez sprzętu',
    'push',
    'none',
    'Cztery rodzaje pompek — klasyczne, w podporze przodem, diamentowe i na krześle. Klatka, barki, triceps.',
    ['pushup', 'pushup_pike', 'pushup_diamond', 'dip_bench'],
  ),
  w(
    'glutes-none',
    'Pośladki bez sprzętu',
    'glutes',
    'none',
    'Przysiad bułgarski na krześle, mostek jednonóż, wyprosty i deska bokiem. Pełny trening pośladków na macie.',
    ['split_bw', 'glutebridge1', 'hyper+plank_side'],
  ),
  w(
    'core-none',
    'Brzuch bez sprzętu',
    'core',
    'none',
    'Dead bug, hollow, praca nad core i deska bokiem. Kwadrans na macie.',
    ['deadbug', 'core', 'hollow', 'plank_side'],
  ),
  w(
    'legs-none',
    'Nogi bez sprzętu',
    'legs',
    'none',
    'Wykrok wsteczny, przysiad jednonóż do krzesła, mostek i nordic curl — nogi, które nie potrzebują sztangi.',
    ['lunge_bw', 'pistol', 'glutebridge', 'nordic+calf'],
  ),

  /* ---------------- Kettlebell i masa ciała ---------------- */
  w(
    'push-kb',
    'Push — kettlebell',
    'push',
    'kb',
    'Wyciskanie nad głowę, floor press, pompki i dipy. Tylko kettlebell i dwa krzesła.',
    ['press', 'floor', 'pushup', 'dip'],
  ),
  w(
    'pull-kb',
    'Pull — kettlebell i drążek',
    'pull',
    'kb',
    'Podciąganie, wiosłowanie kettlebell i australijskie, uginanie i spacer farmera na chwyt.',
    ['pullup', 'row', 'row_inverted', 'curl', 'farmer'],
  ),
  w(
    'legs-kb',
    'Nogi — kettlebell',
    'legs',
    'kb',
    'Goblet, RDL i wykrok, potem nordic curl na tył uda i wspięcia na łydki.',
    ['goblet', 'rdl', 'lunge', 'nordic+calf1'],
  ),
  w(
    'upper-kb',
    'Góra — kettlebell',
    'upper',
    'kb',
    'Pchanie i ciągnięcie po równo: wyciskanie z wiosłowaniem, floor press z podciąganiem.',
    ['press+row', 'floor+pullup', 'pushup+curl'],
  ),
  w(
    'lower-kb',
    'Dół — kettlebell',
    'lower',
    'kb',
    'Swing na rozgrzanie bioder, goblet i wykrok, nordic curl i łydki.',
    ['swing2', 'goblet', 'lunge', 'nordic+calf'],
  ),
  w(
    'glutes-kb',
    'Pośladki — kettlebell i mata',
    'glutes',
    'kb',
    'Zawias, wykrok i mostek biodrowy, na koniec deska bokiem na boczną część pośladka.',
    ['rdl', 'lunge', 'glutebridge+plank_side'],
  ),
  w(
    'chest-kb',
    'Klatka — kettlebell i pompki',
    'chest',
    'kb',
    'Floor press, pompki i dipy, a wiosłowanie na koniec — dla równowagi barków.',
    ['floor+row', 'pushup', 'dip'],
  ),
  w(
    'shoulders-kb',
    'Barki — kettlebell',
    'shoulders',
    'kb',
    'Wyciskanie, pompki w podporze przodem i spacer z ciężarem nad głową. Wiosłowanie na tył barków.',
    ['press+row', 'pushup_pike', 'carry_oh'],
  ),
  w(
    'arms-kb',
    'Ramiona — w domu',
    'arms',
    'kb',
    'Podciąganie nachwytem, pompki diamentowe i na ławce, uginanie z kettlebell.',
    ['chinup+pushup_diamond', 'dip_bench+curl'],
  ),
  w(
    'core-kb',
    'Brzuch i core — w domu',
    'core',
    'kb',
    'Dead bug, rosyjskie skręty, deska bokiem i spacer walizkowy. Dwadzieścia minut.',
    ['deadbug', 'russian', 'plank_side', 'carry'],
  ),

  /* ---------------- Od trenera ---------------- */
  // Dwa plany trenera personalnego: serie z przerwą z zegarkiem i obwód. Kolejność poprawiona
  // tylko tam, gdzie łamała zasady doradcy — wyskoki i swing na świeżo, stacje obwodu na
  // zmianę partii — a podciąganie z „dodatkowo” daje trenigowi ciągnięcie.
  {
    id: 'trainer-sets',
    name: '3 serie, 2 minuty przerwy — od trenera',
    kind: 'full',
    gear: 'gym',
    rest: 120,
    desc: 'Każde ćwiczenie w kolejnych seriach z dwiema minutami przerwy, jak w planie trenera. Wyskoki i swing idą pierwsze, póki nogi są świeże, a podciąganie dochodzi do pchania.',
    items: [
      { ex: 'swing2' },
      { ex: 'squat_jump' },
      { ex: 'bench' },
      { ex: 'goblet' },
      { ex: 'chinup' },
      { ex: 'pushup' },
      { ex: 'core' },
    ],
  },
  {
    id: 'trainer-circuit',
    name: 'Obwód × 3 — od trenera',
    kind: 'full',
    gear: 'gym',
    roundRest: 120,
    desc: 'Cała lista to jedna runda; rund jest tyle, ile serii — zwykle trzy. Stacje zmieniają partie, więc jedna odpoczywa, kiedy pracuje druga. Na koniec podciąganie seriami. Brzuszki z planu zostały poza obwodem: trzecia stacja na brzuch dawała 12 serii na jedną partię — dodasz je w kopii.',
    items: [
      { ex: 'squat_jump', circuit: true },
      { ex: 'pushup', circuit: true },
      { ex: 'legraise_floor', circuit: true },
      { ex: 'squat_back', circuit: true },
      { ex: 'lateral', circuit: true },
      { ex: 'vup', circuit: true },
      { ex: 'chinup' },
    ],
  },
];
