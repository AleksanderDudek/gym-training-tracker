import { useState } from 'react';
import { AREAS, SCOPES, inviteLink, suggestScopes } from '@gymtracker/link';
import type { Area, Scope } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import { QrCode } from '../components/Qr';
import { AreaChips, Dialog, Failure, Loading, fmtDate, toast, useLoad } from '../components/ui';
import { createInvite, inviteState, listInvites, revokeInvite } from '../lib/data';
import type { Invite } from '../lib/data';
import { TRACKER_URL } from '../lib/env';
import { L } from '../lib/labels';
import { navigate, useLocation } from '../lib/router';
import { useReady } from '../session';

const T = text({
  pl: {
    title: 'Zaproszenia',
    lead: 'Link wysyłasz sam — SMS-em, mailem, w komunikatorze albo pokazujesz kod QR na wizycie. Działa raz i wygasa sam.',
    new: 'Nowe zaproszenie',
    areas: 'Co prowadzisz',
    scopes: 'O jakie dane prosisz',
    scopesHint: 'Podopieczny zobaczy tę listę i odhaczy po swojemu. Może zmienić zdanie w każdej chwili.',
    message: 'Wiadomość do podopiecznego (opcjonalnie)',
    messagePh: 'Cześć! Tak jak rozmawialiśmy — zaczynamy od poniedziałku.',
    label: 'Notatka dla ciebie (opcjonalnie)',
    labelCol: 'Notatka',
    labelHint: 'Widzisz ją tylko ty, przy zaproszeniu i podopiecznym. Bez nazwisk i danych kontaktowych — np. „wtorki 18:00”.',
    days: 'Ważne przez',
    dayN: (n: number) => `${n} dni`,
    create: 'Utwórz link',
    readyTitle: 'Link gotowy',
    readyLead: 'Wyślij go podopiecznemu. Otworzy się w GYM TRACKERze na telefonie.',
    qr: 'Kod QR z linkiem zaproszenia',
    copy: 'Kopiuj link',
    copied: 'Link skopiowany',
    share: 'Udostępnij',
    done: 'Gotowe',
    shareText: 'Zaproszenie do współpracy w GYM TRACKERze',
    stateCol: 'Stan',
    state: { open: 'czeka', accepted: 'przyjęte', revoked: 'wycofane', expired: 'wygasło' },
    expires: (d: string) => `do ${d}`,
    revoke: 'Wycofaj',
    revoked: 'Zaproszenie wycofane',
    link: 'Link',
    emptyTitle: 'Brak zaproszeń',
    emptyText: 'Pierwsze zaproszenie to jeden krótki formularz.',
    pickArea: 'Wybierz co najmniej jeden obszar.',
    failed: 'Nie udało się utworzyć zaproszenia.',
    created: 'Utworzone',
  },
  en: {
    title: 'Invites',
    lead: 'You send the link yourself — by text, email, a messenger, or show the QR code in person. It works once and expires on its own.',
    new: 'New invite',
    areas: 'What you coach',
    scopes: 'What data you ask for',
    scopesHint: 'The client sees this list and ticks it their way. They can change their mind at any time.',
    message: 'Message to the client (optional)',
    messagePh: 'Hi! As we discussed — we start on Monday.',
    label: 'A note for you (optional)',
    labelCol: 'Note',
    labelHint: 'Only you see it, on the invite and the client. No names or contact details — e.g. “Tuesdays 6 pm”.',
    days: 'Valid for',
    dayN: (n: number) => `${n} days`,
    create: 'Create link',
    readyTitle: 'Link ready',
    readyLead: 'Send it to the client. It opens in GYM TRACKER on their phone.',
    qr: 'QR code with the invite link',
    copy: 'Copy link',
    copied: 'Link copied',
    share: 'Share',
    done: 'Done',
    shareText: 'Invite to coaching in GYM TRACKER',
    stateCol: 'State',
    state: { open: 'waiting', accepted: 'accepted', revoked: 'withdrawn', expired: 'expired' },
    expires: (d: string) => `until ${d}`,
    revoke: 'Withdraw',
    revoked: 'Invite withdrawn',
    link: 'Link',
    emptyTitle: 'No invites',
    emptyText: 'Your first invite is one short form.',
    pickArea: 'Pick at least one area.',
    failed: 'Could not create the invite.',
    created: 'Created',
  },
});

function copy(link: string) {
  void navigator.clipboard?.writeText(link).then(
    () => toast(T.copied),
    () => undefined,
  );
}

export function Invites() {
  const { coach } = useReady();
  const { query } = useLocation();
  const { data, error, reload } = useLoad(listInvites, []);
  const [creating, setCreating] = useState(query.get('nowe') === '1');
  const linkOf = (i: Invite) => inviteLink(TRACKER_URL, i.id, coach.key_fingerprint);

  const close = () => {
    setCreating(false);
    if (query.get('nowe')) navigate('/zaproszenia', { replace: true });
    reload();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{T.title}</h1>
          <p className="lead">{T.lead}</p>
        </div>
        <button type="button" className="btn blue" onClick={() => setCreating(true)}>
          {T.new}
        </button>
      </div>
      {error ? <Failure error={error} retry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && !data.length ? (
        <section className="card empty">
          <h3>{T.emptyTitle}</h3>
          <p>{T.emptyText}</p>
        </section>
      ) : null}
      {data?.length ? (
        <section className="card flat scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>{T.created}</th>
                <th>{T.areas}</th>
                <th>{T.labelCol}</th>
                <th>{T.stateCol}</th>
                <th>
                  <span className="sr">{T.link}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((i) => {
                const st = inviteState(i);
                return (
                  <tr key={i.id}>
                    <td className="small">{fmtDate(i.createdAt, LOCALE)}</td>
                    <td>
                      <AreaChips areas={i.areas} />
                    </td>
                    <td className="small">{i.label ?? <span className="soft">—</span>}</td>
                    <td className="small">
                      <span className={`chip ${st === 'open' ? 'blue' : st === 'accepted' ? 'ok' : 'muted'}`}>{T.state[st]}</span>{' '}
                      {st === 'open' ? <span className="soft">{T.expires(fmtDate(i.expiresAt, LOCALE))}</span> : null}
                    </td>
                    <td>
                      {st === 'open' ? (
                        <span className="row" style={{ justifyContent: 'flex-end' }}>
                          <button type="button" className="btn ghost small" onClick={() => copy(linkOf(i))}>
                            {T.copy}
                          </button>
                          <button
                            type="button"
                            className="btn danger small"
                            onClick={() =>
                              void revokeInvite(i.id).then(() => {
                                toast(T.revoked);
                                reload();
                              })
                            }
                          >
                            {T.revoke}
                          </button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
      {creating ? <NewInvite onClose={close} linkOf={linkOf} /> : null}
    </>
  );
}

const DEFAULT_AREA: Record<string, Area> = { dietitian: 'nutrition', physio: 'rehab', doctor: 'insight' };

function NewInvite({ onClose, linkOf }: { onClose: () => void; linkOf: (i: Invite) => string }) {
  const { coach } = useReady();
  const defaults: Area[] = [DEFAULT_AREA[coach.profession] ?? 'training'];
  const [areas, setAreas] = useState<Area[]>(defaults);
  const [scopes, setScopes] = useState<Scope[]>(suggestScopes(defaults));
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(14);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleArea = (a: Area) => {
    const next = areas.includes(a) ? areas.filter((x) => x !== a) : AREAS.filter((x) => x === a || areas.includes(x));
    setAreas(next);
    setScopes(suggestScopes(next));
  };

  if (made) {
    const link = linkOf(made);
    return (
      <Dialog title={T.readyTitle} onClose={onClose}>
        <p>{T.readyLead}</p>
        <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
          <QrCode value={link} label={T.qr} />
          <div className="stack" style={{ flex: '1 1 220px', minWidth: 0 }}>
            <label className="field">
              <span>{T.link}</span>
              <input id="invite-link" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <AreaChips areas={made.areas} />
            <div className="row">
              <button type="button" className="btn blue" onClick={() => copy(link)}>
                {T.copy}
              </button>
              {'share' in navigator ? (
                <button type="button" className="btn ghost" onClick={() => void navigator.share({ title: T.shareText, url: link }).catch(() => undefined)}>
                  {T.share}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={onClose}>
          {T.done}
        </button>
      </Dialog>
    );
  }

  const submit = async () => {
    if (!areas.length) return setErr(T.pickArea);
    setBusy(true);
    setErr(null);
    try {
      setMade(await createInvite(coach.id, { areas, scopes, message, label, days }));
    } catch {
      setErr(T.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={T.new} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 4 }}>{T.areas}</legend>
          {AREAS.map((a) => (
            <label key={a} className="check">
              <input id={`area-${a}`} type="checkbox" checked={areas.includes(a)} onChange={() => toggleArea(a)} />
              <span>
                {L.area[a]}
                <span className="hint">{L.areaHint[a]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 4 }}>{T.scopes}</legend>
          <p className="small soft">{T.scopesHint}</p>
          <div className="grid cols-2" style={{ gap: 0 }}>
            {SCOPES.map((s) => (
              <label key={s} className="check">
                <input
                  id={`scope-${s}`}
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={() => setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : SCOPES.filter((x) => x === s || scopes.includes(x)))}
                />
                <span>{L.scope[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>{T.message}</span>
          <textarea id="message" maxLength={500} placeholder={T.messagePh} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label className="field">
          <span>{T.label}</span>
          <input id="label" type="text" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} aria-describedby="label-hint" />
          <span className="hint" id="label-hint">{T.labelHint}</span>
        </label>
        <label className="field">
          <span>{T.days}</span>
          <select id="days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[3, 7, 14, 30].map((n) => (
              <option key={n} value={n}>
                {T.dayN(n)}
              </option>
            ))}
          </select>
        </label>
        {err ? <p className="err" role="alert">{err}</p> : null}
        <button type="submit" className="btn blue" disabled={busy || !areas.length}>
          {T.create}
        </button>
      </form>
    </Dialog>
  );
}
