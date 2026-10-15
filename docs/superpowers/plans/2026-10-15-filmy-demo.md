# Demo videos per user need — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Executed inline in the planning session (the user is away and asked for an autonomous finish).

**Goal:** One 25–45 s Playwright recording per user need, each with a description for
post-production, in `demo-videos/`.

**Architecture:** Spec: `docs/superpowers/specs/2026-10-15-filmy-demo-design.md`. A Node script
(`scripts/demo-videos/record.ts`, run by tsx) builds the app, serves it with `vite preview`, and
records each scenario in its own browser context. Frames come from Playwright's screencast with
the browser at a real device scale of 2; ffmpeg turns them into a constant-rate MP4. The demo
person is generated through the app's own engine (`seed/generate.seed.ts`, run by vitest) and
imported through the app's own „Importuj plik”.

**Tech Stack:** Playwright 1.63 (`page.screencast`, `page.clock`), ffmpeg/ffprobe, tsx, vitest.

## Conventions

As in earlier plans:
- **Branch:** `feat/filmy-demo`.
- **Commits:** in Polish, with conventional prefixes and the Co-Authored-By line.
- **Gates:** typecheck, lint, tests and build before the merge.
- **Merge:** local, no push.
- **Outputs:** `.mp4` and `.jpg` files stay out of git.

## Tasks

### Task 1: Analysis
- [x] Feature map and needs (subagent): screens, routes, data a screen needs, network risks.
- [x] Data model and import path (subagent): AppState in localStorage, diet Backup, validators, time dependence.
- [x] Spec with the needs → scenarios table and decisions.

### Task 2: Recorder
- [x] Probe capture quality: `recordVideo` and the screencast give 1× frames; `--force-device-scale-factor=2` gives sharp 2× frames.
- [x] `lib/recorder.ts`: screencast frames → ffconcat with per-frame durations → H.264 30 fps, BT.709 limited range, cut at the take's real length (`-t`); beats and taps on the frames' clock.
- [x] `lib/scene.ts`: touch rings (top-layer popover), smooth reveal/scroll, tap, type, native select with a touch mark, slider drag, timing log (`DEMO_DEBUG=1`).
- [x] `lib/netcache.ts`: outside requests (photos, tiles, Overpass, thumbnails) from a disk cache.
- [x] `lib/describe.ts`: `.md` per take (need, persona, timeline with captions/voice-over PL+EN and VO fit, taps with zoom boxes, hook, closing card, music) and a contact sheet rendered by the browser.
- [x] `record.ts`: build, preview, per-scenario context (pl-PL, Europe/Warsaw, clock, geolocation), 25–45 s check, file-vs-take length check, `--describe-only`, index in `demo-videos/README.md`.

### Task 3: Demo data
- [x] `seed/generate.seed.ts` (from the subagent's verified generator): 7 weeks of a plan through `applyResult`/`syncBadges`, weights, steps, snacks, diet diary from real products, recipes and menus, favourites; `fresh` person; both validated with the import's own validators.
- [x] `lib/seed.ts`: import through Ustawienia → „Importuj plik”, intro seen, scenario patches, reload.

### Task 4: Scenarios
- [x] Explore each flow with the demo data (`explore.ts`: accessibility tree + screenshot).
- [x] 12 scenarios (01–12), each with copy per beat. 13 („W pobliżu”) not recorded: every public Overpass server failed on the recording day.
- [x] Record, check every contact sheet, re-time takes that are too short or static, re-record.

### Task 5: Docs, gates, merge
- [x] `demo-videos/README.md`: angles, needs, index, post-production guide, re-recording.
- [x] Root README: commands and structure.
- [x] `.gitignore` for the video binaries; vitest excludes `scripts/demo-videos/**`.
- [ ] Typecheck, lint, tests, build; commit; merge into `main` without push.
