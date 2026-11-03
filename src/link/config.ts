/**
 * Współpraca z prowadzącym (GYM TRACKER Sztab) — adresy z buildu.
 *
 * - `VITE_SZTAB_URL` — adres Supabase Sztabu (funkcje RPC pod `/rest/v1/rpc/…`). Lokalnie
 *   `http://127.0.0.1:54321`, w GitHubie zmienna repozytorium `SZTAB_URL`.
 * - `VITE_SZTAB_ANON_KEY` — klucz publiczny (anon) tej bazy. Jawny z założenia: uprawnia tylko
 *   do funkcji dla telefonu, a te i tak chcą tokenu współpracy.
 * - `VITE_SZTAB_APP_URL` — adres aplikacji dla prowadzących, tylko do odnośnika
 *   „Prowadzisz innych?”. Nic z niego nie pobieramy.
 *
 * Bez adresu albo klucza współpracy nie ma wcale: żadnej karty, żadnego zapytania do sieci,
 * a link zaproszenia mówi, że ta wersja aplikacji się nie łączy.
 *
 * Czytane przy każdym wywołaniu, nie raz przy wczytaniu modułu: w buildzie Vite i tak wpisuje
 * tu stałe, a testy podmieniają zmienne (`vi.stubEnv`) bez wczytywania modułów od nowa.
 */

// `||`, nie `??`: workflow wdrożenia podaje nieustawioną zmienną repozytorium jako pusty tekst.
export const sztabUrl = (): string => String(import.meta.env.VITE_SZTAB_URL || '').trim().replace(/\/+$/, '');

export const sztabAnonKey = (): string => String(import.meta.env.VITE_SZTAB_ANON_KEY || '').trim();

/** Adres GYM TRACKER Sztab dla prowadzących — albo pusty, gdy build go nie zna. */
export const sztabAppUrl = (): string => String(import.meta.env.VITE_SZTAB_APP_URL || '').trim();

/** Czy ta wersja aplikacji łączy się ze Sztabem. */
export const linkConfigured = (): boolean => sztabUrl() !== '' && sztabAnonKey() !== '';
