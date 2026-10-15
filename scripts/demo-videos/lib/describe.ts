// The description of a take for post-production: the need and the story, then the real timeline
// of this take (beats, taps with zoom boxes), and a contact sheet of stills so an editor — or
// Claude in Claude Desktop, which reads images but not video — can see every beat.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import { FPS, FRAME, ffmpeg, type TakeResult } from './recorder';
import type { Scenario } from './types';

export interface DescribedBeat {
  n: number;
  id: string;
  from: number;
  to: number;
}

export function timeline(result: TakeResult, duration: number): DescribedBeat[] {
  return result.beats.map((b, i) => ({
    n: i + 1,
    id: b.id,
    from: b.at,
    to: result.beats[i + 1]?.at ?? duration,
  }));
}

export const clock = (s: number) => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${String(m).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
};

const cell = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');

/** Calm voice-over pace, words a second. */
export const VO_PACE = 2.5;

/** How long a line takes at a calm pace, against the beat; ⚠ when it does not fit. */
export function voFit(line: string, seconds: number): { text: string; overrun: number } {
  const needed = line.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length / VO_PACE;
  const overrun = needed - seconds;
  return { text: `${needed.toFixed(1)} / ${seconds.toFixed(1)} s${overrun > 0.4 ? ' ⚠' : ''}`, overrun };
}

/** A still for each beat, near its end — where the result of the beat's action is on screen. */
export async function contactSheet(
  browser: Browser,
  video: string,
  scenario: Scenario,
  beats: DescribedBeat[],
  out: string,
  workDir: string,
): Promise<void> {
  const stills: string[] = [];
  for (const b of beats) {
    const at = Math.max(b.from, b.to - 0.4);
    const file = join(workDir, `still-${b.n}.jpg`);
    await ffmpeg(['-ss', at.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=390:-2', '-q:v', '3', file]);
    stills.push(`data:image/jpeg;base64,${(await readFile(file)).toString('base64')}`);
    await rm(file);
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const tiles = beats
    .map(
      (b, i) => `<figure><img src="${stills[i]}"><figcaption><b>${b.n} · ${clock(b.from)}–${clock(b.to)}</b>
      <span>${escapeHtml(scenario.beats[b.id]!.captionPl)}</span></figcaption></figure>`,
    )
    .join('');
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#D7D9D3;font:14px/1.35 "IBM Plex Sans",system-ui,sans-serif;color:#1E2320}
    h1{margin:0 0 16px;font:600 22px/1.2 system-ui,sans-serif}
    .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
    figure{margin:0;background:#FAFAF8;border-radius:10px;padding:8px}
    img{display:block;width:100%;border-radius:6px}
    figcaption{display:grid;gap:2px;padding:8px 2px 2px}
    b{font-variant-numeric:tabular-nums}
  </style><h1>${escapeHtml(`${scenario.slug} — ${scenario.title}`)}</h1><div class="grid">${tiles}</div>`);
  await page.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 85 });
  await page.close();
}

export async function writeDescription(
  file: string,
  scenario: Scenario,
  result: TakeResult,
  duration: number,
  meta: { video: string; sheet: string; commit: string; recordedAt: string },
): Promise<void> {
  const beats = timeline(result, duration);
  const rows = beats.map((b) => {
    const c = scenario.beats[b.id]!;
    const fit = voFit(c.voPl, b.to - b.from).text;
    return `| ${b.n} | ${clock(b.from)} | ${clock(b.to)} | ${cell(c.shows)} | ${cell(c.captionPl)} | ${cell(c.captionEn)} | ${cell(c.voPl)} | ${fit} | ${cell(c.voEn)} | ${cell(c.edit ?? '')} |`;
  });
  const taps = result.taps.map(
    (t) =>
      `| ${clock(t.at)} | ${cell(t.label)} | ${t.x}, ${t.y} | ${t.box.x}, ${t.box.y}, ${t.box.width}×${t.box.height} |`,
  );
  const md = `---
video: ${meta.video}
contact_sheet: ${meta.sheet}
duration_s: ${duration.toFixed(2)}
resolution: ${FRAME.width}x${FRAME.height}
fps: ${FPS}
codec: H.264 High, yuv420p, no audio
recorded_at: ${meta.recordedAt}
app_commit: ${meta.commit}
---

# ${scenario.slug.slice(0, 2)} — ${scenario.title}

*${scenario.titlePl}*

| | |
| --- | --- |
| **Need** | „${scenario.needPl}” — ${scenario.needEn} |
| **Persona** | ${cell(scenario.persona)} |
| **Problem** | ${cell(scenario.problem)} |
| **How the app helps** | ${cell(scenario.solution)} |
| **Key message** | ${scenario.keyMessagePl} — *${scenario.keyMessageEn}* |
| **Screens shown** | ${scenario.features.join(' · ')} |
| **App time in the take** | ${scenario.clock.replace('T', ' ')} (Europe/Warsaw) |

## Video

- File: \`${meta.video}\` — ${duration.toFixed(1)} s, ${FRAME.width}×${FRAME.height} (a 390×844 phone screen at 2×), ${FPS} fps, no audio.
- The touch rings (a grey ring where a finger taps) are part of the picture. Nothing else is overlaid: captions, zooms, voice-over and music are for post-production.
- All data in the app is a fictional demo user. No real person, no real account.

## Timeline

Times are from this take. A beat runs until the next beat starts. „VO fit” is the Polish line at a calm
${VO_PACE} words a second against the beat's length; ⚠ marks a line to shorten or to let run into the next beat.

| # | In | Out | On screen | Caption (PL) | Caption (EN) | Voice-over (PL) | VO fit | Voice-over (EN) | Edit notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Taps (zoom targets)

Coordinates are video pixels (${FRAME.width}×${FRAME.height}, origin top left). The box is the tapped control — a ready target for a zoom or a highlight.

| Time | Tapped | Centre x, y | Box x, y, w×h |
| --- | --- | --- | --- |
${taps.join('\n') || '| — | — | — | — |'}

## Post-production

- **Hook (0–3 s):** „${scenario.hookPl}” — *${scenario.hookEn}*
- **Closing card (last 2–3 s):** „${scenario.ctaPl}” — *${scenario.ctaEn}*
- **Music:** ${scenario.music}
- **Length:** keep the edit between 25 and 45 s. Cut inside a beat, never across a tap, so every action keeps its cause and its result.
- **Style:** see the shared guide in [README.md](README.md#post-production-guide).

## Contact sheet

One still per beat, taken just before the beat ends.

![Contact sheet](${meta.sheet})
`;
  await writeFile(file, md);
}

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
