import { FlaskConical, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { text } from '../../../i18n';
import { Segmented } from '../../../components/ui';
import { useBridge } from '../../bridge';
import type { Sex } from '../../diet/types';
import { useClock, useProfile } from '../../hooks/useDiet';
import { useUrlState } from '../../hooks/useUrlState';
import { assess, PREGNANCY_NOTE } from '../../labs/assess';
import { deleteReport, habitWeek, loadPrefs, loadReports, savePrefs } from '../../labs/store';
import type { LabReport } from '../../labs/types';
import { latestValues } from '../../labs/verdict';
import { Loading } from '../diet/Onboarding';
import { NumberField } from '../diet/NumberField';
import { AddSheet } from './AddSheet';
import { DietView } from './DietView';
import { GuideView } from './GuideView';
import { ResultsView } from './ResultsView';
import './labs.css';

const T = text({
  pl: {
    title: 'Dieta pod wyniki badań',
    lead: 'Wgraj wyniki krwi lub moczu, a ułożę dietę pod to, czego brakuje — z produktami, przepisami i datą badania kontrolnego.',
    ways: [
      'PDF z laboratorium (np. z konta pacjenta Diagnostyki)',
      'zdjęcie albo zrzut ekranu wydruku z przychodni',
      'tekst skopiowany z portalu lub wpisane ręcznie',
    ],
    private: 'Wszystko zostaje na tym urządzeniu — plik i zdjęcie czyta telefon, bez wysyłania.',
    add: 'Dodaj wyniki',
    views: 'Widok',
    diet: 'Dieta',
    results: 'Wyniki',
    guide: 'Co zbadać',
    who: 'Do zakresów norm',
    whoLead: 'Normy różnią się dla kobiet i mężczyzn, a eGFR liczy się z wieku. Bez profilu diety zapytam tu.',
    woman: 'Kobieta',
    man: 'Mężczyzna',
    age: 'Wiek',
    sex: 'Płeć',
    disclaimer:
      'To informacje, nie diagnoza ani leczenie. Zakresy dotyczą dorosłych; w ciąży i u dzieci są inne. Wyniki zawsze omów z lekarzem, a zmiany w lekach i suplementach — z lekarzem lub farmaceutą.',
    deleted: 'Usunięto badanie.',
    saved: 'Zapisano wyniki.',
    failed: 'Nie udało się zapisać.',
  },
  en: {
    title: 'A diet for your lab results',
    lead: 'Add your blood or urine results and I will build a diet for what is short — with foods, recipes and a retest date.',
    ways: [
      'a PDF from the lab (e.g. a Diagnostyka patient account)',
      'a photo or screenshot of a clinic printout',
      'text copied from a portal, or typed in',
    ],
    private: 'Everything stays on this device — the phone reads the file and the photo, nothing is sent.',
    add: 'Add results',
    views: 'View',
    diet: 'Diet',
    results: 'Results',
    guide: 'What to test',
    who: 'For the ranges',
    whoLead: 'Ranges differ for women and men, and eGFR depends on age. Without a diet profile, I ask here.',
    woman: 'Woman',
    man: 'Man',
    age: 'Age',
    sex: 'Sex',
    disclaimer:
      'This is information, not a diagnosis or treatment. Ranges are for adults; they differ in pregnancy and for children. Always discuss results with a doctor, and changes to medicines and supplements with a doctor or pharmacist.',
    deleted: 'Test deleted.',
    saved: 'Results saved.',
    failed: 'Could not save.',
  },
});

type View = 'dieta' | 'wyniki' | 'co-zbadac';

interface LabsState {
  view: View | null;
  add: boolean;
  edit: number | null;
  open: string | null;
}

const VIEWS: readonly View[] = ['dieta', 'wyniki', 'co-zbadac'];

function read(params: URLSearchParams): LabsState {
  const view = params.get('widok');
  const edit = Number(params.get('edytuj'));
  return {
    view: VIEWS.includes(view as View) ? (view as View) : null,
    add: params.get('dodaj') === '1',
    edit: Number.isInteger(edit) && edit > 0 ? edit : null,
    open: params.get('wynik') || null,
  };
}

function write(state: LabsState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view) params.set('widok', state.view);
  if (state.add) params.set('dodaj', '1');
  if (state.edit) params.set('edytuj', String(state.edit));
  if (state.open) params.set('wynik', state.open);
  return params;
}

export default function LabsPage() {
  const profile = useProfile();
  const { date: today } = useClock();
  const bridge = useBridge();
  const reports = useLiveQuery(loadReports);
  const prefs = useLiveQuery(loadPrefs);
  const habits = useLiveQuery(() => habitWeek(today), [today]);
  const [state, update, closeEntry] = useUrlState(read, write);
  // A new sheet each time it opens: the review never starts from the last one's rows.
  const [sheetKey, setSheetKey] = useState(0);

  const sex: Sex | null = profile?.sex ?? prefs?.sex ?? null;
  const age = profile?.age ?? prefs?.age ?? null;
  const person = useMemo(
    () =>
      sex && prefs
        ? {
            sex,
            age,
            pregnancy: !!profile?.pregnancy,
            eats: prefs.eats,
            lowCarb: profile?.dietProfile === 'keto' || profile?.dietProfile === 'lowcarb',
          }
        : null,
    [sex, age, prefs, profile],
  );
  const latest = useMemo(() => (reports && person ? latestValues(reports, person) : new Map()), [reports, person]);
  const assessment = useMemo(() => (person ? assess(latest, person) : null), [latest, person]);

  if (profile === undefined || reports === undefined || prefs === undefined) return <Loading />;

  const fail = (e: unknown) => {
    console.error(e);
    bridge.toast(T.failed);
  };
  const view: View = state.view ?? (reports.length ? 'dieta' : 'co-zbadac');
  const editing = state.edit ? (reports.find((r) => r.id === state.edit) ?? null) : null;
  const sheetOpen = state.add || !!editing;
  const openAdd = () => {
    setSheetKey((k) => k + 1);
    update({ add: true, edit: null }, { push: true });
  };
  const onEdit = (r: LabReport) => {
    setSheetKey((k) => k + 1);
    update({ edit: r.id ?? null, add: false }, { push: true });
  };
  const onPerson = (found: { sex: Sex | null; birthYear: number | null }) => {
    if (profile || prefs.sex) return;
    const years = found.birthYear ? Number(today.slice(0, 4)) - found.birthYear : null;
    // Only what the header says: a found sex never wipes an age typed in by hand.
    const patch = {
      ...(found.sex && { sex: found.sex }),
      ...(years !== null && years >= 18 && years <= 110 && prefs.age === null && { age: years }),
    };
    if (Object.keys(patch).length) void savePrefs(patch).catch(fail);
  };

  return (
    <>
      <section className="grp fd-lab-head" aria-labelledby="fd-lab-title">
        <h2 id="fd-lab-title">
          <FlaskConical aria-hidden="true" size={18} /> {T.title}
        </h2>
        {!reports.length && (
          <>
            <p className="tight">{T.lead}</p>
            <ul className="fd-lab-list">
              {T.ways.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="tight">{T.private}</p>
          </>
        )}
        <button type="button" className="btn" onClick={openAdd}>
          <Plus aria-hidden="true" size={18} /> {T.add}
        </button>
      </section>

      {!profile && (!prefs.sex || prefs.age === null) && (
        <section className="grp" aria-labelledby="fd-lab-who">
          <h2 id="fd-lab-who">{T.who}</h2>
          <p className="tight">{T.whoLead}</p>
          <div className="fd-lab-who">
            <span className="seg-label">{T.sex}</span>
            <Segmented<Sex>
              label={T.sex}
              value={prefs.sex ?? ('' as Sex)}
              options={[
                { key: 'K', label: T.woman },
                { key: 'M', label: T.man },
              ]}
              onChange={(s) => void savePrefs({ sex: s }).catch(fail)}
            />
            <NumberField label={T.age} value={prefs.age ?? 30} min={18} max={110} integer onChange={(a) => void savePrefs({ age: a }).catch(fail)} />
          </div>
        </section>
      )}

      {reports.length > 0 && (
        <div className="wrap fd-lab-views">
          <Segmented<View>
            label={T.views}
            value={view}
            options={[
              { key: 'dieta', label: T.diet },
              { key: 'wyniki', label: T.results },
              { key: 'co-zbadac', label: T.guide },
            ]}
            onChange={(v) => update({ view: v })}
          />
        </div>
      )}

      {profile?.pregnancy && (
        <p className="wrap banner" role="note">
          {PREGNANCY_NOTE}
        </p>
      )}

      {person && assessment && reports.length > 0 && view === 'dieta' && (
        <DietView assessment={assessment} person={person} plan={prefs.plan} reports={reports} today={today} habits={habits} onToast={bridge.toast} />
      )}
      {person && reports.length > 0 && view === 'wyniki' && (
        <ResultsView
          reports={reports}
          latest={latest}
          sex={person.sex}
          open={state.open}
          onOpen={(open) => update({ open })}
          onEdit={onEdit}
          onDelete={(r) =>
            void deleteReport(r.id!).then(
              () => bridge.toast(T.deleted),
              (e: unknown) => fail(e),
            )
          }
        />
      )}
      {view === 'co-zbadac' && <GuideView latest={latest} today={today} missing={assessment?.missing ?? []} />}

      <p className="wrap disclaimer">{T.disclaimer}</p>

      {sheetOpen && (
        <AddSheet
          key={sheetKey}
          open
          today={today}
          sex={sex}
          edit={editing}
          onClose={() => closeEntry({ add: false, edit: null })}
          onPerson={onPerson}
          onSaved={() => {
            bridge.toast(T.saved);
            closeEntry({ add: false, edit: null });
          }}
        />
      )}
    </>
  );
}
