import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Adres i klucze lokalnego Supabase (`supabase status`) — to klucze demonstracyjne CLI, nie produkcyjne. */
const app = process.cwd(); // vitest biegnie z apps/sztab
const status = JSON.parse(execSync('npx supabase status -o json', { cwd: app, stdio: ['ignore', 'pipe', 'ignore'] }).toString()) as {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};

export const URL_ = status.API_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const anon = (): SupabaseClient => createClient(status.API_URL, status.ANON_KEY, opts);
export const admin = (): SupabaseClient => createClient(status.API_URL, status.SERVICE_ROLE_KEY, opts);

/** Nowy prowadzący z potwierdzonym mailem i zalogowany klient jego sesji. */
export async function coachClient(): Promise<{ client: SupabaseClient; id: string; email: string }> {
  const email = `coach-${crypto.randomUUID()}@example.test`;
  const password = 'correct horse battery 9';
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = anon();
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { client, id: data.user.id, email };
}
