import { useMemo, useState } from 'react';
import { formatPseudonym, parsePseudonym, shortPseudonym } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import { AreaChips, Failure, Link, Loading, ago, fmtDate, useLoad } from '../components/ui';
import { loadAliases } from '../lib/aliases';
import { listConnections } from '../lib/data';
import { L } from '../lib/labels';
import { navigate } from '../lib/router';
import { useReady } from '../session';

const T = text({
  pl: {
    title: 'Podopieczni',
    lead: 'Każdy podopieczny to numer, nie nazwisko. Kto jest kim, trzymasz u siebie — skrót obok numeru widzisz tylko na tym komputerze.',
    invite: 'Zaproś podopiecznego',
    search: 'Szukaj po numerze albo skrócie',
    active: 'Trwające',
    ended: 'Zakończone',
    id: 'Numer',
    alias: 'Skrót',
    areas: 'Obszary',
    sees: 'Widzisz',
    data: 'Dane z',
    since: 'Od',
    none: 'Nic',
    never: 'jeszcze nic',
    emptyTitle: 'Nie masz jeszcze podopiecznych',
    emptyText: 'Wyślij zaproszenie. Podopieczny otworzy je w GYM TRACKERze i sam wybierze, co ci pokaże.',
    endedBy: { client: 'zakończył podopieczny', coach: 'zakończyłeś ty' },
    nothing: 'Nic nie pasuje do wyszukiwania.',
  },
  en: {
    title: 'Clients',
    lead: 'Each client is a number, not a name. Who is who stays with you — the alias next to a number lives on this computer only.',
    invite: 'Invite a client',
    search: 'Search by number or alias',
    active: 'Active',
    ended: 'Ended',
    id: 'Number',
    alias: 'Alias',
    areas: 'Areas',
    sees: 'You see',
    data: 'Data from',
    since: 'Since',
    none: 'Nothing',
    never: 'nothing yet',
    emptyTitle: 'No clients yet',
    emptyText: 'Send an invite. The client opens it in GYM TRACKER and picks what to share with you.',
    endedBy: { client: 'ended by the client', coach: 'ended by you' },
    nothing: 'Nothing matches the search.',
  },
});

export function Clients() {
  const { user } = useReady();
  const { data, error, reload } = useLoad(listConnections, []);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'active' | 'ended'>('active');
  const aliases = useMemo(() => loadAliases(user.id), [user.id]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const asId = parsePseudonym(q) ?? q.trim().toUpperCase().replace(/^GT-?/, '').replace(/-/g, '');
    return (data ?? [])
      .filter((c) => c.status === tab)
      .filter((c) => !needle || c.pseudonym.startsWith(asId) || (aliases[c.pseudonym] ?? '').toLowerCase().includes(needle));
  }, [data, q, tab, aliases]);

  const counts = { active: data?.filter((c) => c.status === 'active').length ?? 0, ended: data?.filter((c) => c.status === 'ended').length ?? 0 };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{T.title}</h1>
          <p className="lead">{T.lead}</p>
        </div>
        <Link to="/zaproszenia?nowe=1" className="btn blue">
          {T.invite}
        </Link>
      </div>
      {error ? <Failure error={error} retry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.length === 0 ? (
        <section className="card empty">
          <h3>{T.emptyTitle}</h3>
          <p>{T.emptyText}</p>
          <Link to="/zaproszenia?nowe=1" className="btn blue">
            {T.invite}
          </Link>
        </section>
      ) : null}
      {data && data.length > 0 ? (
        <section className="card flat">
          <div className="row between" style={{ padding: '12px 16px 0' }}>
            <div className="tabs" role="tablist" style={{ borderBottom: 0 }}>
              {(['active', 'ended'] as const).map((t) => (
                <a
                  key={t}
                  href="#"
                  role="tab"
                  aria-selected={tab === t}
                  aria-current={tab === t ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setTab(t);
                  }}
                >
                  {T[t]}
                  <span className="count">{counts[t]}</span>
                </a>
              ))}
            </div>
            <label style={{ flex: '1 1 240px', maxWidth: 340 }}>
              <span className="sr">{T.search}</span>
              <input id="search" type="search" placeholder={T.search} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <div className="scroll-x" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{T.id}</th>
                  <th>{T.alias}</th>
                  <th>{T.areas}</th>
                  <th>{T.sees}</th>
                  <th>{tab === 'active' ? T.data : T.since}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="link" onClick={() => navigate(`/podopieczni/${c.id}`)}>
                    <td>
                      <a
                        href={`/podopieczni/${c.id}`}
                        className="pid"
                        title={formatPseudonym(c.pseudonym)}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/podopieczni/${c.id}`);
                        }}
                      >
                        {shortPseudonym(c.pseudonym)}
                      </a>
                    </td>
                    <td>{aliases[c.pseudonym] ?? <span className="soft">—</span>}</td>
                    <td>
                      <AreaChips areas={c.areas} />
                    </td>
                    <td className="small">{c.scopes.length ? c.scopes.map((s) => L.scopeShort[s]).join(', ') : T.none}</td>
                    <td className="small">
                      {c.status === 'active'
                        ? c.lastPushAt
                          ? ago(c.lastPushAt)
                          : <span className="soft">{T.never}</span>
                        : `${fmtDate(c.endedAt ?? c.createdAt, LOCALE)} · ${c.endedBy ? T.endedBy[c.endedBy] : ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? <p className="soft" style={{ padding: 16 }}>{T.nothing}</p> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
