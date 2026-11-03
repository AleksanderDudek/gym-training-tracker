/**
 * Prywatne skróty prowadzącego: „Jan, wtorki 18:00” obok ID podopiecznego.
 *
 * **Tylko w tej przeglądarce, nigdy na serwerze.** Sztab nie przechowuje danych kontaktowych
 * podopiecznych — kto jest kim, prowadzący trzyma u siebie (CRM, arkusz, kartoteka). Skrót jest
 * wygodą na tym komputerze, kluczowaną ID (to samo ID wraca po nowym zaproszeniu), z eksportem
 * i importem do pliku.
 */

const key = (userId: string) => `sztab-aliases:${userId}`;

export type Aliases = Record<string, string>;

export function loadAliases(userId: string): Aliases {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? cleanAliases(raw) : {};
  } catch {
    return {};
  }
}

export function saveAlias(userId: string, pseudonym: string, alias: string): Aliases {
  const all = loadAliases(userId);
  const v = alias.trim().slice(0, 60);
  if (v) all[pseudonym] = v;
  else delete all[pseudonym];
  try {
    localStorage.setItem(key(userId), JSON.stringify(all));
  } catch {
    /* Bez pamięci strony skrót zostaje do zamknięcia karty. */
  }
  return all;
}

export function cleanAliases(v: unknown): Aliases {
  const out: Aliases = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, a] of Object.entries(v as Record<string, unknown>)) {
    if (/^[0-9A-HJKMNP-TV-Z]{20}$/.test(k) && typeof a === 'string' && a.trim()) out[k] = a.trim().slice(0, 60);
  }
  return out;
}

export function importAliases(userId: string, v: unknown): number {
  const incoming = cleanAliases(v);
  const all = { ...loadAliases(userId), ...incoming };
  try {
    localStorage.setItem(key(userId), JSON.stringify(all));
  } catch {
    return 0;
  }
  return Object.keys(incoming).length;
}

/** Arkusz do CRM: ID, skrót, obszary, od kiedy. Średnik i BOM, jak w GYM TRACKERze — tak otwiera polski Excel. */
export function crmCsv(rows: { pseudonym: string; alias: string; areas: string; since: string; status: string }[]): string {
  const esc = (s: string) => (/[;"\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s);
  const head = ['ID', 'Skrót', 'Obszary', 'Od', 'Stan'];
  return '﻿' + [head, ...rows.map((r) => [r.pseudonym, r.alias, r.areas, r.since, r.status])].map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}
