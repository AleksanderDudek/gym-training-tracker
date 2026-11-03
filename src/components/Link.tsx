import { useEffect, useMemo, useState } from 'react';
import { formatPseudonym, newIdSecret, parseInviteQuery, pseudonymFor, SCOPES, suggestScopes } from '@gymtracker/link';
import type { Area, AssignmentV1, InvitePreview, Scope } from '@gymtracker/link';
import { BUILTIN, EX } from '../data/exercises';
import { agoText } from '../deviceStatus';
import { hashQuery } from '../food/hash';
import { LOCALE, num } from '../i18n';
import { acceptInvite, areaChecks, keyMatches } from '../link/accept';
import type { AcceptFailure } from '../link/accept';
import { importPlan, importWorkout } from '../link/assign';
import { linkConfigured, sztabAppUrl } from '../link/config';
import { invitePreview, isRpcError } from '../link/rpc';
import { activeConnections, connectionOf, linkState, subscribeLink, updateLink, useLink, visibleAssignments } from '../link/store';
import type { LinkConnection, StoredAssignment } from '../link/store';
import { changeScopes, endConnection, pushOne, setAssignmentStatus } from '../link/sync';
import { LINK_PATH, dietPath, go, goBack, linkAssignmentPath, linkConnectionPath, planPath, workoutPath } from '../routing';
import type { LinkRoute } from '../routing';
import type { AppState } from '../types';
import { T } from './Link.text';
import { W, assignmentTitle } from './Link.words';
import { useNow } from './DeviceStatus';
import { Banner } from './ui';

/**
 * Strony współpracy z prowadzącym: lista, zaproszenie, jedna współpraca i jedno zalecenie.
 * Osobna paczka (z kryptografią), wczytywana dopiero tutaj.
 */

export interface LinkProps {
  route: LinkRoute;
  state: AppState;
  /** Sekret ID z zapisu; gdy go nie ma — zapisuje podany i go zwraca. */
  ensureSecret: (candidate: string) => string;
  /** Zmiana zapisu aplikacji od najświeższego stanu (plan i trening od prowadzącego). */
  apply: (f: (s: AppState) => AppState) => void;
  onToast: (msg: string) => void;
}

const dateText = (ms: number | string): string =>
  new Date(ms).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

const shortDate = (ms: number | string): string => new Date(ms).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' });

const scopesText = (scopes: readonly Scope[]): string => scopes.map((s) => W.scope[s].toLowerCase()).join(', ');

export default function LinkPages(props: LinkProps) {
  if (!linkConfigured()) {
    return (
      <div className="wrap">
        <p className="lead">{T.off}</p>
      </div>
    );
  }
  switch (props.route.kind) {
    case 'link':
      return <LinkHome />;
    case 'linkInvite':
      return <InvitePage {...props} />;
    case 'linkConnection':
      return <ConnectionPage key={props.route.id} id={props.route.id} state={props.state} onToast={props.onToast} />;
    case 'linkAssignment':
      return <AssignmentPage key={props.route.id} id={props.route.id} {...props} />;
  }
}

/* ── Lista ─────────────────────────────────────────────────────────────────────────── */

function LinkHome() {
  const s = useLink();
  const now = useNow(subscribeLink);
  // Uwaga „zakończona przez prowadzącego” na ekranie Dziś znika, gdy ktoś tu zajrzał.
  useEffect(() => {
    if (linkState().connections.some((c) => c.endNotice))
      updateLink((x) => {
        for (const c of x.connections) delete c.endNotice;
      });
  }, []);
  const active = activeConnections(s);
  const ended = s.connections.filter((c) => c.status === 'ended').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  const list = visibleAssignments(s);
  const app = sztabAppUrl();
  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>
      <div className="grp">
        <h2>{T.active}</h2>
        {!active.length && (
          <>
            <p className="tight">{T.noneActive}</p>
            <p className="tight">{T.howStart}</p>
          </>
        )}
        {active.map((c) => (
          <ConnectionSummary key={c.id} c={c} now={now} />
        ))}
        <p className="hint" style={{ marginTop: 10 }}>
          {T.privacy}
        </p>
      </div>
      <div className="grp">
        <h2>{T.assignments}</h2>
        {!list.length && <p className="tight">{T.noAssignments}</p>}
        <AssignmentList list={list} s={s} />
        {s.broken.length > 0 && <p className="hint">{T.broken(s.broken.length)}</p>}
      </div>
      {ended.length > 0 && (
        <div className="grp">
          <details>
            <summary className="link-summary">{T.ended(ended.length)}</summary>
            {ended.map((c) => (
              <div key={c.id} className="link-conn">
                <b>{T.from(c.coach.name, W.profession[c.coach.profession])}</b>
                <p className="tight">
                  {c.endedAt ? T.endedLine(dateText(c.endedAt), c.endedBy === 'coach') : null}
                  {c.pending ? ` ${T.pendingEnd}` : ''}
                </p>
              </div>
            ))}
          </details>
        </div>
      )}
      {app && (
        <div className="wrap">
          <a className="vidlink" href={app} target="_blank" rel="noopener noreferrer">
            {T.coachApp}
          </a>
        </div>
      )}
    </>
  );
}

function ConnectionSummary({ c, now }: { c: LinkConnection; now: number }) {
  return (
    <div className="link-conn">
      <b>{T.from(c.coach.name, W.profession[c.coach.profession])}</b>
      <div className="link-chips">
        {c.areas.map((a) => (
          <span key={a} className="tag">
            {W.area[a]}
          </span>
        ))}
      </div>
      <p className="tight">{c.scopes.length ? T.sees(scopesText(c.scopes)) : T.seesNothing}</p>
      <p className="tight">{c.lastPushAt ? T.sent(agoText(c.lastPushAt, now)) : T.notSent}</p>
      <button className="btn ghost sm" onClick={() => go(linkConnectionPath(c.id))}>
        {T.details}
      </button>
    </div>
  );
}

function AssignmentList({ list, s }: { list: StoredAssignment[]; s: ReturnType<typeof linkState> }) {
  if (!list.length) return null;
  return (
    <ul className="link-items">
      {list.map((a) => {
        const c = connectionOf(s, a.connectionId);
        return (
          <li key={a.id}>
            <a href={linkAssignmentPath(a.id)}>
              <span className="link-item-title">
                {assignmentTitle(a.a)}
                {a.status === 'new' && <span className="badge">{T.status.new}</span>}
              </span>
              <span className="link-item-sub">
                {c?.coach.name ?? a.a.from.name} · {shortDate(a.a.sentAt)}
                {a.status !== 'new' ? ` · ${T.status[a.status]}` : ''}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Zaproszenie ───────────────────────────────────────────────────────────────────── */

type Loaded =
  | { kind: 'loading' }
  | { kind: 'bad' }
  | { kind: 'offline' }
  | { kind: 'missing' }
  | { kind: 'key' }
  | { kind: 'ok'; preview: InvitePreview };

const FAIL_TEXT: Record<AcceptFailure, string> = {
  fingerprint: T.keyText,
  missing: T.missing,
  used: T.used,
  revoked: T.revoked,
  expired: T.expired,
  exclusive: T.exclusive,
  no_areas: T.pickArea,
  offline: T.offline,
  taken: T.taken,
  error: T.failed,
};

function InvitePage({ state, ensureSecret, onToast }: LinkProps) {
  const query = useMemo(() => parseInviteQuery(hashQuery(window.location.hash)), []);
  const [loaded, setLoaded] = useState<Loaded>(() => (query ? { kind: 'loading' } : { kind: 'bad' }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!query) return;
    let live = true;
    invitePreview(query.inviteId).then(
      async (preview) => {
        if (!live) return;
        if (!preview) return setLoaded({ kind: 'missing' });
        // Klucz sprawdzamy, zanim cokolwiek z zaproszenia trafi na ekran jako prawdziwe.
        const ok = await keyMatches(preview, query.fingerprint);
        if (live) setLoaded(ok ? { kind: 'ok', preview } : { kind: 'key' });
      },
      (e: unknown) => {
        if (live) setLoaded(isRpcError(e, 'offline') || !isRpcError(e) ? { kind: 'offline' } : { kind: 'missing' });
      },
    );
    return () => {
      live = false;
    };
  }, [query, attempt]);

  if (loaded.kind === 'loading') return <div className="empty">{T.checking}</div>;
  if (loaded.kind === 'bad') return <Note text={T.badLink} />;
  if (loaded.kind === 'missing') return <Note text={T.missing} />;
  if (loaded.kind === 'key') return <KeyRefusal />;
  if (loaded.kind === 'offline')
    return (
      <div className="wrap">
        <p className="lead">{T.offline}</p>
        <button className="btn" onClick={() => { setLoaded({ kind: 'loading' }); setAttempt((n) => n + 1); }}>
          {T.retry}
        </button>
      </div>
    );
  const preview = loaded.preview;
  const mine = linkState().connections.find((c) => c.inviteId === preview.id);
  if (mine)
    return (
      <div className="wrap">
        <p className="lead">{T.already}</p>
        <button className="btn" onClick={() => go(linkConnectionPath(mine.id), { replace: true })}>
          {T.openIt}
        </button>
      </div>
    );
  if (preview.status !== 'open')
    return <Note text={preview.status === 'accepted' ? T.used : preview.status === 'revoked' ? T.revoked : T.expired} />;
  return <InviteForm preview={preview} fingerprint={query!.fingerprint} state={state} ensureSecret={ensureSecret} onToast={onToast} />;
}

const Note = ({ text }: { text: string }) => (
  <div className="wrap">
    <p className="lead">{text}</p>
  </div>
);

function KeyRefusal() {
  return (
    <div className="wrap">
      <Banner notice={{ level: 'warn', title: T.keyTitle, text: T.keyText }} />
    </div>
  );
}

function InviteForm({
  preview,
  fingerprint,
  state,
  ensureSecret,
  onToast,
}: {
  preview: InvitePreview;
  fingerprint: string;
  state: AppState;
  ensureSecret: (candidate: string) => string;
  onToast: (m: string) => void;
}) {
  const s = useLink();
  const checks = areaChecks(s, preview);
  // Wolne obszary zaznaczone, zajęte przez kogoś innego — nie: zamiana prowadzącego to decyzja.
  const [chosen, setChosen] = useState<Area[]>(() => checks.filter((c) => c.free).map((c) => c.area));
  const [scopes, setScopes] = useState<Scope[]>(() => (preview.scopes.length ? preview.scopes : suggestScopes(preview.areas)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AcceptFailure | null>(null);
  // Sekret zapisany dopiero przy przyjęciu; do tego czasu ID liczy się z kandydata.
  const [candidate] = useState(() => state.cfg.linkSecret ?? newIdSecret());
  const secret = state.cfg.linkSecret ?? candidate;
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void pseudonymFor(secret, preview.coachId, 0).then((p) => live && setId(formatPseudonym(p)));
    return () => {
      live = false;
    };
  }, [secret, preview.coachId]);

  const toggle = <V,>(list: V[], v: V): V[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const replace = chosen.filter((a) => !checks.find((c) => c.area === a)?.free);

  const accept = async () => {
    if (!chosen.length) return setError('no_areas');
    setBusy(true);
    setError(null);
    const r = await acceptInvite({ preview, fingerprint, chosen, replace, scopes, secret: ensureSecret(secret) });
    if (!r.ok) {
      setBusy(false);
      setError(r.reason);
      return;
    }
    const pushed = await pushOne(r.connection, state, { force: true });
    onToast(pushed === 'sent' ? T.accepted : T.acceptedLater);
    go(linkConnectionPath(r.connection.id), { replace: true });
  };

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.invites(preview.coachName, W.profession[preview.profession])}</p>
        {preview.bio && <p className="tight">{preview.bio}</p>}
      </div>
      {preview.message && (
        <div className="grp">
          <h2>{T.message}</h2>
          <p className="link-text">{preview.message}</p>
        </div>
      )}
      <div className="grp">
        <h2>{T.areasTitle}</h2>
        {checks.map((c) => {
          const on = chosen.includes(c.area);
          const holders = c.holders.map((h) => h.coachName).join(', ');
          return (
            <div key={c.area}>
              <label className="check-row">
                <input type="checkbox" checked={on} onChange={() => setChosen((l) => toggle(l, c.area))} />
                <span>
                  <b>{W.area[c.area]}</b> — {W.areaHint[c.area]}
                </span>
              </label>
              {c.same && <p className="hint">{T.sameCoach}</p>}
              {!c.free && <p className="hint">{T.takenBy(holders)}</p>}
              {!c.free &&
                on &&
                c.holders.map((h) => (
                  <p className="hint" key={h.id}>
                    {T.replaceNote(h.coachName, h.areas.length === 1)}
                  </p>
                ))}
            </div>
          );
        })}
      </div>
      <div className="grp">
        <h2>{T.scopesTitle}</h2>
        {SCOPES.map((sc) => (
          <label className="check-row" key={sc}>
            <input type="checkbox" checked={scopes.includes(sc)} onChange={() => setScopes((l) => SCOPES.filter((x) => (x === sc ? !l.includes(x) : l.includes(x))))} />
            <span>{W.scope[sc]}</span>
          </label>
        ))}
        <p className="hint">{T.scopesHint}</p>
      </div>
      <div className="grp">
        <h2>{T.idTitle}</h2>
        <p className="tight">{T.idText(id ?? '…')}</p>
        <p className="hint">{T.validUntil(dateText(preview.expiresAt))}</p>
      </div>
      <div className="wrap">
        {error && (
          <p className="link-error" role="alert">
            {FAIL_TEXT[error]}
          </p>
        )}
        <div className="btnrow">
          <button className="btn" disabled={busy} onClick={() => void accept()}>
            {busy ? T.accepting : T.accept}
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => goBack(LINK_PATH)}>
            {T.later}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Jedna współpraca ──────────────────────────────────────────────────────────────── */

function ConnectionPage({ id, state, onToast }: { id: string; state: AppState; onToast: (m: string) => void }) {
  const s = useLink();
  const c = connectionOf(s, id);
  const [scopes, setScopes] = useState<Scope[]>(() => c?.scopes ?? []);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const now = useNow(subscribeLink);
  if (!c) return <Note text={T.notFound} />;
  const list = visibleAssignments(s, c.id);
  const changed = scopes.length !== c.scopes.length || scopes.some((x) => !c.scopes.includes(x));
  const narrower = c.scopes.some((x) => !scopes.includes(x));

  const save = async () => {
    setBusy(true);
    const r = await changeScopes(c.id, scopes, state);
    setBusy(false);
    onToast(r === 'ok' ? T.scopesSaved : r === 'offline' ? T.offlineSave : T.endedNow);
  };
  const send = async () => {
    setBusy(true);
    const r = await pushOne(c, state, { force: true });
    setBusy(false);
    onToast(r === 'sent' ? T.sentNow : r === 'wait' ? T.sendWait : r === 'too_big' ? T.tooBig : r === 'ended' ? T.endedNow : T.sendFailed);
  };
  const end = async () => {
    setBusy(true);
    const r = await endConnection(c.id);
    setBusy(false);
    setConfirm(false);
    onToast(r === 'ended' ? T.endedNow : T.endedLater);
  };

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.from(c.coach.name, W.profession[c.coach.profession])}</p>
        <p className="tight">
          {c.status === 'active'
            ? T.since(dateText(c.createdAt))
            : c.endedAt
              ? T.endedLine(dateText(c.endedAt), c.endedBy === 'coach')
              : ''}
          {c.pending?.kind === 'end' ? ` ${T.pendingEnd}` : ''}
        </p>
      </div>
      <div className="grp">
        <h2>{T.areas}</h2>
        <div className="link-chips">
          {c.areas.map((a) => (
            <span key={a} className="tag">
              {W.area[a]}
            </span>
          ))}
        </div>
        <h2 style={{ marginTop: 14 }}>{T.yourId}</h2>
        <p className="link-id">{formatPseudonym(c.pseudonym)}</p>
      </div>
      {c.status === 'active' && (
        <div className="grp">
          <h2>{T.scopes}</h2>
          {SCOPES.map((sc) => (
            <label className="check-row" key={sc}>
              <input
                type="checkbox"
                checked={scopes.includes(sc)}
                onChange={() => setScopes((l) => SCOPES.filter((x) => (x === sc ? !l.includes(x) : l.includes(x))))}
              />
              <span>{W.scope[sc]}</span>
            </label>
          ))}
          {narrower && <p className="hint">{T.scopesNarrow}</p>}
          <div className="btnrow">
            <button className="btn sm" disabled={!changed || busy} onClick={() => void save()}>
              {T.saveScopes}
            </button>
            <button className="btn ghost sm" disabled={busy} onClick={() => void send()}>
              {T.sendNow}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            {c.lastPushAt ? T.sent(agoText(c.lastPushAt, now)) : T.notSent}
          </p>
        </div>
      )}
      <div className="grp">
        <h2>{T.itsAssignments}</h2>
        {!list.length && <p className="tight">{T.noAssignments}</p>}
        <AssignmentList list={list} s={s} />
      </div>
      {c.status === 'active' && (
        <div className="grp">
          {!confirm ? (
            <button className="btn ghost" onClick={() => setConfirm(true)}>
              {T.end}
            </button>
          ) : (
            <div role="group" aria-label={T.endQ}>
              <h2>{T.endQ}</h2>
              <p className="tight">{T.endText(c.coach.name)}</p>
              <div className="btnrow" style={{ marginTop: 10 }}>
                <button className="btn" disabled={busy} onClick={() => void end()}>
                  {T.endYes}
                </button>
                <button className="btn ghost" disabled={busy} onClick={() => setConfirm(false)}>
                  {T.endNo}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ── Jedno zalecenie ───────────────────────────────────────────────────────────────── */

function AssignmentPage({ id, apply, state, onToast }: LinkProps & { id: string }) {
  const s = useLink();
  const stored = s.assignments.find((a) => a.id === id);
  useEffect(() => {
    if (stored?.status === 'new') void setAssignmentStatus(id, 'seen');
  }, [id, stored?.status]);
  if (!stored) return <Note text={T.noAssignment} />;
  if (stored.withdrawn) return <Note text={T.withdrawn} />;
  const a = stored.a;
  const c = connectionOf(s, stored.connectionId);
  const from = T.from(c?.coach.name ?? a.from.name, W.profession[a.from.profession]);
  const mark = (status: 'done' | 'declined') => {
    void setAssignmentStatus(id, status);
    onToast(T.marked);
  };
  return (
    <>
      <div className="wrap">
        <p className="today-tag">
          {W.area[a.area]} · {T.status[stored.status]}
        </p>
        <h2 className="today-name">{assignmentTitle(a)}</h2>
        <p className="tight">
          {from}. {T.sentAt(dateText(a.sentAt))}
        </p>
      </div>
      <AssignmentBody stored={stored} a={a} apply={apply} state={state} onToast={onToast} />
      {stored.status !== 'done' && stored.status !== 'declined' && (
        <div className="wrap">
          <div className="btnrow">
            {a.body.kind !== 'plan' && a.body.kind !== 'workout' && (
              <button className="btn" onClick={() => mark('done')}>
                {T.done}
              </button>
            )}
            <button className="btn ghost" onClick={() => mark('declined')}>
              {T.decline}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function CoachNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="grp">
      <h2>{T.note}</h2>
      <p className="link-text">{text}</p>
    </div>
  );
}

function ExerciseLines({ items, videos }: { items: { ex: string }[]; videos: Record<string, string> }) {
  return (
    <ul className="link-list">
      {items.map((i, n) => (
        <li key={`${i.ex}:${n}`}>
          {EX[i.ex] ? EX[i.ex]!.name : <i>{`${i.ex} — ${T.missingEx}`}</i>}
          {videos[i.ex] && (
            <>
              {' · '}
              <a href={videos[i.ex]} target="_blank" rel="noopener noreferrer">
                {T.video}
              </a>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function AssignmentBody({
  stored,
  a,
  apply,
  state,
  onToast,
}: {
  stored: StoredAssignment;
  a: AssignmentV1;
  apply: LinkProps['apply'];
  state: AppState;
  onToast: (m: string) => void;
}) {
  const b = a.body;
  const fromLine = T.from(a.from.name, W.profession[a.from.profession]);
  switch (b.kind) {
    case 'plan': {
      const made = stored.made?.plan;
      const start = () => {
        const r = importPlan(state, a.id, b, fromLine);
        if (!r) return onToast(T.cannotImport);
        apply((s) => importPlan(s, a.id, b, fromLine)?.next ?? s);
        void setAssignmentStatus(a.id, 'started', { made: { plan: r.planId } });
        onToast(r.skipped.length ? `${T.planReady} ${T.skippedEx(r.skipped.join(', '))}` : T.planReady);
        go(planPath(r.planId));
      };
      return (
        <>
          <div className="grp">
            <h2>{b.plan.name}</h2>
            <p className="tight">{T.weeks(b.plan.weeks, b.plan.weekdays.length)}</p>
            {b.plan.goal && <p className="tight">{b.plan.goal}</p>}
            {b.plan.desc && <p className="tight">{b.plan.desc}</p>}
          </div>
          <div className="grp">
            <h2>{T.rotation}</h2>
            {/* Rotacja po kolei: treningi przysłane w zaleceniu albo gotowe z biblioteki aplikacji. */}
            {[...new Set(b.plan.cycle)]
              .map((id) => b.workouts.find((w) => w.id === id) ?? BUILTIN.find((w) => w.id === id))
              .filter((w): w is NonNullable<typeof w> => !!w)
              .map((w) => (
              <div key={w.id} className="link-conn">
                <b>{w.name}</b>
                <ExerciseLines items={w.items} videos={b.videos} />
              </div>
            ))}
          </div>
          <CoachNote text={b.note} />
          <div className="wrap">
            <div className="btnrow">
              <button className="btn" onClick={start}>
                {T.startPlan}
              </button>
              {made && state.plans?.some((p) => p.id === made) && (
                <button className="btn ghost" onClick={() => go(planPath(made))}>
                  {T.openPlan}
                </button>
              )}
            </div>
          </div>
        </>
      );
    }
    case 'workout': {
      const made = stored.made?.workout;
      const add = () => {
        const r = importWorkout(state, a.id, b, fromLine);
        if (!r) return onToast(T.cannotImport);
        apply((s) => importWorkout(s, a.id, b, fromLine)?.next ?? s);
        void setAssignmentStatus(a.id, 'started', { made: { workout: r.workoutId } });
        onToast(r.skipped.length ? `${T.workoutReady} ${T.skippedEx(r.skipped.join(', '))}` : T.workoutReady);
        go(workoutPath(r.workoutId));
      };
      return (
        <>
          <div className="grp">
            <h2>{b.workout.name}</h2>
            {b.workout.desc && <p className="tight">{b.workout.desc}</p>}
            <ExerciseLines items={b.workout.items} videos={b.videos} />
          </div>
          <CoachNote text={b.note} />
          <div className="wrap">
            <div className="btnrow">
              <button className="btn" onClick={add}>
                {T.addWorkout}
              </button>
              {made && state.workouts.some((w) => w.id === made) && (
                <button className="btn ghost" onClick={() => go(workoutPath(made))}>
                  {T.openWorkout}
                </button>
              )}
            </div>
          </div>
        </>
      );
    }
    case 'targets': {
      const lines = [
        b.kcal !== null ? T.kcal(Math.round(b.kcal)) : null,
        b.protein !== null ? T.protein(Math.round(b.protein)) : null,
        b.steps !== null ? T.steps(Math.round(b.steps)) : null,
        b.workoutsPerWeek !== null ? T.perWeek(Math.round(b.workoutsPerWeek)) : null,
        b.weightGoal !== null ? T.weightGoal(num(b.weightGoal, 1)) : null,
        b.weeklyRate !== null ? T.rate(num(b.weeklyRate, 2)) : null,
      ].filter((x): x is string => !!x);
      return (
        <>
          <div className="grp">
            <h2>{T.targets}</h2>
            <ul className="link-list">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <CoachNote text={b.note} />
        </>
      );
    }
    case 'labs':
      return (
        <>
          <div className="grp">
            <h2>{T.labsTitle}</h2>
            <ul className="link-list">
              {b.tests.map((t, i) => (
                <li key={i}>
                  <b>{t.name}</b>
                  {t.note ? ` — ${t.note}` : ''}
                </li>
              ))}
            </ul>
            {b.by && <p className="tight">{T.labsBy(dateText(`${b.by}T12:00:00`))}</p>}
            <p className="hint">{T.labsHow}</p>
            <button className="btn ghost sm" onClick={() => go(dietPath('labs'))}>
              {T.openLabs}
            </button>
          </div>
          <CoachNote text={b.note} />
        </>
      );
    case 'note':
      return (
        <div className="grp">
          {b.text && <p className="link-text">{b.text}</p>}
          {b.checklist.map((item, i) => (
            <label className="check-row" key={i}>
              <input
                type="checkbox"
                checked={stored.ticked.includes(i)}
                onChange={() => {
                  const ticked = stored.ticked.includes(i) ? stored.ticked.filter((x) => x !== i) : [...stored.ticked, i].sort((x, y) => x - y);
                  const status = stored.status === 'new' || stored.status === 'seen' ? 'started' : stored.status;
                  void setAssignmentStatus(a.id, status, { ticked });
                }}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      );
  }
}
