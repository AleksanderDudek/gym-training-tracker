import type { CoachMood, TraineeMood, Who } from '../components/Gorilla';
import type { Gear, PlanLevel, PlanTemplate, ProfileKey, WorkoutGear } from '../types';
import { parseProfileId } from './profiles';
import type { MoveName } from './moves';
import { say } from '../i18n';

/**
 * Sceny do kart treningów i planów — kto ćwiczy, kto kibicuje, jaki gag i co mówi dymek.
 *
 * Źródłem jest system projektowy GYM TRACKER (artefakt „Design System”, komponenty
 * `WorkoutArt` i `PlanArt`, grupy zasobów „Workout art” i „Plan art” z eksportami PNG
 * 1200×600). Treść scen idzie najpierw tam, a dopiero potem tutaj — inaczej grafiki poza
 * aplikacją rozjadą się z tym, co widać na ekranie.
 *
 * Każda scena: tło według sprzętu, wykonawca w ruchu (manekin z silnika póz), kibic
 * w popiersiu, jeden gag i dymek. Tekst dymka powtarza `alt`, więc czytnik ekranu dostaje
 * ten sam żart, a na obrazku nie ma żadnej informacji, której nie byłoby w treści karty.
 */

/** Tło: mieszkanie, mieszkanie z kettlebell albo siłownia. */
export type Setting = 'home' | 'kb' | 'gym';

export type Gag =
  | 'stairs'
  | 'sofa'
  | 'table'
  | 'chairs'
  | 'mirror'
  | 'rack'
  | 'kbs'
  | 'doorbar'
  | 'rug'
  | 'broom'
  | 'boxes'
  | 'clock'
  | 'spotlight'
  | 'spoon'
  | 'seams'
  | 'ticket'
  | 'queue'
  | 'shower'
  | 'leaves'
  | 'feather'
  | 'arcs'
  | 'phoneflash'
  | 'clipboard'
  | 'banana'
  | 'window'
  | 'plant';

export interface Actor {
  who: 'gustaw' | 'gosia';
  move: MoveName;
  gear: Gear;
  flip?: boolean;
}

export interface Fan {
  who: Who;
  mood: TraineeMood | CoachMood;
}

export interface Scene {
  set: Setting;
  /** Wykonawca w ruchu, pełna sylwetka po lewej. */
  act?: Actor;
  /** Kibic w popiersiu, z prawej. */
  fan?: Fan;
  /** Drugi kibic, z lewej od pierwszego — w planach zwykle podopieczny obok trenera. */
  fan2?: Fan;
  /** Jedna albo dwie linijki dymka. */
  bubble: string[];
  /** Kto mówi — nad jego głową stoi dymek. */
  by: 'act' | 'fan' | 'fan2' | 'prop';
  gags?: Gag[];
  /** Duża liczba na kartce kalendarza — długość planu w dniach. */
  big?: string;
  alt: string;
}

/* ---------------- Treningi ---------------- */

export const WORKOUT_SCENES: Record<string, Scene> = {
  A: { set: 'kb', act: { who: 'gustaw', move: 'swing', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'happy' }, bubble: [say('Wchodzę!', "I'm in!")], by: 'act', gags: ['arcs', 'kbs'], alt: say('Gustaw robi swing kettlebell, Gosia kibicuje. Gustaw: „Wchodzę!”', "Gustaw does a kettlebell swing, Gosia cheers him on. Gustaw: “I'm in!”") },
  B: { set: 'kb', act: { who: 'gosia', move: 'row', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'sore' }, bubble: [say('Dziś bolą', 'Today it hurts'), say('inne miejsca…', 'somewhere else…')], by: 'fan', gags: ['kbs'], alt: say('Gosia wiosłuje kettlebell, obolały Gustaw: „Dziś bolą inne miejsca…”', 'Gosia rows a kettlebell, a sore Gustaw: “Today it hurts somewhere else…”') },
  C: { set: 'kb', act: { who: 'gustaw', move: 'squat', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'tired' }, bubble: [say('Nagroda:', 'The prize:'), say('prysznic', 'a shower')], by: 'fan', gags: ['shower'], alt: say('Gustaw robi przysiad z kettlebell, zmęczona Gosia przy drzwiach pod prysznic: „Nagroda: prysznic”', 'Gustaw squats with a kettlebell, a tired Gosia by the shower door: “The prize: a shower”') },
  D: { set: 'home', act: { who: 'gosia', move: 'calf', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'content' }, bubble: [say('Lekko znaczy', 'Light means'), say('lekko', 'light')], by: 'fan', gags: ['feather', 'plant'], alt: say('Gosia wspina się na palce, Gustaw z piórkiem: „Lekko znaczy lekko”', 'Gosia does calf raises, Gustaw holds a feather: “Light means light”') },
  'push-gym': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'barbell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: [say('Jeszcze', 'One'), say('jedno!', 'more!')], by: 'fan', gags: ['rack'], alt: say('Gustaw wyciska sztangę na ławce, Gosia asekuruje: „Jeszcze jedno!”', 'Gustaw bench-presses a barbell, Gosia spots him: “One more!”') },
  'pull-gym': { set: 'gym', act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'amazed' }, bubble: [say('Przyciąga', 'Pulling more'), say('nie tylko ciężary', 'than just weights')], by: 'fan', gags: ['mirror'], alt: say('Gosia podciąga się na drążku, zachwycony Gustaw: „Przyciąga nie tylko ciężary”', 'Gosia does pull-ups, a smitten Gustaw: “Pulling more than just weights”') },
  'legs-gym': { set: 'gym', act: { who: 'gustaw', move: 'squat', gear: 'barbell' }, fan: { who: 'gosia', mood: 'sore' }, bubble: [say('A potem', 'And then'), say('schody…', 'the stairs…')], by: 'fan', gags: ['stairs'], alt: say('Gustaw robi przysiad ze sztangą, Gosia patrzy z przerażeniem na schody: „A potem schody…”', 'Gustaw does a barbell squat, Gosia eyes the stairs in horror: “And then the stairs…”') },
  'upper-gym': { set: 'gym', act: { who: 'gosia', move: 'pressOverhead', gear: 'dumbbell' }, fan: { who: 'gustaw', mood: 'proud' }, bubble: [say('Pchasz, ciągniesz,', 'Push, pull,'), say('jest równowaga', 'perfect balance')], by: 'fan', gags: ['rack'], alt: say('Gosia wyciska hantle nad głowę, Gustaw napina biceps: „Pchasz, ciągniesz, jest równowaga”', 'Gosia presses dumbbells overhead, Gustaw flexes his biceps: “Push, pull, perfect balance”') },
  'lower-gym': { set: 'gym', act: { who: 'gustaw', move: 'lunge', gear: 'barbell' }, fan: { who: 'gosia', mood: 'euphoric' }, bubble: [say('Dół pracuje,', 'Legs do the work,'), say('góra kibicuje!', 'arms do the cheering!')], by: 'fan', alt: say('Gustaw robi wykrok ze sztangą, Gosia wiwatuje: „Dół pracuje, góra kibicuje!”', 'Gustaw does a barbell lunge, Gosia cheers: “Legs do the work, arms do the cheering!”') },
  'full-gym': { set: 'gym', act: { who: 'gosia', move: 'hinge', gear: 'barbell' }, fan: { who: 'gustaw', mood: 'content' }, bubble: [say('Wszystkiego', 'A bit of'), say('po trochu', 'everything')], by: 'fan', gags: ['rack'], alt: say('Gosia robi martwy ciąg, Gustaw z kciukiem w górze: „Wszystkiego po trochu”', 'Gosia deadlifts, Gustaw gives a thumbs up: “A bit of everything”') },
  'full-gym-b': { set: 'gym', act: { who: 'gustaw', move: 'hinge', gear: 'barbell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: [say('Szef zmiany:', 'Shift boss:'), say('martwy ciąg', 'the deadlift')], by: 'act', gags: ['clipboard'], alt: say('Gustaw robi martwy ciąg jak szef zmiany: „Szef zmiany: martwy ciąg”', 'Gustaw deadlifts like the boss of the shift: “Shift boss: the deadlift”') },
  'glutes-gym': { set: 'gym', act: { who: 'gosia', move: 'lunge', gear: 'dumbbell' }, fan: { who: 'gustaw', mood: 'longing' }, bubble: [say('Z boku dziwnie.', 'Looks odd.'), say('Efekt — super.', 'Works great.')], by: 'act', gags: ['mirror'], alt: say('Gosia robi wykroki z hantlami: „Z boku dziwnie. Efekt — super.”', 'Gosia does dumbbell lunges: “Looks odd. Works great.”') },
  'chest-gym': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'dumbbell' }, fan: { who: 'gosia', mood: 'share' }, bubble: [say('Do albumu!', 'One for the album!')], by: 'fan', gags: ['phoneflash'], alt: say('Gustaw wyciska hantle, Gosia robi zdjęcie: „Do albumu!”', 'Gustaw presses dumbbells, Gosia takes a photo: “One for the album!”') },
  'back-gym': { set: 'gym', act: { who: 'gosia', move: 'row', gear: 'barbell' }, fan: { who: 'gustaw', mood: 'share' }, bubble: [say('W lustrze nie widać.', "The mirror can't see it."), say('Na zdjęciu — tak!', 'The camera can!')], by: 'fan', gags: ['phoneflash'], alt: say('Gosia wiosłuje sztangą, Gustaw fotografuje jej plecy: „W lustrze nie widać. Na zdjęciu — tak!”', "Gosia does barbell rows, Gustaw photographs her back: “The mirror can't see it. The camera can!”") },
  'shoulders-gym': { set: 'gym', act: { who: 'gustaw', move: 'lateral', gear: 'dumbbell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: [say('Szwy,', 'Seams,'), say('trzymajcie się!', 'hold on!')], by: 'fan', gags: ['seams'], alt: say('Gustaw unosi hantle bokiem, koszulka trzeszczy w szwach. Gosia: „Szwy, trzymajcie się!”', 'Gustaw does lateral raises and his T-shirt creaks at the seams. Gosia: “Seams, hold on!”') },
  'arms-gym': { set: 'gym', act: { who: 'gosia', move: 'curl', gear: 'dumbbell' }, fan: { who: 'gustaw', mood: 'tired' }, bubble: [say('Łyżka? Za ciężka.', 'A spoon? Too heavy.')], by: 'fan', gags: ['spoon'], alt: say('Gosia ugina ramiona z hantlami, wyczerpany Gustaw z wielką łyżką: „Łyżka? Za ciężka.”', 'Gosia does dumbbell curls, an exhausted Gustaw with a giant spoon: “A spoon? Too heavy.”') },
  'core-gym': { set: 'gym', act: { who: 'gustaw', move: 'crunch', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'proud' }, bubble: [say('Brzuch', 'The abs'), say('ma swoją scenę', 'take the stage')], by: 'fan', gags: ['spotlight'], alt: say('Gustaw robi brzuszki w świetle reflektora: „Brzuch ma swoją scenę”', 'Gustaw does crunches in the spotlight: “The abs take the stage”') },
  'full-none': { set: 'home', act: { who: 'gosia', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'happy' }, bubble: [say('Karnet:', 'Membership:'), say('0 zł', 'free')], by: 'fan', gags: ['sofa', 'ticket'], alt: say('Gosia robi pompki w salonie, Gustaw z biletem: „Karnet: 0 zł”', 'Gosia does push-ups in the living room, Gustaw holds a ticket: “Membership: free”') },
  'full-none-b': { set: 'home', act: { who: 'gustaw', move: 'row', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: [say('Stół wreszcie', 'The table finally'), say('się przydał', 'earns its keep')], by: 'fan', gags: ['table'], alt: say('Gustaw wiosłuje pod stołem, Gosia: „Stół wreszcie się przydał”', 'Gustaw rows under the table, Gosia: “The table finally earns its keep”') },
  'full-none-c': { set: 'home', act: { who: 'gosia', move: 'squat', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'missed' }, bubble: [say('Sąsiedzi myślą,', 'The neighbours think'), say('że się wyprowadzamy', "we're moving out")], by: 'fan', gags: ['boxes'], alt: say('Gosia robi burpee wśród kartonów, Gustaw: „Sąsiedzi myślą, że się wyprowadzamy”', "Gosia does burpees among moving boxes, Gustaw: “The neighbours think we're moving out”") },
  'upper-none': { set: 'home', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'content' }, bubble: [say('Podłoga', 'The floor'), say('zamiast ławki', 'is my bench')], by: 'fan', gags: ['window'], alt: say('Gustaw robi pompki na podłodze, Gosia: „Podłoga zamiast ławki”', 'Gustaw does push-ups on the floor, Gosia: “The floor is my bench”') },
  'lower-none': { set: 'home', act: { who: 'gosia', move: 'lunge', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'happy' }, bubble: [say('Krzesło', 'The chair'), say('dostało etat', 'got a job')], by: 'fan', gags: ['chairs'], alt: say('Gosia robi wykroki przy krześle, Gustaw: „Krzesło dostało etat”', 'Gosia does lunges by a chair, Gustaw: “The chair got a job”') },
  'push-none': { set: 'home', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'share' }, bubble: [say('Podłoga', 'The floor'), say('już mnie zna', 'knows me now')], by: 'act', gags: ['rug'], alt: say('Gustaw robi pompki, dywan patrzy: „Podłoga już mnie zna”', 'Gustaw does push-ups while the rug watches: “The floor knows me now”') },
  'glutes-none': { set: 'home', act: { who: 'gosia', move: 'hinge', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'longing' }, bubble: [say('Kolejka?', 'The queue?'), say('Zero osób.', 'Nobody.')], by: 'act', gags: ['queue'], alt: say('Gosia ćwiczy pośladki na macie: „Kolejka? Zero osób.”', 'Gosia trains her glutes on a mat: “The queue? Nobody.”') },
  'core-none': { set: 'home', act: { who: 'gustaw', move: 'plank', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: [say('To NIE jest', 'This is NOT'), say('odpoczynek', 'a rest')], by: 'act', gags: ['clock'], alt: say('Gustaw w desce przy zegarze: „To NIE jest odpoczynek”', 'Gustaw holds a plank next to a clock: “This is NOT a rest”') },
  'legs-none': { set: 'home', act: { who: 'gosia', move: 'squat', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'amazed' }, bubble: [say('Kto tu rządzi?', "Who's the boss?"), say('— Ja.', '— Me.')], by: 'fan', gags: ['chairs'], alt: say('Gosia robi przysiad do krzesła, Gustaw: „Kto tu rządzi?” — „Ja.”', "Gosia squats to a chair, Gustaw: “Who's the boss?” — “Me.”") },
  'push-kb': { set: 'kb', act: { who: 'gustaw', move: 'pressOverhead', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'content' }, bubble: [say('Meble też', 'The furniture'), say('trenują', 'trains too')], by: 'fan', gags: ['chairs'], alt: say('Gustaw wyciska kettlebell nad głowę między krzesłami, Gosia: „Meble też trenują”', 'Gustaw presses a kettlebell overhead between two chairs, Gosia: “The furniture trains too”') },
  'pull-kb': { set: 'kb', act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'happy' }, bubble: [say('Jak w lesie!', 'Just like the forest!')], by: 'act', gags: ['leaves'], alt: say('Gosia podciąga się na drążku w futrynie obrośniętej liśćmi: „Jak w lesie!”', 'Gosia does pull-ups on a doorway bar overgrown with leaves: “Just like the forest!”') },
  'legs-kb': { set: 'kb', act: { who: 'gustaw', move: 'lunge', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'missed' }, bubble: [say('puk puk', 'knock knock')], by: 'prop', gags: ['broom'], alt: say('Gustaw robi wykroki z kettlebell, a sąsiad z dołu puka miotłą w podłogę: „puk puk”', 'Gustaw does kettlebell lunges while the neighbour below bangs a broom on the ceiling: “knock knock”') },
  'upper-kb': { set: 'kb', act: { who: 'gosia', move: 'row', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'proud' }, bubble: [say('Jeden ciężar,', 'One weight,'), say('dużo roboty', 'plenty of work')], by: 'fan', gags: ['kbs'], alt: say('Gosia wiosłuje kettlebell, Gustaw: „Jeden ciężar, dużo roboty”', 'Gosia rows a kettlebell, Gustaw: “One weight, plenty of work”') },
  'lower-kb': { set: 'kb', act: { who: 'gustaw', move: 'swing', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: [say('Biodra wiedzą,', 'The hips know'), say('co je czeka', "what's coming")], by: 'fan', gags: ['arcs'], alt: say('Gustaw robi swing, Gosia: „Biodra wiedzą, co je czeka”', "Gustaw swings a kettlebell, Gosia: “The hips know what's coming”") },
  'glutes-kb': { set: 'kb', act: { who: 'gosia', move: 'hinge', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'content' }, bubble: [say('Widziałem', "I've seen"), say('już wszystko', 'it all')], by: 'prop', gags: ['rug'], alt: say('Gosia ćwiczy na dywanie, dywan z oczami: „Widziałem już wszystko”', "Gosia trains on the rug, and the rug, which has eyes: “I've seen it all”") },
  'chest-kb': { set: 'kb', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'happy' }, bubble: [say('Klasyka', 'A classic'), say('z podłogi', 'from the floor')], by: 'fan', gags: ['kbs'], alt: say('Gustaw robi pompki obok kettlebelli, Gosia: „Klasyka z podłogi”', 'Gustaw does push-ups next to the kettlebells, Gosia: “A classic from the floor”') },
  'shoulders-kb': { set: 'kb', act: { who: 'gosia', move: 'carry', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'amazed' }, bubble: [say('Najdziwniejszy', 'Weirdest walk'), say('spacer tygodnia', 'of the week')], by: 'fan', gags: ['window'], alt: say('Gosia spaceruje z kettlebell po mieszkaniu, Gustaw: „Najdziwniejszy spacer tygodnia”', 'Gosia walks round the flat with a kettlebell, Gustaw: “Weirdest walk of the week”') },
  'arms-kb': { set: 'kb', act: { who: 'gustaw', move: 'curl', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'share' }, bubble: [say('Rękawy', 'The sleeves'), say('się kurczą!', 'are shrinking!')], by: 'fan', gags: ['seams'], alt: say('Gustaw ugina ramię z kettlebell, Gosia: „Rękawy się kurczą!”', 'Gustaw curls a kettlebell, Gosia: “The sleeves are shrinking!”') },
  'core-kb': { set: 'kb', act: { who: 'gosia', move: 'plank', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'tired' }, bubble: [say('Minuta', 'A minute'), say('czy godzina?', 'or an hour?')], by: 'fan', gags: ['clock'], alt: say('Gosia w desce przy zegarze, Gustaw: „Minuta czy godzina?”', 'Gosia holds a plank next to a clock, Gustaw: “A minute or an hour?”') },
  'trainer-sets': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'barbell' }, fan: { who: 'gosia', mood: 'content' }, bubble: [say('Dwie minuty.', 'Two minutes.'), say('Nie dwie i pół.', 'Not two and a half.')], by: 'fan', gags: ['clock'], alt: say('Gustaw wyciska sztangę, Gosia pilnuje zegara: „Dwie minuty. Nie dwie i pół.”', 'Gustaw bench-presses, Gosia watches the clock: “Two minutes. Not two and a half.”') },
  'trainer-circuit': { set: 'gym', act: { who: 'gosia', move: 'squat', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'tired' }, bubble: [say('Trzecia runda?', 'Round three?'), say('Już?', 'Already?')], by: 'fan', gags: ['clipboard'], alt: say('Gosia robi wyskoki z przysiadu, zmęczony Gustaw z planem treningu: „Trzecia runda? Już?”', 'Gosia does jump squats, a tired Gustaw holds the workout plan: “Round three? Already?”') },
};

/** Własny trening użytkownika: obie postacie z listą. */
export const OWN_WORKOUT_SCENE: Scene = { set: 'home', fan: { who: 'gosia', mood: 'proud' }, fan2: { who: 'gustaw', mood: 'content' }, bubble: [say('Własny zestaw.', 'Home-made set.'), say('Winnych brak.', 'Nobody to blame.')], by: 'fan2', gags: ['clipboard', 'plant'], alt: say('Gustaw i Gosia z listą ćwiczeń: „Własny zestaw. Winnych brak.”', 'Gustaw and Gosia with a list of exercises: “Home-made set. Nobody to blame.”') };

/* ---------------- Plany ---------------- */

/**
 * Plan to droga, więc w każdej scenie stoi Trener Siwy, a kartka kalendarza w rogu mówi,
 * ile dni. „Siła z masą ciała” stoi w mieszkaniu bez kettlebella — w systemie projektowym
 * miała tło z kettlebell, a to plan bez sprzętu; pilnuje tego test zgodności tła ze sprzętem.
 */
export const PLAN_SCENES: Record<string, Scene> = {
  'cel-start-30': { set: 'kb', act: { who: 'gustaw', move: 'swing', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: [say('Każdy siwy grzbiet', 'Every silverback'), say('zaczynał od zera', 'started from zero')], by: 'fan', big: '30', alt: say('Trener Siwy chwali Gustawa przy pierwszym swingu: „Każdy siwy grzbiet zaczynał od zera”', "Coach Siwy praises Gustaw's first swing: “Every silverback started from zero”") },
  'cel-core-30': { set: 'kb', act: { who: 'gosia', move: 'plank', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'calm' }, bubble: [say('Spokojnie.', 'Relax.'), say('Liczę za ciebie.', "I'm counting for you.")], by: 'fan', big: '30', alt: say('Gosia w desce, Trener Siwy z założonymi rękami: „Spokojnie. Liczę za ciebie.”', "Gosia holds a plank, Coach Siwy with his arms folded: “Relax. I'm counting for you.”") },
  'cel-posladki-dom-60': { set: 'kb', act: { who: 'gosia', move: 'hinge', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'wise' }, bubble: [say('Kanapa nie pozna', "The sofa won't know"), say('tych pośladków', 'these glutes')], by: 'fan', big: '60', gags: ['sofa'], alt: say('Gosia z kettlebell, Trener Siwy: „Kanapa nie pozna tych pośladków”', "Gosia with a kettlebell, Coach Siwy: “The sofa won't know these glutes”") },
  'cel-gora-dol-kb-60': { set: 'kb', act: { who: 'gustaw', move: 'pressOverhead', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: [say('Góra, dół, powtórz.', 'Up, down, repeat.'), say('Proste jak goryl.', 'Simple as a gorilla.')], by: 'fan', big: '60', alt: say('Gustaw wyciska kettlebell, Trener Siwy: „Góra, dół, powtórz. Proste jak goryl.”', 'Gustaw presses a kettlebell, Coach Siwy: “Up, down, repeat. Simple as a gorilla.”') },
  'cel-ppl-60': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wink' }, fan2: { who: 'gosia', mood: 'tired' }, bubble: [say('6× w tygodniu.', '6× a week.'), say('Banany zamówione.', 'Bananas ordered.')], by: 'fan', big: '60', alt: say('Gustaw na ławce, zmęczona Gosia i mrugający Trener Siwy: „6× w tygodniu. Banany zamówione.”', 'Gustaw on the bench, a tired Gosia and a winking Coach Siwy: “6× a week. Bananas ordered.”') },
  'cel-gora-dol-60': { set: 'gym', act: { who: 'gosia', move: 'row', gear: 'barbell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: [say('Pół na pół,', 'Half and half,'), say('jak dobra drużyna', 'like a good team')], by: 'fan', big: '60', alt: say('Gosia wiosłuje sztangą, Trener Siwy: „Pół na pół, jak dobra drużyna”', 'Gosia does barbell rows, Coach Siwy: “Half and half, like a good team”') },
  'cel-klatka-60': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wise' }, bubble: [say('Klatka rośnie.', 'The chest grows.'), say('Koszulki — nie.', "The T-shirts don't.")], by: 'fan', big: '60', alt: say('Gustaw wyciska na ławce, Trener Siwy: „Klatka rośnie. Koszulki — nie.”', "Gustaw bench-presses, Coach Siwy: “The chest grows. The T-shirts don't.”") },
  'cel-plecy-60': { set: 'gym', act: { who: 'gosia', move: 'row', gear: 'dumbbell' }, fan: { who: 'siwy', mood: 'calm' }, bubble: [say('Proste plecy,', 'Straight back,'), say('prosta droga', 'straight road')], by: 'fan', big: '60', alt: say('Gosia wiosłuje hantlą, Trener Siwy: „Proste plecy, prosta droga”', 'Gosia rows a dumbbell, Coach Siwy: “Straight back, straight road”') },
  'cel-sila-90': { set: 'gym', act: { who: 'gustaw', move: 'hinge', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wise' }, bubble: [say('90 dni.', '90 days.'), say('Siwizna gratis.', 'Grey hair included.')], by: 'fan', big: '90', alt: say('Gustaw robi martwy ciąg, Trener Siwy: „90 dni. Siwizna gratis.”', 'Gustaw deadlifts, Coach Siwy: “90 days. Grey hair included.”') },
  'cel-posladki-90': { set: 'gym', act: { who: 'gosia', move: 'lunge', gear: 'barbell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: [say('Lustro już', 'The mirror is'), say('się przygotowuje', 'getting ready')], by: 'fan', big: '90', gags: ['mirror'], alt: say('Gosia robi wykroki ze sztangą, Trener Siwy: „Lustro już się przygotowuje”', 'Gosia does barbell lunges, Coach Siwy: “The mirror is getting ready”') },
  'cel-bez-start-30': { set: 'home', act: { who: 'gustaw', move: 'squat', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'coffee' }, bubble: [say('Zero sprzętu,', 'Zero kit,'), say('zero wymówek', 'zero excuses')], by: 'fan', big: '30', alt: say('Gustaw robi przysiad w salonie, Trener Siwy z espresso: „Zero sprzętu, zero wymówek”', 'Gustaw squats in the living room, Coach Siwy with an espresso: “Zero kit, zero excuses”') },
  'cel-bez-brzuch-30': { set: 'home', act: { who: 'gosia', move: 'crunch', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'coffee' }, bubble: [say('Ty brzuszki,', 'You do crunches,'), say('ja kawa. Uczciwie.', 'I do coffee. Fair.')], by: 'fan', big: '30', alt: say('Gosia robi brzuszki, Trener Siwy pije kawę: „Ty brzuszki, ja kawa. Uczciwie.”', 'Gosia does crunches, Coach Siwy drinks coffee: “You do crunches, I do coffee. Fair.”') },
  'cel-bez-cialo-60': { set: 'home', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'approve' }, fan2: { who: 'gosia', mood: 'happy' }, bubble: [say('Salon to też', 'The living room'), say('siłownia', 'is a gym too')], by: 'fan', big: '60', alt: say('Gustaw robi pompki, Gosia i Trener Siwy kibicują: „Salon to też siłownia”', 'Gustaw does push-ups, Gosia and Coach Siwy cheer: “The living room is a gym too”') },
  'cel-bez-posladki-60': { set: 'home', act: { who: 'gosia', move: 'hinge', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'wink' }, bubble: [say('Mata, muzyka,', 'A mat, music,'), say('60 dni', '60 days')], by: 'fan', big: '60', gags: ['rug'], alt: say('Gosia ćwiczy na macie, Trener Siwy mruga: „Mata, muzyka, 60 dni”', 'Gosia trains on a mat, Coach Siwy winks: “A mat, music, 60 days”') },
  'cel-bez-gora-dol-60': { set: 'home', act: { who: 'gustaw', move: 'dip', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'wise' }, bubble: [say('Krzesło awansowało', 'The chair got promoted'), say('na sprzęt', 'to equipment')], by: 'fan', big: '60', gags: ['chairs'], alt: say('Gustaw robi pompki na krzesłach, Trener Siwy: „Krzesło awansowało na sprzęt”', 'Gustaw does dips between chairs, Coach Siwy: “The chair got promoted to equipment”') },
  'cel-bez-sila-90': { set: 'home', act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'approve' }, bubble: [say('Najcięższy sprzęt?', 'The heaviest kit?'), say('Ty sam.', 'You.')], by: 'fan', big: '90', gags: ['doorbar'], alt: say('Gosia podciąga się w futrynie, Trener Siwy: „Najcięższy sprzęt? Ty sam.”', 'Gosia does pull-ups in a doorway, Coach Siwy: “The heaviest kit? You.”') },
};

/** Plany klasyczne z kettlebell — po jednej scenie na poziom (id planu: `poziom-płeć-dni`). */
export const LEVEL_SCENES: Record<PlanLevel, Scene> = {
  zero: { set: 'kb', fan: { who: 'siwy', mood: 'calm' }, fan2: { who: 'gustaw', mood: 'longing' }, bubble: [say('Od zera?', 'From scratch?'), say('Najlepszy start.', 'Best way to start.')], by: 'fan', gags: ['kbs'], alt: say('Gustaw tęsknie patrzy na kettlebelle, Trener Siwy: „Od zera? Najlepszy start.”', 'Gustaw gazes longingly at the kettlebells, Coach Siwy: “From scratch? Best way to start.”') },
  base: { set: 'kb', act: { who: 'gosia', move: 'swing', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: [say('Regularnie.', 'Regularly.'), say('To cały sekret.', "That's the whole secret.")], by: 'fan', gags: ['arcs'], alt: say('Gosia robi swing, Trener Siwy: „Regularnie. To cały sekret.”', "Gosia swings a kettlebell, Coach Siwy: “Regularly. That's the whole secret.”") },
  strong: { set: 'gym', act: { who: 'gustaw', move: 'hinge', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wink' }, bubble: [say('Szukasz ciężaru?', 'After some weight?'), say('Mam.', "I've got plenty.")], by: 'fan', gags: ['rack'], alt: say('Gustaw robi ciężki martwy ciąg, Trener Siwy mruga: „Szukasz ciężaru? Mam.”', "Gustaw does a heavy deadlift, Coach Siwy winks: “After some weight? I've got plenty.”") },
};

/** Plan ułożony samodzielnie. */
export const OWN_PLAN_SCENE: Scene = { set: 'home', fan: { who: 'siwy', mood: 'wise' }, fan2: { who: 'gosia', mood: 'proud' }, bubble: [say('Twój plan,', 'Your plan,'), say('twoje zasady', 'your rules')], by: 'fan', big: '?', alt: say('Gosia z własnym planem, Trener Siwy: „Twój plan, twoje zasady”', 'Gosia with her own plan, Coach Siwy: “Your plan, your rules”') };

/* ---------------- Profile ---------------- */

/**
 * Jedna scena na profil — ten sam żart w planie i w obu treningach, bo profil to jedna
 * historia. W planie kibicuje Trener Siwy z kartką 60 dni, w treningu — drugi podopieczny.
 */
const PROFILE_ACT: Record<ProfileKey, { act: Actor; does: string; bubble: string[]; mood: CoachMood }> = {
  podciaganie: { act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, does: say('Gosia podciąga się na drążku', 'Gosia does pull-ups'), bubble: [say('Najpierw drążek,', 'The bar first,'), say('potem reszta.', 'then the rest.')], mood: 'approve' },
  chwyt: { act: { who: 'gustaw', move: 'carry', gear: 'kettlebell' }, does: say('Gustaw niesie kettlebelle', 'Gustaw carries kettlebells'), bubble: [say('Uścisk dłoni?', 'A handshake?'), say('Na własną odpowiedzialność.', 'At your own risk.')], mood: 'wink' },
  pilka: { act: { who: 'gustaw', move: 'lunge', gear: 'bodyweight' }, does: say('Gustaw robi wykrok', 'Gustaw does a lunge'), bubble: [say('Nogi do gry,', 'Legs for the game,'), say('nie na ławkę.', 'not the bench.')], mood: 'approve' },
  bieganie: { act: { who: 'gosia', move: 'calf', gear: 'bodyweight' }, does: say('Gosia wspina się na palce', 'Gosia does calf raises'), bubble: [say('Łydki biegną', 'The calves run'), say('pierwsze.', 'first.')], mood: 'wise' },
  padel: { act: { who: 'gustaw', move: 'lunge', gear: 'bodyweight' }, does: say('Gustaw robi wykrok jak do piłki przy ścianie', 'Gustaw lunges as if for a ball off the wall'), bubble: [say('Ściana odbija.', 'The wall bounces back.'), say('Ty też.', 'So do you.')], mood: 'wink' },
  plecy: { act: { who: 'gosia', move: 'plank', gear: 'bodyweight' }, does: say('Gosia trzyma deskę', 'Gosia holds a plank'), bubble: [say('Biurko przegrało.', 'The desk lost.'), say('Plecy wygrały.', 'Your back won.')], mood: 'calm' },
};

const SET_OF: Record<WorkoutGear, Setting> = { none: 'home', kb: 'kb', gym: 'gym' };

export function profileScene(k: ProfileKey, gear: WorkoutGear, plan: boolean): Scene {
  const p = PROFILE_ACT[k];
  const other = p.act.who === 'gosia' ? 'gustaw' : 'gosia';
  const fan: Fan = plan ? { who: 'siwy', mood: p.mood } : { who: other, mood: 'happy' };
  const fanName = plan ? say('Trener Siwy', 'Coach Siwy') : other === 'gosia' ? 'Gosia' : 'Gustaw';
  return {
    set: SET_OF[gear],
    act: p.act,
    fan,
    bubble: p.bubble,
    by: 'fan',
    ...(plan ? { big: '60' } : {}),
    alt: say(`${p.does}, ${fanName}: „${p.bubble.join(' ')}”`, `${p.does}, ${fanName}: “${p.bubble.join(' ')}”`),
  };
}

/** Trening z biblioteki dostaje swoją scenę, trening profilu — scenę profilu, własny — wspólną. */
export function workoutScene(id: string): Scene {
  if (Object.hasOwn(WORKOUT_SCENES, id)) return WORKOUT_SCENES[id]!;
  const prof = parseProfileId(id);
  return prof ? profileScene(prof.key, prof.gear, false) : OWN_WORKOUT_SCENE;
}

/**
 * Plan z celem — po identyfikatorze, klasyczny — po poziomie, własny — scena wspólna.
 * Po rodzaju, a nie po kształcie identyfikatora: plan własny też ma poziom, więc zgadywanie
 * z przedrostka dałoby mu scenę planu klasycznego.
 */
export function planScene(t: Pick<PlanTemplate, 'id' | 'kind' | 'level' | 'profile' | 'gear'>): Scene {
  if (t.kind === 'own') return OWN_PLAN_SCENE;
  if (t.profile) return profileScene(t.profile, t.gear ?? 'kb', true);
  if (t.kind === 'goal') return Object.hasOwn(PLAN_SCENES, t.id) ? PLAN_SCENES[t.id]! : OWN_PLAN_SCENE;
  return LEVEL_SCENES[t.level] ?? OWN_PLAN_SCENE;
}
