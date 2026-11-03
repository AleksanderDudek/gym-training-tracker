import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Klient Supabase. PKCE: linki z maila (potwierdzenie, reset hasła) wracają z `?code=`, który
 * biblioteka sama wymienia na sesję — bez tokenów w adresie.
 */
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Kod błędu z `raise exception 'kod'` w funkcjach bazy — albo komunikat biblioteki. */
export const errorCode = (e: { message?: string } | null | undefined): string => e?.message ?? 'unknown';
