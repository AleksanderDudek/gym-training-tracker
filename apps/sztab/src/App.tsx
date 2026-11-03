import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { text } from '@gt/i18n';
import { Link, Loading, Toaster, useLoad } from './components/ui';
import { inviteState, listConnections, listInvites } from './lib/data';
import { L } from './lib/labels';
import { match, useLocation, useRedirect } from './lib/router';
import { SessionProvider, useReady, useSession } from './session';
import { NewPassword, ResetRequest, SignIn, SignUp } from './pages/Auth';
import { Onboarding, Unlock } from './pages/Vault';

// Strony za logowaniem w osobnych paczkach: logowanie nie ciągnie atlasu, planów ani silnika.
const Clients = lazy(() => import('./pages/Clients').then((m) => ({ default: m.Clients })));
const ClientPage = lazy(() => import('./pages/Client').then((m) => ({ default: m.ClientPage })));
const Invites = lazy(() => import('./pages/Invites').then((m) => ({ default: m.Invites })));
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const LibraryEditor = lazy(() => import('./pages/Library').then((m) => ({ default: m.LibraryEditor })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })));

const T = text({
  pl: { clients: 'Podopieczni', invites: 'Zaproszenia', library: 'Biblioteka', settings: 'Ustawienia', privacy: 'RODO i rejestr', signOut: 'Wyloguj', notFound: 'Nie ma takiej strony.' },
  en: { clients: 'Clients', invites: 'Invites', library: 'Library', settings: 'Settings', privacy: 'GDPR and records', signOut: 'Sign out', notFound: 'No such page.' },
});

const PUBLIC = ['/logowanie', '/rejestracja', '/haslo'];

export function App() {
  return (
    <SessionProvider>
      <Gate />
      <Toaster />
    </SessionProvider>
  );
}

function Gate() {
  const { session } = useSession();
  const { path } = useLocation();

  const isPublic = PUBLIC.includes(path);
  const redirect =
    session.kind === 'loading'
      ? null
      : session.kind === 'out'
        ? isPublic
          ? null
          : '/logowanie'
        : session.kind === 'new'
          ? path === '/start'
            ? null
            : '/start'
          : session.kind === 'locked'
            ? path === '/sejf'
              ? null
              : '/sejf'
            : isPublic || path === '/' || path === '/start' || path === '/sejf'
              ? '/podopieczni'
              : null;
  // Strona nowego hasła działa z sesją odzyskiwania — nie przekierowujemy z niej nigdzie.
  useRedirect(path === '/haslo/nowe' ? null : redirect);

  if (path === '/haslo/nowe') return <NewPassword />;
  if (session.kind === 'loading' || redirect) return null;
  if (session.kind === 'out') {
    if (path === '/rejestracja') return <SignUp />;
    if (path === '/haslo') return <ResetRequest />;
    return <SignIn />;
  }
  if (session.kind === 'new') return <Onboarding />;
  if (session.kind === 'locked') return <Unlock />;
  return <Shell path={path} />;
}

function Shell({ path }: { path: string }) {
  const { coach, signOut } = useReady();
  const counts = useLoad(async () => {
    const [c, i] = await Promise.all([listConnections(), listInvites()]);
    return { clients: c.filter((x) => x.status === 'active').length, invites: i.filter((x) => inviteState(x) === 'open').length };
  }, [path]);

  let page: ReactNode;
  let m: Record<string, string> | null;
  if (path === '/podopieczni') page = <Clients />;
  else if ((m = match('/podopieczni/:id', path))) page = <ClientPage id={m.id!} />;
  else if (path === '/zaproszenia') page = <Invites />;
  else if (path === '/biblioteka') page = <Library />;
  else if ((m = match('/biblioteka/nowy/:kind', path))) page = <LibraryEditor kind={m.kind!} />;
  else if ((m = match('/biblioteka/:id', path))) page = <LibraryEditor id={m.id!} />;
  else if (path === '/ustawienia') page = <Settings />;
  else if (path === '/rodo') page = <Privacy />;
  else page = <p>{T.notFound}</p>;

  const nav: [string, string, number | undefined][] = [
    ['/podopieczni', T.clients, counts.data?.clients],
    ['/zaproszenia', T.invites, counts.data?.invites],
    ['/biblioteka', T.library, undefined],
    ['/ustawienia', T.settings, undefined],
    ['/rodo', T.privacy, undefined],
  ];

  return (
    <div className="shell">
      <aside className="side">
        <Link to="/podopieczni" className="brand">
          <span className="mark" aria-hidden="true">
            GT
          </span>
          <span>
            GYM TRACKER<small>SZTAB</small>
          </span>
        </Link>
        <nav className="nav" aria-label="Sztab">
          {nav.map(([to, label, count]) => (
            <Link key={to} to={to} current={path === to || path.startsWith(`${to}/`)}>
              <span>{label}</span>
              {count ? <span className="count">{count}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="me">
          <strong>{coach.display_name}</strong>
          <span className="soft">{L.profession[coach.profession]}</span>
          <button type="button" className="btn link" style={{ justifyContent: 'flex-start', padding: 0 }} onClick={() => void signOut()}>
            {T.signOut}
          </button>
        </div>
      </aside>
      <main className="main" id="main">
        <Suspense fallback={<Loading />}>{page}</Suspense>
      </main>
    </div>
  );
}
