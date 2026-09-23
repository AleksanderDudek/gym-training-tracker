import type { ExerciseId } from '../types';

/**
 * Dopiski do ćwiczeń. Stoją obok wskazówki technicznej, nigdy zamiast niej — `hint` mówi,
 * co zrobić, żeby się nie połamać, a to jest komentarz z szatni. Gdyby kiedyś zabrakło
 * dopisku, ekran po prostu go nie pokaże; nic się nie psuje.
 */
export const EX_JOKES: Partial<Record<ExerciseId, string>> = {
  /* Zawias biodrowy */
  swing2: 'Ruch, po którym pośladki przypominają o swoim istnieniu przez dwa dni.',
  swing1: 'Jedna ręka pracuje, druga udaje, że tak miało być.',
  rdl: 'Wygląda jak podnoszenie klucza z podłogi. Kosztuje znacznie więcej.',
  deadlift: 'Najuczciwsze ćwiczenie świata: albo wstaje, albo nie.',
  deadlift_sumo: 'Szeroko jak przy zapasach sumo, tylko bez przeciwnika i bez publiczności.',
  rdl_bb: 'Dwójgłowe uda dowiadują się, że istnieją, dokładnie w połowie ruchu.',
  rdl_db: 'Hantle sunące po udach. Spodenki protestują, technika nie.',
  rdl_single: 'Balansowanie na jednej nodze z ciężarem. Flamingi mają to za darmo.',
  hipthrust: 'Najlepsze ćwiczenie pośladków i najgorsze do tłumaczenia w klubie.',
  glutebridge: 'Leżenie na podłodze zaliczone jako trening. Cywilizacja osiągnęła szczyt.',
  goodmorning: 'Nazwa brzmi uprzejmie. Ćwiczenie takie nie jest.',
  hyper: 'Prostowanie się jako dyscyplina sportowa.',
  nordic: 'Opadanie w zwolnionym tempie, które kończy się zawsze tak samo.',
  legcurl: 'Maszyna wymyślona po to, żeby przypomnieć o tylnej stronie uda.',
  pullthrough: 'Wygląda dwuznacznie z każdej strony. Działa mimo to.',
  clean_kb: 'Kettlebell ląduje miękko albo zostawia siniaka. Trzeciej opcji nie ma.',
  snatch_kb: 'Jeden ruch od podłogi po sufit. Prosty w opisie, nie w wykonaniu.',

  /* Przysiad */
  goblet: 'Trzymasz ciężar jak kielich. Toast wypada dopiero po serii.',
  lunge: 'Krok w przód i natychmiastowy żal.',
  squat_back: 'Król ćwiczeń. Wymaga odpowiedniego dworu w postaci dnia wolnego.',
  squat_front: 'Gryf z przodu, łokcie w górze, godność gdzieś pośrodku.',
  squat_box: 'Siadasz na skrzyni. Kusi, żeby zostać.',
  hacksquat: 'Maszyna, która robi przysiad za ciebie. Nogi i tak się dowiedzą.',
  legpress: 'Można wrzucić dużo talerzy i poczuć się niezwyciężonym. Zakres prawdę powie.',
  bulgarian: 'Ćwiczenie nazwane po kraju, który nie chciał się do tego przyznać.',
  stepup: 'Wchodzenie na skrzynię. Jak po schodach, tylko dobrowolnie.',
  lunge_walk: 'Spacer dla ludzi, którzy nie lubią chodzić bezkarnie.',
  pistol: 'Przysiad na jednej nodze. Druga wystaje i nie pomaga.',
  squat_air: 'Bez ciężaru, bez wymówek, bez litości przy trzydziestym powtórzeniu.',
  sissy: 'Nazwa myli. Kolana wiedzą swoje.',
  legext: 'Siedzisz i prostujesz nogę. Czworogłowy nie uznaje tego za odpoczynek.',

  /* Ciągnięcie */
  row: 'Wiosłowanie bez łodzi, bez wody i bez widoków.',
  pullup: 'Ćwiczenie, które bezlitośnie informuje o twojej masie ciała.',
  curl: 'Ćwiczenie na plaży. Wykonywane głównie zimą.',
  row_bb: 'Tułów w pozycji, w której nikt nie wygląda dostojnie.',
  row_db: 'Kolano na ławce, mina skupiona, hantel do biodra.',
  row_tbar: 'Wiosłowanie z klatką na oparciu. Plecy rosną, ego też.',
  row_cable: 'Siedzenie i ciągnięcie. Najbardziej biurowe ćwiczenie na plecy.',
  row_inverted: 'Podciąganie dla tych, którzy jeszcze nie podciągają. Bez wstydu.',
  latpulldown: 'Drążek do klatki. Nie za kark — kark też ma swoje prawa.',
  chinup: 'Jak podciąganie, tylko trudniej i z mniejszym uzasadnieniem.',
  facepull: 'Ćwiczenie dla barków, które siedzenie przy biurku zdążyło popsuć.',
  shrug: 'Wzruszanie ramionami z obciążeniem. Idealne po trudnej rozmowie.',
  pullover: 'Ruch z lat siedemdziesiątych. Działał wtedy, działa dalej.',
  curl_bb: 'Sztanga, łokcie przy tułowiu i święta cisza skupienia.',
  curl_db: 'Dwa hantle, dwa bicepsy, jeden cel niezwiązany z wydolnością.',
  curl_hammer: 'Chwyt jak przy młotku. Przedramiona zauważą różnicę.',
  curl_preacher: 'Modlitewnik. Modlitwy w trakcie serii są mile widziane.',

  /* Pchanie */
  press: 'Ciężar nad głową. Sufit nagle wydaje się bliżej.',
  floor: 'Wyciskanie na podłodze. Ławka była zajęta i tak zostało.',
  pushup: 'Ćwiczenie, które zna każdy i którego nikt nie robi wystarczająco.',
  dip: 'Opuszczanie się między poręczami. Barki zgłaszają zastrzeżenia.',
  bench: 'Poniedziałek na całym świecie. Kolejka mówi sama za siebie.',
  bench_incline: 'Skos trzydzieści stopni. Wyżej to już wyciskanie nad głowę i nieporozumienie.',
  bench_db: 'Hantle dają większy zakres i większy problem z podniesieniem ich na start.',
  bench_close: 'Wąski chwyt. Triceps rośnie, nadgarstki negocjują.',
  chestpress: 'Wyciskanie bez ryzyka przygniecenia. Maszyna nie osądza.',
  pecdeck: 'Ruch przypominający przytulanie powietrza z dużym zaangażowaniem.',
  fly_cable: 'Rozpiętki na wyciągach. Wygląda dostojnie, czuć na drugi dzień.',
  ohp_bb: 'Wyciskanie żołnierskie. Postawa na baczność wliczona w cenę.',
  ohp_db: 'Dwa hantle nad głowę. Stabilizacja gratis.',
  arnold: 'Ćwiczenie z rotacją i z nazwiskiem, którego nie trzeba tłumaczyć.',
  lateral: 'Lekkie hantle, wielkie cierpienie. Barki nie znoszą kompromisów.',
  frontraise: 'Unoszenie ramion w przód. Wygląda jak zgłaszanie się do odpowiedzi.',
  pushdown: 'Prostowanie ramion na wyciągu. Triceps w końcu dostaje uwagę.',
  skullcrusher: 'Nazwa ostrzega dosłownie. Warto traktować ją poważnie.',
  pushup_diamond: 'Dłonie w romb. Triceps natychmiast rozumie zamiar.',
  pushup_pike: 'Biodra w górę, głowa w dół, godność gdzieś obok.',
  hspu: 'Pompki do góry nogami. Świat wygląda inaczej i trudniej.',
  dip_bench: 'Pompki na ławce. Łatwiejsze, dopóki nie zrobisz dwudziestu.',

  /* Całe ciało */
  tgu: 'Wstawanie z podłogi z ciężarem nad głową. Jak poranek, tylko dobrowolnie.',
  complex: 'Trzy ćwiczenia bez odkładania ciężaru. Ktoś to wymyślił celowo.',
  thruster: 'Przysiad i wyciskanie w jednym. Oszczędność czasu, strata oddechu.',
  clean_jerk: 'Ruch olimpijski. Nauka trwa latami, opinia sąsiada powstaje natychmiast.',
  burpee: 'Ćwiczenie, na które nikt nigdy nie czekał z niecierpliwością.',
  wallball: 'Rzucanie piłką w ścianę. Ściana nie oddaje, ale i tak wygrywa.',
  boxjump: 'Wskoki na skrzynię. Golenie mają w tej sprawie złe wspomnienia.',
  rower: 'Wiosłowanie donikąd z pełnym zaangażowaniem.',
  bike: 'Rower, który oddaje dokładnie tyle bólu, ile w niego włożysz.',
  jumprope: 'Skakanka. Wyglądało łatwo na podwórku, w wieku dorosłym mniej.',
  ropes: 'Machanie linami. Wygląda efektownie, czuć od razu.',
  sled: 'Pchanie sań. Bez fazy opuszczania, więc i bez wymówek.',

  /* Core i carry */
  carry: 'Chodzenie z ciężarem po jednej stronie. Jak z zakupami, tylko sensowniej.',
  farmer: 'Spacer rolnika. Nazwa uczciwa, obciążenie też.',
  core: 'Brzuch robi się w kuchni, ale dokręca się tutaj.',
  plank: 'Nieruchome leżenie jako wysiłek. Czas zwalnia w okolicach trzydziestej sekundy.',
  plank_side: 'Deska bokiem. Połowa ciała pracuje, druga patrzy z podziwem.',
  deadbug: 'Nazwa nieelegancka, efekt na lędźwie zaskakująco dobry.',
  hollow: 'Leżenie w łódce. Wygląda niewinnie przez pierwsze pięć sekund.',
  abwheel: 'Kółko za kilkanaście złotych i pokora za darmo.',
  legraise_hang: 'Wiszenie i unoszenie nóg. Chwyt poddaje się zwykle pierwszy.',
  crunch_cable: 'Brzuszki z obciążeniem, czyli brzuszki dla dorosłych.',
  pallof: 'Zadanie polega na tym, żeby nic się nie wydarzyło. Trudniejsze, niż brzmi.',
  russian: 'Skręty tułowia. Rosyjskie tylko z nazwy, bolą uniwersalnie.',
  carry_oh: 'Spacer z ciężarem nad głową. Sufit obserwuje z uwagą.',
  carry_rack: 'Ciężar przy klatce utrudnia oddychanie i to jest częścią planu.',
  sled_drag: 'Ciągnięcie sań tyłem. Kolana dziękują, płuca niekoniecznie.',

  /* Nogi — dodatkowe */
  calf: 'Łydki rosną powoli i o tym wiedzą. Robią to na złość.',
  calf1: 'Jedna łydka naraz, bo dwie naraz było za łatwo.',
  calf_seated: 'Wspięcia siedząc. Jedyny przypadek, w którym siedzenie boli.',
  calf_press: 'Wspięcia na suwnicy. Dużo talerzy, mały zakres, wielka duma.',
  tibialis: 'Przód goleni. Partia, o której nikt nie pamięta aż do pierwszego biegu.',
  abduction: 'Maszyna, przy której wszyscy udają, że patrzą w telefon.',
  adduction: 'Ta druga maszyna, przy której wszyscy udają jeszcze bardziej.',
  copenhagen: 'Ćwiczenie z Danii. Przywodziciele rozumieją duński natychmiast.',
};

/**
 * Dopiski do gotowych treningów. Własne zestawy użytkownika dostają tekst losowany,
 * bo nikt nie wpisze żartu do kreatora, a pusty wiersz wygląda gorzej niż byle jaki.
 */
export const WORKOUT_JOKES: Record<string, string> = {
  A: 'Klasyk otwarcia. Wchodzi zawsze, wychodzi z zadyszką.',
  B: 'Druga strona tej samej monety. Bolą inne miejsca.',
  C: 'Całe ciało naraz. Po nim prysznic ma status nagrody.',
  D: 'Dzień lekki. Lekki znaczy lekki, a nie „to samo, tylko gorzej”.',
};

/** Dla treningów ułożonych samodzielnie. Losowane, żeby nie było jednego zdania na zawsze. */
export const OWN_WORKOUT_JOKES: readonly string[] = [
  'Zestaw własnej roboty. Winnych brak.',
  'Ułożone przez ciebie, więc pretensje kieruj do autora.',
  'Twój zestaw. Twoje zasady, twoje zakwasy.',
  'Skrojone na miarę. Miara okazała się ambitna.',
];
