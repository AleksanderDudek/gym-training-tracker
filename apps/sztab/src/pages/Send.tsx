import { useMemo, useState } from 'react';
import { KINDS_BY_AREA, parseAssignment } from '@gymtracker/link';
import type { Area, AssignmentBody, AssignmentKind } from '@gymtracker/link';
import { BUILTIN } from '@gt/data/exercises';
import { GOAL_PLANS, PLANS } from '@gt/data/plans';
import { text } from '@gt/i18n';
import type { PlanTemplate, Workout } from '@gt/types';
import { bodyReady } from '../components/Editors';
import { Dialog, Loading, toast, useLoad } from '../components/ui';
import { listLibrary, sendAssignment } from '../lib/data';
import type { Connection, LibraryBody, LibraryItem } from '../lib/data';
import { L } from '../lib/labels';
import { useReady } from '../session';
import { BodyForm, emptyBody, libraryWorkouts } from './Library';

const T = text({
  pl: {
    title: 'Wyślij podopiecznemu',
    kind: 'Co wysyłasz',
    area: 'W obszarze',
    source: 'Skąd',
    fromLibrary: 'Z twojej biblioteki',
    fromGt: 'Gotowe w GYM TRACKERze',
    fresh: 'Napisz teraz',
    pick: 'Wybierz…',
    note: 'Komentarz (opcjonalnie)',
    send: 'Wyślij',
    sent: 'Wysłano. Podopieczny zobaczy to przy następnym otwarciu aplikacji.',
    invalid: 'Ta treść nie przejdzie sprawdzenia w aplikacji podopiecznego — uzupełnij ją.',
    failed: 'Nie udało się wysłać.',
    noneInLib: 'W bibliotece nie ma jeszcze nic tego rodzaju.',
    encrypted: 'Treść szyfruje się w tej przeglądarce kluczem współpracy. Serwer widzi tylko rodzaj i datę.',
  },
  en: {
    title: 'Send to client',
    kind: 'What you send',
    area: 'In area',
    source: 'From',
    fromLibrary: 'Your library',
    fromGt: 'Ready in GYM TRACKER',
    fresh: 'Write now',
    pick: 'Pick…',
    note: 'Comment (optional)',
    send: 'Send',
    sent: 'Sent. The client sees it next time they open the app.',
    invalid: 'This would not pass the check in the client’s app — please complete it.',
    failed: 'Could not send.',
    noneInLib: 'Nothing of this kind in the library yet.',
    encrypted: 'Content is encrypted in this browser with the collaboration key. The server sees only its kind and date.',
  },
});

const BUILTIN_PLANS: PlanTemplate[] = [...GOAL_PLANS, ...PLANS];

/** Treść z biblioteki zamieniona na zalecenie: plan dostaje treningi z biblioteki, do których odsyła. */
export function toAssignment(body: LibraryBody, library: LibraryItem[], note: string): AssignmentBody {
  switch (body.kind) {
    case 'workout':
      return { kind: 'workout', workout: body.workout, videos: body.videos, note };
    case 'plan': {
      const mine = library.flatMap((i) => (i.body.kind === 'workout' && body.plan.cycle.includes(i.body.workout.id) ? [i.body] : []));
      return {
        kind: 'plan',
        plan: body.plan,
        workouts: mine.map((w) => w.workout),
        videos: Object.assign({}, ...mine.map((w) => w.videos)) as Record<string, string>,
        note,
      };
    }
    default:
      return body;
  }
}

export function SendDialog({ connection, onClose, onSent, initialKind }: { connection: Connection; onClose: () => void; onSent: () => void; initialKind?: AssignmentKind }) {
  const { coach, key } = useReady();
  const lib = useLoad(listLibrary, []);
  const kinds = useMemo(() => [...new Set(connection.areas.flatMap((a) => KINDS_BY_AREA[a]))], [connection.areas]);
  const [kind, setKind] = useState<AssignmentKind>(initialKind && kinds.includes(initialKind) ? initialKind : kinds[0]!);
  const areasFor = (k: AssignmentKind): Area[] => connection.areas.filter((a) => KINDS_BY_AREA[a].includes(k));
  const [area, setArea] = useState<Area>(areasFor(kind)[0]!);
  const [source, setSource] = useState<'lib' | 'gt' | 'fresh'>('lib');
  const [pick, setPick] = useState('');
  const [fresh, setFresh] = useState<LibraryBody>(emptyBody(kind));
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = (lib.data ?? []).filter((i) => i.kind === kind);
  const hasGt = kind === 'workout' || kind === 'plan';

  const chooseKind = (k: AssignmentKind) => {
    setKind(k);
    setArea(areasFor(k)[0]!);
    setFresh(emptyBody(k));
    setPick('');
    setSource('lib');
  };

  const body = (): LibraryBody | null => {
    if (source === 'fresh') return fresh;
    if (source === 'lib') return items.find((i) => i.id === pick)?.body ?? null;
    if (kind === 'workout') {
      const w = BUILTIN.find((x) => x.id === pick);
      return w ? { kind: 'workout', workout: w, videos: {} } : null;
    }
    const p = BUILTIN_PLANS.find((x) => x.id === pick);
    return p ? { kind: 'plan', plan: { ...p, kind: 'own' } } : null;
  };

  const send = async () => {
    const b = body();
    if (!b || !bodyReady(b)) return setErr(T.invalid);
    const a = toAssignment(b, lib.data ?? [], note.trim());
    // To samo sprawdzenie, które zrobi telefon — lepiej odmówić tu niż wysłać coś, co tam przepadnie.
    if (!parseAssignment({ v: 1, id: 'check', area, sentAt: Date.now(), from: { name: coach.display_name, profession: coach.profession }, body: a }))
      return setErr(T.invalid);
    setBusy(true);
    setErr(null);
    try {
      await sendAssignment(key, coach, connection, area, a);
      toast(T.sent);
      onSent();
      onClose();
    } catch {
      setErr(T.failed);
    } finally {
      setBusy(false);
    }
  };

  const gtOptions: { id: string; name: string }[] = kind === 'workout' ? BUILTIN : kind === 'plan' ? BUILTIN_PLANS : [];
  const libraryW: Workout[] = libraryWorkouts(lib.data ?? []);

  return (
    <Dialog title={T.title} onClose={onClose} wide={source === 'fresh'}>
      <div className="stack">
        <span style={{ fontWeight: 600 }}>{T.kind}</span>
        <div className="row" role="radiogroup" aria-label={T.kind}>
          {kinds.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={`btn small ${kind === k ? 'blue' : 'ghost'}`} onClick={() => chooseKind(k)}>
              {L.kind[k]}
            </button>
          ))}
        </div>
      </div>
      {areasFor(kind).length > 1 ? (
        <label className="field">
          <span>{T.area}</span>
          <select id="send-area" value={area} onChange={(e) => setArea(e.target.value as Area)}>
            {areasFor(kind).map((a) => (
              <option key={a} value={a}>
                {L.area[a]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="stack">
        <span style={{ fontWeight: 600 }}>{T.source}</span>
        <div className="row" role="radiogroup" aria-label={T.source}>
          {((hasGt ? ['lib', 'gt', 'fresh'] : ['lib', 'fresh']) as ('lib' | 'gt' | 'fresh')[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={source === s}
              className={`btn small ${source === s ? 'blue' : 'ghost'}`}
              onClick={() => {
                setSource(s);
                setPick('');
              }}
            >
              {s === 'lib' ? T.fromLibrary : s === 'gt' ? T.fromGt : T.fresh}
            </button>
          ))}
        </div>
      </div>
      {source === 'lib' ? (
        !lib.data ? (
          <Loading />
        ) : items.length ? (
          <label className="field">
            <span className="sr">{T.fromLibrary}</span>
            <select id="send-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{T.pick}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="soft">{T.noneInLib}</p>
        )
      ) : null}
      {source === 'gt' ? (
        <label className="field">
          <span className="sr">{T.fromGt}</span>
          <select id="send-gt" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{T.pick}</option>
            {gtOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {source === 'fresh' ? <BodyForm body={fresh} onChange={setFresh} library={libraryW} /> : null}
      {kind === 'plan' || kind === 'workout' ? (
        <label className="field">
          <span>{T.note}</span>
          <textarea id="send-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      ) : null}
      <p className="small soft">{T.encrypted}</p>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button type="button" className="btn blue" disabled={busy} onClick={() => void send()}>
        {T.send}
      </button>
    </Dialog>
  );
}
