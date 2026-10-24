import { LOCALE, pluralEn, text } from '../i18n';
import { plural } from '../engine/quips';
import type { CardioSport, DanceMix, DanceStyle } from '../types';

type Src = 'watch' | 'phone';

/** Teksty ekranu kroków i cardio, formularza, karty na ekranie Dziś i karty wagi w profilu. */
export const T = text({
  pl: {
    fromSrc: { watch: 'z zegarka', phone: 'z telefonu' } as Record<Src, string>,
    steps: (n: number) => `${n.toLocaleString(LOCALE)} ${plural(n, ['krok', 'kroki', 'kroków'])}`,
    danceName: { pair: 'Taniec w parze', solo: 'Taniec solo' } as Record<DanceStyle, string>,
    floors: (n: number) => `${n} ${plural(n, ['piętro', 'piętra', 'pięter'])}`,
    run: 'bieg',
    brisk: 'szybki marsz',
    walk: 'marsz',
    briskOrJog: 'szybki marsz albo trucht',
    deviceDistance: (src: Src, km: string) => `droga ${src === 'phone' ? 'z telefonu' : 'z zegarka'} ${km}`,
    part: (word: string, km: string, dur: string, kmh: string) => `${word} ${km} w ${dur} (${kmh} km/h)`,
    elsewhere: (km: string) => `bez ${km} bieżni — liczy się osobno`,
    mix: {
      full: { name: 'Cały czas taniec', share: '80–90% tańca', short: 'cały czas taniec' },
      half: { name: 'Pół na pół', share: 'połowa tańca', short: 'pół na pół z tłumaczeniem' },
      talk: { name: 'Dużo tłumaczenia', share: '20–30% tańca', short: 'dużo tłumaczenia' },
    } as Record<DanceMix, { name: string; share: string; short: string }>,
    treadmillLabel: (kmh: string, min: number, grade: string | null) =>
      `Bieżnia ${kmh} km/h · ${min} min${grade ? ` · ${grade}%` : ''}`,
    bikeLabel: (kmh: string, min: number) => `Rower ${kmh} km/h · ${min} min`,
    ergoLabel: (watts: number, min: number) => `Rower ${watts} W · ${min} min`,
    dm: (dd: string, mm: string) => `${dd}.${mm}`,
    weekday: ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],
    noMinutes: (base: string) => `Minut ruchu jeszcze nie ma — z kroków liczy się to, co ponad ${base}.`,
    minutes: (m: number, xp: number, cap: boolean) =>
      `Minuty ruchu: ${m} · +${xp} XP${cap ? ' — limit dnia, dalej rosną już tylko odznaki' : ''}.`,
    whoAria: 'Minuty ruchu w tym tygodniu na tle zalecenia WHO',
    whoDone: (m: number, who: number) => `Ten tydzień: ${m} minut ruchu — zalecenie WHO (${who}) spełnione.`,
    whoLeft: (m: number, who: number) =>
      `Ten tydzień: ${m} z ${who} minut ruchu zalecanych przez WHO. Minuta intensywna liczy się podwójnie.`,
    shortcuts: {
      steps: { name: 'Kroki z telefonu', sub: 'liczba z całego dnia' },
      treadmill: { name: 'Bieżnia', sub: 'prędkość, czas i nachylenie' },
      bike: { name: 'Rower', sub: 'prędkość albo moc i czas' },
      dance: { name: 'Taniec', sub: 'zajęcia w parze albo solo' },
    } as Record<CardioSport, { name: string; sub: string }>,
    today: (what: string) => `dziś ${what}`,
    shortcutAria: (name: string, now: string | null) => `${name}${now ? `, ${now}` : ''}. Wpisz.`,
    tag: 'Kroki i cardio',
    cardSteps: (steps: string, kcal: string | null) => `Dziś ${steps}${kcal ? ` · ${kcal}` : ''}`,
    cardKcal: (kcal: string) => `Dziś ${kcal} z cardio`,
    cardEntries: (n: number) => `Dziś ${n} ${plural(n, ['wpis', 'wpisy', 'wpisów'])} cardio`,
    cardBurn: (workouts: string | null) => `Kalorie ponad spoczynek${workouts ? `; z treningu dochodzi ${workouts}` : ''}.`,
    cardNoKg: 'Kalorie policzę, gdy podasz wagę — zapyta o nią formularz.',
    cardEmpty: 'Kroki, bieżnia, rower, taniec',
    cardEmptyText:
      'Przepisz liczby z telefonu, bieżni albo licznika roweru, a po zajęciach tańca — ich czas. Kalorie policzę z twojej wagi, a minuty ruchu dadzą doświadczenie postaci i odznaki.',
    cardLink: 'Kroki i cardio — dziś, tydzień i historia →',
    sports: { steps: 'Kroki', treadmill: 'Bieżnia', bike: 'Rower', dance: 'Taniec' } as Record<CardioSport, string>,
    lead: {
      steps:
        'Przepisz kroki z telefonu albo zegarka — liczbę z całego dnia. Kolejny wpis na ten sam dzień zastąpi poprzedni, więc wieczorem wystarczy wpisać stan licznika.',
      treadmill:
        'Średnia prędkość i czas z wyświetlacza bieżni. Nachylenie w procentach — puste znaczy płasko.',
      bike: 'Na zewnątrz — średnia prędkość z licznika. Na rowerze stacjonarnym wybierz moc: prędkość na jego wyświetlaczu to umowna liczba, a waty mówią, ile naprawdę pracy poszło.',
      dance:
        'Czas całych zajęć i to, ile z nich naprawdę tańczysz. Kiedy instruktor tłumaczy i pokazuje, stoisz — dlatego kalorie liczą się z obu części, a minuty ruchu tylko z tańca.',
    } as Record<CardioSport, string>,
    danceStyles: { pair: 'W parze', solo: 'Solo' } as Record<DanceStyle, string>,
    minsSteps: (mins: number, base: string) => `${mins} min ruchu z nadwyżki ponad ${base} kroków`,
    minsStepsNone: (base: string) => `do minut ruchu liczy się to, co ponad ${base} kroków`,
    minsDance: (mins: number) => `${mins} min ruchu — liczy się sam taniec, bez tłumaczenia`,
    minsDanceNone: 'za mało tańca na pełną minutę ruchu',
    minsLight: 'za lekko na minuty ruchu — to mniej niż 3 MET',
    minsVigorous: (mins: number) => `${mins} min ruchu — intensywnie, więc minuty liczą się podwójnie`,
    mins: (mins: number) => `${mins} min ruchu`,
    last: (v: string) => `ostatnio ${v}`,
    pickDay: 'Wybierz dzień — nie później niż dziś.',
    enterSteps: 'Wpisz liczbę kroków.',
    enterDance: 'Wpisz czas zajęć.',
    enterWatts: 'Wpisz moc i czas.',
    enterKmh: 'Wpisz prędkość i czas.',
    kgCheck: (min: number, max: number) => `Waga od ${min} do ${max} kg — sprawdź liczbę.`,
    kindLabel: 'Rodzaj ruchu',
    bikeShows: 'Co pokazuje licznik',
    speedKmh: 'Prędkość, km/h',
    powerW: 'Moc, W',
    dance: 'Taniec',
    mixSeg: 'ile z zajęć to taniec',
    mixLabel: 'Ile z zajęć to taniec, a ile tłumaczenie',
    when: 'kiedy',
    dayLabel: 'Dzień',
    todayOpt: 'Dziś',
    yesterdayOpt: 'Wczoraj',
    otherOpt: 'Inny dzień',
    dayField: 'dzień',
    stepsField: 'kroki z całego dnia',
    danceField: 'czas całych zajęć, min',
    wattsField: 'średnia moc, W',
    kmhField: 'średnia prędkość, km/h',
    minField: 'czas, min',
    gradeField: 'nachylenie, % (puste — płasko)',
    kgField: 'twoja waga, kg — z niej liczą się kalorie',
    prevSteps: (steps: string) =>
      `Ten dzień ma już wpis: ${steps}. Nowa liczba go zastąpi — wpisz stan licznika z całego dnia.`,
    deviceSteps: (src: Src, steps: string) =>
      `${src === 'watch' ? 'Zegarek' : 'Telefon'} podał na ten dzień ${steps}. Liczy się wyższa liczba, więc niższy wpis niczego nie zmieni.`,
    deviceRides: (src: Src, rides: string) =>
      `${src === 'watch' ? 'Zegarek' : 'Telefon'} podał już przejazd z tego dnia: ${rides}. Wpisz tylko inny — ten sam policzyłby się dwa razy.`,
    aboveRest: 'ponad spoczynek',
    withRest: (kcal: string, kind: 'treadmill' | 'bike') =>
      ` · razem ze spoczynkiem ${kcal} — tę liczbę zwykle pokazuje ${kind === 'treadmill' ? 'bieżnia' : 'rower'}`,
    noKgPreview: 'Kalorie pokażę, gdy wpiszesz wagę. Ruch zapiszę i bez niej.',
    stepsPreview: (km: string, dur: string, cadence: number) =>
      `ok. ${km} · ok. ${dur} marszu przy ${cadence} krokach na minutę`,
    dancePreview: (min: number, met: string) => `ok. ${min} min tańca, reszta to słuchanie · średnio ${met} MET`,
    save: 'Zapisz',
    footSteps:
      'Spacer na bieżni z telefonem w kieszeni jest już w krokach. Wpisz jedno albo drugie — inaczej ten sam marsz policzy się dwa razy.',
    footDance:
      'Telefon w kieszeni liczy też kroki taneczne. Jeśli był przy tobie na zajęciach, kroki z tego dnia mają już kawałek tańca — kalorie wyjdą wtedy trochę za wysoko.',
    footTreadmill:
      'Kroki z zegarka i telefonu z tego dnia nie policzą tej drogi drugi raz — odejmę ją od nich. Kroki wpisane ręcznie: wpisz jedno albo drugie.',
    footBike:
      'Jeśli telefon był przy tobie, jego kroki mogą już zawierać ten ruch. Wpisz jedno albo drugie — inaczej policzy się dwa razy.',
    deleteEntry: (label: string) => `Usuń wpis: ${label}`,
    fromWatch: 'Z zegarka',
    fromPhone: 'Z telefonu',
    rhr: (n: number) => `tętno spoczynkowe ${n}`,
    hr: (range: string, avg: number | null) => `tętno ${range}${avg !== null ? `, średnio ${avg}` : ''}`,
    stress: (n: number) => `stres ${n}`,
    sleepScore: (n: number) => `sen ${n}/100`,
    sleep: (t: string) => `sen ${t}`,
    weight: (kg: string) => `waga ${kg} kg`,
    kcalWeekAria: 'Kalorie z ruchu w ostatnich siedmiu dniach',
    noMove: 'bez ruchu',
    pageLead:
      'Ruch zmierzony telefonem, zegarkiem, bieżnią albo rowerem i zajęcia tańca — przepisane tutaj. Kalorie liczą się z twojej wagi i są szacunkiem: aktywne, czyli ponad to, co ciało spaliłoby w tym czasie w spoczynku.',
    /** Pod wstępem, gdy ktoś prowadzi dziennik jedzenia: ruch nie zmienia celu jedzenia. */
    notFood:
      'Te kalorie to szacunek (±20–30%). Dziennik jedzenia ich nie dolicza — cel jedzenia dopasowuje się co tydzień do Twojej wagi.',
    watchCheck: 'Masz zegarek? Sprawdź, czy kroki mogą przychodzić same →',
    watchCheckHide: 'Nie pokazuj więcej',
    watchGaps: (name: string, list: string) => `${name} nie udostępnia aplikacjom ${list} — dlatego ich tu nie ma.`,
    log: 'Wpisz',
    logHint: 'Wybierz, skąd są liczby — resztę wpiszesz na następnym ekranie.',
    kgFor: (kg: string, day: string) => `Kalorie liczone dla ${kg} kg (ważenie ${day}). Wagę zmienisz w profilu.`,
    noKg: 'Bez wagi zapiszę drogę i czas, a kalorie policzę, gdy tylko ją podasz — także dla wcześniejszych wpisów.',
    kgLink: 'Waga i wzrost w profilu →',
    noKgLink: 'Wpisz wagę w profilu →',
    todayLabel: 'Dziś',
    todaySteps: (steps: string) => `${steps}. `,
    todayKcal: (kcal: string) => `Z kroków i cardio ${kcal}.`,
    todayNone: 'Dziś jeszcze bez wpisu. ',
    todayRest: (workouts: string, snacks: string | null, total: string) =>
      ` Z treningu ${workouts}${snacks ? `, z przekąsek ${snacks}` : ''}. Razem ${total} ponad spoczynek.`,
    week: 'Ostatnie siedem dni',
    weekNoKg: 'Pasek kalorii pojawi się po pierwszym ważeniu.',
    weekSteps: (steps: string, avg: string) => `${steps}, średnio ${avg} dziennie. `,
    weekKcal: (kcal: string) => `Z kroków i cardio ${kcal}`,
    weekTotal: (kcal: string) => `, razem z treningami i przekąskami ${kcal}.`,
    earlier: 'Wcześniej',
    showAll: (n: number) => `Pokaż wszystkie dni (${n})`,
    howTitle: 'Jak liczymy kalorie i minuty ruchu',
    how: (baseSteps: string, perMin: number, cap: number) => (
      <>
        <p>
          <b>Kalorie aktywne.</b> Liczba mówi, ile ruch spalił ponad spoczynek — tak ACSM liczy wydatek
          przy planowaniu ruchu i tak zegarki podają „energię aktywną”. Bieżnia i rower zwykle pokazują
          sumę razem ze spoczynkiem, dlatego formularz podaje obie.
        </p>
        <p>
          <b>Kroki.</b> Droga — ta, którą zmierzył zegarek albo telefon (długość kroku kalibrują
          u siebie biegi z GPS); bez niej kroki razy długość kroku: 41% wzrostu, a bez wzrostu
          w profilu 70 cm. Koszt marszu idzie z równania ACSM: ponad spoczynek 0,1 ml tlenu na
          kilogram na każdy metr, więc przy zwykłym tempie liczy się droga, a nie czas. Bieg kosztuje
          na kilometr mniej więcej dwa razy tyle (0,2 ml/kg/m), a marsz szybszy niż 6 km/h też
          więcej — dlatego biegi, marsze i wędrówki zapisane na zegarku liczą się swoją prędkością
          przez swój czas, a reszta dnia jako zwykły marsz. Piętra dokładają wznoszenie: 3 m na
          piętro, 1,8 ml tlenu na kilogram na metr w górę. Waga — z dnia ruchu. Bieżnia wpisana
          ręcznie schodzi z kroków zegarka i telefonu, bo one policzyły ją same.
        </p>
        <p>
          <b>Bieżnia.</b> Równania ACSM na marsz i bieg, z nachyleniem — tymi samymi wzorami liczą
          kalorie bieżnie. Między 6 a 8 km/h wynik przechodzi płynnie od marszu do biegu.
        </p>
        <p>
          <b>Rower.</b> Prędkość — tabela Compendium of Physical Activities 2024 (kody 01018–01060),
          połączona liniowo między przedziałami. Moc w watach — równanie ACSM dla cykloergometru;
          dokładniejsze, bo waty to praca, a prędkość zależy od wiatru, opon i roweru.
        </p>
        <p>
          <b>Taniec.</b> Compendium 2024 daje tańcowi z partnerem 4,8 MET (salsa, kod 03090), a solo
          — balet, nowoczesny, jazz na zajęciach — 5,0 (kod 03010). Część zajęć to słuchanie
          instruktora: stanie z przestępowaniem z nogi na nogę, 1,5 MET (kod 07041). „Cały czas
          taniec” liczy się jako 85% tańca, „pół na pół” — 50%, „dużo tłumaczenia” — 25%. Kalorie idą
          z obu części, minuty ruchu — tylko z tańca.
        </p>
        <p>
          <b>Trening siłowy.</b> Każde ćwiczenie ma wartość MET z Compendium dla swojego rodzaju pracy —
          od 2,8 dla deski do 9,8 dla swingów — a czas liczy się z serii, tempa i typowych przerw, nie
          z zegara sesji. Zegar mierzy też telefon odłożony na godzinę; serie mierzą pracę.
        </p>
        <p>
          <b>Minuty ruchu, doświadczenie i odznaki.</b> WHO zaleca 150–300 minut ruchu umiarkowanego
          tygodniowo, a minutę intensywną liczy za dwie. Tu tak samo: bieżnia i rower od 3 MET to
          minuty umiarkowane, od 6 MET — podwójne. Z kroków liczy się nadwyżka ponad {baseSteps}{' '}
          (tyle robi się bez wychodzenia z domu), po 100 na minutę, a z zajęć tańca — sam taniec,
          bez tłumaczenia. Minuta to {perMin} XP,
          do {cap} dziennie — połowa treningu, bo spacer ma dokładać, a nie zastępować.
          Odznaki liczą kroki, kilometry, zajęcia i minuty, nigdy kalorie: te rosną razem z wagą.
        </p>
        <p className="tight">
          To szacunek. Pomiar tlenu u konkretnej osoby potrafi odbiec o 20–30% — w obie strony.
          Kalorie nie są zaleceniem żywieniowym. Dziennik jedzenia nie dolicza ich do celu — cel jedzenia
          dopasowuje się co tydzień do wagi i zapisów.
        </p>
      </>
    ),
    kgRange: (min: number, max: number) => `Waga od ${min} do ${max} kg.`,
    cmRange: (min: number, max: number) => `Wzrost od ${min} do ${max} cm.`,
    body: 'Waga i wzrost',
    bodyLast: (kg: string, day: string, avg: string | null) =>
      `Ostatnie ważenie: ${kg} kg, ${day}.${avg !== null ? ` Średnia z 7 dni: ${avg} kg.` : ''} Kalorie liczą się z wagi z dnia ruchu, więc nowe ważenie nie zmienia historii.`,
    bodyNone:
      'Z wagi liczą się kalorie kroków, bieżni, roweru, tańca i treningów. Najlepiej ważyć się rano, codziennie albo kilka razy w tygodniu — ekran Dziś o to zapyta.',
    phoneOffer: (kg: string, day: string) => `Telefon ma nowsze ważenie: ${kg} kg, ${day}.`,
    phoneOfferBtn: 'Wpisz do dziennika',
    trend: (n: number) => `Waga z ${n} ostatnich ważeń, kg`,
    trendNoun: 'ważeń',
    kgToday: 'waga dziś, kg',
    saveKg: 'Zapisz wagę',
    cmField: 'wzrost, cm — do długości kroku (można pominąć)',
    saveCm: 'Zapisz wzrost',
    recentAria: 'Ostatnie ważenia',
    deleteWeight: (day: string) => `Usuń ważenie z ${day}`,
    summary: (steps: string, kcal: string | null, m: number, who: number, count: number) =>
      `Ostatnie 7 dni: ${steps}${kcal !== null ? `, ${kcal} z kroków, bieżni, roweru i tańca` : ''}. W tym tygodniu ${m} z ${who} minut ruchu zalecanych przez WHO. Wpisów od początku: ${count}.`,
    summaryNone:
      'Jeszcze bez wpisów. Przepisz kroki z telefonu, wynik z bieżni i roweru albo czas zajęć tańca — kalorie policzą się z twojej wagi.',
    summaryBtn: 'Kroki i cardio — dziś i historia',
    summaryFirst: 'Wpisz pierwsze kroki',
  },
  en: {
    fromSrc: { watch: 'from watch', phone: 'from phone' } as Record<Src, string>,
    steps: (n: number) => `${n.toLocaleString(LOCALE)} ${pluralEn(n, 'step', 'steps')}`,
    danceName: { pair: 'Partner dance', solo: 'Solo dance' } as Record<DanceStyle, string>,
    floors: (n: number) => `${n} ${pluralEn(n, 'floor', 'floors')}`,
    run: 'run',
    brisk: 'brisk walk',
    walk: 'walk',
    briskOrJog: 'brisk walk or jog',
    deviceDistance: (src: Src, km: string) => `distance from ${src === 'phone' ? 'phone' : 'watch'} ${km}`,
    part: (word: string, km: string, dur: string, kmh: string) => `${word} ${km} in ${dur} (${kmh} km/h)`,
    elsewhere: (km: string) => `minus ${km} of treadmill — counted separately`,
    mix: {
      full: { name: 'Dancing throughout', share: '80–90% dancing', short: 'dancing throughout' },
      half: { name: 'Half and half', share: 'half dancing', short: 'half dancing, half instruction' },
      talk: { name: 'Lots of instruction', share: '20–30% dancing', short: 'lots of instruction' },
    } as Record<DanceMix, { name: string; share: string; short: string }>,
    treadmillLabel: (kmh: string, min: number, grade: string | null) =>
      `Treadmill ${kmh} km/h · ${min} min${grade ? ` · ${grade}%` : ''}`,
    bikeLabel: (kmh: string, min: number) => `Bike ${kmh} km/h · ${min} min`,
    ergoLabel: (watts: number, min: number) => `Bike ${watts} W · ${min} min`,
    dm: (dd: string, mm: string) => `${dd}/${mm}`,
    weekday: ['', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    noMinutes: (base: string) => `No movement minutes yet — steps count above ${base}.`,
    minutes: (m: number, xp: number, cap: boolean) =>
      `Movement minutes: ${m} · +${xp} XP${cap ? ' — daily limit reached, only badges grow from here' : ''}.`,
    whoAria: 'Movement minutes this week against the WHO guideline',
    whoDone: (m: number, who: number) => `This week: ${m} movement minutes — WHO guideline (${who}) met.`,
    whoLeft: (m: number, who: number) =>
      `This week: ${m} of the ${who} movement minutes the WHO recommends. A vigorous minute counts double.`,
    shortcuts: {
      steps: { name: 'Steps from your phone', sub: 'the whole day’s count' },
      treadmill: { name: 'Treadmill', sub: 'speed, time and incline' },
      bike: { name: 'Bike', sub: 'speed or power, and time' },
      dance: { name: 'Dance', sub: 'partner or solo classes' },
    } as Record<CardioSport, { name: string; sub: string }>,
    today: (what: string) => `today ${what}`,
    shortcutAria: (name: string, now: string | null) => `${name}${now ? `, ${now}` : ''}. Log it.`,
    tag: 'Steps & cardio',
    cardSteps: (steps: string, kcal: string | null) => `Today ${steps}${kcal ? ` · ${kcal}` : ''}`,
    cardKcal: (kcal: string) => `Today ${kcal} from cardio`,
    cardEntries: (n: number) => `Today ${n} cardio ${pluralEn(n, 'entry', 'entries')}`,
    cardBurn: (workouts: string | null) => `Calories above resting${workouts ? `; your workout adds ${workouts}` : ''}.`,
    cardNoKg: 'I’ll work out calories once you give your weight — the form will ask for it.',
    cardEmpty: 'Steps, treadmill, bike, dance',
    cardEmptyText:
      'Copy in the numbers from your phone, the treadmill or your bike computer, and after a dance class — how long it was. I’ll work out calories from your weight, and movement minutes earn your character XP and badges.',
    cardLink: 'Steps & cardio — today, this week and history →',
    sports: { steps: 'Steps', treadmill: 'Treadmill', bike: 'Bike', dance: 'Dance' } as Record<CardioSport, string>,
    lead: {
      steps:
        'Copy in your steps from your phone or watch — the whole day’s count. A new entry for the same day replaces the previous one, so in the evening just enter what the counter shows.',
      treadmill: 'Average speed and time from the treadmill display. Incline in per cent — empty means flat.',
      bike: 'Outdoors — average speed from your bike computer. On a stationary bike pick power: the speed on its display is a nominal number, while watts tell you how much work you really did.',
      dance:
        'How long the whole class was and how much of it you actually danced. While the instructor explains and demonstrates, you stand — so calories count from both parts, and movement minutes only from the dancing.',
    } as Record<CardioSport, string>,
    danceStyles: { pair: 'Partner', solo: 'Solo' } as Record<DanceStyle, string>,
    minsSteps: (mins: number, base: string) => `${mins} movement min from the steps above ${base}`,
    minsStepsNone: (base: string) => `movement minutes count only the steps above ${base}`,
    minsDance: (mins: number) => `${mins} movement min — only the dancing counts, not the instruction`,
    minsDanceNone: 'not enough dancing for a full movement minute',
    minsLight: 'too light for movement minutes — that’s under 3 MET',
    minsVigorous: (mins: number) => `${mins} movement min — vigorous, so the minutes count double`,
    mins: (mins: number) => `${mins} movement min`,
    last: (v: string) => `last time ${v}`,
    pickDay: 'Pick a day — no later than today.',
    enterSteps: 'Enter the number of steps.',
    enterDance: 'Enter how long the class was.',
    enterWatts: 'Enter the power and time.',
    enterKmh: 'Enter the speed and time.',
    kgCheck: (min: number, max: number) => `Weight from ${min} to ${max} kg — check the number.`,
    kindLabel: 'Kind of movement',
    bikeShows: 'What the display shows',
    speedKmh: 'Speed, km/h',
    powerW: 'Power, W',
    dance: 'Dance',
    mixSeg: 'how much of the class is dancing',
    mixLabel: 'How much of the class is dancing and how much is instruction',
    when: 'when',
    dayLabel: 'Day',
    todayOpt: 'Today',
    yesterdayOpt: 'Yesterday',
    otherOpt: 'Another day',
    dayField: 'day',
    stepsField: 'steps for the whole day',
    danceField: 'length of the whole class, min',
    wattsField: 'average power, W',
    kmhField: 'average speed, km/h',
    minField: 'time, min',
    gradeField: 'incline, % (empty — flat)',
    kgField: 'your weight, kg — calories are worked out from it',
    prevSteps: (steps: string) =>
      `This day already has an entry: ${steps}. The new number will replace it — enter the whole day’s count.`,
    deviceSteps: (src: Src, steps: string) =>
      `Your ${src === 'watch' ? 'watch' : 'phone'} reported ${steps} for this day. The higher number counts, so a lower entry won’t change anything.`,
    deviceRides: (src: Src, rides: string) =>
      `Your ${src === 'watch' ? 'watch' : 'phone'} has already reported a ride for this day: ${rides}. Only enter a different one — the same ride would count twice.`,
    aboveRest: 'above resting',
    withRest: (kcal: string, kind: 'treadmill' | 'bike') =>
      ` · ${kcal} including resting — the number the ${kind === 'treadmill' ? 'treadmill' : 'bike'} usually shows`,
    noKgPreview: 'I’ll show calories once you enter your weight. I’ll save the movement without it, too.',
    stepsPreview: (km: string, dur: string, cadence: number) =>
      `about ${km} · about ${dur} of walking at ${cadence} steps a minute`,
    dancePreview: (min: number, met: string) => `about ${min} min of dancing, the rest is listening · ${met} MET on average`,
    save: 'Save',
    footSteps:
      'A treadmill walk with your phone in your pocket is already in your steps. Enter one or the other — otherwise the same walk counts twice.',
    footDance:
      'A phone in your pocket counts dance steps too. If you had it with you in class, that day’s steps already include some of the dancing — so the calories will come out a little high.',
    footTreadmill:
      'Steps from your watch and phone for this day won’t count this distance a second time — I’ll subtract it from them. Steps entered by hand: enter one or the other.',
    footBike:
      'If your phone was with you, its steps may already include this movement. Enter one or the other — otherwise it counts twice.',
    deleteEntry: (label: string) => `Delete entry: ${label}`,
    fromWatch: 'From your watch',
    fromPhone: 'From your phone',
    rhr: (n: number) => `resting heart rate ${n}`,
    hr: (range: string, avg: number | null) => `heart rate ${range}${avg !== null ? `, average ${avg}` : ''}`,
    stress: (n: number) => `stress ${n}`,
    sleepScore: (n: number) => `sleep ${n}/100`,
    sleep: (t: string) => `sleep ${t}`,
    weight: (kg: string) => `weight ${kg} kg`,
    kcalWeekAria: 'Calories from movement in the last seven days',
    noMove: 'no movement',
    pageLead:
      'Movement measured by your phone, watch, treadmill or bike, and dance classes — copied in here. Calories are worked out from your weight and are an estimate: active calories, meaning above what your body would burn at rest in the same time.',
    notFood:
      'These calories are an estimate (±20–30%). The food diary doesn’t add them — your food target adjusts weekly to your weight.',
    watchCheck: 'Got a watch? Check whether your steps can arrive by themselves →',
    watchCheckHide: 'Don’t show again',
    watchGaps: (name: string, list: string) => `${name} doesn’t share ${list} with apps — that’s why they’re missing here.`,
    log: 'Log',
    logHint: 'Pick where the numbers come from — you’ll enter the rest on the next screen.',
    kgFor: (kg: string, day: string) =>
      `Calories worked out for ${kg} kg (weighed ${day}). You can change your weight in your profile.`,
    noKg: 'Without your weight I’ll save the distance and time, and work out calories as soon as you give it — for earlier entries too.',
    kgLink: 'Weight and height in your profile →',
    noKgLink: 'Enter your weight in your profile →',
    todayLabel: 'Today',
    todaySteps: (steps: string) => `${steps}. `,
    todayKcal: (kcal: string) => `From steps and cardio ${kcal}.`,
    todayNone: 'No entries yet today. ',
    todayRest: (workouts: string, snacks: string | null, total: string) =>
      ` From your workout ${workouts}${snacks ? `, from snacks ${snacks}` : ''}. ${total} above resting in total.`,
    week: 'Last seven days',
    weekNoKg: 'The calorie bar appears after your first weigh-in.',
    weekSteps: (steps: string, avg: string) => `${steps}, ${avg} a day on average. `,
    weekKcal: (kcal: string) => `From steps and cardio ${kcal}`,
    weekTotal: (kcal: string) => `, ${kcal} including workouts and snacks.`,
    earlier: 'Earlier',
    showAll: (n: number) => `Show all days (${n})`,
    howTitle: 'How we count calories and movement minutes',
    how: (baseSteps: string, perMin: number, cap: number) => (
      <>
        <p>
          <b>Active calories.</b> The number shows how much the movement burned above resting — that’s how
          ACSM counts energy expenditure when planning exercise, and how watches report “active energy”.
          Treadmills and bikes usually show the total including resting, which is why the form gives both.
        </p>
        <p>
          <b>Steps.</b> Distance — as measured by your watch or phone (they calibrate stride length themselves
          from GPS runs); without it, steps times stride length: 41% of your height, or 70 cm without a height
          in your profile. The cost of walking comes from the ACSM equation: 0.1 ml of oxygen per kilogram for
          every metre above resting, so at a normal pace it’s the distance that counts, not the time. Running
          costs roughly twice as much per kilometre (0.2 ml/kg/m), and walking faster than 6 km/h costs more
          too — which is why runs, walks and hikes recorded on your watch count at their own speed for their
          own time, and the rest of the day as ordinary walking. Floors add climbing: 3 m per floor, 1.8 ml of
          oxygen per kilogram per metre up. Weight — from the day of the movement. A treadmill session entered
          by hand is taken off the watch and phone steps, because they counted it themselves.
        </p>
        <p>
          <b>Treadmill.</b> The ACSM walking and running equations, with incline — treadmills count calories
          with the same formulas. Between 6 and 8 km/h the result moves smoothly from walking to running.
        </p>
        <p>
          <b>Bike.</b> Speed — the Compendium of Physical Activities 2024 table (codes 01018–01060),
          interpolated linearly between ranges. Power in watts — the ACSM cycle ergometer equation; more
          accurate, because watts are work, while speed depends on wind, tyres and the bike.
        </p>
        <p>
          <b>Dance.</b> The 2024 Compendium gives partner dancing 4.8 MET (salsa, code 03090), and solo —
          ballet, modern, jazz in a class — 5.0 (code 03010). Part of a class is listening to the instructor:
          standing and shifting from foot to foot, 1.5 MET (code 07041). “Dancing throughout” counts as 85%
          dancing, “half and half” as 50%, “lots of instruction” as 25%. Calories come from both parts,
          movement minutes only from the dancing.
        </p>
        <p>
          <b>Strength training.</b> Every exercise has a MET value from the Compendium for its kind of work —
          from 2.8 for the plank to 9.8 for swings — and the time comes from sets, tempo and typical rests,
          not from the session clock. The clock also measures a phone put down for an hour; sets measure work.
        </p>
        <p>
          <b>Movement minutes, XP and badges.</b> The WHO recommends 150–300 minutes of moderate activity a
          week, and counts a vigorous minute as two. Same here: treadmill and bike from 3 MET are moderate
          minutes, from 6 MET — double. From steps, the surplus above {baseSteps} counts (roughly what you do
          without leaving home), at 100 a minute, and from dance classes — just the dancing, without the
          instruction. A minute is {perMin} XP, up to {cap} a day — half a workout, because a walk should add
          to training, not replace it. Badges count steps, kilometres, classes and minutes, never calories:
          those rise with body weight.
        </p>
        <p className="tight">
          This is an estimate. Measuring a particular person’s oxygen use can differ by 20–30% — either way.
          Calories are not nutrition advice. The food diary doesn’t add them to your target — the food target adjusts
          weekly to your weight and logs.
        </p>
      </>
    ),
    kgRange: (min: number, max: number) => `Weight from ${min} to ${max} kg.`,
    cmRange: (min: number, max: number) => `Height from ${min} to ${max} cm.`,
    body: 'Weight and height',
    bodyLast: (kg: string, day: string, avg: string | null) =>
      `Last weigh-in: ${kg} kg, ${day}.${avg !== null ? ` 7-day average: ${avg} kg.` : ''} Calories use your weight on the day of the movement, so a new weigh-in doesn’t change your history.`,
    bodyNone:
      'Your weight is used to work out calories for steps, treadmill, bike, dance and workouts. It’s best to weigh yourself in the morning, every day or a few times a week — the Today screen will ask.',
    phoneOffer: (kg: string, day: string) => `Your phone has a newer weigh-in: ${kg} kg, ${day}.`,
    phoneOfferBtn: 'Add to the log',
    trend: (n: number) => `Weight from the last ${n} weigh-ins, kg`,
    trendNoun: 'weigh-ins',
    kgToday: 'weight today, kg',
    saveKg: 'Save weight',
    cmField: 'height, cm — for stride length (optional)',
    saveCm: 'Save height',
    recentAria: 'Recent weigh-ins',
    deleteWeight: (day: string) => `Delete the weigh-in from ${day}`,
    summary: (steps: string, kcal: string | null, m: number, who: number, count: number) =>
      `Last 7 days: ${steps}${kcal !== null ? `, ${kcal} from steps, treadmill, bike and dance` : ''}. This week: ${m} movement minutes — the WHO recommends ${who}. Entries so far: ${count}.`,
    summaryNone:
      'No entries yet. Copy in your steps from your phone, your treadmill and bike results or how long a dance class was — calories will be worked out from your weight.',
    summaryBtn: 'Steps & cardio — today and history',
    summaryFirst: 'Log your first steps',
  },
});
