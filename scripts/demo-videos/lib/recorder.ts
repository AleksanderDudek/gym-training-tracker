// One take of a demo video: frames from Playwright's screencast (only when the picture changes, each
// with its own time), turned into a constant 30 fps H.264 MP4 by ffmpeg. Beats are marked on the
// same clock as the frames, so the scenario's description gets the real timestamps of the take.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';

/** Phone in portrait, CSS pixels; recorded at 2× (the browser runs with a real device scale of 2). */
export const VIEWPORT = { width: 390, height: 844 } as const;
export const SCALE = 2;
export const FRAME = { width: VIEWPORT.width * SCALE, height: VIEWPORT.height * SCALE } as const;
export const FPS = 30;

export interface MarkedBeat {
  id: string;
  /** Seconds from the start of the video. */
  at: number;
}

export interface MarkedTap {
  /** Seconds from the start of the video. */
  at: number;
  /** Centre of the tapped element in VIDEO pixels (CSS pixels × 2). */
  x: number;
  y: number;
  /** What was tapped, as the scenario names it. */
  label: string;
  /** The tapped element's box in video pixels: a ready zoom target. */
  box: { x: number; y: number; width: number; height: number };
}

export interface TakeResult {
  duration: number;
  frames: number;
  beats: MarkedBeat[];
  taps: MarkedTap[];
}

/** Runs ffmpeg and fails with its last lines when it fails. */
export function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    let err = '';
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-800)}`))));
  });
}

export class Take {
  private dir = '';
  private frames: { file: string; t: number }[] = [];
  private t0: number | null = null;
  private stoppedAt = 0;
  private firstSeen = 0;
  readonly beats: MarkedBeat[] = [];
  readonly taps: MarkedTap[] = [];

  constructor(private readonly page: Page) {}

  /** Seconds since the first frame (0 before it arrives). */
  now(): number {
    return this.t0 === null ? 0 : (Date.now() - this.t0) / 1000;
  }

  async start(): Promise<void> {
    this.dir = await mkdtemp(join(tmpdir(), 'demo-take-'));
    await this.page.screencast.start({
      size: { width: FRAME.width, height: FRAME.height },
      quality: 92,
      onFrame: ({ data, timestamp }) => {
        if (this.stoppedAt) return;
        if (this.t0 === null) this.firstSeen = Date.now();
        this.t0 ??= timestamp;
        const file = join(this.dir, `f${String(this.frames.length).padStart(6, '0')}.jpg`);
        // In order and at once: the next frame's duration is measured from this one.
        writeFileSync(file, data);
        this.frames.push({ file, t: timestamp });
      },
    });
    // The first frame starts the clock; wait for it so every mark has a time.
    const deadline = Date.now() + 5000;
    while (this.t0 === null && Date.now() < deadline) await this.page.waitForTimeout(20);
    if (this.t0 === null) throw new Error('screencast: no first frame');
  }

  mark(id: string): void {
    this.beats.push({ id, at: round(this.now()) });
  }

  async tapAt(target: Locator, label: string): Promise<void> {
    const box = await target.boundingBox();
    if (!box) throw new Error(`tap: ${label} has no box`);
    this.taps.push({
      at: round(this.now()),
      x: Math.round((box.x + box.width / 2) * SCALE),
      y: Math.round((box.y + box.height / 2) * SCALE),
      label,
      box: {
        x: Math.round(box.x * SCALE),
        y: Math.round(box.y * SCALE),
        width: Math.round(box.width * SCALE),
        height: Math.round(box.height * SCALE),
      },
    });
  }

  /** Stops the screencast and writes `out` (MP4, H.264, 30 fps, yuv420p, faststart). */
  async stop(out: string): Promise<TakeResult> {
    this.stoppedAt = Date.now();
    await this.page.screencast.stop();
    if (!this.frames.length || this.t0 === null) throw new Error('screencast: no frames');
    if (process.env.DEMO_DEBUG)
      console.log(`  stop at ${((this.stoppedAt - this.t0) / 1000).toFixed(1)} s; last frame ${((this.frames.at(-1)!.t - this.t0) / 1000).toFixed(1)} s; first frame vs node clock ${(this.firstSeen - this.t0).toFixed(0)} ms`);
    const lines = ['ffconcat version 1.0'];
    this.frames.forEach((f, i) => {
      const next = this.frames[i + 1]?.t ?? this.stoppedAt;
      lines.push(`file '${f.file}'`, `duration ${(Math.max(next - f.t, 1) / 1000).toFixed(4)}`);
    });
    // The concat demuxer ignores the last duration unless the last file is listed once more — and
    // then it may hold that file for as long again; `-t` cuts the video at the take's real end.
    lines.push(`file '${this.frames.at(-1)!.file}'`);
    const seconds = (this.stoppedAt - this.t0) / 1000;
    const list = join(this.dir, 'frames.ffconcat');
    await writeFile(list, lines.join('\n'));
    try {
      await ffmpeg([
        '-f', 'concat', '-safe', '0', '-i', list,
        // JPEG frames are full-range BT.601; video players and editors expect limited-range BT.709.
        '-vf',
        `fps=${FPS},scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709:flags=lanczos,format=yuv420p`,
        '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high',
        '-t', seconds.toFixed(3), '-movflags', '+faststart', '-an', out,
      ]);
    } finally {
      await this.dispose();
    }
    return {
      duration: round((this.stoppedAt - this.t0) / 1000),
      frames: this.frames.length,
      beats: this.beats,
      taps: this.taps,
    };
  }

  /** Removes the frames on disk; a failed take leaves nothing behind (hundreds of MB otherwise). */
  async dispose(): Promise<void> {
    if (this.dir) await rm(this.dir, { recursive: true, force: true });
    this.dir = '';
  }
}

/** Duration of a video file in seconds, as ffprobe reads it. */
export function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(Number(out.trim())) : reject(new Error(`ffprobe ${code}`))));
  });
}

const round = (s: number) => Math.round(s * 10) / 10;
