import { sb } from './sb';
import { leftoverFactors, normalizeCode, verifiedFactor } from './mfa';
import type { FactorLike } from './mfa';

/** Wynik prośby o kod: `ok`, zły kod, limit prób albo inny błąd (komunikat dobiera ekran). */
export type CodeResult = 'ok' | 'bad' | 'rate' | 'format' | 'other';

export function codeResult(error: { code?: string; status?: number } | null): CodeResult {
  if (!error) return 'ok';
  if (error.code === 'mfa_verification_failed' || error.code === 'mfa_challenge_expired') return 'bad';
  if (error.status === 429 || error.code?.includes('rate_limit')) return 'rate';
  return 'other';
}

export async function listFactors(): Promise<FactorLike[]> {
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) throw error;
  return data.all;
}

/** Sprawdza kod potwierdzonego czynnika (podnosi sesję do aal2). */
export async function verifyCode(raw: string, factorId?: string): Promise<CodeResult> {
  const code = normalizeCode(raw);
  if (!code) return 'format';
  const id = factorId ?? verifiedFactor(await listFactors())?.id;
  if (!id) return 'other';
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: id, code });
  return codeResult(error);
}

/** Zaczyna włączanie: sprząta po porzuconych próbach, potem zakłada nowy czynnik. */
export async function startEnroll() {
  for (const f of leftoverFactors(await listFactors())) await sb.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Sztab' });
  if (error) throw error;
  return { factorId: data.id, uri: data.totp.uri, secret: data.totp.secret };
}
