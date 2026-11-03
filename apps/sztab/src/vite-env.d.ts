/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adres projektu Supabase. Bez niego — lokalny Supabase z `npm run db:start`. */
  readonly VITE_SZTAB_URL?: string;
  /** Klucz publiczny (anon) projektu. */
  readonly VITE_SZTAB_ANON_KEY?: string;
  /** Adres GYM TRACKERa, pod który prowadzą linki zaproszeń. */
  readonly VITE_TRACKER_URL?: string;
  /** `1` — przycisk „Zaloguj przez Google” (wymaga klienta OAuth w projekcie Supabase). */
  readonly VITE_SZTAB_GOOGLE?: string;
}
