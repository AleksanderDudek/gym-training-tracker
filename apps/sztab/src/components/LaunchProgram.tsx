import { useCallback, useMemo, useState } from 'react';
import { AREAS, shortPseudonym } from '@gymtracker/link';
import type { Area } from '@gymtracker/link';
import { plural } from '@gt/food/lib/format';
import { pluralEn, text } from '@gt/i18n';
import { loadAliases } from '../lib/aliases';
import { passesCheck, toAssignment } from '../lib/assign';
import { listConnections, listLibrary, sendAssignment } from '../lib/data';
import type { Connection, LibraryItem, SendableBody } from '../lib/data';
import { L } from '../lib/labels';
import { MAX_AHEAD_DAYS, addLocalDays, datedSteps, fmtDay, fmtTime, nextMonday, planLaunch, startError, today, tomorrow } from '../lib/program';
import type { LaunchTask, ScheduleError, StepSkip } from '../lib/program';
import { useReady } from '../session';
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
    failed: (n: number) => `nie udało się wysłać ${n} — uruchom program jeszcze raz tylko dla tego podopiecznego albo wyślij brakujące ręcznie`,
    close: 'Gotowe',
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
    failed: (n: number) => `${n} failed — launch again for this client only or send the missing ones by hand`,
    close: 'Done',
  },
});

interface Report {
  c: Connection;
  sent: number;
  now: number;
  skipped: string[];
  failed: number;
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

  const plans = picked.map((c) => ({ c, tasks: planLaunch(c, dated, items, check) }));
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

  const launch = async () => {
    if (!body) return setErr(T.pick);
    if (startErr) return setErr(T.startErr[startErr]);
    if (!picked.length) return setErr(T.pickClients);
    // Daty jeszcze raz — od otwarcia okna mogła minąć godzina któregoś kroku.
    const fresh = datedSteps(body.steps, start);
    const work = picked.map((c) => ({ c, tasks: planLaunch(c, fresh, items, check) }));
    const total = work.reduce((n, w) => n + w.tasks.filter((t) => !t.skip).length, 0);
    if (!total) return setErr(T.nothing);
    setErr(null);
    setBusy(true);
    setProgress({ done: 0, total });
    const out: Report[] = [];
    let done = 0;
    for (const { c, tasks } of work) {
      const r: Report = { c, sent: 0, now: 0, skipped: [], failed: 0 };
      for (const t of tasks) {
        if (t.skip) {
          r.skipped.push(why(t, c));
          continue;
        }
        try {
          await sendAssignment(key, coach, c, t.area!, toAssignment(t.item!.body as SendableBody, items, ''), { visibleFrom: t.at });
          r.sent++;
          if (t.now) r.now++;
        } catch {
          r.failed++;
        }
        setProgress({ done: ++done, total });
      }
      out.push(r);
    }
    setBusy(false);
    setProgress(null);
    setReport(out);
  };

  if (report) {
    const ok = report.filter((r) => r.sent > 0).length;
    return (
      <Dialog title={T.title} onClose={onClose} wide>
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
              {r.failed ? <span className="err">{T.failed(r.failed)}</span> : null}
            </li>
          ))}
        </ul>
        <button type="button" className="btn blue" onClick={onClose}>
          {T.close}
        </button>
      </Dialog>
    );
  }

  const skipNotes = plans.flatMap(({ c, tasks }) => {
    const skipped = tasks.filter((t) => t.skip && t.skip !== 'missing');
    return skipped.length ? [{ c, text: T.skips(label(c), skipped.length, tasks.length) + [...new Set(skipped.map((t) => why(t, c)))].join('; ') }] : [];
  });

  return (
    <Dialog title={prog ? `${T.title}: ${prog.title}` : T.title} onClose={onClose} wide>
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
            <button type="button" className="btn link small" onClick={() => setChosen(new Set(people.filter((c) => c.status === 'active').map((c) => c.id)))}>
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
                </span>
                {c.status === 'active' ? <AreaChips areas={c.areas} /> : <span className="chip muted">{T.ended}</span>}
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

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
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {dated.some((d) => d.now) ? <p className="small soft">{T.nowHint}</p> : null}
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
        </div>
      ) : null}
      <button type="button" className="btn blue" disabled={busy || !body || !picked.length} onClick={() => void launch()}>
        {T.launch(picked.length)}
      </button>
    </Dialog>
  );
}
