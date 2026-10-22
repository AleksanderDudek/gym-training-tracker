import { describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { BUILTIN, EFFORT, EX, GEAR_LABEL, READY, STAGES, ex, groupLabel } from './exercises';
import { EX_JOKES, OWN_WORKOUT_JOKES, WORKOUT_JOKES } from './exjokes';
import { MUSCLES, MUSCLE_ACC, MUSCLE_NAME } from './muscles';
import { MOVES } from './moves';
import { EXPECT, GOAL_PLANS, LEVEL_DESC, LEVEL_LABEL, PLANS, PROFILE_PLANS, SEX_LABEL } from './plans';
import { PROFILES, PROFILE_GEARS, PROFILE_KEYS } from './profiles';
import { LEVEL_SCENES, OWN_PLAN_SCENE, OWN_WORKOUT_SCENE, PLAN_SCENES, WORKOUT_SCENES, profileScene } from './scenes';
import type { Scene } from './scenes';
import { EQUIP_LABEL, STATIONS, stationFor } from './stations';
import { VIDEOS } from './videos';
import { bubbleWidth } from '../components/SceneArt';

/**
 * Dane po angielsku: każdy tekst, który trafia na ekran, ma angielską wersję. Polskie litery
 * albo typowo polskie słowa bez ogonków znaczą, że coś zostało nieprzetłumaczone. Wyjątki to
 * klucze (partia ruchu `group`) i prawdziwe tytuły polskich filmów z YouTube.
 */
const POLISH = /[ąćęłńóśźż]|\b(albo|oraz|jest|nie|dla|przez|tylko|trening|pompki|brzuszki|deska|nogi|plecy|barki|klatka|sztanga|hantle)\b/i;

/** Wszystkie teksty z etykietą miejsca, żeby błąd mówił, skąd przyszedł. */
const texts: [string, string][] = [];
const add = (where: string, ...values: (string | undefined)[]) =>
  values.forEach((v, i) => v !== undefined && texts.push([values.length > 1 ? `${where}[${i}]` : where, v]));

Object.entries(EX).forEach(([id, e]) => add(`EX.${id}`, e.name, e.hint, groupLabel(e.group)));
Object.entries(GEAR_LABEL).forEach(([k, v]) => add(`GEAR_LABEL.${k}`, v));
Object.entries(STAGES).forEach(([k, v]) => add(`STAGES.${k}`, ...v));
Object.entries(EFFORT).forEach(([k, v]) => add(`EFFORT.${k}`, v.label, v.sub));
Object.entries(READY).forEach(([k, v]) => add(`READY.${k}`, v));
BUILTIN.forEach((w) => add(`workout ${w.id}`, w.name, w.desc));
[...PLANS, ...GOAL_PLANS, ...PROFILE_PLANS].forEach((p) => add(`plan ${p.id}`, p.name, p.desc, p.goal, p.expect));
Object.entries(SEX_LABEL).forEach(([k, v]) => add(`SEX_LABEL.${k}`, v));
Object.entries(LEVEL_LABEL).forEach(([k, v]) => add(`LEVEL_LABEL.${k}`, v));
Object.entries(LEVEL_DESC).forEach(([k, v]) => add(`LEVEL_DESC.${k}`, v));
Object.entries(EXPECT).forEach(([k, v]) => add(`EXPECT.${k}`, v));
Object.entries(PROFILES).forEach(([k, p]) => add(`PROFILES.${k}`, p.name, p.goal, p.why, p.joke));
MUSCLES.forEach((m) => add(`muscle ${m}`, MUSCLE_NAME[m], MUSCLE_ACC[m]));
Object.entries(MOVES).forEach(([k, m]) => add(`MOVES.${k}`, m.alt));
Object.entries(EQUIP_LABEL).forEach(([k, v]) => add(`EQUIP_LABEL.${k}`, v));
Object.keys(STATIONS).forEach((id) => add(`station ${id}`, stationFor(id, 'kb').machine, stationFor(id, 'gym').machine));
Object.entries(EX_JOKES).forEach(([k, v]) => add(`EX_JOKES.${k}`, v));
Object.entries(WORKOUT_JOKES).forEach(([k, v]) => add(`WORKOUT_JOKES.${k}`, v));
add('OWN_WORKOUT_JOKES', ...OWN_WORKOUT_JOKES);

const scenes: [string, Scene][] = [
  ...Object.entries(WORKOUT_SCENES),
  ...Object.entries(PLAN_SCENES),
  ...Object.entries(LEVEL_SCENES),
  ['own-workout', OWN_WORKOUT_SCENE],
  ['own-plan', OWN_PLAN_SCENE],
  ...PROFILE_KEYS.flatMap((k) =>
    PROFILE_GEARS.flatMap((g): [string, Scene][] => [
      [`profil-${k}-${g}-plan`, profileScene(k, g, true)],
      [`profil-${k}-${g}-trening`, profileScene(k, g, false)],
    ]),
  ),
];
scenes.forEach(([id, s]) => add(`scene ${id}`, ...s.bubble, s.alt));

describe('data in English', () => {
  it('every user-visible text is English', () => {
    expect(texts.length).toBeGreaterThan(900);
    expect(texts.filter(([, v]) => POLISH.test(v)).map(([where, v]) => `${where}: ${v}`)).toEqual([]);
  });

  it('standard English exercise names, unique across the library', () => {
    expect(EX.swing2!.name).toBe('Two-hand swing');
    expect(EX.deadlift!.name).toBe('Conventional deadlift');
    expect(EX.squat_back!.name).toBe('Barbell back squat');
    expect(EX.row_db!.name).toBe('One-arm dumbbell row');
    expect(EX.bench!.name).toBe('Bench press');
    expect(EX.plank!.name).toBe('Plank');
    expect(ex('pushup').hint).toMatch(/^Body in one line/);
    const names = Object.values(EX).map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('movement groups stay Polish keys and get an English label', () => {
    expect(EX.deadlift!.group).toBe('Zawias biodrowy');
    expect(groupLabel(EX.deadlift!.group)).toBe('Hip hinge');
    expect(groupLabel(EX.row!.group)).toBe('Pull');
    expect(groupLabel(EX.burpee!.group)).toBe('Full body');
    expect(groupLabel('nieznana')).toBe('nieznana');
  });

  it('built-in workouts, plans and profiles read in English', () => {
    expect(BUILTIN.find((w) => w.id === 'A')!.name).toBe('Workout A');
    expect(BUILTIN.find((w) => w.id === 'profil-podciaganie-kb-a')!.name).toBe('Pull-ups — full body A');
    expect(BUILTIN.find((w) => w.id === 'profil-pilka-gym-b')!.desc).toMatch(
      /Profile: box jumps first, then Nordic curl and Copenhagen plank to finish\.$/,
    );
    expect(PLANS.find((p) => p.id === 'zero-any-3')!.name).toBe('From scratch · 3× a week');
    expect(PROFILE_PLANS.find((p) => p.id === 'profil-plecy-none')!.name).toBe('Healthy back — all-round, 60 days');
    expect(MUSCLE_NAME.posladki).toBe('Glutes');
  });

  it('each exercise and workout joke has an English line', () => {
    BUILTIN.forEach((w) => expect(WORKOUT_JOKES[w.id], w.id).toBeTruthy());
    expect(OWN_WORKOUT_JOKES).toHaveLength(4);
    expect(EX_JOKES.deadlift).toMatch(/honest/);
  });

  it('speech bubbles fit the frame and are repeated in the alt text', () => {
    scenes.forEach(([id, s]) => {
      expect(bubbleWidth(s.bubble), id).toBeLessThanOrEqual(584);
      s.bubble.forEach((l) => expect(s.alt, id).toContain(l.replace(/^— /, '')));
    });
    expect(profileScene('plecy', 'kb', true).alt).toBe('Gosia holds a plank, Coach Siwy: “The desk lost. Your back won.”');
  });

  it('only Polish-language videos keep Polish titles', () => {
    const polishTitles = Object.values(VIDEOS)
      .flatMap((v) => [...v.main, ...v.kb])
      .filter((v) => /[ąćęłńóśźż]/i.test(`${v.title} ${v.channel}`));
    expect(polishTitles.length).toBeGreaterThan(0);
    polishTitles.forEach((v) => expect(v.lang, v.title).toBe('pl'));
  });
});
