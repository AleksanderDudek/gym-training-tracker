import { Check } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { LANG, text } from '../../../i18n';
import { FOOD_PATH, go } from '../../../routing';
import { useBridge } from '../../bridge';
import { markDiet } from '../../dietFlag';
import { hashQuery } from '../../hash';
import {
  applyProfileEdit,
  manualProblem,
  paceChips,
  rebased,
  startPace,
  targetWeightProblem,
  type Goal,
} from '../../diet/edit';
import { addDays, paceText } from '../../diet/model';
import { DIET_PROFILE_IDS, DIET_PROFILES } from '../../diet/profiles';
import { completeProfile, endPause, saveProfileEdit, startPause } from '../../diet/store';
import {
  burnOf,
  directionOf,
  floorOf,
  hardMinOf,
  hidesKcal,
  impliedPace,
  minTargetOf,
  pauseOn,
  r10,
  safety,
  snap05,
} from '../../diet/target';
import { trendOn } from '../../diet/trend';
import type { ActivityLevel, Profile } from '../../diet/types';
import { formatNumber } from '../../lib/format';
import { DataSection } from './DataSection';
import { dayMonthLong, paceWord } from './dietFormat';
import { ImportWorkbook } from './ImportWorkbook';
import { NumberField } from './NumberField';
import { Loading, PLAIN_MODE } from './Onboarding';
import { useDietBase, useStoreList } from './useDietPage';
import './diet.css';

const T = text({
  pl: {
    lead: 'Z tych kilku odpowiedzi liczę Twój dzienny cel kalorii i białka. Wszystko zostaje na tym urządzeniu. Masz arkusz z planem? Wczytaj go — parametry i plan posiłków przyjdą razem.',
    importExcel: 'Wczytaj z Excela',
    firstTitle: 'Zacznij od profilu',
    you: 'Ty',
    sex: 'Płeć',
    male: 'mężczyzna',
    female: 'kobieta',
    age: 'Wiek',
    years: 'lat',
    height: 'Wzrost',
    weightNowField: 'Ile ważysz teraz',
    weightNow: (kg: string) => `Waga teraz: ${kg} kg (trend z ważeń).`,
    noWeighIns: (kg: string) => `Bez ważeń — liczę z wagi na starcie (${kg} kg).`,
    startTitle: 'Start diety',
    startWeight: 'Waga na starcie',
    start: 'Start',
    heightShared: 'Wzrost to ten sam, co w profilu treningowym — zapis zmienia go w obu miejscach.',
    goalTitle: 'Twój cel',
    goals: { loss: 'Schudnąć', keep: 'Utrzymać wagę', gain: 'Przybrać' } as Record<Goal, string>,
    goalMissing: 'Wybierz cel.',
    targetWeight: 'Waga docelowa',
    targetMissing: 'Wpisz wagę docelową.',
    targetSideLoss: 'Przy tym celu waga docelowa powinna być niższa niż obecna.',
    targetSideGain: 'Przy tym celu waga docelowa powinna być wyższa niż obecna.',
    minTarget: (kg: string) => `Najniższa waga docelowa przy Twoim wzroście to ${kg} kg (BMI 18,5).`,
    pregnancy: 'Jestem w ciąży lub karmię piersią',
    pregnancyHint:
      'W ciąży i podczas karmienia nie ustawiam deficytu ani nie dopasowuję celu z wagi. Potrzeby są wtedy wyższe — ile jeść, ustal z lekarzem lub położną.',
    under18:
      'Poniżej 18 lat nie ustawiam deficytu ani nie pokazuję kalorii — jedzenie ma wspierać wzrost i trening. Dziennik pokaże białko i podpowie posiłki.',
    lowBmi: 'Przy BMI poniżej 18,5 nie ustawiam deficytu — wybierz utrzymanie albo przybieranie.',
    levelTitle: 'Twój zwykły tydzień',
    levels: {
      inactive: ['Głównie siedzę', 'Praca przy biurku, dojazdy autem lub komunikacją; treningi do 2–3 razy w tygodniu.'],
      low: ['Codziennie ok. godziny ruchu', 'Spacery, rower do pracy albo trening prawie każdego dnia.'],
      active: ['Dużo ruchu', 'Praca na nogach albo codziennie półtorej godziny treningu, w tym intensywnego.'],
      very: ['Bardzo dużo ruchu', 'Praca fizyczna albo ponad 2 godziny intensywnego treningu dziennie.'],
    } as Record<ActivityLevel, readonly [string, string]>,
    stepsHint: (avg: string) => `Twoja średnia z ostatnich 2 tygodni: ${avg} kroków dziennie.`,
    anchoredTitle: 'Odpowiedzi do pierwszego szacunku',
    anchored:
      'Spalanie liczę już z Twoich danych, więc zmiana tutaj nie przesunie celu. Jeśli Twój ruch zmienił się na stałe, waga pokaże to w 3–5 tygodni i cel dopasuje się sam — szybciej możesz ustawić cel ręcznie.',
    paceTitle: 'Tempo',
    current: (pace: string) => `${pace} (obecne)`,
    paceLimited: (floor: string) =>
      `Szybsze tempo byłoby dla Ciebie za szybkie (ponad 1% masy ciała na tydzień) albo zeszłoby poniżej bezpiecznego minimum ${floor} kcal.`,
    result: (kcal: string, g: string) => `Cel: ${kcal} kcal dziennie · białko co najmniej ${g} g`,
    estimate:
      'To pierwszy szacunek — u większości ludzi trafia z dokładnością do ok. 300 kcal. Po 4–5 tygodniach ważenia i zapisów dopasuję go do Ciebie.',
    lastCheck: (date: string, changed: boolean) =>
      `Ostatnie sprawdzenie: ${date} — ${changed ? 'cel zmieniony' : 'cel bez zmian'}.`,
    manual: 'Ustaw cel ręcznie',
    manualField: 'Dziennie (kcal)',
    implied: (pace: string) => `Tempo przy tym celu: ok. ${pace} na tydzień`,
    zeroPace: '0 kg',
    minError: (min: string) => `Najniżej ${min} kcal.`,
    range: (min: number, max: number) => `Wpisz liczbę od ${min} do ${max}.`,
    number: 'Wpisz liczbę.',
    belowFloor: (floor: string) =>
      `To mniej niż Twoja podstawowa przemiana materii (${floor} kcal) — trudno wtedy dostarczyć wszystkie składniki i łatwo stracić mięśnie.`,
    doctor: 'Ten cel jest ustalony z lekarzem albo dietetykiem',
    manualFast: 'Przy tym celu tempo wychodzi ponad 1% masy ciała na tydzień — zwykle za szybko, by utrzymać mięśnie.',
    howTitle: 'Jak liczę cel',
    how: {
      start:
        'Na start: ze wzoru NASEM 2023 (płeć, wiek, wzrost, waga i Twój zwykły tydzień) wychodzi, ile spalasz. Wzór powstał z pomiarów metodą podwójnie znakowanej wody, ale u jednej osoby myli się zwykle o ok. 250–350 kcal — dlatego to tylko punkt startu.',
      loss: (pace: string, kcal: string) =>
        `Od tego odejmuję tyle, ile wymaga tempo: ${pace} tygodniowo to ok. ${kcal} kcal dziennie.`,
      keep: 'Przy utrzymaniu niczego nie odejmuję.',
      gain: (pace: string, kcal: string) =>
        `Do tego dodaję tyle, ile wymaga tempo: ${pace} tygodniowo to ok. ${kcal} kcal dziennie.`,
      monday:
        'W poniedziałki porównuję zapisane jedzenie z trendem wagi z ostatnich 4 tygodni. Wierzę tylko tej części różnicy, której waga i zapisy są pewne, i zmieniam cel najwyżej o 100 kcal na tydzień. Gdy ważysz mniej, obniżam cel od razu — tyle mniej spalasz. Gdy wychodzi, że spalasz mniej, niż liczyłem, najpierw pytam, czy zapisujesz prawie wszystko. Nie obniżam go, gdy chudniesz szybciej, niż zakłada plan.',
      settle:
        'Pierwsze 2 tygodnie po starcie, po dużej zmianie celu i po przerwie pomijam — waga zmienia się wtedy głównie przez wodę.',
      move: 'Kroki, treningi i zegarek nie zmieniają celu: kalorie z ruchu to szacunek z błędem 20–30% i większym, a ciało część z nich oddaje, oszczędzając gdzie indziej. Więcej ruchu na dłużej widać w wadze — i stamtąd trafia do celu.',
      safety:
        'Bezpieczeństwo: nie schodzę poniżej Twojej podstawowej przemiany materii (chyba że cel jest ustalony z lekarzem albo dietetykiem) i nigdy poniżej 1500 kcal (mężczyźni) i 1200 kcal (kobiety). Tempo ograniczam do 1% masy ciała na tydzień, a poniżej 18 lat, przy BMI poniżej 18,5 i w ciąży nie ustawiam deficytu.',
      burn: (kcal: string) => `Teraz liczę, że spalasz ok. ${kcal} kcal dziennie.`,
      foot: 'Aplikacja nie zastępuje dietetyka ani lekarza.',
    },
    settingsTitle: 'Ustawienia liczenia',
    autoAdjust:
      'Dopasowuj cel co tydzień — w poniedziałki, o 100 kcal, zawsze z wyjaśnieniem; zanim obniżę cel z powodu niższego spalania, pytam. Wyłączone: tylko podpowiadam.',
    hideKcal: 'Bez liczenia kalorii — dziennik pokaże białko i podpowie posiłki, ale bez kalorii.',
    pause: 'Przerwa',
    pauseText: 'Na urlop albo chorobę: cel to utrzymanie wagi, a dopasowanie czeka.',
    pauseWeek: 'Przerwa na tydzień',
    pauseTwoWeeks: 'Na 2 tygodnie',
    pauseUntil: (date: string) => `Przerwa do ${date}.`,
    pauseEnd: 'Zakończ przerwę',
    dietType: 'Sposób odżywiania',
    yes: 'Tak:',
    avoid: 'Unikaj:',
    upTo: (n: number) => `do ${n}`,
    dailyMacros: (p: number, c: string | number, f: number) => `Dziennie: B ${p} g · W ${c} g · T ${f} g`,
    store: 'Sklep',
    planFor: 'Gdy nie znam sklepów w pobliżu, planuj pod:',
    anyStore: 'dowolny sklep',
    nearbyFirst:
      'Sklepy w pobliżu z sekcji „W pobliżu” mają pierwszeństwo – odczytuję je z tego urządzenia, bez nowego wyszukiwania.',
    saveStart: 'Zapisz i zacznij',
    saveProfile: 'Zapisz profil',
    saved: 'Zapisano',
  },
  en: {
    lead: 'From these few answers I work out your daily calorie and protein target. Everything stays on this device. Got a workbook with a plan? Import it — the settings and the meal plan come along.',
    importExcel: 'Import from Excel',
    firstTitle: 'Start with your profile',
    you: 'You',
    sex: 'Sex',
    male: 'Male',
    female: 'Female',
    age: 'Age',
    years: 'years',
    height: 'Height',
    weightNowField: 'Your weight now',
    weightNow: (kg: string) => `Weight now: ${kg} kg (trend from your weigh-ins).`,
    noWeighIns: (kg: string) => `No weigh-ins — I use your starting weight (${kg} kg).`,
    startTitle: 'Diet start',
    startWeight: 'Starting weight',
    start: 'Start date',
    heightShared: 'Height is the same as in your training profile — saving changes it in both places.',
    goalTitle: 'Your goal',
    goals: { loss: 'Lose weight', keep: 'Keep my weight', gain: 'Gain weight' } as Record<Goal, string>,
    goalMissing: 'Choose your goal.',
    targetWeight: 'Target weight',
    targetMissing: 'Enter your target weight.',
    targetSideLoss: 'For this goal the target weight should be below your current weight.',
    targetSideGain: 'For this goal the target weight should be above your current weight.',
    minTarget: (kg: string) => `The lowest target weight for your height is ${kg} kg (BMI 18.5).`,
    pregnancy: 'I’m pregnant or breastfeeding',
    pregnancyHint:
      'During pregnancy and breastfeeding I don’t set a deficit or fit the target to your weight. Your needs are higher then — agree how much to eat with your doctor or midwife.',
    under18:
      'Under 18 I don’t set a deficit or show calories — food should support growing and training. The diary shows protein and suggests meals.',
    lowBmi: 'With a BMI under 18.5 I don’t set a deficit — pick maintenance or gaining.',
    levelTitle: 'Your usual week',
    levels: {
      inactive: ['Mostly sitting', 'Desk job, commuting by car or public transport; workouts up to 2–3 times a week.'],
      low: ['About an hour of activity every day', 'Walks, cycling to work or a workout almost every day.'],
      active: ['A lot of activity', 'On your feet at work, or an hour and a half of training a day, some of it hard.'],
      very: ['A great deal of activity', 'Physical work, or over 2 hours of hard training a day.'],
    } as Record<ActivityLevel, readonly [string, string]>,
    stepsHint: (avg: string) => `Your average over the last 2 weeks: ${avg} steps a day.`,
    anchoredTitle: 'Answers for the first estimate',
    anchored:
      'I already work out your burn from your data, so changing this won’t move the target. If your activity changed for good, the scale shows it in 3–5 weeks and the target adjusts by itself — or set the target yourself.',
    paceTitle: 'Pace',
    current: (pace: string) => `${pace} (current)`,
    paceLimited: (floor: string) =>
      `A faster pace would be too fast for you (over 1% of body weight a week) or go below the safe minimum of ${floor} kcal.`,
    result: (kcal: string, g: string) => `Target: ${kcal} kcal a day · protein at least ${g} g`,
    estimate:
      'This is a first estimate — for most people it’s within about 300 kcal. After 4–5 weeks of weigh-ins and logs I’ll fit it to you.',
    lastCheck: (date: string, changed: boolean) =>
      `Last check: ${date} — ${changed ? 'target changed' : 'target unchanged'}.`,
    manual: 'Set the target yourself',
    manualField: 'Daily (kcal)',
    implied: (pace: string) => `Pace at this target: about ${pace} a week`,
    zeroPace: '0 kg',
    minError: (min: string) => `At least ${min} kcal.`,
    range: (min: number, max: number) => `Enter a number from ${min} to ${max}.`,
    number: 'Enter a number.',
    belowFloor: (floor: string) =>
      `That’s below your basal metabolic rate (${floor} kcal) — it’s hard to get every nutrient and easy to lose muscle.`,
    doctor: 'This target is agreed with a doctor or dietitian',
    manualFast: 'At this target the pace is over 1% of body weight a week — usually too fast to keep your muscle.',
    howTitle: 'How I work out the target',
    how: {
      start:
        'To start: the NASEM 2023 equation (sex, age, height, weight and your usual week) gives how much you burn. It was built from doubly labelled water measurements, but for one person it’s typically off by about 250–350 kcal — so it’s only a starting point.',
      loss: (pace: string, kcal: string) => `From that I take what your pace needs: ${pace} a week is about ${kcal} kcal a day.`,
      keep: 'For maintenance I take nothing off.',
      gain: (pace: string, kcal: string) => `To that I add what your pace needs: ${pace} a week is about ${kcal} kcal a day.`,
      monday:
        'On Mondays I compare your logged food with your weight trend over the last 4 weeks. I only trust the part of the difference your weight and logs are sure of, and I change the target by at most 100 kcal a week. When you weigh less, I lower it straight away — you burn that much less. When it looks like you burn less than I assumed, I first ask whether you log almost everything. I don’t lower it while you’re losing faster than planned.',
      settle:
        'I skip the first 2 weeks after the start, a big change of target and a break — weight then changes mostly through water.',
      move: 'Steps, workouts and the watch don’t change the target: activity calories are an estimate that’s 20–30% off or more, and the body gives some of them back by saving elsewhere. More activity over time shows on the scale — and reaches the target from there.',
      safety:
        'Safety: I don’t go below your basal metabolic rate (unless your target is agreed with a doctor or dietitian), and never below 1,500 kcal (men) or 1,200 kcal (women). Pace is capped at 1% of body weight a week, and under 18, with a BMI below 18.5 or in pregnancy I don’t set a deficit.',
      burn: (kcal: string) => `Right now I reckon you burn about ${kcal} kcal a day.`,
      foot: 'The app doesn’t replace a dietitian or a doctor.',
    },
    settingsTitle: 'Counting settings',
    autoAdjust:
      'Fit the target every week — on Mondays, by 100 kcal, always with an explanation; I ask before lowering it because you seem to burn less. Off: I only suggest.',
    hideKcal: 'No calorie counting — the diary shows protein and suggests meals, but no calories.',
    pause: 'Break',
    pauseText: 'For a holiday or illness: your target is maintenance and fitting waits.',
    pauseWeek: 'A week’s break',
    pauseTwoWeeks: '2 weeks',
    pauseUntil: (date: string) => `Break until ${date}.`,
    pauseEnd: 'End the break',
    dietType: 'Diet type',
    yes: 'Yes:',
    avoid: 'Avoid:',
    upTo: (n: number) => `up to ${n}`,
    dailyMacros: (p: number, c: string | number, f: number) => `Daily: P ${p} g · C ${c} g · F ${f} g`,
    store: 'Shop',
    planFor: 'When I don’t know the shops nearby, plan for:',
    anyStore: 'any shop',
    nearbyFirst: 'Shops from the “Nearby” section come first – I read them from this device, without a new search.',
    saveStart: 'Save and start',
    saveProfile: 'Save profile',
    saved: 'Saved',
  },
});

const LEVELS: ActivityLevel[] = ['inactive', 'low', 'active', 'very'];
const GOALS: Goal[] = ['loss', 'keep', 'gain'];

const round1 = (kg: number): number => Math.round(kg * 10) / 10;

/** Steps in the hint need a week of the last two with steps. */
const HINT_MIN_DAYS = 7;
const HINT_DAYS = 14;

/**
 * Profil diety — podstrona dziennika: kilka odpowiedzi (ciało, cel, zwykły tydzień, tempo), z nich
 * jeden dzienny cel, „Jak liczę cel”, ustawienia liczenia, sposób odżywiania, sklep i kopia danych
 * diety. Bez profilu to pierwszy krok („Zapisz i zacznij” wraca do dziennika). Wzrost jest jeden
 * z treningami: pole czyta wzrost z profilu treningowego i zapisuje do obu, a waga to trend
 * z dziennika wagi.
 */
export default function DietProfilePage() {
  const bridge = useBridge();
  const { profile, clock } = useDietBase();
  const today = clock.date;
  const stores = useStoreList();

  // Punkt startu nowego profilu: waga i wzrost z treningów. Liczony raz — formularz zaczyna od nowa,
  // gdy zmieni się tożsamość profilu, więc ważenie dopisane w trakcie nie może go podmienić.
  const [blank] = useState(() => {
    const last = [...bridge.weights].reverse().find((w) => w.day <= today)?.kg ?? null;
    const start = last === null ? 80 : round1(last);
    return completeProfile({
      heightCm: Math.round(bridge.heightCm ?? 175),
      startWeightKg: start,
      // Bez wagi docelowej z góry: pole jest puste, dopóki ktoś jej nie wpisze (cel „Utrzymać” jej nie potrzebuje).
      targetWeightKg: start,
      hideKcal: hashQuery(window.location.hash).get('tryb') === PLAIN_MODE,
    });
  });

  if (profile === undefined) return <Loading />;
  if (!profile) return <ProfileForm profile={blank} isNew today={today} stores={stores} />;
  return (
    <>
      <ProfileForm profile={profile} isNew={false} today={today} stores={stores} />
      <DataSection />
    </>
  );
}

function sameProfile(a: Profile, b: Profile): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => k !== 'id'));
  // Po wartości: historia celu i ostatnie sprawdzenie to tablice i obiekty, a z IndexedDB wracają kopie.
  return [...keys].every((k) => JSON.stringify(a[k as keyof Profile]) === JSON.stringify(b[k as keyof Profile]));
}

/**
 * Szkic po zmianie zapisanego profilu gdzie indziej (przerwa, przywrócona kopia, poniedziałkowe
 * sprawdzenie w innej karcie): to, co się tam zmieniło, przychodzi; reszta zostaje tak, jak ją ktoś
 * właśnie wpisuje.
 */
function withChanges(base: Profile, incoming: Profile, draft: Profile): Profile {
  const out: Record<string, unknown> = { ...draft };
  const keys = new Set([...Object.keys(base), ...Object.keys(incoming)]);
  for (const k of keys) {
    const key = k as keyof Profile;
    if (JSON.stringify(base[key]) !== JSON.stringify(incoming[key])) out[k] = incoming[key];
  }
  return out as unknown as Profile;
}

/** Whether the last check that really looked at the data changed the target (a `check` entry from its week on). */
function lastCheckLine(p: Profile, today: string): { week: string; changed: boolean } | null {
  const c = p.lastCheck;
  if (!c || c.status === 'setup' || c.status === 'migrated' || c.week > today) return null;
  return { week: c.week, changed: p.goals.some((g) => g.by === 'check' && g.from >= c.week && g.from <= today) };
}

/** Average steps of the last two weeks (to 100), when at least a week of them has steps. */
function stepsAverage(stepsOn: (day: string) => number | null, today: string): number | null {
  const days = Array.from({ length: HINT_DAYS }, (_, i) => stepsOn(addDays(today, -(i + 1)))).filter(
    (s): s is number => s !== null && s > 0,
  );
  if (days.length < HINT_MIN_DAYS) return null;
  return Math.round(days.reduce((a, b) => a + b, 0) / days.length / 100) * 100;
}

interface FormProps {
  /** Zapisany profil albo punkt startu, gdy go jeszcze nie ma. */
  profile: Profile;
  isNew: boolean;
  today: string;
  /** Sieci z nazwami, najlepsze pod przepisy najpierw. */
  stores: { key: string; name: string }[];
}

/**
 * Dla kogo jest cel i skąd się bierze. Liczba celu powstaje dopiero przy zapisie (`applyProfileEdit`),
 * a wiersz „Cel: …” pokazuje dokładnie to, co zapis zostawi. Niebezpieczne tempa są wyłączone
 * z powodem pod spodem; błędy zatrzymują zapis i przenoszą fokus na pierwsze złe pole.
 */
function ProfileForm({ profile, isNew, today, stores }: FormProps) {
  const bridge = useBridge();
  // Wzrost z treningów ma pierwszeństwo przed zapisanym w profilu diety — to ta sama osoba.
  // W całych centymetrach, jak w treningach: profil z arkusza czy z Produktów PL mógł mieć 180,5,
  // a treningi zapisują `Math.round` — szkic z ułamkiem po zapisie różniłby się od tego, co wraca,
  // i formularz zaczynałby od nowa (a wzrost dryfował o pół centymetra).
  const withGymHeight = (p: Profile): Profile => ({ ...p, heightCm: Math.round(bridge.heightCm ?? p.heightCm) });
  const [draft, setDraft] = useState<Profile>(() => withGymHeight(profile));
  // Cel nowego profilu nie jest zaznaczony z góry: najpierw pytanie, czego ktoś chce.
  const [goal, setGoal] = useState<Goal | null>(() => (isNew ? null : directionOf(profile.goalPace)));
  const [targetKg, setTargetKg] = useState<number | null>(() => (isNew ? null : profile.targetWeightKg));
  const [manual, setManual] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const [howOpen, setHowOpen] = useState(() => hashQuery(window.location.hash).get('jak') === '1');
  const howRef = useRef<HTMLDetailsElement>(null);
  // Profil zmieniony gdzie indziej podmienia w szkicu to, co się zmieniło; te same wartości
  // wracające po zapisie — nic. O podmianie decyduje sam wiersz z IndexedDB: wzrost zapisany chwilę
  // wcześniej w treningach nie może cofnąć reszty szkicu.
  const [source, setSource] = useState(profile);
  if (profile !== source) {
    const base = withGymHeight(source);
    const incoming = withGymHeight(profile);
    setSource(profile);
    const next = withChanges(base, incoming, draft);
    if (!sameProfile(next, draft)) {
      setDraft(next);
      setSaved(false);
    }
    if (incoming.goalPace !== base.goalPace) setGoal(directionOf(incoming.goalPace));
    if (incoming.targetWeightKg !== base.targetWeightKg) setTargetKg(incoming.targetWeightKg);
  }
  const set = (patch: Partial<Profile>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  // „Jak liczę cel →” z innego ekranu (`?jak=1`): rozwinięte i przewinięte do siebie. Z opóźnieniem,
  // bo router po zmianie ekranu sam przewija na górę.
  useEffect(() => {
    const scroll = () => window.setTimeout(() => howRef.current?.scrollIntoView?.({ block: 'start' }), 150);
    let timer = hashQuery(window.location.hash).get('jak') === '1' ? scroll() : undefined;
    const onHash = () => {
      if (hashQuery(window.location.hash).get('jak') !== '1') return;
      setHowOpen(true);
      timer = scroll();
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.clearTimeout(timer);
    };
  }, []);

  const trend = trendOn(bridge.weights, today);
  // Waga, z której liczą się cele: nowy profil — wpisana; zapisany — trend z ważeń, bez nich waga na starcie.
  const kgNow = isNew ? draft.startWeightKg : (trend ?? draft.startWeightKg);
  const under18 = draft.age < 18;
  const pregnant = draft.sex === 'K' && draft.pregnancy;
  const locked = under18 || pregnant;
  const chosen: Goal | null = locked ? 'keep' : goal;
  const stored = isNew ? null : profile.goalPace;
  const shown = !hidesKcal(draft);

  // Waga docelowa sprawdzana, gdy ktoś ją rusza: nowy profil, inny cel albo inna liczba. Zapisany
  // profil, któremu trend przeszedł już wagę docelową, zapisze się bez tego pytania.
  const targetTouched = isNew || goal !== directionOf(profile.goalPace) || targetKg !== profile.targetWeightKg;
  const targetIssue = locked || !targetTouched ? null : targetWeightProblem(chosen, targetKg, kgNow, draft.heightCm);
  const forSave: Profile = {
    ...draft,
    pregnancy: pregnant,
    goalPace: chosen === 'loss' || chosen === 'gain' ? draft.goalPace : 0,
    targetWeightKg: targetKg !== null && targetIssue?.kind !== 'min' ? targetKg : round1(kgNow),
  };
  const effective = rebased(isNew ? null : profile, forSave, kgNow);
  const manualIssue = manualProblem(forSave, kgNow, manual);
  const manualFloor = manual !== null && r10(manual) >= hardMinOf(forSave) && r10(manual) < floorOf(forSave, kgNow);
  // Wiersz „Cel: …” liczy dokładnie to, co zapis: wpisana liczba poniżej minimum podstawowej
  // przemiany pokazuje się taka, jak wpisana (z pytaniem o lekarza), za niska albo za wysoka — wcale.
  const preview = applyProfileEdit(
    isNew ? null : profile,
    manualIssue?.kind === 'floor' ? { ...forSave, belowFloorOk: true } : forSave,
    { today, kgNow, manual: manualIssue && manualIssue.kind !== 'floor' ? null : manual },
  );
  const protein = DIET_PROFILES[preview.dietProfile].targets(preview.dailyKcal, preview.targetWeightKg).protein.target;
  const noLoss = safety({ ...effective, targetWeightKg: kgNow }, kgNow).noLoss;
  const noGain = safety(effective, kgNow).noGain;
  const chips = chosen === 'loss' || chosen === 'gain' ? paceChips(effective, kgNow, chosen, stored) : [];
  const limited = chosen === 'loss' && chips.some((c) => c.disabled);
  const implied = manual !== null && (!manualIssue || manualIssue.kind === 'floor') ? impliedPace(effective, kgNow, r10(manual)) : null;
  const check = isNew || !profile.anchored ? null : lastCheckLine(profile, today);
  const steps = stepsAverage((day) => bridge.stepsOn(day), today);
  const pause = isNew ? null : pauseOn(profile, today);
  const storeKnown = !draft.preferredStore || stores.some((s) => s.key === draft.preferredStore);

  const pick = (next: Goal) => {
    setGoal(next);
    setManual(null);
    set({ goalPace: startPace(effective, kgNow, next, stored) });
  };

  const submit = async () => {
    const next = applyProfileEdit(isNew ? null : profile, forSave, { today, kgNow, manual });
    await saveProfileEdit(next);
    // Wzrost jest jeden: zapis profilu diety poprawia też wzrost w treningach.
    if (draft.heightCm !== bridge.heightCm) bridge.setHeight(draft.heightCm);
    markDiet(true);
    if (isNew) {
      go(FOOD_PATH, { replace: true });
      return;
    }
    setDraft(withGymHeight(next));
    setGoal(directionOf(next.goalPace));
    setTargetKg(next.targetWeightKg);
    setManual(null);
    setTried(false);
    setSaved(true);
  };

  const pauseCtx = { today, kgNow };

  const resultLine = shown && (
    <p className="fd-diet-paceline">
      {T.result(formatNumber(preview.dailyKcal, 0), formatNumber(protein, 0))}
    </p>
  );

  // Cel ręcznie: w trybie bez liczb go nie ma — to same kalorie.
  const manualBox = shown && (
    <details className="why fd-diet-manual">
      <summary>{T.manual}</summary>
      <div>
        <OptionalNumber
          label={T.manualField}
          value={manual}
          onChange={(n) => {
            setManual(n);
            setSaved(false);
          }}
          integer
          suffix="kcal"
          error={
            manualIssue?.kind === 'min'
              ? T.minError(formatNumber(manualIssue.min, 0))
              : manualIssue?.kind === 'max'
                ? T.range(manualIssue.min, manualIssue.max)
                : manualIssue?.kind === 'floor'
                  ? T.belowFloor(formatNumber(manualIssue.floor, 0))
                  : null
          }
        />
        {manualFloor && manualIssue?.kind !== 'floor' && (
          <p className="tight fd-diet-soft">{T.belowFloor(formatNumber(floorOf(forSave, kgNow), 0))}</p>
        )}
        {/* Zaznaczone wcześniej zostaje widoczne, żeby dało się je cofnąć. */}
        {(manualFloor || draft.belowFloorOk) && (
          <label className="check-row fd-diet-check">
            <input
              type="checkbox"
              checked={draft.belowFloorOk}
              onChange={(e) => set({ belowFloorOk: e.target.checked })}
            />
            <span>{T.doctor}</span>
          </label>
        )}
        {implied !== null && (
          <p className="tight">
            {T.implied(Math.abs(snap05(implied)) < 0.005 ? T.zeroPace : paceWord(snap05(implied)))}
          </p>
        )}
        {implied !== null && implied > kgNow / 100 && <p className="tight fd-diet-soft">{T.manualFast}</p>}
      </div>
    </details>
  );

  const levelCards = (
    <fieldset className="fd-diet-levels">
      <legend>{T.levelTitle}</legend>
      {LEVELS.map((level) => {
        const [title, description] = T.levels[level];
        return (
          <label key={level} className="fd-diet-level">
            <input
              type="radio"
              name="diet-level"
              checked={draft.activityLevel === level}
              onChange={() => set({ activityLevel: level })}
            />
            <span>
              <b>{title}</b>
              <span>{description}</span>
            </span>
          </label>
        );
      })}
      {steps !== null && <p className="tight fd-diet-soft">{T.stepsHint(formatNumber(steps, 0))}</p>}
    </fieldset>
  );

  const pace = preview.goalPace;
  const how = (
    <details
      ref={howRef}
      className="grp fd-diet-how"
      open={howOpen}
      onToggle={(e) => setHowOpen(e.currentTarget.open)}
    >
      <summary>{T.howTitle}</summary>
      <ol>
        <li>{T.how.start}</li>
        <li>
          {directionOf(pace) === 'keep'
            ? T.how.keep
            : (directionOf(pace) === 'loss' ? T.how.loss : T.how.gain)(
                `${formatNumber(Math.abs(pace), 2)} kg`,
                formatNumber(r10((Math.abs(pace) * preview.kcalPerKg) / 7), 0),
              )}
        </li>
        <li>{T.how.monday}</li>
        <li>{T.how.settle}</li>
        <li>{T.how.move}</li>
        <li>{T.how.safety}</li>
        {shown && <li>{T.how.burn(formatNumber(r10(burnOf(preview, kgNow)), 0))}</li>}
      </ol>
      <p className="tight fd-diet-soft">{T.how.foot}</p>
    </details>
  );

  return (
    <>
      {isNew && (
        <div className="wrap">
          <p className="lead">{T.lead}</p>
          <ImportWorkbook
            label={T.importExcel}
            // Arkusz tworzy profil, więc ten formularz zaraz zniknie razem z wynikiem importu —
            // jak w Produktach PL od razu do dziennika, a co wczytano, mówi wiadomość na dole.
            onImported={(summary) => {
              bridge.toast(summary);
              go(FOOD_PATH, { replace: true });
            }}
          />
        </div>
      )}

      <form
        className="fd-diet-profile"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          // Błędy „brak” (cel, waga docelowa) pokazują się dopiero po próbie zapisu; pole z literówką
          // trzyma w szkicu ostatnią poprawną liczbę — zapis teraz utrwaliłby wartość, na którą nikt
          // nie patrzy. Fokus idzie do pierwszego złego pola, także w zwiniętym bloku.
          flushSync(() => setTried(true));
          const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]:not([disabled])');
          if (invalid) {
            const closed = invalid.closest('details');
            if (closed && !closed.open) closed.open = true;
            invalid.focus();
            return;
          }
          void submit();
        }}
      >
        <section className="grp" aria-labelledby="fd-diet-you-title">
          <h2 id="fd-diet-you-title">{isNew ? T.firstTitle : T.you}</h2>
          <div className="fd-diet-grid2">
            <label className="fld">
              <span>{T.sex}</span>
              <select
                value={draft.sex}
                onChange={(e) => {
                  const sex = e.target.value as Profile['sex'];
                  set({ sex, ...(sex === 'M' && { pregnancy: false }) });
                }}
              >
                <option value="M">{T.male}</option>
                <option value="K">{T.female}</option>
              </select>
            </label>
            <NumberField
              label={T.age}
              value={draft.age}
              onChange={(age) => set({ age })}
              integer
              min={14}
              max={100}
              suffix={T.years}
            />
            <NumberField
              label={T.height}
              value={draft.heightCm}
              onChange={(heightCm) => set({ heightCm })}
              integer
              min={120}
              max={230}
              suffix="cm"
            />
            {isNew && (
              <NumberField
                label={T.weightNowField}
                value={draft.startWeightKg}
                onChange={(startWeightKg) => set({ startWeightKg })}
                min={30}
                max={300}
                suffix="kg"
              />
            )}
          </div>
          <p className="tight fd-diet-soft">{T.heightShared}</p>
          {!isNew && (
            <>
              <p className="tight">
                {trend !== null
                  ? T.weightNow(formatNumber(round1(trend), 1))
                  : T.noWeighIns(formatNumber(draft.startWeightKg, 1))}
              </p>
              <details className="why fd-diet-dietstart">
                <summary>{T.startTitle}</summary>
                <div className="fd-diet-grid2">
                  <NumberField
                    label={T.startWeight}
                    value={draft.startWeightKg}
                    onChange={(startWeightKg) => set({ startWeightKg })}
                    min={30}
                    max={300}
                    suffix="kg"
                  />
                  <label className="fld">
                    <span>{T.start}</span>
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => e.target.value && set({ startDate: e.target.value })}
                    />
                  </label>
                </div>
              </details>
            </>
          )}
        </section>

        <section className="grp" aria-labelledby="fd-diet-goal-title">
          <h2 id="fd-diet-goal-title">{T.goalTitle}</h2>
          {under18 ? (
            <p className="tight">{T.under18}</p>
          ) : (
            <>
              <GoalPick
                goal={chosen}
                closed={{ loss: noLoss !== null, keep: false, gain: noGain !== null }}
                missing={tried && chosen === null}
                onPick={pick}
              />
              {noLoss === 'bmi' && <p className="tight fd-diet-soft">{T.lowBmi}</p>}
              {(chosen === 'loss' || chosen === 'gain') && (
                <div className="fd-diet-goalweight">
                  <OptionalNumber
                    label={T.targetWeight}
                    value={targetKg}
                    onChange={(n) => {
                      setTargetKg(n);
                      setSaved(false);
                    }}
                    suffix="kg"
                    min={30}
                    max={300}
                    error={
                      targetIssue?.kind === 'missing'
                        ? tried
                          ? T.targetMissing
                          : null
                        : targetIssue?.kind === 'min'
                          ? T.minTarget(formatNumber(targetIssue.kg, 0))
                          : targetIssue?.kind === 'side'
                            ? targetIssue.goal === 'loss'
                              ? T.targetSideLoss
                              : T.targetSideGain
                            : null
                    }
                  />
                </div>
              )}
              {draft.sex === 'K' && (
                <>
                  <label className="check-row fd-diet-check">
                    <input
                      type="checkbox"
                      checked={draft.pregnancy}
                      onChange={(e) => set({ pregnancy: e.target.checked })}
                    />
                    <span>{T.pregnancy}</span>
                  </label>
                  {pregnant && <p className="tight fd-diet-soft">{T.pregnancyHint}</p>}
                </>
              )}
              {chosen === 'keep' && (
                <>
                  {resultLine}
                  {manualBox}
                </>
              )}
            </>
          )}
        </section>

        {isNew || !profile.anchored ? (
          <div className="grp">{levelCards}</div>
        ) : (
          // Spalanie jest już z danych: pytanie o tydzień nie przesunęłoby celu, więc stoi zwinięte, z powodem.
          <div className="grp">
            <details className="why fd-diet-anchored">
              <summary>{T.anchoredTitle}</summary>
              <div>
                <p className="tight">{T.anchored}</p>
                {levelCards}
              </div>
            </details>
          </div>
        )}

        {(chosen === 'loss' || chosen === 'gain') && (
          <section className="grp" aria-labelledby="fd-diet-pace-title">
            <h2 id="fd-diet-pace-title">{T.paceTitle}</h2>
            <div className="chips" role="group" aria-labelledby="fd-diet-pace-title">
              {chips.map((c) => {
                const label = paceText(c.pace);
                return (
                  <button
                    key={c.pace}
                    type="button"
                    disabled={c.disabled}
                    aria-pressed={manual === null && Math.abs(draft.goalPace - c.pace) < 1e-9}
                    onClick={() => {
                      setManual(null);
                      set({ goalPace: c.pace });
                    }}
                  >
                    {c.current ? T.current(label) : label}
                  </button>
                );
              })}
            </div>
            {limited && (
              <p className="tight fd-diet-soft">{T.paceLimited(formatNumber(minTargetOf(effective, kgNow), 0))}</p>
            )}
            {resultLine}
            {/* Obie linijki mówią o liczbie celu — bez liczb nie ma o czym. */}
            {shown &&
              (check ? (
                <p className="tight fd-diet-soft">{T.lastCheck(dayMonthLong(check.week), check.changed)}</p>
              ) : (
                (isNew || !profile.anchored) && <p className="tight fd-diet-soft">{T.estimate}</p>
              ))}
            {manualBox}
          </section>
        )}

        {how}

        <section className="grp" aria-labelledby="fd-diet-settings-title">
          <h2 id="fd-diet-settings-title">{T.settingsTitle}</h2>
          <label className="check-row fd-diet-check">
            <input type="checkbox" checked={draft.autoAdjust} onChange={(e) => set({ autoAdjust: e.target.checked })} />
            <span>{T.autoAdjust}</span>
          </label>
          <label className="check-row fd-diet-check">
            <input
              type="checkbox"
              checked={hidesKcal(draft)}
              disabled={under18}
              onChange={(e) => set({ hideKcal: e.target.checked })}
            />
            <span>{T.hideKcal}</span>
          </label>
          {!isNew && (
            <div className="fd-diet-breaks">
              <h3>{T.pause}</h3>
              {pause ? (
                <>
                  <p className="tight">{T.pauseUntil(dayMonthLong(pause.to))}</p>
                  <div className="actions">
                    <button type="button" className="btn ghost" onClick={() => void endPause(pauseCtx)}>
                      {T.pauseEnd}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="tight fd-diet-soft">{T.pauseText}</p>
                  <div className="actions">
                    <button type="button" className="btn ghost" onClick={() => void startPause(7, pauseCtx)}>
                      {T.pauseWeek}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => void startPause(14, pauseCtx)}>
                      {T.pauseTwoWeeks}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <fieldset className="grp fd-diet-styles">
          <legend>{T.dietType}</legend>
          {DIET_PROFILE_IDS.map((id) => {
            const p = DIET_PROFILES[id];
            const t = p.targets(preview.dailyKcal, preview.targetWeightKg);
            return (
              <label key={id} className="fd-diet-style">
                <span className="fd-diet-style-head">
                  <input
                    type="radio"
                    name="diet-profile"
                    checked={draft.dietProfile === id}
                    onChange={() => set({ dietProfile: id })}
                  />
                  {p.label}
                </span>
                <span>{p.description}</span>
                <span className="fd-diet-meta">
                  <b className="fd-diet-yes">{T.yes}</b> {p.allows}
                </span>
                <span className="fd-diet-meta">
                  <b className="fd-diet-no">{T.avoid}</b> {p.avoids}
                </span>
                <span className="fd-diet-meta fd-diet-nums">
                  {T.dailyMacros(
                    t.protein.target,
                    t.carbs.max !== null ? T.upTo(t.carbs.max) : t.carbs.target,
                    t.fat.target,
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>

        <section className="grp" aria-labelledby="fd-diet-store-title">
          <h2 id="fd-diet-store-title">{T.store}</h2>
          <label className="fld fd-diet-field">
            <span>{T.planFor}</span>
            <select
              value={draft.preferredStore ?? ''}
              onChange={(e) => set({ preferredStore: e.target.value || null })}
            >
              <option value="">{T.anyStore}</option>
              {!storeKnown && draft.preferredStore && (
                <option value={draft.preferredStore}>{draft.preferredStore}</option>
              )}
              {stores.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <p className="tight">{T.nearbyFirst}</p>
        </section>

        <div className="fd-diet-savebar">
          <button type="submit" className="btn">
            {isNew ? T.saveStart : T.saveProfile}
          </button>
          <span role="status" className="fd-diet-saved">
            {saved && (
              <>
                <Check size={20} strokeWidth={2} aria-hidden /> {T.saved}
              </>
            )}
          </span>
        </div>
      </form>
    </>
  );
}

/** Trzy cele jako jedna grupa wyborów; zamknięty kierunek jest wyłączony, a powód stoi pod spodem. */
function GoalPick({
  goal,
  closed,
  missing,
  onPick,
}: {
  goal: Goal | null;
  closed: Record<Goal, boolean>;
  missing: boolean;
  onPick: (goal: Goal) => void;
}) {
  const errorId = useId();
  return (
    <>
      <div
        className="fd-diet-goalpick"
        role="radiogroup"
        aria-labelledby="fd-diet-goal-title"
        aria-describedby={missing ? errorId : undefined}
      >
        {GOALS.map((g) => (
          <label key={g}>
            <input
              type="radio"
              name="diet-goal"
              checked={goal === g}
              disabled={closed[g]}
              aria-invalid={missing || undefined}
              onChange={() => onPick(g)}
            />
            <span>{T.goals[g]}</span>
          </label>
        ))}
      </div>
      {missing && (
        <p className="fd-diet-err" id={errorId}>
          {T.goalMissing}
        </p>
      )}
    </>
  );
}

/** Liczba z polskim przecinkiem albo kropką; `null`, gdy tekst nie jest liczbą. */
function parse(text: string, integer: boolean): number | null {
  const n = Number(text.replace(',', '.').trim());
  if (!text.trim() || !Number.isFinite(n)) return null;
  return integer ? Math.round(n) : n;
}

/** Liczba tak, jak się ją pisze po polsku: 75,5. */
const shownNumber = (value: number): string => (LANG === 'pl' ? String(value).replace('.', ',') : String(value));

/**
 * Pole liczby, które może być puste (waga docelowa nowego profilu, cel ręcznie): jak `NumberField`,
 * ale puste pole to `null`, a błąd znaleziony przez formularz (za nisko, zła strona) stoi pod nim
 * i oznacza je jako błędne — zapis szuka pierwszego takiego pola.
 */
function OptionalNumber({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  integer = false,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  error: string | null;
}) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : shownNumber(value));
  const [known, setKnown] = useState(value);
  if (value !== known) {
    setKnown(value);
    if (parse(text, integer) !== value) setText(value === null ? '' : shownNumber(value));
  }
  const parsed = parse(text, integer);
  const outside = parsed !== null && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max));
  const own = text.trim() && parsed === null ? T.number : outside ? T.range(min ?? 0, max ?? 0) : null;
  const message = own ?? error;
  const described = [suffix ? `${id}-unit` : null, message ? `${id}-error` : null].filter(Boolean).join(' ');

  return (
    <div className="fd-diet-num">
      <label htmlFor={id}>{label}</label>
      <div className="fd-diet-num-box">
        <input
          id={id}
          type="text"
          className="num"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={text}
          aria-invalid={message ? true : undefined}
          aria-describedby={described || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const n = parse(e.target.value, integer);
            const empty = !e.target.value.trim();
            if (empty || (n !== null && (min === undefined || n >= min) && (max === undefined || n <= max))) {
              const next = empty ? null : n;
              setKnown(next);
              onChange(next);
            }
          }}
        />
        {suffix && (
          <span className="fd-diet-unit" id={`${id}-unit`}>
            {suffix}
          </span>
        )}
      </div>
      {message && (
        <p className="fd-diet-err" id={`${id}-error`}>
          {message}
        </p>
      )}
    </div>
  );
}
