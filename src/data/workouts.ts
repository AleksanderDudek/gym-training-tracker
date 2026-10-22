import type { Workout, WorkoutKind } from '../types';
import { say } from '../i18n';

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
    say('Push — klatka, barki, triceps', 'Push — chest, shoulders, triceps'),
    'push',
    'gym',
    say('Dzień pchania z układu push/pull/nogi. Dwa wyciskania na klatkę, jedno nad głowę, potem izolacje.', 'Push day from a push/pull/legs split. Two chest presses, one overhead, then isolation work.'),
    ['bench', 'bench_incline', 'ohp_db', 'fly_cable+pushdown', 'lateral'],
  ),
  w(
    'pull-gym',
    say('Pull — plecy i biceps', 'Pull — back and biceps'),
    'pull',
    'gym',
    say('Dzień ciągnięcia: z góry i poziomo sztangą, tył barków, a biceps dwoma uginaniami na koniec.', 'Pull day: a vertical pull and a barbell row, rear delts, then two curls for the biceps to finish.'),
    ['latpulldown', 'row_bb', 'facepull+curl_db', 'curl_hammer'],
  ),
  w(
    'legs-gym',
    say('Nogi — przysiad i zawias', 'Legs — squat and hinge'),
    'legs',
    'gym',
    say('Oba wzorce nóg: kolano (przysiad, suwnica) i biodro (RDL), tył uda, łydki i brzuch na koniec.', 'Both leg patterns: knee (squat, leg press) and hip (RDL), then hamstrings, calves and abs to finish.'),
    ['squat_back', 'rdl_bb', 'legpress+calf_press', 'legcurl', 'legraise_hang'],
  ),
  w(
    'upper-gym',
    say('Góra — pchanie i ciągnięcie', 'Upper — push and pull'),
    'upper',
    'gym',
    say('Górna połowa w równowadze: każde pchanie ma swoje ciągnięcie. Do układu góra/dół.', 'A balanced upper body: every push has its pull. For an upper/lower split.'),
    ['bench', 'row_bb', 'ohp_db+latpulldown', 'lateral+curl_db', 'pushdown'],
  ),
  w(
    'lower-gym',
    say('Dół — siła nóg i pośladków', 'Lower — leg and glute strength'),
    'lower',
    'gym',
    say('Martwy ciąg, przysiad bułgarski i hip thrust, potem prostowanie nóg, łydki i unoszenie nóg w zwisie.', 'Deadlift, Bulgarian split squat and hip thrust, then leg extensions, calves and hanging leg raises.'),
    ['deadlift', 'bulgarian', 'hipthrust', 'legext', 'calf_seated', 'legraise_hang'],
  ),
  w(
    'full-gym',
    say('Całe ciało — siłownia A', 'Full body — gym A'),
    'full',
    'gym',
    say('Przysiad, wyciskanie, wiosłowanie i RDL w jednej sesji. Do planu na dwa–trzy dni w tygodniu.', 'Squat, press, row and RDL in one session. For a plan with two or three days a week.'),
    ['squat_back', 'bench', 'row_cable+rdl_db', 'ohp_db+plank'],
  ),
  w(
    'full-gym-b',
    say('Całe ciało — siłownia B', 'Full body — gym B'),
    'full',
    'gym',
    say('Druga połowa pary: martwy ciąg, wyciskanie żołnierskie, podciąganie i przysiad bułgarski.', 'The other half of the pair: deadlift, military press, pull-ups and Bulgarian split squat.'),
    ['deadlift', 'ohp_bb', 'chinup+bulgarian', 'pallof'],
  ),

  /* ---------------- Siłownia: partie ---------------- */
  w(
    'glutes-gym',
    say('Pośladki — siłownia', 'Glutes — gym'),
    'glutes',
    'gym',
    say('Hip thrust i przysiad bułgarski, do tego odwodzenie na bok pośladka. Ok. dziesięciu serii — tyle naraz jeszcze się opłaca.', 'Hip thrust and Bulgarian split squat, plus abduction for the side of the glutes. About ten sets: as much as still pays off in one go.'),
    ['hipthrust', 'bulgarian', 'legcurl', 'abduction+plank_side'],
  ),
  w(
    'chest-gym',
    say('Klatka — siłownia', 'Chest — gym'),
    'chest',
    'gym',
    say('Płasko, na skosie i rozpiętki, a do każdego pchania ciągnięcie: wiosłowanie i face pull trzymają barki w miejscu.', 'Flat, incline and flyes, with a pull for every push: rows and face pulls keep your shoulders in place.'),
    ['bench', 'bench_incline', 'row_cable', 'fly_cable+facepull'],
  ),
  w(
    'back-gym',
    say('Plecy — siłownia', 'Back — gym'),
    'back',
    'gym',
    say('Szerokość z drążka, grubość z wiosłowania, tył barków i prostowniki na koniec.', 'Width from the pulldown, thickness from rows, then rear delts and lower back to finish.'),
    ['latpulldown', 'row_bb', 'row_cable', 'facepull', 'hyper'],
  ),
  w(
    'shoulders-gym',
    say('Barki — siłownia', 'Shoulders — gym'),
    'shoulders',
    'gym',
    say('Wszystkie trzy aktony: przód z wyciskań, bok z unoszenia, tył z face pulla. Kaptury na koniec.', 'All three heads: front from presses, side from raises, rear from face pulls. Traps to finish.'),
    ['ohp_bb', 'arnold', 'lateral+facepull', 'shrug'],
  ),
  w(
    'arms-gym',
    say('Ramiona — biceps i triceps', 'Arms — biceps and triceps'),
    'arms',
    'gym',
    say('Wąskie wyciskanie na start, potem uginania i prostowania na zmianę. Dodatek, nie podstawa planu.', 'Close-grip bench to start, then curls and extensions, alternating. An extra, not the backbone of a plan.'),
    ['bench_close', 'skullcrusher+curl_bb', 'pushdown+curl_hammer', 'curl_preacher'],
  ),
  w(
    'core-gym',
    say('Brzuch i core — siłownia', 'Abs and core — gym'),
    'core',
    'gym',
    say('Unoszenie nóg, kółko, Pallof press i spacer farmera. Krótki — do dołożenia albo na dzień lżejszy.', 'Leg raises, ab wheel, Pallof press and farmer carry. Short: add it on, or use it on a lighter day.'),
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
    say('Całe ciało bez sprzętu A', 'Full body, no equipment A'),
    'full',
    'none',
    say('Przysiad, pompki, wiosłowanie pod stołem, mostek i deska. Podłoga i solidny stół — nic więcej.', 'Squats, push-ups, rows under a table, glute bridges and a plank. A floor and a sturdy table, nothing else.'),
    ['squat_air+pushup', 'row_inverted+glutebridge', 'plank'],
  ),
  w(
    'full-none-b',
    say('Całe ciało bez sprzętu B', 'Full body, no equipment B'),
    'full',
    'none',
    say('Wykrok wsteczny, pompki w podporze przodem, wiosłowanie pod stołem, wyprosty i dead bug.', 'Reverse lunges, pike push-ups, rows under a table, back extensions and dead bugs.'),
    ['lunge_bw+pushup_pike', 'row_inverted+hyper', 'deadbug'],
  ),
  w(
    'full-none-c',
    say('Całe ciało bez sprzętu C', 'Full body, no equipment C'),
    'full',
    'none',
    say('Burpee na rozgrzanie, przysiad bułgarski z nogą na krześle, pompki diamentowe, wiosłowanie i hollow.', 'Burpees to warm up, Bulgarian split squats on a chair, diamond push-ups, rows and hollow holds.'),
    ['burpee', 'split_bw+pushup_diamond', 'row_inverted', 'y_raise+hollow'],
  ),
  w(
    'upper-none',
    say('Góra bez sprzętu', 'Upper body, no equipment'),
    'upper',
    'none',
    say('Pompki i wiosłowanie pod stołem na zmianę, pompki w podporze, na krześle i litera Y na tył barków.', 'Push-ups and rows under a table, alternating, then pike push-ups, chair dips and Y raises for the rear delts.'),
    ['pushup+row_inverted', 'pushup_pike+y_raise', 'dip_bench'],
  ),
  w(
    'lower-none',
    say('Dół bez sprzętu', 'Lower body, no equipment'),
    'lower',
    'none',
    say('Przysiad, przysiad bułgarski na krześle, mostek jednonóż, nordic curl ze stopami pod kanapą i łydki.', 'Squats, Bulgarian split squats on a chair, single-leg glute bridges, Nordic curls with your feet under the sofa, and calves.'),
    ['squat_air', 'split_bw', 'glutebridge1', 'nordic+calf1'],
  ),
  w(
    'push-none',
    say('Push bez sprzętu', 'Push, no equipment'),
    'push',
    'none',
    say('Cztery rodzaje pompek — klasyczne, w podporze przodem, diamentowe i na krześle. Klatka, barki, triceps.', 'Four kinds of push-ups: classic, pike, diamond and dips on a chair. Chest, shoulders, triceps.'),
    ['pushup', 'pushup_pike', 'pushup_diamond', 'dip_bench'],
  ),
  w(
    'glutes-none',
    say('Pośladki bez sprzętu', 'Glutes, no equipment'),
    'glutes',
    'none',
    say('Przysiad bułgarski na krześle, mostek jednonóż, wyprosty i deska bokiem. Pełny trening pośladków na macie.', 'Bulgarian split squats on a chair, single-leg glute bridges, back extensions and side planks. A full glute workout on a mat.'),
    ['split_bw', 'glutebridge1', 'hyper+plank_side'],
  ),
  w(
    'core-none',
    say('Brzuch bez sprzętu', 'Abs, no equipment'),
    'core',
    'none',
    say('Dead bug, hollow, praca nad core i deska bokiem. Kwadrans na macie.', 'Dead bugs, hollow holds, core work and side planks. Fifteen minutes on a mat.'),
    ['deadbug', 'core', 'hollow', 'plank_side'],
  ),
  w(
    'legs-none',
    say('Nogi bez sprzętu', 'Legs, no equipment'),
    'legs',
    'none',
    say('Wykrok wsteczny, przysiad jednonóż do krzesła, mostek i nordic curl — nogi, które nie potrzebują sztangi.', "Reverse lunges, single-leg squats to a chair, glute bridges and Nordic curls: legs that don't need a barbell."),
    ['lunge_bw', 'pistol', 'glutebridge', 'nordic+calf'],
  ),

  /* ---------------- Kettlebell i masa ciała ---------------- */
  w(
    'push-kb',
    'Push — kettlebell',
    'push',
    'kb',
    say('Wyciskanie nad głowę, floor press, pompki i dipy. Tylko kettlebell i dwa krzesła.', 'Overhead press, floor press, push-ups and dips. Just a kettlebell and two chairs.'),
    ['press', 'floor', 'pushup', 'dip'],
  ),
  w(
    'pull-kb',
    say('Pull — kettlebell i drążek', 'Pull — kettlebell and bar'),
    'pull',
    'kb',
    say('Podciąganie, wiosłowanie kettlebell i australijskie, uginanie i spacer farmera na chwyt.', 'Chin-ups, kettlebell and inverted rows, curls, and a farmer carry for grip.'),
    ['pullup', 'row', 'row_inverted', 'curl', 'farmer'],
  ),
  w(
    'legs-kb',
    say('Nogi — kettlebell', 'Legs — kettlebell'),
    'legs',
    'kb',
    say('Goblet, RDL i wykrok, potem nordic curl na tył uda i wspięcia na łydki.', 'Goblet squat, RDL and lunge, then Nordic curls for the hamstrings and calf raises.'),
    ['goblet', 'rdl', 'lunge', 'nordic+calf1'],
  ),
  w(
    'upper-kb',
    say('Góra — kettlebell', 'Upper — kettlebell'),
    'upper',
    'kb',
    say('Pchanie i ciągnięcie po równo: wyciskanie z wiosłowaniem, floor press z podciąganiem.', 'Equal push and pull: press with row, floor press with chin-ups.'),
    ['press+row', 'floor+pullup', 'pushup+curl'],
  ),
  w(
    'lower-kb',
    say('Dół — kettlebell', 'Lower — kettlebell'),
    'lower',
    'kb',
    say('Swing na rozgrzanie bioder, goblet i wykrok, nordic curl i łydki.', 'Swings to warm up your hips, goblet squat and lunge, Nordic curls and calves.'),
    ['swing2', 'goblet', 'lunge', 'nordic+calf'],
  ),
  w(
    'glutes-kb',
    say('Pośladki — kettlebell i mata', 'Glutes — kettlebell and mat'),
    'glutes',
    'kb',
    say('Zawias, wykrok i mostek biodrowy, na koniec deska bokiem na boczną część pośladka.', 'Hinge, lunge and glute bridge, then a side plank for the side of the glutes.'),
    ['rdl', 'lunge', 'glutebridge+plank_side'],
  ),
  w(
    'chest-kb',
    say('Klatka — kettlebell i pompki', 'Chest — kettlebell and push-ups'),
    'chest',
    'kb',
    say('Floor press, pompki i dipy, a wiosłowanie na koniec — dla równowagi barków.', 'Floor press, push-ups and dips, with rows at the end to balance your shoulders.'),
    ['floor+row', 'pushup', 'dip'],
  ),
  w(
    'shoulders-kb',
    say('Barki — kettlebell', 'Shoulders — kettlebell'),
    'shoulders',
    'kb',
    say('Wyciskanie, pompki w podporze przodem i spacer z ciężarem nad głową. Wiosłowanie na tył barków.', 'Press, pike push-ups and an overhead carry. Rows for the rear delts.'),
    ['press+row', 'pushup_pike', 'carry_oh'],
  ),
  w(
    'arms-kb',
    say('Ramiona — w domu', 'Arms — at home'),
    'arms',
    'kb',
    say('Podciąganie nachwytem, pompki diamentowe i na ławce, uginanie z kettlebell.', 'Pull-ups, diamond push-ups, bench dips and kettlebell curls.'),
    ['chinup+pushup_diamond', 'dip_bench+curl'],
  ),
  w(
    'core-kb',
    say('Brzuch i core — w domu', 'Abs and core — at home'),
    'core',
    'kb',
    say('Dead bug, rosyjskie skręty, deska bokiem i spacer walizkowy. Dwadzieścia minut.', 'Dead bugs, Russian twists, side planks and a suitcase carry. Twenty minutes.'),
    ['deadbug', 'russian', 'plank_side', 'carry'],
  ),

  /* ---------------- Od trenera ---------------- */
  // Dwa plany trenera personalnego: serie z przerwą z zegarkiem i obwód. Kolejność poprawiona
  // tylko tam, gdzie łamała zasady doradcy — wyskoki i swing na świeżo, stacje obwodu na
  // zmianę partii — a podciąganie z „dodatkowo” daje trenigowi ciągnięcie.
  {
    id: 'trainer-sets',
    name: say('3 serie, 2 minuty przerwy — od trenera', "3 sets, 2 minutes' rest — from a trainer"),
    kind: 'full',
    gear: 'gym',
    rest: 120,
    desc: say('Każde ćwiczenie w kolejnych seriach z dwiema minutami przerwy, jak w planie trenera. Wyskoki i swing idą pierwsze, póki nogi są świeże, a podciąganie dochodzi do pchania.', "Each exercise in straight sets with two minutes' rest, as in the trainer's plan. Jumps and swings go first while your legs are fresh, and pull-ups balance out the pushing."),
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
    name: say('Obwód × 3 — od trenera', 'Circuit × 3 — from a trainer'),
    kind: 'full',
    gear: 'gym',
    roundRest: 120,
    desc: say('Cała lista to jedna runda; rund jest tyle, ile serii — zwykle trzy. Stacje zmieniają partie, więc jedna odpoczywa, kiedy pracuje druga. Na koniec podciąganie seriami. Brzuszki z planu zostały poza obwodem: trzecia stacja na brzuch dawała 12 serii na jedną partię — dodasz je w kopii.', "The whole list is one round, with as many rounds as sets, usually three. Stations switch muscle groups, so one rests while the other works. Pull-ups in sets to finish. The plan's crunches were left out of the circuit: a third abs station meant 12 sets for one muscle group. Add them in your own copy."),
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
