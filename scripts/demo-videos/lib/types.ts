import type { Page } from 'playwright';
import type { Scene } from './scene';

/** Copy for one beat of a video: what the viewer sees, and what post-production puts over it. */
export interface BeatCopy {
  /** What happens on screen, for the editor. */
  shows: string;
  /** On-screen caption in Polish (the app's language), short enough for two lines on a phone. */
  captionPl: string;
  captionEn: string;
  /** Voice-over line; it should fit the beat's length at a calm pace (~2.5 words a second). */
  voPl: string;
  voEn: string;
  /** Edit notes: zoom, highlight, speed, cut. */
  edit?: string;
}

export interface Scenario {
  /** File name stem: "01-pierwszy-trening". */
  slug: string;
  title: string;
  titlePl: string;
  /** The need in the user's own words. */
  needPl: string;
  needEn: string;
  persona: string;
  problem: string;
  /** How the app answers the need, in two or three sentences. */
  solution: string;
  keyMessagePl: string;
  keyMessageEn: string;
  /** Screens and features shown. */
  features: string[];
  /** Local wall-clock time the app lives in during the take ("2026-10-15T18:20:00+02:00"). */
  clock: string;
  /**
   * Who is using the app: `full` — seven weeks into a plan, with a food diary; `fresh` — installed
   * it yesterday (height and one weigh-in).
   */
  seed: 'full' | 'fresh';
  /** Changes to the training state on top of the seed, for this story only. */
  patch?: (state: Record<string, unknown>) => void;
  /** Where the phone is (W pobliżu); without it the location permission is not granted. */
  geolocation?: { latitude: number; longitude: number };
  /** Opening caption (first ~3 s) and closing card. */
  hookPl: string;
  hookEn: string;
  ctaPl: string;
  ctaEn: string;
  music: string;
  /** Before the camera rolls: open the right screen, close what a returning user would not see. */
  setup(page: Page): Promise<void>;
  /** On camera. Every `scene.beat(id)` needs an entry in `beats`. */
  run(scene: Scene): Promise<void>;
  beats: Record<string, BeatCopy>;
}
