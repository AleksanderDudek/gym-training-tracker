import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MESSAGE_MAX, formatPseudonym, parsePseudonym, shortPseudonym } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import { AreaChips, Dialog, Failure, Link, Loading, ago, fmtDate, toast, useLoad } from '../components/ui';
import {
  addGroup,
  cleanGroupName,
  crmCsv,
  groupNames,
  importAliases,
  importCsv,
  loadAliases,
  loadGroups,
  loadSeen,
  markSeen,
  removeGroup,
} from '../lib/aliases';
import { listConnections, sendMessage, unreadCounts } from '../lib/data';
import type { Connection } from '../lib/data';
import { L } from '../lib/labels';
import { LOW_PCT, compareReviews, reasonText, review } from '../lib/review';
import type { Review, ReviewData } from '../lib/review';
import { forgetReview, loadReview } from '../lib/reviewLoad';
import { navigate } from '../lib/router';
import { useReady } from '../session';
import './clients.css';

// Okna akcji grupowych ciągną bibliotekę i kreatory — dopiero gdy prowadzący po nie sięgnie.
const SendDialog = lazy(() => import('./Send').then((m) => ({ default: m.SendDialog })));
const LaunchProgramDialog = lazy(() => import('../components/LaunchProgram').then((m) => ({ default: m.LaunchProgramDialog })));

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
    show: 'Pokaż',
    all: 'Wszyscy',
    review: 'Do przejrzenia',
    allClear: 'Nikt nie czeka na przejrzenie — wszyscy na bieżąco.',
    counting: (n: number, all: number) => `Sprawdzam dane podopiecznych: ${n} z ${all}…`,
    idAreas: 'Numer i obszary',
    aliasGroups: 'Skrót i grupy',
    unread: ['Wiad.', 'Nieprzeczytane wiadomości'],
    answers: ['Odp.', 'Nowe odpowiedzi na formularze od ostatniego otwarcia'],
    training: ['Trening', 'Treningi z ostatnich 7 dni wobec planu'],
    habits: ['Nawyki', 'Odhaczone nawyki, 7 pełnych dni'],
    meals: ['Jadłospis', 'Zjedzone posiłki z jadłospisu, 7 pełnych dni'],
    why: 'Dlaczego',
    notApplicable: 'nie dotyczy',
    waiting: 'wczytuję',
    loadFailed: 'Nie udało się wczytać danych tego podopiecznego. Odśwież stronę, żeby spróbować ponownie.',
    failedShort: 'bez danych',
    selectAll: 'Zaznacz wszystkich (w filtrze)',
    select: (who: string) => `Zaznacz: ${who}`,
    selected: (n: number) => `Zaznaczono: ${n}`,
    send: 'Wyślij…',
    launch: 'Uruchom program…',
    message: 'Wiadomość do zaznaczonych',
    clear: 'Odznacz',
    group: 'grupa',
    addGroup: (who: string) => `Dodaj grupę: ${who}`,
    groupName: 'Nazwa grupy',
    removeGroup: (g: string) => `Usuń z grupy „${g}”`,
    groupsNote: 'Grupy zostają w tej przeglądarce, jak skróty — serwer ich nie zna. Na inny komputer przeniesiesz je plikiem CSV.',
    exportCsv: 'Pobierz listę (CSV)',
    importCsv: 'Wczytaj skróty i grupy',
    imported: (a: number, g: number) => `Wczytano — skróty: ${a}, grupy: ${g}`,
    importFailed: 'Tego pliku nie da się wczytać.',
    statusActive: 'trwa',
    statusEnded: 'zakończona',
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
    show: 'Show',
    all: 'Everyone',
    review: 'Needs review',
    allClear: 'Nobody needs a review — everyone is up to date.',
    counting: (n: number, all: number) => `Checking client data: ${n} of ${all}…`,
    idAreas: 'Number and areas',
    aliasGroups: 'Alias and groups',
    unread: ['Msg.', 'Unread messages'],
    answers: ['Ans.', 'New form answers since you last opened the client'],
    training: ['Training', 'Workouts in the last 7 days against the plan'],
    habits: ['Habits', 'Ticked habits, last 7 full days'],
    meals: ['Meals', 'Meals eaten from the meal plan, last 7 full days'],
    why: 'Why',
    notApplicable: 'not applicable',
    waiting: 'loading',
    loadFailed: 'Could not load this client’s data. Refresh the page to try again.',
    failedShort: 'no data',
    selectAll: 'Select everyone (in the filter)',
    select: (who: string) => `Select: ${who}`,
    selected: (n: number) => `Selected: ${n}`,
    send: 'Send…',
    launch: 'Launch program…',
    message: 'Message the selected',
    clear: 'Clear',
    group: 'group',
    addGroup: (who: string) => `Add a group: ${who}`,
    groupName: 'Group name',
    removeGroup: (g: string) => `Remove from group “${g}”`,
    groupsNote: 'Groups stay in this browser, like aliases — the server never sees them. Move them to another computer with the CSV file.',
    exportCsv: 'Download list (CSV)',
    importCsv: 'Load aliases and groups',
    imported: (a: number, g: number) => `Loaded — aliases: ${a}, groups: ${g}`,
    importFailed: 'This file cannot be loaded.',
    statusActive: 'active',
    statusEnded: 'ended',
  },
});

type Filter = 'all' | 'review' | `g:${string}`;
type Loaded = ReviewData | 'error';
type DialogKind = 'send' | 'program' | 'message';

const GROUPS_LIST_ID = 'sz-clients-group-names';

/** Dane do „Do przejrzenia” dla trwających współprac: w tle, z pamięcią sesji (`reviewLoad`). */
function useReviewData(key: CryptoKey, conns: readonly Connection[], version: number): Record<string, Loaded> {
  const [got, setGot] = useState<Record<string, Loaded>>({});
  useEffect(() => {
    let alive = true;
    for (const c of conns) {
      loadReview(key, c).then(
        (d) => alive && setGot((g) => ({ ...g, [c.id]: d })),
        () => alive && setGot((g) => ({ ...g, [c.id]: 'error' })),
      );
    }
    return () => {
      alive = false;
    };
  }, [key, conns, version]);
  return got;
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Clients() {
  const { user, key } = useReady();
  const { data, error, reload } = useLoad(listConnections, []);
  // Licznik wiadomości to dodatek: gdy zawiedzie, lista i tak się pokazuje.
  const unread = useLoad(() => unreadCounts().catch((): Record<string, number> => ({})), []);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'active' | 'ended'>('active');
  const [chosen, setFilter] = useState<Filter>('all');
  const [aliases, setAliases] = useState(() => loadAliases(user.id));
  const [groups, setGroups] = useState(() => loadGroups(user.id));
  const seen = useMemo(() => loadSeen(user.id), [user.id]);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [version, setVersion] = useState(0);
  // Chwila wejścia na listę — wiek danych i okna 7 dni liczą się od niej przez całą wizytę.
  const [now] = useState(() => Date.now());
  const file = useRef<HTMLInputElement>(null);

  const active = useMemo(() => (data ?? []).filter((c) => c.status === 'active'), [data]);
  const got = useReviewData(key, active, version);

  const reviews = useMemo(() => {
    const counts = unread.data ?? {};
    const out = new Map<string, Review>();
    for (const c of active) {
      const d = got[c.id];
      out.set(c.id, review(c, d && d !== 'error' ? d : null, { unread: counts[c.id] ?? 0, lastSeen: seen[c.id] ?? null, now }));
    }
    return out;
  }, [active, got, unread.data, seen, now]);

  const known = useMemo(() => groupNames(groups), [groups]);
  const groupOf = (c: Connection) => groups[c.pseudonym] ?? [];
  const who = (c: Connection) => aliases[c.pseudonym] ?? shortPseudonym(c.pseudonym);
  const sees = (c: Connection) => (c.scopes.length ? c.scopes.map((s) => L.scopeShort[s]).join(', ') : T.none);

  // Grupa zniknęła (ostatni podopieczny wypisany) — wracamy do wszystkich.
  const filter: Filter = chosen.startsWith('g:') && !known.includes(chosen.slice(2)) ? 'all' : chosen;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const asId = parsePseudonym(q) ?? q.trim().toUpperCase().replace(/^GT-?/, '').replace(/-/g, '');
    const list = (data ?? [])
      .filter((c) => c.status === tab)
      .filter((c) => !needle || c.pseudonym.startsWith(asId) || (aliases[c.pseudonym] ?? '').toLowerCase().includes(needle));
    if (tab === 'ended' || filter === 'all') return list;
    if (filter === 'review')
      return list
        .filter((c) => reviews.get(c.id)!.score > 0)
        .sort((a, b) => compareReviews(reviews.get(a.id)!, reviews.get(b.id)!) || a.pseudonym.localeCompare(b.pseudonym));
    const g = filter.slice(2).toLocaleLowerCase();
    return list.filter((c) => (groups[c.pseudonym] ?? []).some((x) => x.toLocaleLowerCase() === g));
  }, [data, q, tab, aliases, filter, reviews, groups]);

  const counts = { active: active.length, ended: data?.filter((c) => c.status === 'ended').length ?? 0 };
  const toReview = active.filter((c) => reviews.get(c.id)!.score > 0).length;
  const pending = active.filter((c) => got[c.id] === undefined).length;

  // Zaznaczać da się tylko trwające; po zmianie listy zostają tylko ci, którzy wciąż trwają.
  const selected = useMemo(() => active.filter((c) => picked.has(c.id)), [active, picked]);
  const selectedIds = useRef<string[]>([]);
  useEffect(() => {
    selectedIds.current = selected.map((c) => c.id);
  }, [selected]);
  const visibleIds = tab === 'active' ? rows.map((c) => c.id) : [];
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => picked.has(id));
  const someVisible = visibleIds.some((id) => picked.has(id));
  const headBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = someVisible && !allVisible;
  }, [someVisible, allVisible]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleVisible = () =>
    setPicked((p) => {
      const n = new Set(p);
      for (const id of visibleIds) {
        if (allVisible) n.delete(id);
        else n.add(id);
      }
      return n;
    });

  // Stała funkcja: okno (`Dialog`) wiesza na niej fokus i klawisz Escape.
  const closeDialog = useCallback(() => {
    // Wysyłka mogła dodać zalecenia — dane zaznaczonych liczymy od nowa.
    for (const id of selectedIds.current) forgetReview(key, id);
    setVersion((v) => v + 1);
    setDialog(null);
  }, [key]);
  const closeMessage = useCallback(() => setDialog(null), []);
  const noop = useCallback(() => undefined, []);

  const open = (c: Connection) => {
    if (c.status === 'active') {
      markSeen(user.id, c.id);
      forgetReview(key, c.id);
    }
    navigate(`/podopieczni/${c.id}`);
  };

  const exportCsv = () => {
    const rows = (data ?? []).map((c) => ({
      pseudonym: formatPseudonym(c.pseudonym),
      alias: aliases[c.pseudonym] ?? '',
      areas: c.areas.map((a) => L.area[a]).join(', '),
      since: new Date(c.createdAt).toLocaleDateString(LOCALE),
      status: c.status === 'active' ? T.statusActive : T.statusEnded,
      groups: (groups[c.pseudonym] ?? []).join(', '),
    }));
    download('sztab-podopieczni.csv', crmCsv(rows), 'text/csv;charset=utf-8');
  };

  const importFile = async (f: File) => {
    try {
      const body = await f.text();
      // Plik skrótów z Ustawień (JSON) też przejdzie — bez grup.
      const r = body.trim().startsWith('{') ? { aliases: importAliases(user.id, JSON.parse(body)), groups: 0 } : importCsv(user.id, body);
      setAliases(loadAliases(user.id));
      setGroups(loadGroups(user.id));
      toast(T.imported(r.aliases, r.groups));
    } catch {
      toast(T.importFailed);
    }
  };

  const filters: [Filter, ReactNode, number][] = [
    ['all', T.all, counts.active],
    ['review', T.review, toReview],
    ...known.map((g): [Filter, ReactNode, number] => [`g:${g}`, g, active.filter((c) => groupOf(c).some((x) => x.toLocaleLowerCase() === g.toLocaleLowerCase())).length]),
  ];

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

          {tab === 'active' && active.length ? (
            <>
              <div className="sz-clients-filters" role="group" aria-label={T.show}>
                {filters.map(([f, label, n]) => (
                  <button
                    key={f}
                    type="button"
                    className={`sz-clients-chip${f === 'review' && n ? ' sz-clients-attn' : ''}`}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {label}
                    <span className="sz-clients-n">{n}</span>
                  </button>
                ))}
              </div>
              {pending ? (
                <p className="sz-clients-status" role="status">
                  {T.counting(active.length - pending, active.length)}
                </p>
              ) : null}
              {selected.length ? (
                <div className="sz-clients-bulk" role="region" aria-label={T.selected(selected.length)}>
                  <strong aria-live="polite">{T.selected(selected.length)}</strong>
                  <button type="button" className="btn ghost small" onClick={() => setDialog('send')}>
                    {T.send}
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => setDialog('program')}>
                    {T.launch}
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => setDialog('message')}>
                    {T.message}
                  </button>
                  <button type="button" className="btn link small" onClick={() => setPicked(new Set())}>
                    {T.clear}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="scroll-x" style={{ marginTop: 12 }}>
            {tab === 'active' ? (
              <table className="tbl sz-clients-tbl">
                <thead>
                  <tr>
                    <th className="sz-clients-check">
                      <label>
                        <input
                          ref={headBox}
                          type="checkbox"
                          checked={allVisible}
                          disabled={!visibleIds.length}
                          aria-label={T.selectAll}
                          title={T.selectAll}
                          onChange={toggleVisible}
                        />
                      </label>
                    </th>
                    <th>{T.idAreas}</th>
                    <th>{T.aliasGroups}</th>
                    <th>{T.why}</th>
                    <th>{T.data}</th>
                    <Th abbr={T.unread} />
                    <Th abbr={T.answers} />
                    <Th abbr={T.training} />
                    <Th abbr={T.habits} />
                    <Th abbr={T.meals} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const r = reviews.get(c.id)!;
                    const state = got[c.id];
                    const waiting = state === undefined;
                    const failed = state === 'error';
                    const isPicked = picked.has(c.id);
                    return (
                      <tr key={c.id} className={`link${isPicked ? ' sz-clients-picked' : ''}`} aria-busy={waiting || undefined} onClick={() => open(c)}>
                        <td className="sz-clients-check" onClick={(e) => e.stopPropagation()}>
                          <label>
                            <input type="checkbox" checked={isPicked} aria-label={T.select(who(c))} onChange={() => toggle(c.id)} />
                          </label>
                        </td>
                        <td>
                          <a
                            href={`/podopieczni/${c.id}`}
                            className="pid"
                            title={formatPseudonym(c.pseudonym)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              open(c);
                            }}
                          >
                            {shortPseudonym(c.pseudonym)}
                          </a>
                          <div className="sz-clients-areas" title={`${T.sees}: ${sees(c)}`}>
                            <AreaChips areas={c.areas} />
                            <span className="sr">{`${T.sees}: ${sees(c)}`}</span>
                          </div>
                        </td>
                        <td className="sz-clients-labels" onClick={(e) => e.stopPropagation()}>
                          {aliases[c.pseudonym] ? <div className="sz-clients-alias">{aliases[c.pseudonym]}</div> : null}
                          <GroupCell
                            who={who(c)}
                            list={groupOf(c)}
                            onAdd={(g) => setGroups(addGroup(user.id, c.pseudonym, g))}
                            onRemove={(g) => setGroups(removeGroup(user.id, c.pseudonym, g))}
                          />
                        </td>
                        <td>
                          <Reasons r={r} waiting={waiting} failed={failed} />
                        </td>
                        <td className={`small sz-clients-age${r.stale ? ' sz-clients-warn' : ''}`}>{c.lastPushAt ? ago(c.lastPushAt) : <span className="soft">{T.never}</span>}</td>
                        <td className="n">{r.unread ? <span className="sz-clients-hot">{r.unread}</span> : <span className="soft">0</span>}</td>
                        <td className="n">
                          <Cell waiting={waiting} failed={failed} value={r.newAnswers} render={(n) => (n ? <strong>{n}</strong> : <span className="soft">0</span>)} />
                        </td>
                        <td className="n">
                          <Cell waiting={waiting} failed={failed} value={r.training} render={pct} />
                        </td>
                        <td className="n">
                          <Cell waiting={waiting} failed={failed} value={r.habits} render={pct} />
                        </td>
                        <td className="n">
                          <Cell waiting={waiting} failed={failed} value={r.meals} render={pct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{T.id}</th>
                    <th>{T.alias}</th>
                    <th>{T.areas}</th>
                    <th>{T.sees}</th>
                    <th>{T.since}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="link" onClick={() => open(c)}>
                      <td>
                        <a
                          href={`/podopieczni/${c.id}`}
                          className="pid"
                          title={formatPseudonym(c.pseudonym)}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            open(c);
                          }}
                        >
                          {shortPseudonym(c.pseudonym)}
                        </a>
                      </td>
                      <td>{aliases[c.pseudonym] ?? <span className="soft">—</span>}</td>
                      <td>
                        <AreaChips areas={c.areas} />
                      </td>
                      <td className="small">{sees(c)}</td>
                      <td className="small">{`${fmtDate(c.endedAt ?? c.createdAt, LOCALE)} · ${c.endedBy ? T.endedBy[c.endedBy] : ''}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Póki dane się liczą, „Do przejrzenia” może jeszcze kogoś pokazać — postęp mówi pasek nad tabelą. */}
            {!rows.length && !(tab === 'active' && filter === 'review' && pending) ? (
              <p className="soft" style={{ padding: 16 }}>
                {tab === 'active' && filter === 'review' && !q.trim() ? T.allClear : T.nothing}
              </p>
            ) : null}
          </div>

          <div className="sz-clients-foot">
            <p>{T.groupsNote}</p>
            <div className="row">
              <button type="button" className="btn ghost small" onClick={exportCsv}>
                {T.exportCsv}
              </button>
              <button type="button" className="btn ghost small" onClick={() => file.current?.click()}>
                {T.importCsv}
              </button>
              <input
                ref={file}
                type="file"
                accept=".csv,text/csv,.json,application/json"
                hidden
                aria-label={T.importCsv}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void importFile(f);
                }}
              />
            </div>
          </div>
          <datalist id={GROUPS_LIST_ID}>
            {known.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </section>
      ) : null}

      {dialog && selected.length ? (
        <Suspense fallback={null}>
          {dialog === 'send' ? <SendDialog connection={selected[0]!} recipients={selected} onClose={closeDialog} onSent={noop} /> : null}
          {dialog === 'program' ? <LaunchProgramDialog program={null} connections={selected} onClose={closeDialog} /> : null}
          {dialog === 'message' ? <MessageDialog recipients={selected} who={who} onClose={closeMessage} /> : null}
        </Suspense>
      ) : null}
    </>
  );
}

const pct = (n: number) => <span className={n < LOW_PCT ? 'sz-clients-warn' : n >= 80 ? 'sz-clients-good' : undefined}>{n}%</span>;

function Th({ abbr: [short, long] }: { abbr: string[] }) {
  return (
    <th className="n">
      <abbr title={long}>{short}</abbr>
    </th>
  );
}

function Wait() {
  return (
    <>
      <span className="sz-clients-wait" aria-hidden="true" />
      <span className="sr">{T.waiting}</span>
    </>
  );
}

/** Komórka liczby z przeglądu: czeka, nie wczytała się, nie dotyczy (—) albo wartość. */
function Cell({ waiting, failed, value, render }: { waiting: boolean; failed: boolean; value: number | null; render: (n: number) => ReactNode }) {
  if (waiting) return <Wait />;
  if (failed) return <span className="soft">?</span>;
  if (value === null)
    return (
      <span className="soft" title={T.notApplicable}>
        —
      </span>
    );
  return <>{render(value)}</>;
}

function Reasons({ r, waiting, failed }: { r: Review; waiting: boolean; failed: boolean }) {
  if (!r.reasons.length && waiting) return <Wait />;
  if (!r.reasons.length && !failed) return <span className="soft">—</span>;
  return (
    <ul className="sz-clients-reasons">
      {r.reasons.map((x) => (
        <li key={x.code} className="sz-clients-reason">
          {reasonText(x)}
        </li>
      ))}
      {failed ? (
        <li className="sz-clients-reason sz-clients-soft" title={T.loadFailed}>
          {T.failedShort}
        </li>
      ) : null}
    </ul>
  );
}

/** Grupy w wierszu: usuwanie krzyżykiem, dopisanie z podpowiedzią istniejących grup. */
function GroupCell({ who, list, onAdd, onRemove }: { who: string; list: string[]; onAdd: (g: string) => void; onRemove: (g: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const addBtn = useRef<HTMLButtonElement>(null);
  const back = useRef(false);
  useEffect(() => {
    if (editing) input.current?.focus();
    else if (back.current) {
      back.current = false;
      addBtn.current?.focus();
    }
  }, [editing]);
  const done = (save: boolean, refocus: boolean) => {
    const g = cleanGroupName(v);
    if (save && g) onAdd(g);
    setV('');
    back.current = refocus;
    setEditing(false);
  };
  return (
    <div className="sz-clients-groups">
      {list.map((g) => (
        <span key={g} className="sz-clients-group">
          <span>{g}</span>
          <button type="button" aria-label={T.removeGroup(g)} title={T.removeGroup(g)} onClick={() => onRemove(g)}>
            ×
          </button>
        </span>
      ))}
      {editing ? (
        <input
          ref={input}
          type="text"
          className="sz-clients-groupin"
          list={GROUPS_LIST_ID}
          aria-label={T.addGroup(who)}
          placeholder={T.groupName}
          maxLength={32}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              done(true, true);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              done(false, true);
            }
          }}
          onBlur={() => done(true, false)}
        />
      ) : list.length < 8 ? (
        <button ref={addBtn} type="button" className="sz-clients-addgroup" aria-label={T.addGroup(who)} onClick={() => setEditing(true)}>
          + {T.group}
        </button>
      ) : null}
    </div>
  );
}

const M = text({
  pl: {
    title: 'Wiadomość do zaznaczonych',
    to: (n: number) => `Odbiorcy (${n})`,
    body: 'Treść',
    lead: 'Każdy dostaje osobną kopię, zaszyfrowaną kluczem waszej współpracy. Odbiorcy nie widzą siebie nawzajem.',
    send: (n: number) => `Wyślij (${n})`,
    progress: (d: number, n: number) => `Wysyłam: ${d} z ${n}`,
    done: (ok: number, n: number) => `Wysłano do ${ok} z ${n}.`,
    failed: 'Nie doszło do:',
    retry: 'Ponów dla nieudanych',
    close: 'Zamknij',
  },
  en: {
    title: 'Message the selected',
    to: (n: number) => `Recipients (${n})`,
    body: 'Message',
    lead: 'Everyone gets a separate copy, encrypted with your collaboration key. Recipients don’t see each other.',
    send: (n: number) => `Send (${n})`,
    progress: (d: number, n: number) => `Sending: ${d} of ${n}`,
    done: (ok: number, n: number) => `Sent to ${ok} of ${n}.`,
    failed: 'Not delivered to:',
    retry: 'Retry the failed ones',
    close: 'Close',
  },
});

/** Ta sama wiadomość do wielu: każda współpraca szyfruje swoim kluczem, po kolei, z postępem i podsumowaniem. */
function MessageDialog({ recipients, who, onClose }: { recipients: Connection[]; who: (c: Connection) => string; onClose: () => void }) {
  const { key } = useReady();
  const [msg, setMsg] = useState('');
  const [run, setRun] = useState<{ total: number; done: number; failed: Connection[]; busy: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    // Tryb ścisły Reacta montuje dwa razy — po drugim montażu okno znowu żyje.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const sendTo = async (list: Connection[]) => {
    const body = msg.trim();
    if (!body || !list.length) return;
    const failed: Connection[] = [];
    setRun({ total: list.length, done: 0, failed, busy: true });
    for (const [i, c] of list.entries()) {
      // Zamknięte okno zatrzymuje wysyłkę: kolejni już nie dostaną.
      if (!alive.current) return;
      try {
        await sendMessage(key, c, body);
      } catch {
        failed.push(c);
      }
      if (alive.current) setRun({ total: list.length, done: i + 1, failed: [...failed], busy: i + 1 < list.length });
    }
  };

  const busy = !!run?.busy;
  const finished = !!run && !run.busy;
  return (
    <Dialog title={M.title} onClose={onClose}>
      <p className="soft small">{M.lead}</p>
      <div className="stack">
        <strong className="small">{M.to(recipients.length)}</strong>
        <div className="sz-clients-to">
          {recipients.map((c) => (
            <span key={c.id} className="chip">
              {who(c)}
            </span>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{M.body}</span>
        <textarea id="sz-clients-msg" value={msg} maxLength={MESSAGE_MAX} disabled={busy || finished} onChange={(e) => setMsg(e.target.value)} />
        <span className="sz-clients-count" aria-hidden="true">
          {msg.length} / {MESSAGE_MAX}
        </span>
      </label>
      {run ? (
        <div className="stack" role="status" aria-live="polite">
          <progress className="sz-clients-progress" max={run.total} value={run.done} />
          <span className="small">{busy ? M.progress(run.done, run.total) : M.done(run.total - run.failed.length, run.total)}</span>
          {finished && run.failed.length ? (
            <span className="err">
              {M.failed} {run.failed.map(who).join(', ')}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="row">
        {!run ? (
          <button type="button" className="btn blue" disabled={!msg.trim()} onClick={() => void sendTo(recipients)}>
            {M.send(recipients.length)}
          </button>
        ) : null}
        {finished && run.failed.length ? (
          <button type="button" className="btn blue" onClick={() => void sendTo(run.failed)}>
            {M.retry}
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={onClose}>
          {M.close}
        </button>
      </div>
    </Dialog>
  );
}
