import type { CoachMood, TraineeMood, Who } from '../components/Gorilla';
import type { Gear, PlanLevel, PlanTemplate, ProfileKey, WorkoutGear } from '../types';
import { parseProfileId } from './profiles';
import type { MoveName } from './moves';

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
  A: { set: 'kb', act: { who: 'gustaw', move: 'swing', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'happy' }, bubble: ['Wchodzę!'], by: 'act', gags: ['arcs', 'kbs'], alt: 'Gustaw robi swing kettlebell, Gosia kibicuje. Gustaw: „Wchodzę!”' },
  B: { set: 'kb', act: { who: 'gosia', move: 'row', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'sore' }, bubble: ['Dziś bolą', 'inne miejsca…'], by: 'fan', gags: ['kbs'], alt: 'Gosia wiosłuje kettlebell, obolały Gustaw: „Dziś bolą inne miejsca…”' },
  C: { set: 'kb', act: { who: 'gustaw', move: 'squat', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'tired' }, bubble: ['Nagroda:', 'prysznic'], by: 'fan', gags: ['shower'], alt: 'Gustaw robi przysiad z kettlebell, zmęczona Gosia przy drzwiach pod prysznic: „Nagroda: prysznic”' },
  D: { set: 'home', act: { who: 'gosia', move: 'calf', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'content' }, bubble: ['Lekko znaczy', 'lekko'], by: 'fan', gags: ['feather', 'plant'], alt: 'Gosia wspina się na palce, Gustaw z piórkiem: „Lekko znaczy lekko”' },
  'push-gym': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'barbell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: ['Jeszcze', 'jedno!'], by: 'fan', gags: ['rack'], alt: 'Gustaw wyciska sztangę na ławce, Gosia asekuruje: „Jeszcze jedno!”' },
  'pull-gym': { set: 'gym', act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'amazed' }, bubble: ['Przyciąga', 'nie tylko ciężary'], by: 'fan', gags: ['mirror'], alt: 'Gosia podciąga się na drążku, zachwycony Gustaw: „Przyciąga nie tylko ciężary”' },
  'legs-gym': { set: 'gym', act: { who: 'gustaw', move: 'squat', gear: 'barbell' }, fan: { who: 'gosia', mood: 'sore' }, bubble: ['A potem', 'schody…'], by: 'fan', gags: ['stairs'], alt: 'Gustaw robi przysiad ze sztangą, Gosia patrzy z przerażeniem na schody: „A potem schody…”' },
  'upper-gym': { set: 'gym', act: { who: 'gosia', move: 'pressOverhead', gear: 'dumbbell' }, fan: { who: 'gustaw', mood: 'proud' }, bubble: ['Pchasz, ciągniesz,', 'jest równowaga'], by: 'fan', gags: ['rack'], alt: 'Gosia wyciska hantle nad głowę, Gustaw napina biceps: „Pchasz, ciągniesz, jest równowaga”' },
  'lower-gym': { set: 'gym', act: { who: 'gustaw', move: 'lunge', gear: 'barbell' }, fan: { who: 'gosia', mood: 'euphoric' }, bubble: ['Dół pracuje,', 'góra kibicuje!'], by: 'fan', alt: 'Gustaw robi wykrok ze sztangą, Gosia wiwatuje: „Dół pracuje, góra kibicuje!”' },
  'full-gym': { set: 'gym', act: { who: 'gosia', move: 'hinge', gear: 'barbell' }, fan: { who: 'gustaw', mood: 'content' }, bubble: ['Wszystkiego', 'po trochu'], by: 'fan', gags: ['rack'], alt: 'Gosia robi martwy ciąg, Gustaw z kciukiem w górze: „Wszystkiego po trochu”' },
  'full-gym-b': { set: 'gym', act: { who: 'gustaw', move: 'hinge', gear: 'barbell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: ['Szef zmiany:', 'martwy ciąg'], by: 'act', gags: ['clipboard'], alt: 'Gustaw robi martwy ciąg jak szef zmiany: „Szef zmiany: martwy ciąg”' },
  'glutes-gym': { set: 'gym', act: { who: 'gosia', move: 'lunge', gear: 'dumbbell' }, fan: { who: 'gustaw', mood: 'longing' }, bubble: ['Z boku dziwnie.', 'Efekt — super.'], by: 'act', gags: ['mirror'], alt: 'Gosia robi wykroki z hantlami: „Z boku dziwnie. Efekt — super.”' },
  'chest-gym': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'dumbbell' }, fan: { who: 'gosia', mood: 'share' }, bubble: ['Do albumu!'], by: 'fan', gags: ['phoneflash'], alt: 'Gustaw wyciska hantle, Gosia robi zdjęcie: „Do albumu!”' },
  'back-gym': { set: 'gym', act: { who: 'gosia', move: 'row', gear: 'barbell' }, fan: { who: 'gustaw', mood: 'share' }, bubble: ['W lustrze nie widać.', 'Na zdjęciu — tak!'], by: 'fan', gags: ['phoneflash'], alt: 'Gosia wiosłuje sztangą, Gustaw fotografuje jej plecy: „W lustrze nie widać. Na zdjęciu — tak!”' },
  'shoulders-gym': { set: 'gym', act: { who: 'gustaw', move: 'lateral', gear: 'dumbbell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: ['Szwy,', 'trzymajcie się!'], by: 'fan', gags: ['seams'], alt: 'Gustaw unosi hantle bokiem, koszulka trzeszczy w szwach. Gosia: „Szwy, trzymajcie się!”' },
  'arms-gym': { set: 'gym', act: { who: 'gosia', move: 'curl', gear: 'dumbbell' }, fan: { who: 'gustaw', mood: 'tired' }, bubble: ['Łyżka? Za ciężka.'], by: 'fan', gags: ['spoon'], alt: 'Gosia ugina ramiona z hantlami, wyczerpany Gustaw z wielką łyżką: „Łyżka? Za ciężka.”' },
  'core-gym': { set: 'gym', act: { who: 'gustaw', move: 'crunch', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'proud' }, bubble: ['Brzuch', 'ma swoją scenę'], by: 'fan', gags: ['spotlight'], alt: 'Gustaw robi brzuszki w świetle reflektora: „Brzuch ma swoją scenę”' },
  'full-none': { set: 'home', act: { who: 'gosia', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'happy' }, bubble: ['Karnet:', '0 zł'], by: 'fan', gags: ['sofa', 'ticket'], alt: 'Gosia robi pompki w salonie, Gustaw z biletem: „Karnet: 0 zł”' },
  'full-none-b': { set: 'home', act: { who: 'gustaw', move: 'row', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: ['Stół wreszcie', 'się przydał'], by: 'fan', gags: ['table'], alt: 'Gustaw wiosłuje pod stołem, Gosia: „Stół wreszcie się przydał”' },
  'full-none-c': { set: 'home', act: { who: 'gosia', move: 'squat', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'missed' }, bubble: ['Sąsiedzi myślą,', 'że się wyprowadzamy'], by: 'fan', gags: ['boxes'], alt: 'Gosia robi burpee wśród kartonów, Gustaw: „Sąsiedzi myślą, że się wyprowadzamy”' },
  'upper-none': { set: 'home', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'content' }, bubble: ['Podłoga', 'zamiast ławki'], by: 'fan', gags: ['window'], alt: 'Gustaw robi pompki na podłodze, Gosia: „Podłoga zamiast ławki”' },
  'lower-none': { set: 'home', act: { who: 'gosia', move: 'lunge', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'happy' }, bubble: ['Krzesło', 'dostało etat'], by: 'fan', gags: ['chairs'], alt: 'Gosia robi wykroki przy krześle, Gustaw: „Krzesło dostało etat”' },
  'push-none': { set: 'home', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'share' }, bubble: ['Podłoga', 'już mnie zna'], by: 'act', gags: ['rug'], alt: 'Gustaw robi pompki, dywan patrzy: „Podłoga już mnie zna”' },
  'glutes-none': { set: 'home', act: { who: 'gosia', move: 'hinge', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'longing' }, bubble: ['Kolejka?', 'Zero osób.'], by: 'act', gags: ['queue'], alt: 'Gosia ćwiczy pośladki na macie: „Kolejka? Zero osób.”' },
  'core-none': { set: 'home', act: { who: 'gustaw', move: 'plank', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: ['To NIE jest', 'odpoczynek'], by: 'act', gags: ['clock'], alt: 'Gustaw w desce przy zegarze: „To NIE jest odpoczynek”' },
  'legs-none': { set: 'home', act: { who: 'gosia', move: 'squat', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'amazed' }, bubble: ['Kto tu rządzi?', '— Ja.'], by: 'fan', gags: ['chairs'], alt: 'Gosia robi przysiad do krzesła, Gustaw: „Kto tu rządzi?” — „Ja.”' },
  'push-kb': { set: 'kb', act: { who: 'gustaw', move: 'pressOverhead', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'content' }, bubble: ['Meble też', 'trenują'], by: 'fan', gags: ['chairs'], alt: 'Gustaw wyciska kettlebell nad głowę między krzesłami, Gosia: „Meble też trenują”' },
  'pull-kb': { set: 'kb', act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'happy' }, bubble: ['Jak w lesie!'], by: 'act', gags: ['leaves'], alt: 'Gosia podciąga się na drążku w futrynie obrośniętej liśćmi: „Jak w lesie!”' },
  'legs-kb': { set: 'kb', act: { who: 'gustaw', move: 'lunge', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'missed' }, bubble: ['puk puk'], by: 'prop', gags: ['broom'], alt: 'Gustaw robi wykroki z kettlebell, a sąsiad z dołu puka miotłą w podłogę: „puk puk”' },
  'upper-kb': { set: 'kb', act: { who: 'gosia', move: 'row', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'proud' }, bubble: ['Jeden ciężar,', 'dużo roboty'], by: 'fan', gags: ['kbs'], alt: 'Gosia wiosłuje kettlebell, Gustaw: „Jeden ciężar, dużo roboty”' },
  'lower-kb': { set: 'kb', act: { who: 'gustaw', move: 'swing', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'amazed' }, bubble: ['Biodra wiedzą,', 'co je czeka'], by: 'fan', gags: ['arcs'], alt: 'Gustaw robi swing, Gosia: „Biodra wiedzą, co je czeka”' },
  'glutes-kb': { set: 'kb', act: { who: 'gosia', move: 'hinge', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'content' }, bubble: ['Widziałem', 'już wszystko'], by: 'prop', gags: ['rug'], alt: 'Gosia ćwiczy na dywanie, dywan z oczami: „Widziałem już wszystko”' },
  'chest-kb': { set: 'kb', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'gosia', mood: 'happy' }, bubble: ['Klasyka', 'z podłogi'], by: 'fan', gags: ['kbs'], alt: 'Gustaw robi pompki obok kettlebelli, Gosia: „Klasyka z podłogi”' },
  'shoulders-kb': { set: 'kb', act: { who: 'gosia', move: 'carry', gear: 'kettlebell' }, fan: { who: 'gustaw', mood: 'amazed' }, bubble: ['Najdziwniejszy', 'spacer tygodnia'], by: 'fan', gags: ['window'], alt: 'Gosia spaceruje z kettlebell po mieszkaniu, Gustaw: „Najdziwniejszy spacer tygodnia”' },
  'arms-kb': { set: 'kb', act: { who: 'gustaw', move: 'curl', gear: 'kettlebell' }, fan: { who: 'gosia', mood: 'share' }, bubble: ['Rękawy', 'się kurczą!'], by: 'fan', gags: ['seams'], alt: 'Gustaw ugina ramię z kettlebell, Gosia: „Rękawy się kurczą!”' },
  'core-kb': { set: 'kb', act: { who: 'gosia', move: 'plank', gear: 'bodyweight' }, fan: { who: 'gustaw', mood: 'tired' }, bubble: ['Minuta', 'czy godzina?'], by: 'fan', gags: ['clock'], alt: 'Gosia w desce przy zegarze, Gustaw: „Minuta czy godzina?”' },
};

/** Własny trening użytkownika: obie postacie z listą. */
export const OWN_WORKOUT_SCENE: Scene = { set: 'home', fan: { who: 'gosia', mood: 'proud' }, fan2: { who: 'gustaw', mood: 'content' }, bubble: ['Własny zestaw.', 'Winnych brak.'], by: 'fan2', gags: ['clipboard', 'plant'], alt: 'Gustaw i Gosia z listą ćwiczeń: „Własny zestaw. Winnych brak.”' };

/* ---------------- Plany ---------------- */

/**
 * Plan to droga, więc w każdej scenie stoi Trener Siwy, a kartka kalendarza w rogu mówi,
 * ile dni. „Siła z masą ciała” stoi w mieszkaniu bez kettlebella — w systemie projektowym
 * miała tło z kettlebell, a to plan bez sprzętu; pilnuje tego test zgodności tła ze sprzętem.
 */
export const PLAN_SCENES: Record<string, Scene> = {
  'cel-start-30': { set: 'kb', act: { who: 'gustaw', move: 'swing', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: ['Każdy siwy grzbiet', 'zaczynał od zera'], by: 'fan', big: '30', alt: 'Trener Siwy chwali Gustawa przy pierwszym swingu: „Każdy siwy grzbiet zaczynał od zera”' },
  'cel-core-30': { set: 'kb', act: { who: 'gosia', move: 'plank', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'calm' }, bubble: ['Spokojnie.', 'Liczę za ciebie.'], by: 'fan', big: '30', alt: 'Gosia w desce, Trener Siwy z założonymi rękami: „Spokojnie. Liczę za ciebie.”' },
  'cel-posladki-dom-60': { set: 'kb', act: { who: 'gosia', move: 'hinge', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'wise' }, bubble: ['Kanapa nie pozna', 'tych pośladków'], by: 'fan', big: '60', gags: ['sofa'], alt: 'Gosia z kettlebell, Trener Siwy: „Kanapa nie pozna tych pośladków”' },
  'cel-gora-dol-kb-60': { set: 'kb', act: { who: 'gustaw', move: 'pressOverhead', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: ['Góra, dół, powtórz.', 'Proste jak goryl.'], by: 'fan', big: '60', alt: 'Gustaw wyciska kettlebell, Trener Siwy: „Góra, dół, powtórz. Proste jak goryl.”' },
  'cel-ppl-60': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wink' }, fan2: { who: 'gosia', mood: 'tired' }, bubble: ['6× w tygodniu.', 'Banany zamówione.'], by: 'fan', big: '60', alt: 'Gustaw na ławce, zmęczona Gosia i mrugający Trener Siwy: „6× w tygodniu. Banany zamówione.”' },
  'cel-gora-dol-60': { set: 'gym', act: { who: 'gosia', move: 'row', gear: 'barbell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: ['Pół na pół,', 'jak dobra drużyna'], by: 'fan', big: '60', alt: 'Gosia wiosłuje sztangą, Trener Siwy: „Pół na pół, jak dobra drużyna”' },
  'cel-klatka-60': { set: 'gym', act: { who: 'gustaw', move: 'benchPress', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wise' }, bubble: ['Klatka rośnie.', 'Koszulki — nie.'], by: 'fan', big: '60', alt: 'Gustaw wyciska na ławce, Trener Siwy: „Klatka rośnie. Koszulki — nie.”' },
  'cel-plecy-60': { set: 'gym', act: { who: 'gosia', move: 'row', gear: 'dumbbell' }, fan: { who: 'siwy', mood: 'calm' }, bubble: ['Proste plecy,', 'prosta droga'], by: 'fan', big: '60', alt: 'Gosia wiosłuje hantlą, Trener Siwy: „Proste plecy, prosta droga”' },
  'cel-sila-90': { set: 'gym', act: { who: 'gustaw', move: 'hinge', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wise' }, bubble: ['90 dni.', 'Siwizna gratis.'], by: 'fan', big: '90', alt: 'Gustaw robi martwy ciąg, Trener Siwy: „90 dni. Siwizna gratis.”' },
  'cel-posladki-90': { set: 'gym', act: { who: 'gosia', move: 'lunge', gear: 'barbell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: ['Lustro już', 'się przygotowuje'], by: 'fan', big: '90', gags: ['mirror'], alt: 'Gosia robi wykroki ze sztangą, Trener Siwy: „Lustro już się przygotowuje”' },
  'cel-bez-start-30': { set: 'home', act: { who: 'gustaw', move: 'squat', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'coffee' }, bubble: ['Zero sprzętu,', 'zero wymówek'], by: 'fan', big: '30', alt: 'Gustaw robi przysiad w salonie, Trener Siwy z espresso: „Zero sprzętu, zero wymówek”' },
  'cel-bez-brzuch-30': { set: 'home', act: { who: 'gosia', move: 'crunch', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'coffee' }, bubble: ['Ty brzuszki,', 'ja kawa. Uczciwie.'], by: 'fan', big: '30', alt: 'Gosia robi brzuszki, Trener Siwy pije kawę: „Ty brzuszki, ja kawa. Uczciwie.”' },
  'cel-bez-cialo-60': { set: 'home', act: { who: 'gustaw', move: 'pushup', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'approve' }, fan2: { who: 'gosia', mood: 'happy' }, bubble: ['Salon to też', 'siłownia'], by: 'fan', big: '60', alt: 'Gustaw robi pompki, Gosia i Trener Siwy kibicują: „Salon to też siłownia”' },
  'cel-bez-posladki-60': { set: 'home', act: { who: 'gosia', move: 'hinge', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'wink' }, bubble: ['Mata, muzyka,', '60 dni'], by: 'fan', big: '60', gags: ['rug'], alt: 'Gosia ćwiczy na macie, Trener Siwy mruga: „Mata, muzyka, 60 dni”' },
  'cel-bez-gora-dol-60': { set: 'home', act: { who: 'gustaw', move: 'dip', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'wise' }, bubble: ['Krzesło awansowało', 'na sprzęt'], by: 'fan', big: '60', gags: ['chairs'], alt: 'Gustaw robi pompki na krzesłach, Trener Siwy: „Krzesło awansowało na sprzęt”' },
  'cel-bez-sila-90': { set: 'home', act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, fan: { who: 'siwy', mood: 'approve' }, bubble: ['Najcięższy sprzęt?', 'Ty sam.'], by: 'fan', big: '90', gags: ['doorbar'], alt: 'Gosia podciąga się w futrynie, Trener Siwy: „Najcięższy sprzęt? Ty sam.”' },
};

/** Plany klasyczne z kettlebell — po jednej scenie na poziom (id planu: `poziom-płeć-dni`). */
export const LEVEL_SCENES: Record<PlanLevel, Scene> = {
  zero: { set: 'kb', fan: { who: 'siwy', mood: 'calm' }, fan2: { who: 'gustaw', mood: 'longing' }, bubble: ['Od zera?', 'Najlepszy start.'], by: 'fan', gags: ['kbs'], alt: 'Gustaw tęsknie patrzy na kettlebelle, Trener Siwy: „Od zera? Najlepszy start.”' },
  base: { set: 'kb', act: { who: 'gosia', move: 'swing', gear: 'kettlebell' }, fan: { who: 'siwy', mood: 'approve' }, bubble: ['Regularnie.', 'To cały sekret.'], by: 'fan', gags: ['arcs'], alt: 'Gosia robi swing, Trener Siwy: „Regularnie. To cały sekret.”' },
  strong: { set: 'gym', act: { who: 'gustaw', move: 'hinge', gear: 'barbell' }, fan: { who: 'siwy', mood: 'wink' }, bubble: ['Szukasz ciężaru?', 'Mam.'], by: 'fan', gags: ['rack'], alt: 'Gustaw robi ciężki martwy ciąg, Trener Siwy mruga: „Szukasz ciężaru? Mam.”' },
};

/** Plan ułożony samodzielnie. */
export const OWN_PLAN_SCENE: Scene = { set: 'home', fan: { who: 'siwy', mood: 'wise' }, fan2: { who: 'gosia', mood: 'proud' }, bubble: ['Twój plan,', 'twoje zasady'], by: 'fan', big: '?', alt: 'Gosia z własnym planem, Trener Siwy: „Twój plan, twoje zasady”' };

/* ---------------- Profile ---------------- */

/**
 * Jedna scena na profil — ten sam żart w planie i w obu treningach, bo profil to jedna
 * historia. W planie kibicuje Trener Siwy z kartką 60 dni, w treningu — drugi podopieczny.
 */
const PROFILE_ACT: Record<ProfileKey, { act: Actor; does: string; bubble: string[]; mood: CoachMood }> = {
  podciaganie: { act: { who: 'gosia', move: 'pullup', gear: 'bodyweight' }, does: 'Gosia podciąga się na drążku', bubble: ['Najpierw drążek,', 'potem reszta.'], mood: 'approve' },
  chwyt: { act: { who: 'gustaw', move: 'carry', gear: 'kettlebell' }, does: 'Gustaw niesie kettlebelle', bubble: ['Uścisk dłoni?', 'Na własną odpowiedzialność.'], mood: 'wink' },
  pilka: { act: { who: 'gustaw', move: 'lunge', gear: 'bodyweight' }, does: 'Gustaw robi wykrok', bubble: ['Nogi do gry,', 'nie na ławkę.'], mood: 'approve' },
  bieganie: { act: { who: 'gosia', move: 'calf', gear: 'bodyweight' }, does: 'Gosia wspina się na palce', bubble: ['Łydki biegną', 'pierwsze.'], mood: 'wise' },
  padel: { act: { who: 'gustaw', move: 'lunge', gear: 'bodyweight' }, does: 'Gustaw robi wykrok jak do piłki przy ścianie', bubble: ['Ściana odbija.', 'Ty też.'], mood: 'wink' },
  plecy: { act: { who: 'gosia', move: 'plank', gear: 'bodyweight' }, does: 'Gosia trzyma deskę', bubble: ['Biurko przegrało.', 'Plecy wygrały.'], mood: 'calm' },
};

const SET_OF: Record<WorkoutGear, Setting> = { none: 'home', kb: 'kb', gym: 'gym' };

export function profileScene(k: ProfileKey, gear: WorkoutGear, plan: boolean): Scene {
  const p = PROFILE_ACT[k];
  const other = p.act.who === 'gosia' ? 'gustaw' : 'gosia';
  const fan: Fan = plan ? { who: 'siwy', mood: p.mood } : { who: other, mood: 'happy' };
  const fanName = plan ? 'Trener Siwy' : other === 'gosia' ? 'Gosia' : 'Gustaw';
  return {
    set: SET_OF[gear],
    act: p.act,
    fan,
    bubble: p.bubble,
    by: 'fan',
    ...(plan ? { big: '60' } : {}),
    alt: `${p.does}, ${fanName}: „${p.bubble.join(' ')}”`,
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
