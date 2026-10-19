import { Check } from 'lucide-react';
import { useState } from 'react';
import { FOOD_PATH, go } from '../../../routing';
import { useBridge } from '../../bridge';
import { markDiet } from '../../dietFlag';
import { bmr, dayReaching, forecast, goalDirection, paceKgPerWeek, suggestedKcal, tdee } from '../../diet/energy';
import { addDays, paceText, weightOn } from '../../diet/model';
import { DIET_PROFILE_IDS, DIET_PROFILES } from '../../diet/profiles';
import { completeProfile, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { useMergedHistory } from '../../hooks/useDiet';
import { formatDate, formatNumber } from '../../lib/format';
import { DataSection } from './DataSection';
import { ImportWorkbook } from './ImportWorkbook';
import { NumberField } from './NumberField';
import { Loading } from './Onboarding';
import { useDietBase, useStoreList } from './useDietPage';
import './diet.css';

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
  { value: 1.2, label: 'Siedzący tryb, bez treningów' },
  { value: 1.28, label: 'Praca przy biurku + 2 treningi w tygodniu' },
  { value: 1.375, label: 'Lekko aktywny: 1–3 treningi w tygodniu' },
  { value: 1.55, label: 'Aktywny: 3–5 treningów w tygodniu' },
  { value: 1.725, label: 'Bardzo aktywny: codzienny wysiłek' },
];

/** Kilogramy na tydzień: chudnięcie (dodatnie), utrzymanie i spokojne przybieranie (ujemne). */
const PACES = [0.25, 0.5, 0.75, 1, 0, -0.25];

/** Poniżej tego tempa (w obie strony) waga stoi: cel zaokrąglony do 10 kcal nie rusza jej bardziej. */
const STILL = 0.05;

function sameProfile(a: Profile, b: Profile): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => k !== 'id'));
  return [...keys].every((k) => a[k as keyof Profile] === b[k as keyof Profile]);
}

/** Co w tych liczbach jest ryzykowne, w kolejności, w jakiej ma znaczenie. */
function warningsOf(p: Profile, weight: number): string[] {
  const out: string[] = [];
  const base = bmr(p, weight);
  const pace = paceKgPerWeek(p, weight, p.dailyKcal);
  if (p.dailyKcal < base)
    out.push(
      `Cel ${p.dailyKcal} kcal jest poniżej podstawowej przemiany materii (${Math.round(base)} kcal) – trudny do utrzymania i grozi utratą mięśni.`,
    );
  if (p.dailyKcal < (p.sex === 'M' ? 1500 : 1200))
    out.push('Bardzo mało kalorii – trudno wtedy dostarczyć wszystkie składniki odżywcze.');
  if (pace > weight * 0.01)
    out.push(
      `Tempo ${formatNumber(pace, 2)} kg/tydz. to ponad 1% masy ciała – zwykle za szybko, by utrzymać mięśnie i wytrwać.`,
    );
  // Przy treningu siłowym 0,25–0,5% masy ciała na tydzień to tempo, przy którym rosną mięśnie, a nie sam tłuszcz.
  if (-pace > weight * 0.005)
    out.push(
      `Przybieranie ${formatNumber(-pace, 2)} kg/tydz. to ponad 0,5% masy ciała – zwykle więcej tłuszczu niż mięśni.`,
    );
  const direction = goalDirection(p);
  if (pace < -STILL && direction !== 'gain') out.push('To nadwyżka kalorii – waga będzie rosła.');
  if (pace > STILL && direction === 'gain') out.push('To deficyt kalorii – waga będzie spadać, a cel jest wyżej.');
  if (direction === 'keep' && Math.abs(pace) >= 2 * STILL)
    out.push(
      `Waga docelowa to waga startowa, a ten cel zmienia ją o ${paceText(pace)} – wybierz utrzymanie albo ustaw wagę docelową.`,
    );
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
    await saveProfile(draft);
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
          <p className="lead">
            Z tych danych liczę Twoje spalanie i dzienny cel. Wszystko zostaje na tym urządzeniu. Masz arkusz z planem?
            Wczytaj go – parametry z panelu i plan posiłków przyjdą razem.
          </p>
          <ImportWorkbook
            label="Wczytaj z Excela"
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
          <h2 id="fd-diet-you-title">{isNew ? 'Zacznij od profilu' : 'Ty'}</h2>
          <div className="fd-diet-grid2">
            <label className="fld">
              <span>Płeć</span>
              <select value={draft.sex} onChange={(e) => set({ sex: e.target.value as Profile['sex'] })}>
                <option value="M">mężczyzna</option>
                <option value="K">kobieta</option>
              </select>
            </label>
            <NumberField
              label="Wiek"
              value={draft.age}
              onChange={(age) => set({ age })}
              integer
              min={14}
              max={100}
              suffix="lat"
            />
            <NumberField
              label="Wzrost"
              value={draft.heightCm}
              onChange={(heightCm) => set({ heightCm })}
              integer
              min={120}
              max={230}
              suffix="cm"
            />
            <NumberField
              label="Waga na starcie"
              value={draft.startWeightKg}
              onChange={(startWeightKg) => set({ startWeightKg })}
              min={30}
              max={300}
              suffix="kg"
            />
            <NumberField
              label="Waga docelowa"
              value={draft.targetWeightKg}
              onChange={(targetWeightKg) => set({ targetWeightKg })}
              min={30}
              max={300}
              suffix="kg"
            />
            <label className="fld">
              <span>Start</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => e.target.value && set({ startDate: e.target.value })}
              />
            </label>
          </div>
          <p className="tight fd-diet-soft">
            Wzrost to ten sam, co w profilu treningowym — zapis zmienia go w obu miejscach.
          </p>
          <label className="fld fd-diet-field">
            <span>Aktywność (bez liczenia kroków)</span>
            <select
              value={draft.activityMultiplier}
              onChange={(e) => set({ activityMultiplier: Number(e.target.value) })}
            >
              {!activityKnown && (
                <option value={draft.activityMultiplier}>Własny współczynnik × {draft.activityMultiplier}</option>
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
              label="Kroki dziennie (plan)"
              value={draft.targetSteps}
              onChange={(targetSteps) => set({ targetSteps })}
              integer
              min={0}
              max={50000}
            />
          </div>
          <details className="why fd-diet-advanced">
            <summary>Zaawansowane (wartości z arkusza)</summary>
            <div className="fd-diet-grid2">
              <NumberField
                label="Kroki już w aktywności"
                value={draft.baseSteps}
                onChange={(baseSteps) => set({ baseSteps })}
                integer
                min={0}
                max={30000}
              />
              <NumberField
                label="kcal na 1000 kroków na kg"
                value={draft.kcalPer1000StepsPerKg}
                onChange={(kcalPer1000StepsPerKg) => set({ kcalPer1000StepsPerKg })}
                min={0}
                max={2}
              />
              <NumberField
                label="Dodatkowy wysiłek"
                value={draft.extraWeeklyKcal}
                onChange={(extraWeeklyKcal) => set({ extraWeeklyKcal })}
                integer
                min={0}
                max={20000}
                suffix="kcal/tydz."
              />
              <NumberField
                label="Energia w 1 kg masy"
                value={draft.kcalPerKg}
                onChange={(kcalPerKg) => set({ kcalPerKg })}
                integer
                min={3000}
                max={9000}
                suffix="kcal"
              />
            </div>
          </details>
        </section>

        <section className="grp" aria-labelledby="fd-diet-goal-title">
          <h2 id="fd-diet-goal-title">Cel kalorii</h2>
          <dl className="tiles fd-diet-energy">
            <div className="tile">
              <dt>Podstawowe spalanie (BMR)</dt>
              <dd>{formatNumber(base, 0)} kcal</dd>
            </div>
            <div className="tile">
              <dt>Spalanie dzienne (z krokami)</dt>
              <dd>{formatNumber(expenditure, 0)} kcal</dd>
            </div>
            <div className="tile">
              <dt>{expenditure >= draft.dailyKcal ? 'Deficyt' : 'Nadwyżka'}</dt>
              <dd>{formatNumber(Math.abs(expenditure - draft.dailyKcal), 0)} kcal/dzień</dd>
            </div>
            <div className="tile">
              <dt>Tempo</dt>
              <dd>{paceText(pace)}</dd>
              <dd className="fd-diet-soft">
                {reach ? `cel ok. ${formatDate(reach)}` : direction === 'keep' ? 'utrzymanie wagi' : 'cel poza zasięgiem'}
              </dd>
            </div>
          </dl>
          <p className="tight">
            Liczone dla wagi {formatNumber(weight, 1)} kg{isNew ? '' : ' (ostatnie ważenie)'}.
          </p>
          <div className="fd-diet-kcal-goal">
            <NumberField
              label="Dziennie"
              value={draft.dailyKcal}
              onChange={(dailyKcal) => set({ dailyKcal })}
              integer
              min={800}
              max={6000}
              suffix="kcal"
            />
          </div>
          <div className="chips" role="group" aria-label="Cel według tempa">
            {PACES.map((p) => {
              const kcal = Math.round(suggestedKcal(draft, weight, p) / 10) * 10;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={draft.dailyKcal === kcal}
                  onClick={() => set({ dailyKcal: kcal })}
                >
                  {p === 0 ? 'utrzymanie' : paceText(p)} · {formatNumber(kcal, 0)} kcal
                </button>
              );
            })}
          </div>
          {warnings.length > 0 && (
            <div className="dnote warn fd-diet-warnings">
              <b>Uwaga</b>
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
            <span>
              Dopasowuj cel do tygodnia: nadwyżka z wcześniejszych dni jest rozkładana na kolejne (najwyżej 10% celu
              dziennie), niedojedzone kalorie wracają.
            </span>
          </label>
        </section>

        <fieldset className="grp fd-diet-styles">
          <legend>Sposób odżywiania</legend>
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
                  <b className="fd-diet-yes">Tak:</b> {p.allows}
                </span>
                <span className="fd-diet-meta">
                  <b className="fd-diet-no">Unikaj:</b> {p.avoids}
                </span>
                <span className="fd-diet-meta fd-diet-nums">
                  Dziennie: B {t.protein.target} g · W {t.carbs.max !== null ? `do ${t.carbs.max}` : t.carbs.target} g ·
                  T {t.fat.target} g
                </span>
              </label>
            );
          })}
        </fieldset>

        <section className="grp" aria-labelledby="fd-diet-store-title">
          <h2 id="fd-diet-store-title">Sklep</h2>
          <label className="fld fd-diet-field">
            <span>Gdy nie znam sklepów w pobliżu, planuj pod:</span>
            <select
              value={draft.preferredStore ?? ''}
              onChange={(e) => set({ preferredStore: e.target.value || null })}
            >
              <option value="">dowolny sklep</option>
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
          <p className="tight">
            Sklepy w pobliżu z sekcji „W pobliżu” mają pierwszeństwo – odczytuję je z tego urządzenia, bez nowego
            wyszukiwania.
          </p>
        </section>

        <div className="fd-diet-savebar">
          <button type="submit" className="btn">
            {isNew ? 'Zapisz i zacznij' : 'Zapisz profil'}
          </button>
          <span role="status" className="fd-diet-saved">
            {saved && (
              <>
                <Check size={20} strokeWidth={2} aria-hidden /> Zapisano
              </>
            )}
          </span>
        </div>
      </form>
    </>
  );
}
