import type { Workout, WorkoutKind } from '../types';

/**
 * Biblioteka gotowych treningów.
 *
 * Dwa zestawy sprzętu: siłownia (sztanga, hantle, maszyny, wyciągi — kettlebell też się
 * znajdzie) i kettlebell z masą ciała, który zmieści się w domu. W każdym trzy rodziny:
 *
 * - **podziały** — push/pull/nogi i góra/dół, do planów na cztery–sześć dni w tygodniu;
 * - **całe ciało** — do planów na dwa–trzy dni, zalecane przez ACSM na początek;
 * - **partie** — pośladki, klatka, plecy, barki, ramiona i brzuch, gdy ktoś ma konkretny cel.
 *
 * Każdy trening przechodzi przez doradcę bez ostrzeżeń — pilnuje tego test. W praktyce
 * znaczy to: żadna partia nie dostaje w jednej sesji więcej niż ok. dziesięciu serii,
 * ruchy wielostawowe idą przed izolacjami, a brzuch, łydki i spacery na końcu.
 */

const w = (
  id: string,
  name: string,
  kind: WorkoutKind,
  gear: Workout['gear'],
  desc: string,
  items: string[],
): Workout => ({ id, name, kind, gear, desc, items: items.map((ex) => ({ ex })) });

export const LIBRARY: Workout[] = [
  /* ---------------- Siłownia: podziały ---------------- */
  w(
    'push-gym',
    'Push — klatka, barki, triceps',
    'push',
    'gym',
    'Dzień pchania z układu push/pull/nogi. Dwa wyciskania na klatkę, jedno nad głowę, potem izolacje.',
    ['bench', 'bench_incline', 'ohp_db', 'fly_cable', 'lateral', 'pushdown'],
  ),
  w(
    'pull-gym',
    'Pull — plecy i biceps',
    'pull',
    'gym',
    'Dzień ciągnięcia: z góry i poziomo sztangą, tył barków, a biceps dwoma uginaniami na koniec.',
    ['latpulldown', 'row_bb', 'facepull', 'curl_db', 'curl_hammer'],
  ),
  w(
    'legs-gym',
    'Nogi — przysiad i zawias',
    'legs',
    'gym',
    'Oba wzorce nóg: kolano (przysiad, suwnica) i biodro (RDL), tył uda, łydki i brzuch na koniec.',
    ['squat_back', 'rdl_bb', 'legpress', 'legcurl', 'calf_press', 'legraise_hang'],
  ),
  w(
    'upper-gym',
    'Góra — pchanie i ciągnięcie',
    'upper',
    'gym',
    'Górna połowa w równowadze: każde pchanie ma swoje ciągnięcie. Do układu góra/dół.',
    ['bench', 'row_bb', 'ohp_db', 'latpulldown', 'lateral', 'curl_db', 'pushdown'],
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
    ['squat_back', 'bench', 'row_cable', 'rdl_db', 'ohp_db', 'plank'],
  ),
  w(
    'full-gym-b',
    'Całe ciało — siłownia B',
    'full',
    'gym',
    'Druga połowa pary: martwy ciąg, wyciskanie żołnierskie, podciąganie i przysiad bułgarski.',
    ['deadlift', 'ohp_bb', 'chinup', 'bulgarian', 'pallof'],
  ),

  /* ---------------- Siłownia: partie ---------------- */
  w(
    'glutes-gym',
    'Pośladki — siłownia',
    'glutes',
    'gym',
    'Hip thrust i przysiad bułgarski, do tego odwodzenie na bok pośladka. Ok. dziesięciu serii — tyle naraz jeszcze się opłaca.',
    ['hipthrust', 'bulgarian', 'legcurl', 'abduction', 'plank_side'],
  ),
  w(
    'chest-gym',
    'Klatka — siłownia',
    'chest',
    'gym',
    'Płasko, na skosie i rozpiętki, a do każdego pchania ciągnięcie: wiosłowanie i face pull trzymają barki w miejscu.',
    ['bench', 'bench_incline', 'row_cable', 'fly_cable', 'facepull'],
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
    ['ohp_bb', 'arnold', 'lateral', 'facepull', 'shrug'],
  ),
  w(
    'arms-gym',
    'Ramiona — biceps i triceps',
    'arms',
    'gym',
    'Wąskie wyciskanie na start, potem uginania i prostowania na zmianę. Dodatek, nie podstawa planu.',
    ['bench_close', 'curl_bb', 'skullcrusher', 'curl_hammer', 'pushdown', 'curl_preacher'],
  ),
  w(
    'core-gym',
    'Brzuch i core — siłownia',
    'core',
    'gym',
    'Unoszenie nóg, kółko, Pallof press i spacer farmera. Krótki — do dołożenia albo na dzień lżejszy.',
    ['legraise_hang', 'abwheel', 'pallof', 'farmer'],
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
    ['goblet', 'rdl', 'lunge', 'nordic', 'calf1'],
  ),
  w(
    'upper-kb',
    'Góra — kettlebell',
    'upper',
    'kb',
    'Pchanie i ciągnięcie po równo: wyciskanie z wiosłowaniem, floor press z podciąganiem.',
    ['press', 'row', 'floor', 'pullup', 'pushup', 'curl'],
  ),
  w(
    'lower-kb',
    'Dół — kettlebell',
    'lower',
    'kb',
    'Swing na rozgrzanie bioder, goblet i wykrok, nordic curl i łydki.',
    ['swing2', 'goblet', 'lunge', 'nordic', 'calf'],
  ),
  w(
    'glutes-kb',
    'Pośladki — kettlebell i mata',
    'glutes',
    'kb',
    'Zawias, wykrok i mostek biodrowy, na koniec deska bokiem na boczną część pośladka.',
    ['rdl', 'lunge', 'glutebridge', 'plank_side'],
  ),
  w(
    'chest-kb',
    'Klatka — kettlebell i pompki',
    'chest',
    'kb',
    'Floor press, pompki i dipy, a wiosłowanie na koniec — dla równowagi barków.',
    ['floor', 'pushup', 'dip', 'row'],
  ),
  w(
    'shoulders-kb',
    'Barki — kettlebell',
    'shoulders',
    'kb',
    'Wyciskanie, pompki w podporze przodem i spacer z ciężarem nad głową. Wiosłowanie na tył barków.',
    ['press', 'pushup_pike', 'row', 'carry_oh'],
  ),
  w(
    'arms-kb',
    'Ramiona — w domu',
    'arms',
    'kb',
    'Podciąganie nachwytem, pompki diamentowe i na ławce, uginanie z kettlebell.',
    ['chinup', 'pushup_diamond', 'dip_bench', 'curl'],
  ),
  w(
    'core-kb',
    'Brzuch i core — w domu',
    'core',
    'kb',
    'Dead bug, rosyjskie skręty, deska bokiem i spacer walizkowy. Dwadzieścia minut.',
    ['deadbug', 'russian', 'plank_side', 'carry'],
  ),
];
