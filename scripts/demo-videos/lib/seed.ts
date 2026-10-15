/// <reference lib="dom" />
// Puts the demo person into the app the way a person would: Ustawienia → „Importuj plik” with a
// backup made by seed/generate.seed.ts (training state + food diary). What the import leaves out
// on purpose (the intro already seen) and what a scenario needs on top goes into the training
// state in localStorage, then a reload boots the app on it.
import { readFile } from 'node:fs/promises';
import type { Page } from 'playwright';
import type { Scenario } from './types';

const STATE_KEY = 'kb-trener-v3';

export async function seed(page: Page, scenario: Scenario): Promise<void> {
  const file = `scripts/demo-videos/seed/${scenario.seed}.json`;
  const backup = JSON.parse(await readFile(file, 'utf8')) as { introSeen?: string };
  await page.goto('#/ustawienia');
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(file);
  await page.getByText(/^Dane wczytane/).waitFor({ timeout: 20_000 });

  const raw = await page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
  if (!raw) throw new Error('seed: no training state after the import');
  const state = JSON.parse(raw) as Record<string, unknown>;
  // The import does not carry the intro; a returning person has seen it.
  state.introSeen = backup.introSeen ?? scenario.clock.slice(0, 10);
  scenario.patch?.(state);
  await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [STATE_KEY, JSON.stringify(state)]);
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('about:blank');
}
