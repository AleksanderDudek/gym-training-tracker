import { useCallback, useMemo, useState } from 'react';
import { KINDS_BY_AREA, shortPseudonym } from '@gymtracker/link';
import type { Area, AssignmentBody, AssignmentKind } from '@gymtracker/link';
import { BUILTIN } from '@gt/data/exercises';
import { GOAL_PLANS, PLANS } from '@gt/data/plans';
import { text } from '@gt/i18n';
import type { PlanTemplate, Workout } from '@gt/types';
import { bodyReady } from '../components/Editors';
import { Dialog, Loading, toast, useLoad } from '../components/ui';
import { loadAliases } from '../lib/aliases';
import { passesCheck, toAssignment } from '../lib/assign';
import { listLibrary, sendAssignment } from '../lib/data';
import type { Connection, LibraryBody } from '../lib/data';
import { L } from '../lib/labels';
import { canNotify } from '../lib/notify';
import {
  DEFAULT_TIME,
  MAX_AHEAD_DAYS,
  addLocalDays,
  batchAreas,
  dateIssue,
  fmtCalendarDay,
  fmtWhen,
  planRecipients,
  scheduleAt,
  today,
  tomorrow,
} from '../lib/program';
import type { DateIssue, ScheduleError } from '../lib/program';
import { forgetReview } from '../lib/reviewLoad';
import { useReady } from '../session';
import { BodyForm, emptyBody, libraryWorkouts } from './Library';
import '../components/schedule.css';

export { toAssignment } from '../lib/assign';

const T = text({
  pl: {
    title: 'Wyślij podopiecznemu',
    titleMany: (n: number) => `Wyślij ${n} podopiecznym`,
    kind: 'Co wysyłasz',
    area: 'W obszarze',
    source: 'Skąd',
    fromLibrary: 'Z twojej biblioteki',
    fromGt: 'Gotowe w GYM TRACKERze',
    fresh: 'Napisz teraz',
    pick: 'Wybierz…',
    note: 'Komentarz (opcjonalnie)',
    send: 'Wyślij',
    sendMany: (n: number) => `Wyślij do ${n}`,
    planMany: (n: number) => `Zaplanuj dla ${n}`,
    plan: 'Zaplanuj',
    sent: 'Wysłano. Podopieczny zobaczy to przy następnym otwarciu aplikacji.',
    sentNotified: 'Wysłano. Podopieczny dostanie powiadomienie.',
    notifyYes: 'Podopieczny dostanie powiadomienie na telefon (bez treści).',
    notifyNo: 'Bez powiadomienia na telefon — podopieczny zobaczy to przy następnym otwarciu aplikacji.',
    notifyMany: (n: number, total: number) =>
      n === total
        ? 'Wszyscy odbiorcy dostaną powiadomienie na telefon (bez treści).'
        : n === 0
          ? 'Bez powiadomień na telefon — odbiorcy zobaczą to przy następnym otwarciu aplikacji.'
          : `Powiadomienie na telefon: ${n} z ${total}. Pozostali zobaczą to przy następnym otwarciu aplikacji.`,
    scheduled: (w: string) => `Zaplanowano na ${w}. Wcześniej podopieczny tego nie zobaczy.`,
    invalid: 'Ta treść nie przejdzie sprawdzenia w aplikacji podopiecznego — uzupełnij ją.',
    failed: 'Nie udało się wysłać.',
    noneInLib: 'W bibliotece nie ma jeszcze nic tego rodzaju.',
    encrypted: 'Treść szyfruje się w tej przeglądarce kluczem współpracy. Serwer widzi tylko rodzaj i datę.',
    encryptedMany: 'Każdy podopieczny dostaje osobny szyfrogram swoim kluczem współpracy. Serwer widzi tylko rodzaj i datę.',
    when: 'Kiedy',
    now: 'Teraz',
    later: 'Zaplanuj',
    day: 'Dzień',
    time: 'Godzina',
    laterHint: 'Podopieczny dostanie to dopiero o tej porze — wcześniej nic nie zobaczy. Do tego czasu możesz to anulować w zakładce Zalecenia.',
    whenErr: {
      invalid: 'Wpisz dzień i godzinę.',
      past: 'Ta chwila już minęła — wybierz późniejszą.',
      far: 'Zaplanować można najwyżej rok naprzód.',
    } as Record<ScheduleError, string>,
    recipients: (n: number) => `Odbiorcy (${n})`,
    why: {
      ended: 'współpraca zakończona',
      kind: (k: string, areas: string) => `„${k}” nie pasuje do obszarów: ${areas}`,
      invalid: 'treść nie przejdzie sprawdzenia w tym obszarze',
      failed: 'błąd wysyłki',
    },
    nobody: 'Nikt z zaznaczonych nie może dostać tego rodzaju.',
    progress: (d: number, n: number) => `Wysyłam ${d} z ${n}…`,
    summary: (d: number, n: number) => `Wysłano do ${d} z ${n}.`,
    summaryLater: (d: number, n: number, w: string) => `Zaplanowano dla ${d} z ${n} na ${w}.`,
    skipped: 'Pominięto',
    failedList: 'Nie udało się',
    close: 'Zamknij',
    retry: 'Ponów nieudane',
    wait: 'Okno zamknie się dopiero po wysyłce.',
    batchArea: 'Obszar dla podopiecznych z kilkoma obszarami',
    batchAreaHint: 'Kto nie ma tego obszaru, dostanie to w swoim pierwszym pasującym — obszar każdego widać na liście odbiorców.',
    release: (day: string) => (day === today() ? 'dziś' : fmtCalendarDay(day)),
    expired: (until: string, when: string) =>
      `Ta lista nawyków kończy się ${until}, a podopieczny dostanie ją ${when} — żaden punkt już wtedy nie obowiązuje. Zmień datę końca albo wyślij wcześniej.`,
    started: (start: string, when: string, n: number) =>
      `Jadłospis ma stały start ${start}. Podopieczny dostanie go ${when} i zacznie od dnia ${n} cyklu, nie od pierwszego. Jeśli ma zacząć od początku, usuń datę startu.`,
  },
  en: {
    title: 'Send to client',
    titleMany: (n: number) => `Send to ${n} clients`,
    kind: 'What you send',
    area: 'In area',
    source: 'From',
    fromLibrary: 'Your library',
    fromGt: 'Ready in GYM TRACKER',
    fresh: 'Write now',
    pick: 'Pick…',
    note: 'Comment (optional)',
    send: 'Send',
    sendMany: (n: number) => `Send to ${n}`,
    planMany: (n: number) => `Schedule for ${n}`,
    plan: 'Schedule',
    sent: 'Sent. The client sees it next time they open the app.',
    sentNotified: 'Sent. The client gets a notification.',
    notifyYes: 'The client gets a phone notification (without the content).',
    notifyNo: 'No phone notification — the client sees it next time they open the app.',
    notifyMany: (n: number, total: number) =>
      n === total
        ? 'All recipients get a phone notification (without the content).'
        : n === 0
          ? 'No phone notifications — recipients see it next time they open the app.'
          : `Phone notification: ${n} of ${total}. The rest see it next time they open the app.`,
    scheduled: (w: string) => `Scheduled for ${w}. The client will not see it before then.`,
    invalid: 'This would not pass the check in the client’s app — please complete it.',
    failed: 'Could not send.',
    noneInLib: 'Nothing of this kind in the library yet.',
    encrypted: 'Content is encrypted in this browser with the collaboration key. The server sees only its kind and date.',
    encryptedMany: 'Each client gets a separate ciphertext under their own collaboration key. The server sees only its kind and date.',
    when: 'When',
    now: 'Now',
    later: 'Schedule',
    day: 'Day',
    time: 'Time',
    laterHint: 'The client gets it only at that time — nothing shows up before. Until then you can cancel it in the Advice tab.',
    whenErr: {
      invalid: 'Enter a day and a time.',
      past: 'That moment has passed — pick a later one.',
      far: 'You can schedule at most a year ahead.',
    } as Record<ScheduleError, string>,
    recipients: (n: number) => `Recipients (${n})`,
    why: {
      ended: 'collaboration ended',
      kind: (k: string, areas: string) => `“${k}” does not fit the areas: ${areas}`,
      invalid: 'content would not pass the check in this area',
      failed: 'sending failed',
    },
    nobody: 'None of the selected clients can receive this kind.',
    progress: (d: number, n: number) => `Sending ${d} of ${n}…`,
    summary: (d: number, n: number) => `Sent to ${d} of ${n}.`,
    summaryLater: (d: number, n: number, w: string) => `Scheduled for ${d} of ${n} at ${w}.`,
    skipped: 'Skipped',
    failedList: 'Failed',
    close: 'Close',
    retry: 'Retry failed',
    wait: 'The window closes only after sending.',
    batchArea: 'Area for clients with several areas',
    batchAreaHint: 'Clients without this area get it in their first matching one — each client’s area is shown in the recipient list.',
    release: (day: string) => (day === today() ? 'today' : fmtCalendarDay(day)),
    expired: (until: string, when: string) =>
      `This habit list ends on ${until}, but the client gets it ${when} — no item applies by then. Change the end date or send it earlier.`,
    started: (start: string, when: string, n: number) =>
      `The meal plan has a fixed start on ${start}. The client gets it ${when} and begins on cycle day ${n}, not day 1. To start from the beginning, remove the start date.`,
  },
});

const BUILTIN_PLANS: PlanTemplate[] = [...GOAL_PLANS, ...PLANS];

type Outcome = { c: Connection; why: string };

interface Result {
  sent: Connection[];
  /** Nieudani z obszarem — „Ponów nieudane” wysyła tylko do nich. */
  failed: (Outcome & { area: Area })[];
  skipped: Outcome[];
  total: number;
  at: Date | null;
  /** Treść, która poszła — ta sama idzie przy ponowieniu. */
  body: AssignmentBody;
}

/** „Kiedy”: teraz albo w wybranym dniu o godzinie (czas przeglądarki prowadzącego). */
export function WhenField({
  when,
  day,
  time,
  onChange,
}: {
  when: 'now' | 'later';
  day: string;
  time: string;
  onChange: (v: { when: 'now' | 'later'; day: string; time: string }) => void;
}) {
  return (
    <div className="stack">
      <span style={{ fontWeight: 600 }}>{T.when}</span>
      <div className="row" role="radiogroup" aria-label={T.when}>
        {(['now', 'later'] as const).map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={when === w}
            className={`btn small ${when === w ? 'blue' : 'ghost'}`}
            onClick={() => onChange({ when: w, day, time })}
          >
            {w === 'now' ? T.now : T.later}
          </button>
        ))}
      </div>
      {when === 'later' ? (
        <>
          <div className="sz-sched-when">
            <label className="field">
              <span>{T.day}</span>
              <input
                id="send-day"
                type="date"
                min={today()}
                max={addLocalDays(today(), MAX_AHEAD_DAYS)}
                value={day}
                onChange={(e) => onChange({ when, day: e.target.value, time })}
              />
            </label>
            <label className="field">
              <span>{T.time}</span>
              <input id="send-time" type="time" value={time} onChange={(e) => onChange({ when, day, time: e.target.value })} />
            </label>
          </div>
          <p className="small soft">{T.laterHint}</p>
        </>
      ) : null}
    </div>
  );
}

export function SendDialog({
  connection,
  recipients,
  onClose,
  onSent,
  initialKind,
}: {
  connection: Connection;
  /**
   * Kontrakt rdzenia (spec 2026-11-25): wysyłka do wielu — wszyscy zaznaczeni, `connection` pierwszy.
   * Każdy dostaje własny szyfrogram swoim kluczem współpracy. Bez listy — tylko `connection`.
   */
  recipients?: Connection[];
  onClose: () => void;
  onSent: () => void;
  initialKind?: AssignmentKind;
}) {
  const { coach, key, user } = useReady();
  const lib = useLoad(listLibrary, []);
  const multi = (recipients?.length ?? 0) > 1;
  const targets = useMemo(() => (multi ? recipients! : [connection]), [multi, recipients, connection]);
  const kinds = useMemo(() => [...new Set(targets.flatMap((c) => c.areas.flatMap((a) => KINDS_BY_AREA[a])))], [targets]);
  const [kind, setKind] = useState<AssignmentKind>(initialKind && kinds.includes(initialKind) ? initialKind : kinds[0]!);
  const areasFor = (k: AssignmentKind): Area[] => connection.areas.filter((a) => KINDS_BY_AREA[a].includes(k));
  const [area, setArea] = useState<Area>(areasFor(kind)[0] ?? connection.areas[0]!);
  const [source, setSource] = useState<'lib' | 'gt' | 'fresh'>('lib');
  const [pick, setPick] = useState('');
  const [fresh, setFresh] = useState<LibraryBody>(emptyBody(kind));
  const [note, setNote] = useState('');
  const [sched, setSched] = useState<{ when: 'now' | 'later'; day: string; time: string }>(() => ({ when: 'now', day: tomorrow(), time: DEFAULT_TIME }));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [prefer, setPrefer] = useState<Area | null>(null);
  const aliases = useMemo(() => (multi ? loadAliases(user.id) : {}), [multi, user.id]);
  // W trakcie wysyłki okno się nie zamyka (Escape, tło, ×): pętla i podsumowanie zostają.
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  const items = (lib.data ?? []).filter((i) => i.kind === kind);
  const hasGt = kind === 'workout' || kind === 'plan';
  // Obszar wybierany raz dla całej partii — tylko gdy ktoś może dostać ten rodzaj w kilku obszarach.
  const areaChoices = useMemo(() => (multi ? batchAreas(targets, [kind]) : []), [multi, targets, kind]);
  const batchArea = prefer && areaChoices.includes(prefer) ? prefer : (areaChoices[0] ?? null);
  const plan = useMemo(() => planRecipients(targets, kind, batchArea), [targets, kind, batchArea]);
  const whyKind = (c: Connection) => T.why.kind(L.kind[kind], c.areas.map((a) => L.area[a]).join(', '));
  const skipWhy = (s: (typeof plan.skip)[number]) => (s.reason === 'ended' ? T.why.ended : whyKind(s.c));

  const chooseKind = (k: AssignmentKind) => {
    setKind(k);
    setArea(areasFor(k)[0] ?? area);
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
    if (!b || b.kind === 'program' || !bodyReady(b)) return setErr(T.invalid);
    let visibleFrom: Date | null = null;
    if (sched.when === 'later') {
      const s = scheduleAt(sched.day, sched.time);
      if ('error' in s) return setErr(T.whenErr[s.error]);
      visibleFrom = s.at;
    }
    const a = toAssignment(b, lib.data ?? [], note.trim());

    if (!multi) {
      // To samo sprawdzenie, które zrobi telefon — lepiej odmówić tu niż wysłać coś, co tam przepadnie.
      if (!passesCheck(coach, area, a)) return setErr(T.invalid);
      setBusy(true);
      setErr(null);
      try {
        await sendAssignment(key, coach, connection, area, a, { visibleFrom });
        forgetReview(key, connection.id);
        toast(visibleFrom ? T.scheduled(fmtWhen(visibleFrom)) : canNotify(connection) ? T.sentNotified : T.sent);
        onSent();
        onClose();
      } catch {
        setErr(T.failed);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Wielu odbiorców: po kolei, każdy w swoim obszarze i swoim kluczem.
    const skipped: Outcome[] = plan.skip.map((s) => ({ c: s.c, why: skipWhy(s) }));
    const go = plan.send.filter((r) => {
      if (passesCheck(coach, r.area, a)) return true;
      skipped.push({ c: r.c, why: T.why.invalid });
      return false;
    });
    if (!go.length) return setErr(plan.send.length ? T.invalid : T.nobody);
    setErr(null);
    const out: Result = { sent: [], failed: [], skipped, total: plan.send.length + plan.skip.length, at: visibleFrom, body: a };
    await sendTo(go, a, visibleFrom, out);
    setResult({ ...out });
  };

  /** Po kolei, każdy w swoim obszarze i swoim kluczem; nieudani trafiają do `out.failed`. */
  const sendTo = async (list: { c: Connection; area: Area }[], a: AssignmentBody, visibleFrom: Date | null, out: Result) => {
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let done = 0;
    for (const r of list) {
      try {
        await sendAssignment(key, coach, r.c, r.area, a, { visibleFrom });
        out.sent.push(r.c);
        forgetReview(key, r.c.id);
      } catch {
        out.failed.push({ c: r.c, area: r.area, why: T.why.failed });
      }
      setProgress({ done: ++done, total: list.length });
    }
    setBusy(false);
    setProgress(null);
    if (out.sent.length) onSent();
  };

  /** „Ponów nieudane”: tylko do tych, do których nie poszło — reszta już ma. */
  const retry = async () => {
    if (!result) return;
    const again = result.failed.map((f) => ({ c: f.c, area: f.area }));
    const out: Result = { ...result, sent: [...result.sent], failed: [] };
    setResult(out);
    await sendTo(again, result.body, result.at, out);
    setResult({ ...out });
  };

  // Stała data w treści (koniec nawyków, start jadłospisu), która w dniu wypuszczenia już minęła.
  const releaseDay = sched.when === 'later' ? sched.day : today();
  const issue = dateIssue(body(), releaseDay);
  const issueText = (x: DateIssue) =>
    x.kind === 'expired' ? T.expired(fmtCalendarDay(x.until), T.release(releaseDay)) : T.started(fmtCalendarDay(x.start), T.release(releaseDay), x.dayIndex + 1);

  // Powiadomienie na telefon: tylko kto je włączył (i gdy ten Sztab zna serwer aplikacji).
  const notifyLine = multi
    ? plan.send.length
      ? T.notifyMany(plan.send.filter((r) => canNotify(r.c)).length, plan.send.length)
      : null
    : canNotify(connection)
      ? T.notifyYes
      : T.notifyNo;

  const gtOptions: { id: string; name: string }[] = kind === 'workout' ? BUILTIN : kind === 'plan' ? BUILTIN_PLANS : [];
  const libraryW: Workout[] = libraryWorkouts(lib.data ?? []);
  const who = (c: Connection) => (
    <span className="sz-sched-who">
      <span className="pid">{shortPseudonym(c.pseudonym)}</span>
      {aliases[c.pseudonym] ? <span className="alias">{aliases[c.pseudonym]}</span> : null}
    </span>
  );

  if (result) {
    return (
      <Dialog title={T.titleMany(result.total)} onClose={close}>
        <div className="sz-sched-summary" role="status">
          <strong>{result.at ? T.summaryLater(result.sent.length, result.total, fmtWhen(result.at)) : T.summary(result.sent.length, result.total)}</strong>
          {result.skipped.length ? (
            <div>
              <span>{T.skipped}:</span>
              <ul>
                {result.skipped.map((s) => (
                  <li key={s.c.id}>
                    {who(s.c)} <span className="sz-sched-skip">{s.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.failed.length ? (
            <div className="err">
              <span>{T.failedList}:</span>
              <ul>
                {result.failed.map((s) => (
                  <li key={s.c.id}>
                    {who(s.c)} {s.why}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {progress ? (
          <div className="sz-sched-progress" role="status" aria-live="polite">
            <span>{T.progress(progress.done, progress.total)}</span>
            <progress max={progress.total} value={progress.done} />
          </div>
        ) : null}
        <div className="row">
          {result.failed.length ? (
            <button type="button" className="btn blue" disabled={busy} onClick={() => void retry()}>
              {T.retry}
            </button>
          ) : null}
          <button type="button" className={`btn ${result.failed.length ? 'ghost' : 'blue'}`} disabled={busy} onClick={onClose}>
            {T.close}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title={multi ? T.titleMany(targets.length) : T.title} onClose={close} wide={source === 'fresh'}>
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
      {!multi && areasFor(kind).length > 1 ? (
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
      {multi && areaChoices.length > 1 ? (
        <label className="field">
          <span>{T.batchArea}</span>
          <select id="send-batch-area" value={batchArea ?? ''} onChange={(e) => setPrefer(e.target.value as Area)}>
            {areaChoices.map((a) => (
              <option key={a} value={a}>
                {L.area[a]}
              </option>
            ))}
          </select>
          <span className="small soft">{T.batchAreaHint}</span>
        </label>
      ) : null}
      {multi ? (
        <div className="stack">
          <span style={{ fontWeight: 600 }} id="send-recipients">
            {T.recipients(targets.length)}
          </span>
          <ul className="sz-sched-list" aria-labelledby="send-recipients">
            {plan.send.map((r) => (
              <li key={r.c.id}>
                {who(r.c)}
                <span className={`chip ${r.area}`}>{L.area[r.area]}</span>
              </li>
            ))}
            {plan.skip.map((s) => (
              <li key={s.c.id}>
                {who(s.c)}
                <span className="sz-sched-skip">
                  {T.skipped}: {skipWhy(s)}
                </span>
              </li>
            ))}
          </ul>
          {!plan.send.length ? <p className="err">{T.nobody}</p> : null}
        </div>
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
      <WhenField
        when={sched.when}
        day={sched.day}
        time={sched.time}
        onChange={(v) => {
          setSched(v);
          setErr(null);
        }}
      />
      {issue ? <div className="note warn small">{issueText(issue)}</div> : null}
      <p className="small soft">{multi ? T.encryptedMany : T.encrypted}</p>
      {notifyLine ? <p className="small soft">{notifyLine}</p> : null}
      {err ? <p className="err" role="alert">{err}</p> : null}
      {progress ? (
        <div className="sz-sched-progress" role="status" aria-live="polite">
          <span>{T.progress(progress.done, progress.total)}</span>
          <progress max={progress.total} value={progress.done} />
          <span className="small soft">{T.wait}</span>
        </div>
      ) : null}
      <button type="button" className="btn blue" disabled={busy || (multi && !plan.send.length)} onClick={() => void send()}>
        {multi
          ? sched.when === 'later'
            ? T.planMany(plan.send.length)
            : T.sendMany(plan.send.length)
          : sched.when === 'later'
            ? T.plan
            : T.send}
      </button>
    </Dialog>
  );
}
