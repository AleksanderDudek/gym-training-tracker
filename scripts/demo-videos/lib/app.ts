import type { Page } from 'playwright';

/** Opens a screen of the app and waits until it has settled: fonts in, first render done. */
export async function open(page: Page, route: string): Promise<void> {
  await page.goto(`/${route}`);
  await page.getByRole('navigation', { name: 'Główna nawigacja' }).waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(900);
}

/** A tab of the bottom bar: Dziś, Trening, Jedzenie, Osiągnięcia, Profil. */
export function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Główna nawigacja' }).getByRole('link', { name, exact: true });
}

/** A section link inside a tab („Sekcje zakładki Trening” / „… Jedzenie”). */
export function section(page: Page, tabName: 'Trening' | 'Jedzenie', name: string) {
  return page.getByRole('navigation', { name: `Sekcje zakładki ${tabName}` }).getByRole('link', { name, exact: true });
}

/** A training-state exercise's progress, for scenario patches. */
export function progress(state: Record<string, unknown>, id: string): Record<string, unknown> {
  const prog = state.prog as Record<string, Record<string, unknown>>;
  const p = prog[id];
  if (!p) throw new Error(`patch: no exercise ${id}`);
  return p;
}
