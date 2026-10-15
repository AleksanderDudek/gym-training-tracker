/// <reference lib="dom" />
// A look at a screen with the demo data, for writing and fixing scenarios: the accessibility tree
// (roles and names to use in locators) and a screenshot. Needs `npm run preview -- --port 4327`.
// Usage: npx tsx scripts/demo-videos/explore.ts <full|fresh> <HH:MM> <#/route> <out-dir> [steps.json]
// Steps: [{"click":"Button name"}, {"text":"Visible text"}, {"fill":["Field name","value"]}, {"option":"Option"},
//   {"select":["Select name","Label"]}, {"press":"Enter"}, {"wait":500}, {"scroll":600}]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { cacheOutsideRequests } from './lib/netcache';
import { seed } from './lib/seed';
import type { Scenario } from './lib/types';

const [who = 'full', time = '13:00', route = '#/sesja', out = 'demo-explore', stepsFile] = process.argv.slice(2);
type Step = {
  click?: string;
  text?: string;
  fill?: [string, string];
  option?: string;
  select?: [string, string];
  wait?: number;
  scroll?: number;
  press?: string;
};
const steps = stepsFile ? (JSON.parse(await readFile(stepsFile, 'utf8')) as Step[]) : [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: 'pl-PL',
  timezoneId: 'Europe/Warsaw',
  serviceWorkers: 'block',
  baseURL: 'http://localhost:4327/',
  geolocation: { latitude: 52.2297, longitude: 21.0122 },
  permissions: ['geolocation'],
});
await cacheOutsideRequests(context);
const page = await context.newPage();
const clock = `2026-10-15T${time}:00+02:00`;
await page.clock.install({ time: new Date(clock) });
await seed(page, { seed: who, clock } as Scenario);
await page.goto(`/${route}`);
await page.waitForTimeout(1500);
for (const step of steps) await act(page, step);
await mkdir(out, { recursive: true });
const name = route.replace(/[^\w]+/g, '_') + (stepsFile ? `_${stepsFile.replace(/.*\//, '').replace('.json', '')}` : '');
await writeFile(join(out, `${name}.aria.txt`), await page.locator('body').ariaSnapshot());
await page.screenshot({ path: join(out, `${name}.png`) });
await page.screenshot({ path: join(out, `${name}.full.png`), fullPage: true });
console.log(join(out, name));
await browser.close();

async function act(page: Page, s: Step) {
  if (s.click) await page.getByRole('button', { name: s.click }).or(page.getByRole('link', { name: s.click })).first().click();
  if (s.text) await page.getByText(s.text).first().click();
  if (s.fill) {
    const field = page.getByRole('textbox', { name: s.fill[0] }).or(page.getByRole('spinbutton', { name: s.fill[0] })).or(page.getByRole('searchbox', { name: s.fill[0] }));
    await field.or(page.getByRole('combobox', { name: s.fill[0] })).first().fill(s.fill[1]);
  }
  if (s.option) await page.getByRole('option', { name: s.option }).first().click();
  if (s.select) await page.getByRole('combobox', { name: s.select[0] }).selectOption({ label: s.select[1] });
  if (s.press) await page.keyboard.press(s.press);
  if (s.scroll) await page.mouse.wheel(0, s.scroll);
  await page.waitForTimeout(s.wait ?? 700);
}
