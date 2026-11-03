import { useEffect, useMemo, useState } from 'react';
import { ASSIGNMENT_KINDS } from '@gymtracker/link';
import type { AssignmentKind } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import type { Workout } from '@gt/types';
import {
  LabsForm,
  NoteForm,
  PlanForm,
  TargetsForm,
  WorkoutForm,
  bodyReady,
  bodyTitle,
  emptyLabs,
  emptyNote,
  emptyPlan,
  emptyTargets,
  emptyWorkout,
} from '../components/Editors';
import { Failure, Link, Loading, fmtDate, toast, useLoad } from '../components/ui';
import { deleteLibraryItem, listLibrary, saveLibraryItem } from '../lib/data';
import type { LibraryBody, LibraryItem } from '../lib/data';
import { L } from '../lib/labels';
import { navigate } from '../lib/router';
import { useReady } from '../session';

const T = text({
  pl: {
    title: 'Biblioteka',
    lead: 'Twoje treningi, plany i gotowe zalecenia. Składasz je z atlasu GYM TRACKERa i wysyłasz podopiecznym jednym kliknięciem.',
    new: 'Nowy',
    all: 'Wszystko',
    updated: 'Zmieniony',
    emptyTitle: 'Biblioteka jest pusta',
    emptyText: 'Zacznij od treningu: wybierasz ćwiczenia z atlasu 114 ćwiczeń, a doradca mówi, czego brakuje.',
    save: 'Zapisz',
    saved: 'Zapisano',
    remove: 'Usuń z biblioteki',
    removed: 'Usunięto',
    sure: 'Na pewno usunąć? Wysłane już zalecenia zostają u podopiecznych.',
    yes: 'Tak, usuń',
    no: 'Nie',
    back: 'Biblioteka',
    titleField: 'Nazwa w bibliotece',
    untitled: 'Bez nazwy',
    notReady: 'Uzupełnij nazwę i treść, zanim zapiszesz.',
    copyOf: (s: string) => `${s} (kopia)`,
    duplicate: 'Duplikuj',
    sum: {
      ex: (n: number) => `${n} ćw.`,
      videos: (n: number) => `${n} wideo`,
      plan: (w: number, d: number, c: number) => `${w} tyg. · ${d}× w tygodniu · ${c} tren.`,
      kcal: (n: number) => `${n} kcal`,
      protein: (n: number) => `${n} g białka`,
      steps: (n: number) => `${n} kroków`,
    },
  },
  en: {
    title: 'Library',
    lead: 'Your workouts, plans and ready advice. You build them from the GYM TRACKER atlas and send them to clients in one click.',
    new: 'New',
    all: 'All',
    updated: 'Updated',
    emptyTitle: 'The library is empty',
    emptyText: 'Start with a workout: pick exercises from the 114-exercise atlas and the advisor tells you what is missing.',
    save: 'Save',
    saved: 'Saved',
    remove: 'Delete from library',
    removed: 'Deleted',
    sure: 'Delete it? Advice already sent stays with your clients.',
    yes: 'Yes, delete',
    no: 'No',
    back: 'Library',
    titleField: 'Name in the library',
    untitled: 'Untitled',
    notReady: 'Add a name and content before saving.',
    copyOf: (s: string) => `${s} (copy)`,
    duplicate: 'Duplicate',
    sum: {
      ex: (n: number) => `${n} exercises`,
      videos: (n: number) => `${n} videos`,
      plan: (w: number, d: number, c: number) => `${w} wk · ${d}× a week · ${c} workouts`,
      kcal: (n: number) => `${n} kcal`,
      protein: (n: number) => `${n} g protein`,
      steps: (n: number) => `${n} steps`,
    },
  },
});

export const libraryWorkouts = (items: LibraryItem[]): Workout[] =>
  items.flatMap((i) => (i.body.kind === 'workout' ? [i.body.workout] : []));

export function Library() {
  const { data, error, reload } = useLoad(listLibrary, []);
  const [kind, setKind] = useState<AssignmentKind | 'all'>('all');
  const rows = (data ?? []).filter((i) => kind === 'all' || i.kind === kind);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{T.title}</h1>
          <p className="lead">{T.lead}</p>
        </div>
        <div className="row">
          {ASSIGNMENT_KINDS.map((k) => (
            <Link key={k} to={`/biblioteka/nowy/${k}`} className={`btn ${k === 'workout' ? 'blue' : 'ghost'} small`}>
              + {L.kind[k]}
            </Link>
          ))}
        </div>
      </div>
      {error ? <Failure error={error} retry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && !data.length ? (
        <section className="card empty">
          <h3>{T.emptyTitle}</h3>
          <p>{T.emptyText}</p>
          <Link to="/biblioteka/nowy/workout" className="btn blue">
            + {L.kind.workout}
          </Link>
        </section>
      ) : null}
      {data?.length ? (
        <section className="card flat">
          <div className="tabs" style={{ padding: '4px 12px 0' }}>
            {(['all', ...ASSIGNMENT_KINDS] as const).map((k) => (
              <a
                key={k}
                href="#"
                aria-current={kind === k ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setKind(k);
                }}
              >
                {k === 'all' ? T.all : L.kind[k]}
                <span className="count">{k === 'all' ? data.length : data.filter((i) => i.kind === k).length}</span>
              </a>
            ))}
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="link" onClick={() => navigate(`/biblioteka/${i.id}`)}>
                    <td>
                      <a
                        href={`/biblioteka/${i.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/biblioteka/${i.id}`);
                        }}
                      >
                        <strong>{i.title}</strong>
                      </a>
                      <div className="small soft">{summary(i.body)}</div>
                    </td>
                    <td className="small">{L.kind[i.kind]}</td>
                    <td className="small soft n">{fmtDate(i.updatedAt, LOCALE)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function summary(b: LibraryBody): string {
  switch (b.kind) {
    case 'workout': {
      const v = Object.keys(b.videos).length;
      return [T.sum.ex(b.workout.items.length), v ? T.sum.videos(v) : ''].filter(Boolean).join(' · ');
    }
    case 'plan':
      return T.sum.plan(b.plan.weeks, b.plan.weekdays.length, b.plan.cycle.length);
    case 'targets':
      return [b.kcal && T.sum.kcal(b.kcal), b.protein && T.sum.protein(b.protein), b.steps && T.sum.steps(b.steps)].filter(Boolean).join(' · ');
    case 'labs':
      return b.tests.map((t) => t.name).filter(Boolean).join(', ');
    case 'note':
      return b.text.slice(0, 90);
  }
}

export function emptyBody(kind: AssignmentKind): LibraryBody {
  switch (kind) {
    case 'workout':
      return emptyWorkout();
    case 'plan':
      return emptyPlan();
    case 'targets':
      return emptyTargets();
    case 'labs':
      return emptyLabs();
    case 'note':
      return emptyNote();
  }
}

export function BodyForm({ body, onChange, library }: { body: LibraryBody; onChange: (b: LibraryBody) => void; library: Workout[] }) {
  switch (body.kind) {
    case 'workout':
      return <WorkoutForm value={body} onChange={onChange} />;
    case 'plan':
      return <PlanForm value={body} onChange={onChange} library={library} />;
    case 'targets':
      return <TargetsForm value={body} onChange={onChange} />;
    case 'labs':
      return <LabsForm value={body} onChange={onChange} />;
    case 'note':
      return <NoteForm value={body} onChange={onChange} />;
  }
}

export function LibraryEditor({ id, kind }: { id?: string; kind?: string }) {
  const { coach } = useReady();
  const lib = useLoad(listLibrary, []);
  const existing = useMemo(() => lib.data?.find((i) => i.id === id), [lib.data, id]);
  const [body, setBody] = useState<LibraryBody | null>(null);
  const [title, setTitle] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (body) return;
    if (existing) {
      setBody(existing.body);
      setTitle(existing.title);
    } else if (kind && (ASSIGNMENT_KINDS as readonly string[]).includes(kind)) setBody(emptyBody(kind as AssignmentKind));
  }, [existing, kind, body]);

  if (lib.error) return <Failure error={lib.error} retry={lib.reload} />;
  if (!body) return <Loading />;

  const library = libraryWorkouts(lib.data ?? []).filter((w) => body.kind !== 'workout' || w.id !== body.workout.id);
  const named = body.kind === 'workout' || body.kind === 'plan' || body.kind === 'note';

  const save = async (asCopy = false) => {
    if (!bodyReady(body)) return setErr(T.notReady);
    setErr(null);
    const t = named ? bodyTitle(body, T.untitled) : title.trim() || L.kind[body.kind];
    const b: LibraryBody = asCopy
      ? body.kind === 'workout'
        ? { ...body, workout: { ...body.workout, id: `w-${crypto.randomUUID().slice(0, 8)}`, name: T.copyOf(body.workout.name) } }
        : body.kind === 'plan'
          ? { ...body, plan: { ...body.plan, id: `p-${crypto.randomUUID().slice(0, 8)}`, name: T.copyOf(body.plan.name) } }
          : body
      : body;
    const saved = await saveLibraryItem(coach.id, { id: asCopy ? undefined : existing?.id, title: asCopy ? T.copyOf(t) : t, body: b });
    toast(T.saved);
    navigate(`/biblioteka/${saved.id}`, { replace: !existing });
    if (asCopy) {
      setBody(saved.body);
      setTitle(saved.title);
    }
    lib.reload();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/biblioteka" className="crumb">
            ← {T.back}
          </Link>
          <h1 style={{ marginTop: 6 }}>{existing ? existing.title : L.kind[body.kind]}</h1>
        </div>
        <div className="row">
          {existing ? (
            <button type="button" className="btn ghost" onClick={() => void save(true)}>
              {T.duplicate}
            </button>
          ) : null}
          <button type="button" className="btn blue" onClick={() => void save()}>
            {T.save}
          </button>
        </div>
      </div>
      <section className="card">
        {!named ? (
          <label className="field">
            <span>{T.titleField}</span>
            <input id="lib-title" type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        ) : null}
        <BodyForm body={body} onChange={setBody} library={library} />
        {err ? <p className="err" role="alert">{err}</p> : null}
      </section>
      {existing ? (
        <section className="row">
          {confirm ? (
            <>
              <span>{T.sure}</span>
              <button
                type="button"
                className="btn danger"
                onClick={() =>
                  void deleteLibraryItem(existing.id).then(() => {
                    toast(T.removed);
                    navigate('/biblioteka', { replace: true });
                  })
                }
              >
                {T.yes}
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>
                {T.no}
              </button>
            </>
          ) : (
            <button type="button" className="btn danger" onClick={() => setConfirm(true)}>
              {T.remove}
            </button>
          )}
        </section>
      ) : null}
    </>
  );
}
