import { useCallback, useMemo, useState } from 'react';
import { AREAS, shortPseudonym } from '@gymtracker/link';
import type { Area, AssignmentKind } from '@gymtracker/link';
import { plural } from '@gt/food/lib/format';
import { pluralEn, text } from '@gt/i18n';
import { loadAliases } from '../lib/aliases';
import { passesCheck, toAssignment } from '../lib/assign';
import { listConnections, listLibrary, sendAssignment } from '../lib/data';
import type { Connection, LibraryItem, SendableBody } from '../lib/data';
import { bulkPick } from '../lib/demo/state';
import { L } from '../lib/labels';
import {
  MAX_AHEAD_DAYS,
  addLocalDays,
  batchAreas,
  dateIssue,
  datedSteps,
  dayKey,
  fmtCalendarDay,
  fmtDay,
  fmtTime,
  nextMonday,
  planLaunch,
  startError,
  today,
  tomorrow,
} from '../lib/program';
import type { DateIssue, LaunchTask, ScheduleError, StepSkip } from '../lib/program';
import { forgetReview } from '../lib/reviewLoad';
import { useReady } from '../session';
import { DemoChip } from './Demo';
import { AreaChips, Dialog, Failure, Loading, useLoad } from './ui';
import './schedule.css';

const T = text({
  pl: {
    title: 'Uruchom program',
    program: 'Program',
    pick: 'Wybierz program…',
    noPrograms: 'W bibliotece nie ma jeszcze programu. Ułóż go w Bibliotece: „+ Program”.',
    start: 'Dzień startu (dzień 1 programu)',
    monday: 'Najbliższy poniedziałek',
    startHint: 'Godziny kroków liczą się według zegara tego komputera.',
    startErr: {
      invalid: 'Wybierz dzień startu.',
      past: 'Dzień startu nie może być w przeszłości.',
      far: 'Start najwyżej rok naprzód.',
    } as Record<ScheduleError, string>,
    clients: 'Podopieczni',
    all: 'Zaznacz wszystkich',
    none: 'Odznacz wszystkich',
    noClients: 'Nie masz trwających współprac.',
    ended: 'współpraca zakończona',
    schedule: (n: number) => `Harmonogram (${n} ${plural(n, 'krok', 'kroki', 'kroków')})`,
    emptyProgram: 'Ten program nie ma kroków.',
    nowChip: 'od razu',
    nowHint: 'Kroki, których godzina już minęła, pójdą od razu.',
    notInLib: 'brak w bibliotece — zostanie pominięty',
    skips: (id: string, k: number, n: number) => `${id}: pominie ${k} z ${n} — `,
    why: {
      missing: 'brak w bibliotece',
      kind: (k: string, areas: string) => `„${k}” nie pasuje do obszarów: ${areas}`,
      invalid: 'treść nie przejdzie sprawdzenia',
    },
    asIs: 'Treść idzie taka, jaka jest teraz w bibliotece: późniejsza zmiana w bibliotece nie zmieni już zaplanowanych zaleceń. Zaplanowane anulujesz w zakładce Zalecenia podopiecznego.',
    encrypted: 'Każde zalecenie szyfruje się w tej przeglądarce kluczem współpracy danego podopiecznego. Serwer widzi tylko rodzaj i datę „pokaż od”.',
    launch: (n: number) => `Uruchom dla ${n} ${n === 1 ? 'podopiecznego' : 'podopiecznych'}`,
    pickClients: 'Zaznacz co najmniej jednego podopiecznego.',
    nothing: 'Żaden krok nie pasuje do zaznaczonych podopiecznych.',
    progress: (d: number, n: number) => `Wysyłam ${d} z ${n}…`,
    done: (d: number, n: number) => `Program uruchomiony dla ${d} z ${n} ${n === 1 ? 'podopiecznego' : 'podopiecznych'}.`,
    sent: (n: number, now: number) =>
      `${n} ${plural(n, 'zalecenie', 'zalecenia', 'zaleceń')}${now ? ` — ${now} od razu, reszta według harmonogramu` : ' według harmonogramu'}`,
    noneSent: 'nic nie poszło',
    skipped: (n: number) => `pominięto ${n}`,
    failed: (n: number) => `nie udało się wysłać ${n} ${plural(n, 'kroku', 'kroków', 'kroków')} — „Ponów nieudane” wyśle tylko te, bez dubli`,
    retry: 'Ponów nieudane',
    retrying: 'Ponawiam…',
    close: 'Gotowe',
    wait: 'Okno zamknie się dopiero po wysyłce — przerwana zostawiłaby program bez części kroków.',
    area: 'Obszar dla podopiecznych z kilkoma obszarami',
    areaHint: 'Dotyczy kroków, które pasują do kilku obszarów podopiecznego (np. nawyki, formularz). Kto nie ma tego obszaru, dostaje je w swoim pierwszym pasującym.',
    expired: (until: string) => `lista kończy się ${until} — tego dnia już nieaktualna`,
    started: (n: number) => `stały start jadłospisu — zacznie od dnia ${n} cyklu`,
    datesNote:
      'Część kroków ma w bibliotece stałą datę, która w dniu wypuszczenia już minie (zaznaczone wyżej). Popraw datę w bibliotece albo zmień dzień startu, zanim uruchomisz.',
  },
  en: {
    title: 'Launch program',
    program: 'Program',
    pick: 'Pick a program…',
    noPrograms: 'There is no program in the library yet. Build one in the Library: “+ Program”.',
    start: 'Start day (program day 1)',
    monday: 'Next Monday',
    startHint: 'Step times follow this computer’s clock.',
    startErr: {
      invalid: 'Pick a start day.',
      past: 'The start day cannot be in the past.',
      far: 'Start at most a year ahead.',
    } as Record<ScheduleError, string>,
    clients: 'Clients',
    all: 'Select all',
    none: 'Clear all',
    noClients: 'You have no active collaborations.',
    ended: 'collaboration ended',
    schedule: (n: number) => `Schedule (${n} ${pluralEn(n, 'step', 'steps')})`,
    emptyProgram: 'This program has no steps.',
    nowChip: 'now',
    nowHint: 'Steps whose time has already passed go out right away.',
    notInLib: 'not in the library — will be skipped',
    skips: (id: string, k: number, n: number) => `${id}: skips ${k} of ${n} — `,
    why: {
      missing: 'not in the library',
      kind: (k: string, areas: string) => `“${k}” does not fit the areas: ${areas}`,
      invalid: 'content would not pass the check',
    },
    asIs: 'Content goes out as it is in the library right now: later library edits do not change already scheduled advice. Cancel scheduled items in the client’s Advice tab.',
    encrypted: 'Each item is encrypted in this browser with that client’s collaboration key. The server sees only its kind and “show from” date.',
    launch: (n: number) => `Launch for ${n} ${pluralEn(n, 'client', 'clients')}`,
    pickClients: 'Select at least one client.',
    nothing: 'No step fits the selected clients.',
    progress: (d: number, n: number) => `Sending ${d} of ${n}…`,
    done: (d: number, n: number) => `Program launched for ${d} of ${n} ${pluralEn(n, 'client', 'clients')}.`,
    sent: (n: number, now: number) => `${n} ${pluralEn(n, 'item', 'items')}${now ? ` — ${now} right away, the rest on schedule` : ' on schedule'}`,
    noneSent: 'nothing went out',
    skipped: (n: number) => `skipped ${n}`,
    failed: (n: number) => `${n} ${pluralEn(n, 'step', 'steps')} failed — “Retry failed” sends only those, without duplicates`,
    retry: 'Retry failed',
    retrying: 'Retrying…',
    close: 'Done',
    wait: 'The window closes only after sending — stopping halfway would leave the program with missing steps.',
    area: 'Area for clients with several areas',
    areaHint: 'Applies to steps that fit several of a client’s areas (e.g. habits, a form). Clients without this area get them in their first matching one.',
    expired: (until: string) => `the list ends on ${until} — already out of date that day`,
    started: (n: number) => `fixed meal plan start — begins on cycle day ${n}`,
    datesNote: 'Some steps have a fixed date in the library that will have passed by their release day (marked above). Fix the date in the library or change the start day before launching.',
  },
});

interface Report {
  c: Connection;
  sent: number;
  now: number;
  skipped: string[];
  /** Kroki, których nie udało się wysłać — „Ponów nieudane” wysyła tylko je. */
  failed: LaunchTask[];
}

/**
 * „Uruchom program”: wybór podopiecznych i dnia startu, potem każdy krok programu idzie jako zalecenie
 * z datą „pokaż od”. Kontrakt rdzenia dla części „Harmonogram i programy” (implementacja) i „Lista
 * podopiecznych” (wołanie z akcji grupowych) — spec 2026-11-25.
 *
 * `program` — element biblioteki rodzaju `program`; `connections` — wstępnie zaznaczeni podopieczni
 * (z listy), pusta lista — wybór w oknie.
 */
export function LaunchProgramDialog({ program, connections, onClose }: { program: LibraryItem | null; connections: Connection[]; onClose: () => void }) {
  const { coach, key, user } = useReady();
  const lib = useLoad(listLibrary, []);
  const pool = useLoad(async () => (connections.length ? connections : (await listConnections()).filter((c) => c.status === 'active')), []);
  const aliases = useMemo(() => loadAliases(user.id), [user.id]);
  const [programId, setProgramId] = useState(program?.id ?? '');
  const [start, setStart] = useState(() => tomorrow());
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(connections.filter((c) => c.status === 'active').map((c) => c.id)));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<Report[] | null>(null);
  const [prefer, setPrefer] = useState<Area | null>(null);
  // W trakcie wysyłki okno się nie zamyka (Escape, tło, ×): pętla i raport zostają.
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  const items = useMemo(() => lib.data ?? [], [lib.data]);
  const programs = items.filter((i) => i.kind === 'program');
  // Program z biblioteki takiej, jaka jest teraz (podany z zewnątrz mógł się od tamtej pory zmienić).
  const prog = program ? (programs.find((i) => i.id === program.id) ?? program) : (programs.find((i) => i.id === programId) ?? null);
  const body = prog && prog.body.kind === 'program' ? prog.body : null;
  const startErr = startError(start);
  // Najwyżej `MAX_STEPS` kroków — liczy się od nowa przy każdym rysowaniu, także „od razu” dla minionych godzin.
  const dated = body && !startErr ? datedSteps(body.steps, start) : [];
  const people = useMemo(() => pool.data ?? [], [pool.data]);

  // To samo sprawdzenie, które zrobi telefon — raz na element biblioteki i obszar, nie przy każdym rysowaniu.
  const validity = useMemo(() => {
    const out = new Map<string, boolean>();
    for (const item of items) {
      if (item.body.kind === 'program') continue;
      const a = toAssignment(item.body, items, '');
      for (const area of AREAS) out.set(`${item.id}|${area}`, passesCheck(coach, area, a));
    }
    return out;
  }, [items, coach]);
  const check = useCallback((item: LibraryItem, area: Area) => validity.get(`${item.id}|${area}`) ?? false, [validity]);
  const picked = useMemo(() => people.filter((c) => c.status === 'active' && chosen.has(c.id)), [people, chosen]);

  const stepKinds = [...new Set(dated.flatMap((d) => items.find((i) => i.id === d.step.itemId && i.kind !== 'program')?.kind ?? []))] as AssignmentKind[];
  const areaChoices = batchAreas(picked, stepKinds);
  const area = prefer && areaChoices.includes(prefer) ? prefer : (areaChoices[0] ?? null);
  const plans = picked.map((c) => ({ c, tasks: planLaunch(c, dated, items, check, area) }));
  const label = (c: Connection) => shortPseudonym(c.pseudonym);
  const why = (t: LaunchTask, c: Connection): string =>
    t.skip === 'kind' ? T.why.kind(L.kind[t.item!.kind], c.areas.map((a) => L.area[a]).join(', ')) : T.why[t.skip as Exclude<StepSkip, 'kind'>];

  const toggle = (id: string, on: boolean) =>
    setChosen((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  /** Wysyła zadania po kolei i dopisuje wynik do raportu każdego podopiecznego. */
  const sendAll = async (work: { r: Report; tasks: LaunchTask[] }[]) => {
    const total = work.reduce((n, w) => n + w.tasks.length, 0);
    setBusy(true);
    setProgress({ done: 0, total });
    let done = 0;
    for (const { r, tasks } of work) {
      for (const t of tasks) {
        try {
          await sendAssignment(key, coach, r.c, t.area!, toAssignment(t.item!.body as SendableBody, items, ''), { visibleFrom: t.at });
          r.sent++;
          if (t.now) r.now++;
        } catch {
          r.failed.push(t);
        }
        setProgress({ done: ++done, total });
      }
      // Lista „Do przejrzenia” policzy tego podopiecznego od nowa — ma nowe zalecenia.
      forgetReview(key, r.c.id);
    }
    setBusy(false);
    setProgress(null);
  };

  const launch = async () => {
    if (!body) return setErr(T.pick);
    if (startErr) return setErr(T.startErr[startErr]);
    if (!picked.length) return setErr(T.pickClients);
    // Daty jeszcze raz — od otwarcia okna mogła minąć godzina któregoś kroku.
    const fresh = datedSteps(body.steps, start);
    const work = picked.map((c) => ({ c, tasks: planLaunch(c, fresh, items, check, area) }));
    if (!work.some((w) => w.tasks.some((t) => !t.skip))) return setErr(T.nothing);
    setErr(null);
    const out: Report[] = work.map(({ c, tasks }) => ({ c, sent: 0, now: 0, skipped: tasks.filter((t) => t.skip).map((t) => why(t, c)), failed: [] }));
    await sendAll(out.map((r, i) => ({ r, tasks: work[i]!.tasks.filter((t) => !t.skip) })));
    setReport(out);
  };

  /** „Ponów nieudane”: tylko kroki, które nie poszły — reszta programu już jest u podopiecznych. */
  const retry = async () => {
    if (!report) return;
    const again = report.map((r) => ({ r, tasks: r.failed.splice(0) })).filter((w) => w.tasks.length);
    setReport([...report]);
    await sendAll(again);
    setReport([...report]);
  };

  if (report) {
    const ok = report.filter((r) => r.sent > 0).length;
    const failed = report.some((r) => r.failed.length);
    return (
      <Dialog title={T.title} onClose={close} wide>
        <p role="status">
          <strong>{T.done(ok, report.length)}</strong>
        </p>
        <ul className="sz-sched-report">
          {report.map((r) => (
            <li key={r.c.id}>
              <span className="sz-sched-who">
                <span className="pid">{label(r.c)}</span>
                {aliases[r.c.pseudonym] ? <span className="alias">{aliases[r.c.pseudonym]}</span> : null}
              </span>
              <span>{r.sent ? T.sent(r.sent, r.now) : T.noneSent}</span>
              {r.skipped.length ? (
                <span className="sz-sched-skip">
                  {T.skipped(r.skipped.length)}: {[...new Set(r.skipped)].join('; ')}
                </span>
              ) : null}
              {r.failed.length ? <span className="err">{T.failed(r.failed.length)}</span> : null}
            </li>
          ))}
        </ul>
        {progress ? (
          <div className="sz-sched-progress" role="status" aria-live="polite">
            <span>{T.retrying}</span>
            <progress max={progress.total} value={progress.done} />
          </div>
        ) : null}
        <div className="row">
          {failed ? (
            <button type="button" className="btn blue" disabled={busy} onClick={() => void retry()}>
              {T.retry}
            </button>
          ) : null}
          <button type="button" className={`btn ${failed ? 'ghost' : 'blue'}`} disabled={busy} onClick={onClose}>
            {T.close}
          </button>
        </div>
      </Dialog>
    );
  }

  // Stała data w treści (koniec nawyków, start jadłospisu) przed dniem wypuszczenia kroku.
  const issues = dated.map((d) => dateIssue(items.find((x) => x.id === d.step.itemId && x.kind !== 'program')?.body, dayKey(d.at)));
  const issueText = (x: DateIssue) => (x.kind === 'expired' ? T.expired(fmtCalendarDay(x.until)) : T.started(x.dayIndex + 1));

  const skipNotes = plans.flatMap(({ c, tasks }) => {
    const skipped = tasks.filter((t) => t.skip && t.skip !== 'missing');
    return skipped.length ? [{ c, text: T.skips(label(c), skipped.length, tasks.length) + [...new Set(skipped.map((t) => why(t, c)))].join('; ') }] : [];
  });

  return (
    <Dialog title={prog ? `${T.title}: ${prog.title}` : T.title} onClose={close} wide>
      {lib.error ? <Failure error={lib.error} retry={lib.reload} /> : null}
      {!program ? (
        !lib.data ? (
          <Loading />
        ) : programs.length ? (
          <label className="field">
            <span>{T.program}</span>
            <select id="launch-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">{T.pick}</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="note">{T.noPrograms}</p>
        )
      ) : null}

      <div className="stack">
        <div className="sz-sched-when">
          <label className="field">
            <span>{T.start}</span>
            <input
              id="launch-start"
              type="date"
              min={today()}
              max={addLocalDays(today(), MAX_AHEAD_DAYS)}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setErr(null);
              }}
            />
          </label>
          <button type="button" className="btn ghost small" onClick={() => setStart(nextMonday())}>
            {T.monday}
          </button>
        </div>
        <p className="small soft">{startErr ? <span className="err">{T.startErr[startErr]}</span> : T.startHint}</p>
      </div>

      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>{T.clients}</legend>
        {pool.error ? <Failure error={pool.error} retry={pool.reload} /> : null}
        {!pool.data && !pool.error ? <Loading /> : null}
        {pool.data && !people.length ? <p className="soft">{T.noClients}</p> : null}
        {people.length > 1 ? (
          <div className="row">
            <button type="button" className="btn link small" onClick={() => setChosen(new Set(bulkPick(user.id, people.filter((c) => c.status === 'active')).map((c) => c.id)))}>
              {T.all}
            </button>
            <button type="button" className="btn link small" onClick={() => setChosen(new Set())}>
              {T.none}
            </button>
          </div>
        ) : null}
        {people.length ? (
          <div className="sz-sched-pick">
            {people.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={chosen.has(c.id)} disabled={c.status !== 'active'} onChange={(e) => toggle(c.id, e.target.checked)} />
                <span className="sz-sched-who">
                  <span className="pid">{label(c)}</span>
                  {aliases[c.pseudonym] ? <span className="alias">{aliases[c.pseudonym]}</span> : null}
                  <DemoChip c={c} />
                </span>
                {c.status === 'active' ? <AreaChips areas={c.areas} /> : <span className="chip muted">{T.ended}</span>}
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

      {areaChoices.length > 1 ? (
        <label className="field">
          <span>{T.area}</span>
          <select id="launch-area" value={area ?? ''} onChange={(e) => setPrefer(e.target.value as Area)}>
            {areaChoices.map((a) => (
              <option key={a} value={a}>
                {L.area[a]}
              </option>
            ))}
          </select>
          <span className="small soft">{T.areaHint}</span>
        </label>
      ) : null}

      {body ? (
        <div className="stack">
          <span style={{ fontWeight: 600 }} id="launch-schedule">
            {T.schedule(dated.length)}
          </span>
          {!body.steps.length ? <p className="soft">{T.emptyProgram}</p> : null}
          {dated.length ? (
            <ol className="sz-sched-preview" aria-labelledby="launch-schedule">
              {dated.map((d, i) => {
                const item = items.find((x) => x.id === d.step.itemId && x.kind !== 'program');
                const issue = issues[i];
                return (
                  <li key={i}>
                    <span className="when">{fmtDay(d.at)}</span>
                    <span className="time">{fmtTime(d.at)}</span>
                    <span className="what">
                      {item ? (
                        <>
                          <span className="soft">{L.kind[item.kind]} · </span>
                          {item.title}
                        </>
                      ) : (
                        <span className="missing">{T.notInLib}</span>
                      )}{' '}
                      {d.now ? <span className="chip blue">{T.nowChip}</span> : null}
                      {issue ? <span className="sz-sched-skip"> {issueText(issue)}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {dated.some((d) => d.now) ? <p className="small soft">{T.nowHint}</p> : null}
          {issues.some(Boolean) ? <div className="note warn small">{T.datesNote}</div> : null}
          {skipNotes.map((s) => (
            <div key={s.c.id} className="note warn small">
              {s.text}
            </div>
          ))}
        </div>
      ) : null}

      <div className="note blue">{T.asIs}</div>
      <p className="small soft">{T.encrypted}</p>
      {err ? (
        <p className="err" role="alert">
          {err}
        </p>
      ) : null}
      {progress ? (
        <div className="sz-sched-progress" role="status" aria-live="polite">
          <span>{T.progress(progress.done, progress.total)}</span>
          <progress max={progress.total} value={progress.done} />
          <span className="small soft">{T.wait}</span>
        </div>
      ) : null}
      <button type="button" className="btn blue" disabled={busy || !body || !picked.length} onClick={() => void launch()}>
        {T.launch(picked.length)}
      </button>
    </Dialog>
  );
}
