/**
 * Logowanie dwuetapowe (TOTP) — czyste funkcje: kod z aplikacji uwierzytelniającej, decyzja bramki
 * po zalogowaniu i zapis sekretu do ręcznego wpisania.
 */

/** Kod z aplikacji: sześć cyfr, spacje i myślniki (np. „123 456”) ignorujemy. Inaczej `null`. */
export function normalizeCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

export interface AalData {
  currentLevel?: string | null;
  nextLevel?: string | null;
}

/** Bramka: sesja po haśle (aal1), a konto ma potwierdzony czynnik (następny poziom aal2) → pytamy o kod. */
export function needsCode(aal: AalData | null | undefined): boolean {
  return aal?.nextLevel === 'aal2' && aal.currentLevel === 'aal1';
}

/** Sekret w grupach po 4 znaki, wielkimi literami — łatwiej go przepisać do drugiej aplikacji. */
export function groupSecret(secret: string): string {
  return (secret.replace(/\s+/g, '').toUpperCase().match(/.{1,4}/g) ?? []).join(' ');
}

export interface FactorLike {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
  created_at?: string;
}

const totp = (all: readonly FactorLike[], status: string) => all.filter((f) => f.factor_type === 'totp' && f.status === status);

/** Potwierdzony czynnik TOTP (pierwszy), jeśli jest. */
export const verifiedFactor = (all: readonly FactorLike[]): FactorLike | null => totp(all, 'verified')[0] ?? null;

/** Niedokończone próby włączenia — do usunięcia przed nową. */
export const leftoverFactors = (all: readonly FactorLike[]): FactorLike[] => totp(all, 'unverified');
