/**
 * Konfiguracja z buildu. Domyślne wartości to lokalny Supabase z `npm run db:start` — jego klucz
 * anon jest demonstracyjnym kluczem CLI, wspólnym dla wszystkich instalacji, nie sekretem.
 */
const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const SUPABASE_URL = import.meta.env.VITE_SZTAB_URL || 'http://127.0.0.1:54321';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SZTAB_ANON_KEY || LOCAL_ANON;
export const TRACKER_URL = import.meta.env.VITE_TRACKER_URL || 'https://aleksanderdudek.github.io/gym-training-tracker/';
export const GOOGLE_SIGN_IN = import.meta.env.VITE_SZTAB_GOOGLE === '1';
