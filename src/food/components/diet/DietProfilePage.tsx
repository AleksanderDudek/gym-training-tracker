import { Check } from 'lucide-react';
import { useState } from 'react';
import { text } from '../../../i18n';
import { FOOD_PATH, go } from '../../../routing';
import { useBridge } from '../../bridge';
import { markDiet } from '../../dietFlag';
import { bmr, dayReaching, forecast, goalDirection, paceKgPerWeek, suggestedKcal, tdee } from '../../diet/energy';
import { addDays, paceText, weightOn } from '../../diet/model';
import { DIET_PROFILE_IDS, DIET_PROFILES } from '../../diet/profiles';
import { completeProfile, now, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { useMergedHistory } from '../../hooks/useDiet';
import { formatDate, formatNumber } from '../../lib/format';
import { DataSection } from './DataSection';
import { ImportWorkbook } from './ImportWorkbook';
import { NumberField } from './NumberField';
import { Loading } from './Onboarding';
import { useDietBase, useStoreList } from './useDietPage';
import './diet.css';

const T = text({
  pl: {
    levels: {
      sedentary: 'Siedzący tryb, bez treningów',
      desk: 'Praca przy biurku + 2 treningi w tygodniu',
      light: 'Lekko aktywny: 1–3 treningi w tygodniu',
      active: 'Aktywny: 3–5 treningów w tygodniu',
      veryActive: 'Bardzo aktywny: codzienny wysiłek',
    },
    belowBmr: (goal: number, base: number) =>
      `Cel ${goal} kcal jest poniżej podstawowej przemiany materii (${base} kcal) – trudny do utrzymania i grozi utratą mięśni.`,
    tooFew: 'Bardzo mało kalorii – trudno wtedy dostarczyć wszystkie składniki odżywcze.',
    tooFast: (pace: string) =>
      `Tempo ${pace} kg/tydz. to ponad 1% masy ciała – zwykle za szybko, by utrzymać mięśnie i wytrwać.`,
    gainTooFast: (pace: string) =>
      `Przybieranie ${pace} kg/tydz. to ponad 0,5% masy ciała – zwykle więcej tłuszczu niż mięśni.`,
    surplus: 'To nadwyżka kalorii – waga będzie rosła.',
    deficit: 'To deficyt kalorii – waga będzie spadać, a cel jest wyżej.',
    keepMoves: (pace: string) =>
      `Waga docelowa to waga startowa, a ten cel zmienia ją o ${pace} – wybierz utrzymanie albo ustaw wagę docelową.`,
    lead: 'Z tych danych liczę Twoje spalanie i dzienny cel. Wszystko zostaje na tym urządzeniu. Masz arkusz z planem? Wczytaj go – parametry z panelu i plan posiłków przyjdą razem.',
    importExcel: 'Wczytaj z Excela',
    startTitle: 'Zacznij od profilu',
    you: 'Ty',
    sex: 'Płeć',
    male: 'mężczyzna',
    female: 'kobieta',
    age: 'Wiek',
    years: 'lat',
    height: 'Wzrost',
    startWeight: 'Waga na starcie',
    targetWeight: 'Waga docelowa',
    start: 'Start',
    heightShared: 'Wzrost to ten sam, co w profilu treningowym — zapis zmienia go w obu miejscach.',
    activity: 'Aktywność (bez liczenia kroków)',
    customFactor: (m: number) => `Własny współczynnik × ${m}`,
    targetSteps: 'Kroki dziennie (plan)',
    advanced: 'Zaawansowane (wartości z arkusza)',
    baseSteps: 'Kroki już w aktywności',
    kcalPerSteps: 'kcal na 1000 kroków na kg',
    extra: 'Dodatkowy wysiłek',
    perWeek: 'kcal/tydz.',
    kcalPerKg: 'Energia w 1 kg masy',
    correction: 'Korekta spalania z check-inów',
    perDay: 'kcal/dzień',
    correctionHint:
      'Korektę ustawia check-in przed planem z zakupami: o tyle Twoje spalanie różni się od wzoru według wagi i zapisów. Wpisz 0, żeby liczyć samym wzorem.',
    goalTitle: 'Cel kalorii',
    bmr: 'Podstawowe spalanie (BMR)',
    tdee: 'Spalanie dzienne (z krokami)',
    deficitTile: 'Deficyt',
    surplusTile: 'Nadwyżka',
    pace: 'Tempo',
    reachOn: (date: string) => `cel ok. ${date}`,
    keeping: 'utrzymanie wagi',
    outOfReach: 'cel poza zasięgiem',
    countedFor: (kg: string, last: boolean, correction: string | null) =>
      `Liczone dla wagi ${kg} kg${last ? ' (ostatnie ważenie)' : ''}${correction ? `, z korektą spalania z check-inów: ${correction}` : ''}.`,
    daily: 'Dziennie',
    byPace: 'Cel według tempa',
    maintain: 'utrzymanie',
    warning: 'Uwaga',
    adaptWeekly:
      'Dopasowuj cel do tygodnia: nadwyżka z wcześniejszych dni jest rozkładana na kolejne (najwyżej 10% celu dziennie), niedojedzone kalorie wracają.',
    adaptActivity:
      'Dopasowuj cel do ruchu: więcej kroków niż w celu albo trening spoza planu dodaje kalorie, mniej kroków albo opuszczony trening z planu — odejmuje. Liczy się tylko różnica wobec planu, nie wszystkie spalone kalorie.',
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
    levels: {
      sedentary: 'Sedentary, no workouts',
      desk: 'Desk job + 2 workouts a week',
      light: 'Lightly active: 1–3 workouts a week',
      active: 'Active: 3–5 workouts a week',
      veryActive: 'Very active: exercise every day',
    },
    belowBmr: (goal: number, base: number) =>
      `A goal of ${goal} kcal is below your basal metabolic rate (${base} kcal) – hard to keep up, and you risk losing muscle.`,
    tooFew: 'Very few calories – it’s hard to get all the nutrients you need.',
    tooFast: (pace: string) =>
      `A pace of ${pace} kg/wk is over 1% of your body weight – usually too fast to keep your muscle and stick with it.`,
    gainTooFast: (pace: string) =>
      `Gaining ${pace} kg/wk is over 0.5% of your body weight – usually more fat than muscle.`,
    surplus: 'That’s a calorie surplus – your weight will go up.',
    deficit: 'That’s a calorie deficit – your weight will go down, but your target is higher.',
    keepMoves: (pace: string) =>
      `Your target weight is your starting weight, but this goal changes it by ${pace} – pick maintenance or set a target weight.`,
    lead: 'From this I work out how much you burn and your daily goal. Everything stays on this device. Got a workbook with a plan? Import it – the panel settings and the meal plan come along.',
    importExcel: 'Import from Excel',
    startTitle: 'Start with your profile',
    you: 'You',
    sex: 'Sex',
    male: 'Male',
    female: 'Female',
    age: 'Age',
    years: 'years',
    height: 'Height',
    startWeight: 'Starting weight',
    targetWeight: 'Target weight',
    start: 'Start date',
    heightShared: 'Height is the same as in your training profile — saving changes it in both places.',
    activity: 'Activity (not counting steps)',
    customFactor: (m: number) => `Custom factor × ${m}`,
    targetSteps: 'Steps a day (plan)',
    advanced: 'Advanced (workbook values)',
    baseSteps: 'Steps already in the activity',
    kcalPerSteps: 'kcal per 1000 steps per kg',
    extra: 'Extra exercise',
    perWeek: 'kcal/wk',
    kcalPerKg: 'Energy in 1 kg of body mass',
    correction: 'Burn correction from check-ins',
    perDay: 'kcal/day',
    correctionHint:
      'The check-in before a plan & shopping sets the correction: how far your burn differs from the formula, going by your weight and logs. Enter 0 to use the formula alone.',
    goalTitle: 'Calorie goal',
    bmr: 'Basal burn (BMR)',
    tdee: 'Daily burn (with steps)',
    deficitTile: 'Deficit',
    surplusTile: 'Surplus',
    pace: 'Pace',
    reachOn: (date: string) => `goal around ${date}`,
    keeping: 'keeping your weight',
    outOfReach: 'goal out of reach',
    countedFor: (kg: string, last: boolean, correction: string | null) =>
      `Worked out for ${kg} kg${last ? ' (last weigh-in)' : ''}${correction ? `, with the burn correction from check-ins: ${correction}` : ''}.`,
    daily: 'Daily',
    byPace: 'Goal by pace',
    maintain: 'maintenance',
    warning: 'Watch out',
    adaptWeekly:
      'Match the goal to the week: a surplus from earlier days is spread over the next ones (at most 10% of the goal a day), and calories you didn’t eat come back.',
    adaptActivity:
      'Match the goal to activity: more steps than planned or an unplanned workout adds calories, fewer steps or a skipped planned workout takes them off. Only the difference from the plan counts, not every calorie burned.',
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

/**
 * Profil diety — podstrona dziennika: dane do modelu energii, cel kalorii, sposób odżywiania,
 * sklep i kopia danych diety. Bez profilu to pierwszy krok („Zapisz i zacznij” wraca do dziennika).
 * Wzrost jest jeden z treningami: pole czyta wzrost z profilu treningowego i zapisuje do obu.
 */
export default function DietProfilePage() {
  const bridge = useBridge();
  const { profile, clock } = useDietBase();
  const today = clock.date;
  const from = profile ? [profile.startDate, addDays(today, -14)].sort()[0]! : null;
  const history = useMergedHistory(from);
  const stores = useStoreList();

  // Ostatnie ważenie z dziennika wagi — do celu kalorii i jako waga startowa nowego profilu.
  const lastWeight = [...bridge.weights].reverse().find((w) => w.day <= today)?.kg ?? null;
  // Punkt startu nowego profilu: waga i wzrost z treningów. Liczony raz — formularz zaczyna od nowa,
  // gdy zmieni się tożsamość profilu, więc ważenie dopisane w trakcie nie może go podmienić.
  const [blank] = useState(() => {
    const start = lastWeight ?? 80;
    return completeProfile({
      heightCm: Math.round(bridge.heightCm ?? 175),
      startWeightKg: start,
      targetWeightKg: Math.round((start - 5) * 10) / 10,
    });
  });

  if (profile === undefined || (profile && !history)) return <Loading />;
  if (!profile || !history) {
    return <ProfileForm profile={blank} isNew currentWeight={blank.startWeightKg} stores={stores} />;
  }
  return (
    <>
      <ProfileForm
        profile={profile}
        isNew={false}
        currentWeight={lastWeight ?? weightOn(history.days.values(), today, profile.startWeightKg)}
        stores={stores}
      />
      <DataSection />
    </>
  );
}

const ACTIVITY: { value: number; label: string }[] = [
  { value: 1.2, label: T.levels.sedentary },
  { value: 1.28, label: T.levels.desk },
  { value: 1.375, label: T.levels.light },
  { value: 1.55, label: T.levels.active },
  { value: 1.725, label: T.levels.veryActive },
];

/** Kilogramy na tydzień: chudnięcie (dodatnie), utrzymanie i spokojne przybieranie (ujemne). */
const PACES = [0.25, 0.5, 0.75, 1, 0, -0.25];

/** Poniżej tego tempa (w obie strony) waga stoi: cel zaokrąglony do 10 kcal nie rusza jej bardziej. */
const STILL = 0.05;

function sameProfile(a: Profile, b: Profile): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => k !== 'id'));
  // Po wartości: historia celu i ostatnie sprawdzenie to tablice i obiekty, a z IndexedDB wracają kopie.
  return [...keys].every((k) => JSON.stringify(a[k as keyof Profile]) === JSON.stringify(b[k as keyof Profile]));
}

/** Co w tych liczbach jest ryzykowne, w kolejności, w jakiej ma znaczenie. */
function warningsOf(p: Profile, weight: number): string[] {
  const out: string[] = [];
  const base = bmr(p, weight);
  const pace = paceKgPerWeek(p, weight, p.dailyKcal);
  if (p.dailyKcal < base)
    out.push(T.belowBmr(p.dailyKcal, Math.round(base)));
  if (p.dailyKcal < (p.sex === 'M' ? 1500 : 1200))
    out.push(T.tooFew);
  if (pace > weight * 0.01)
    out.push(T.tooFast(formatNumber(pace, 2)));
  // Przy treningu siłowym 0,25–0,5% masy ciała na tydzień to tempo, przy którym rosną mięśnie, a nie sam tłuszcz.
  if (-pace > weight * 0.005)
    out.push(T.gainTooFast(formatNumber(-pace, 2)));
  const direction = goalDirection(p);
  if (pace < -STILL && direction !== 'gain') out.push(T.surplus);
  if (pace > STILL && direction === 'gain') out.push(T.deficit);
  if (direction === 'keep' && Math.abs(pace) >= 2 * STILL)
    out.push(T.keepMoves(paceText(pace)));
  return out;
}

interface FormProps {
  /** Zapisany profil albo punkt startu, gdy go jeszcze nie ma. */
  profile: Profile;
  isNew: boolean;
  /** Ostatnie ważenie — do przycisków tempa (przed pierwszym: waga startowa). */
  currentWeight: number;
  /** Sieci z nazwami, najlepsze pod przepisy najpierw. */
  stores: { key: string; name: string }[];
}

/**
 * Dla kogo jest plan i skąd biorą się liczby dnia. Wszystko, o co pyta PANEL arkusza, jest tutaj;
 * to, czego nie trzeba wiedzieć (energia w kilogramie, kalorie na tysiąc kroków), siedzi
 * w „Zaawansowanych” z wartościami z arkusza.
 */
function ProfileForm({ profile, isNew, currentWeight, stores }: FormProps) {
  const bridge = useBridge();
  // Wzrost z treningów ma pierwszeństwo przed zapisanym w profilu diety — to ta sama osoba.
  // W całych centymetrach, jak w treningach: profil z arkusza czy z Produktów PL mógł mieć 180,5,
  // a treningi zapisują `Math.round` — szkic z ułamkiem po zapisie różniłby się od tego, co wraca,
  // i formularz zaczynałby od nowa (a wzrost dryfował o pół centymetra).
  const withGymHeight = (p: Profile): Profile => ({ ...p, heightCm: Math.round(bridge.heightCm ?? p.heightCm) });
  const [draft, setDraft] = useState<Profile>(() => withGymHeight(profile));
  const [saved, setSaved] = useState(false);
  // Profil zmieniony gdzie indziej (wczytany arkusz, przywrócona kopia) podmienia formularz;
  // te same wartości wracające po zapisie — nie. O podmianie decyduje sam wiersz z IndexedDB:
  // wzrost zapisany chwilę wcześniej w treningach nie może cofnąć reszty szkicu.
  const [source, setSource] = useState(profile);
  if (profile !== source) {
    setSource(profile);
    const incoming = withGymHeight(profile);
    if (!sameProfile(incoming, draft)) {
      setDraft(incoming);
      setSaved(false);
    }
  }
  const set = (patch: Partial<Profile>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  const weight = isNew ? draft.startWeightKg : currentWeight;
  const base = bmr(draft, weight);
  const expenditure = tdee(draft, weight);
  const pace = paceKgPerWeek(draft, weight, draft.dailyKcal);
  const days = Array.from({ length: 730 }, (_, i) => ({
    date: addDays(draft.startDate, i),
    plannedKcal: draft.dailyKcal,
  }));
  const direction = goalDirection(draft);
  const reach = dayReaching(draft.targetWeightKg, forecast(draft, days), 'plan', direction);
  const warnings = warningsOf(draft, weight);
  const activityKnown = ACTIVITY.some((a) => a.value === draft.activityMultiplier);
  const storeKnown = !draft.preferredStore || stores.some((s) => s.key === draft.preferredStore);

  const submit = async () => {
    // A new goal starts its own week's balance: days eaten to the old one are not its surplus.
    await saveProfile(draft.dailyKcal === profile.dailyKcal ? draft : { ...draft, goalSince: now().date });
    // Wzrost jest jeden: zapis profilu diety poprawia też wzrost w treningach.
    if (draft.heightCm !== bridge.heightCm) bridge.setHeight(draft.heightCm);
    markDiet(true);
    if (isNew) go(FOOD_PATH, { replace: true });
    else setSaved(true);
  };

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
          // Pole z literówką trzyma w szkicu ostatnią poprawną liczbę: zapis teraz utrwaliłby
          // wartość, na którą nikt nie patrzy.
          const invalid = e.currentTarget.querySelector<HTMLInputElement>('[aria-invalid="true"]');
          if (invalid) {
            invalid.focus();
            return;
          }
          void submit();
        }}
      >
        <section className="grp" aria-labelledby="fd-diet-you-title">
          <h2 id="fd-diet-you-title">{isNew ? T.startTitle : T.you}</h2>
          <div className="fd-diet-grid2">
            <label className="fld">
              <span>{T.sex}</span>
              <select value={draft.sex} onChange={(e) => set({ sex: e.target.value as Profile['sex'] })}>
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
            <NumberField
              label={T.startWeight}
              value={draft.startWeightKg}
              onChange={(startWeightKg) => set({ startWeightKg })}
              min={30}
              max={300}
              suffix="kg"
            />
            <NumberField
              label={T.targetWeight}
              value={draft.targetWeightKg}
              onChange={(targetWeightKg) => set({ targetWeightKg })}
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
          <p className="tight fd-diet-soft">{T.heightShared}</p>
          <label className="fld fd-diet-field">
            <span>{T.activity}</span>
            <select
              value={draft.activityMultiplier}
              onChange={(e) => set({ activityMultiplier: Number(e.target.value) })}
            >
              {!activityKnown && (
                <option value={draft.activityMultiplier}>{T.customFactor(draft.activityMultiplier)}</option>
              )}
              {ACTIVITY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} (× {a.value})
                </option>
              ))}
            </select>
          </label>
          <div className="fd-diet-field">
            <NumberField
              label={T.targetSteps}
              value={draft.targetSteps}
              onChange={(targetSteps) => set({ targetSteps })}
              integer
              min={0}
              max={50000}
            />
          </div>
          <details className="why fd-diet-advanced">
            <summary>{T.advanced}</summary>
            <div className="fd-diet-grid2">
              <NumberField
                label={T.baseSteps}
                value={draft.baseSteps}
                onChange={(baseSteps) => set({ baseSteps })}
                integer
                min={0}
                max={30000}
              />
              <NumberField
                label={T.kcalPerSteps}
                value={draft.kcalPer1000StepsPerKg}
                onChange={(kcalPer1000StepsPerKg) => set({ kcalPer1000StepsPerKg })}
                min={0}
                max={2}
              />
              <NumberField
                label={T.extra}
                value={draft.extraWeeklyKcal}
                onChange={(extraWeeklyKcal) => set({ extraWeeklyKcal })}
                integer
                min={0}
                max={20000}
                suffix={T.perWeek}
              />
              <NumberField
                label={T.kcalPerKg}
                value={draft.kcalPerKg}
                onChange={(kcalPerKg) => set({ kcalPerKg })}
                integer
                min={3000}
                max={9000}
                suffix="kcal"
              />
              <NumberField
                label={T.correction}
                value={draft.kcalCorrection}
                onChange={(kcalCorrection) => set({ kcalCorrection })}
                integer
                min={-2000}
                max={2000}
                suffix={T.perDay}
              />
            </div>
            <p className="tight fd-diet-soft">{T.correctionHint}</p>
          </details>
        </section>

        <section className="grp" aria-labelledby="fd-diet-goal-title">
          <h2 id="fd-diet-goal-title">{T.goalTitle}</h2>
          <dl className="tiles fd-diet-energy">
            <div className="tile">
              <dt>{T.bmr}</dt>
              <dd>{formatNumber(base, 0)} kcal</dd>
            </div>
            <div className="tile">
              <dt>{T.tdee}</dt>
              <dd>{formatNumber(expenditure, 0)} kcal</dd>
            </div>
            <div className="tile">
              <dt>{expenditure >= draft.dailyKcal ? T.deficitTile : T.surplusTile}</dt>
              <dd>
                {formatNumber(Math.abs(expenditure - draft.dailyKcal), 0)} {T.perDay}
              </dd>
            </div>
            <div className="tile">
              <dt>{T.pace}</dt>
              <dd>{paceText(pace)}</dd>
              <dd className="fd-diet-soft">
                {reach ? T.reachOn(formatDate(reach)) : direction === 'keep' ? T.keeping : T.outOfReach}
              </dd>
            </div>
          </dl>
          <p className="tight">
            {T.countedFor(
              formatNumber(weight, 1),
              !isNew,
              draft.kcalCorrection !== 0
                ? `${draft.kcalCorrection > 0 ? '+' : '−'}${formatNumber(Math.abs(draft.kcalCorrection), 0)} kcal`
                : null,
            )}
          </p>
          <div className="fd-diet-kcal-goal">
            <NumberField
              label={T.daily}
              value={draft.dailyKcal}
              onChange={(dailyKcal) => set({ dailyKcal })}
              integer
              min={800}
              max={6000}
              suffix="kcal"
            />
          </div>
          <div className="chips" role="group" aria-label={T.byPace}>
            {PACES.map((p) => {
              const kcal = Math.round(suggestedKcal(draft, weight, p) / 10) * 10;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={draft.dailyKcal === kcal}
                  onClick={() => set({ dailyKcal: kcal })}
                >
                  {p === 0 ? T.maintain : paceText(p)} · {formatNumber(kcal, 0)} kcal
                </button>
              );
            })}
          </div>
          {warnings.length > 0 && (
            <div className="dnote warn fd-diet-warnings">
              <b>{T.warning}</b>
              <ul className="fd-diet-bullets">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="check-row fd-diet-check">
            <input
              type="checkbox"
              checked={draft.adaptWeekly}
              onChange={(e) => set({ adaptWeekly: e.target.checked })}
            />
            <span>{T.adaptWeekly}</span>
          </label>
          <label className="check-row fd-diet-check">
            <input
              type="checkbox"
              checked={draft.adaptActivity !== false}
              onChange={(e) => set({ adaptActivity: e.target.checked })}
            />
            <span>{T.adaptActivity}</span>
          </label>
        </section>

        <fieldset className="grp fd-diet-styles">
          <legend>{T.dietType}</legend>
          {DIET_PROFILE_IDS.map((id) => {
            const p = DIET_PROFILES[id];
            const t = p.targets(draft.dailyKcal, draft.targetWeightKg);
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
