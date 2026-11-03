import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCoach } from './lib/data';
import type { Coach } from './lib/data';
import { navigate } from './lib/router';
import { sb } from './lib/sb';
import { loadDeviceKey } from './lib/vault';

/**
 * Stan logowania, w czterech krokach: brak sesji → konto bez profilu (pierwsze kroki i sejf) →
 * profil bez klucza na tym komputerze (otwarcie sejfu kodem) → gotowe.
 */
export type Session =
  | { kind: 'loading' }
  | { kind: 'out' }
  | { kind: 'new'; user: User }
  | { kind: 'locked'; user: User; coach: Coach }
  | { kind: 'ready'; user: User; coach: Coach; key: CryptoKey };

interface Ctx {
  session: Session;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ kind: 'loading' });

  const resolve = useCallback(async (user: User | null) => {
    if (!user) return setSession({ kind: 'out' });
    try {
      const coach = await getCoach(user.id);
      if (!coach) return setSession({ kind: 'new', user });
      const device = await loadDeviceKey(user.id);
      // Klucz z innego sejfu (konto usunięte i założone od nowa) nie otworzy niczego — jak brak klucza.
      if (!device || device.fingerprint !== coach.key_fingerprint) return setSession({ kind: 'locked', user, coach });
      setSession({ kind: 'ready', user, coach, key: device.privateKey });
    } catch {
      setSession({ kind: 'out' });
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void sb.auth.getSession().then(({ data }) => {
      if (alive) void resolve(data.session?.user ?? null);
    });
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/haslo/nowe', { replace: true });
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void resolve(s?.user ?? null);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [resolve]);

  const refresh = useCallback(async () => {
    const { data } = await sb.auth.getUser();
    await resolve(data.user);
  }, [resolve]);

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    navigate('/logowanie', { replace: true });
  }, []);

  return <SessionCtx.Provider value={{ session, refresh, signOut }}>{children}</SessionCtx.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession poza SessionProvider');
  return c;
}

/** Dla stron za logowaniem — prowadzący z kluczem. */
export function useReady(): Extract<Session, { kind: 'ready' }> & Pick<Ctx, 'refresh' | 'signOut'> {
  const { session, refresh, signOut } = useSession();
  if (session.kind !== 'ready') throw new Error('useReady bez gotowej sesji');
  return { ...session, refresh, signOut };
}
