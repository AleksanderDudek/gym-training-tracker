import { describe, expect, it } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN } from '../data/exercises';
import { MOVES } from '../data/moves';
import { GOAL_PLANS, LEVELS, PLANS, PROFILE_PLANS } from '../data/plans';
import { PROFILE_GEARS, PROFILE_KEYS } from '../data/profiles';
import {
  LEVEL_SCENES,
  OWN_PLAN_SCENE,
  OWN_WORKOUT_SCENE,
  PLAN_SCENES,
  WORKOUT_SCENES,
  planScene,
  profileScene,
  workoutScene,
} from '../data/scenes';
import type { Scene, Setting } from '../data/scenes';
import { COACH_MOODS, TRAINEE_MOODS } from './Gorilla';
import { PlanArt, WorkoutArt, bubbleWidth } from './SceneArt';
import type { WorkoutGear } from '../types';

/**
 * Sceny przyszły z systemu projektowego jako tabela — test pilnuje, żeby tabela trzymała
 * się aplikacji: każdy trening i plan ma swoją scenę, tło pasuje do sprzętu, kalendarz do
 * długości planu, a dymek mieści się w kadrze i powtarza się w tekście zastępczym.
 */

const ALL: [string, Scene][] = [
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

/** Plan bez sprzętu nie może mieć w tle kettlebella, a plan na siłownię — dywanu w salonie. */
const SETS: Record<WorkoutGear, Setting[]> = { none: ['home'], kb: ['kb', 'home'], gym: ['gym'] };

describe('sceny treningów i planów', () => {
  it('każdy trening z biblioteki ma własną scenę i nie ma scen bez treningu', () => {
    expect(Object.keys(WORKOUT_SCENES).sort()).toEqual(BUILTIN.filter((w) => !w.profile).map((w) => w.id).sort());
    // Treningi profili mają scenę swojego profilu, nie wspólną scenę treningu własnego.
    BUILTIN.filter((w) => w.profile).forEach((w) => expect(workoutScene(w.id), w.id).not.toBe(OWN_WORKOUT_SCENE));
  });

  it('każdy plan z celem ma własną scenę, a kalendarz pokazuje jego długość', () => {
    expect(Object.keys(PLAN_SCENES).sort()).toEqual(GOAL_PLANS.map((p) => p.id).sort());
    GOAL_PLANS.forEach((p) => expect({ id: p.id, big: PLAN_SCENES[p.id]!.big }).toEqual({ id: p.id, big: String(p.days) }));
    expect(Object.keys(LEVEL_SCENES).sort()).toEqual([...LEVELS].sort());
  });

  it('tło pasuje do sprzętu treningu i planu', () => {
    const bad = [
      ...BUILTIN.filter((w) => w.gear && !SETS[w.gear].includes(workoutScene(w.id).set)).map((w) => w.id),
      ...[...GOAL_PLANS, ...PROFILE_PLANS].filter((p) => p.gear && !SETS[p.gear].includes(planScene(p).set)).map((p) => p.id),
    ];
    expect(bad).toEqual([]);
  });

  it('ruchy są z silnika póz, a miny pasują do postaci', () => {
    ALL.forEach(([id, s]) => {
      if (s.act) expect(MOVES[s.act.move], id).toBeTruthy();
      [s.fan, s.fan2].forEach((f) => {
        if (!f) return;
        const moods: object = f.who === 'siwy' ? COACH_MOODS : TRAINEE_MOODS;
        expect(Object.hasOwn(moods, f.mood), `${id}: ${f.who} ${f.mood}`).toBe(true);
      });
    });
  });

  it('w planach zawsze stoi Trener Siwy, w treningach ćwiczy jeden podopieczny, a kibicuje drugi', () => {
    [...Object.values(PLAN_SCENES), ...Object.values(LEVEL_SCENES), OWN_PLAN_SCENE, ...PROFILE_PLANS.map(planScene)].forEach((s) =>
      expect([s.fan?.who, s.fan2?.who]).toContain('siwy'),
    );
    [...Object.entries(WORKOUT_SCENES), ...BUILTIN.filter((w) => w.profile).map((w): [string, Scene] => [w.id, workoutScene(w.id)])].forEach(([id, s]) => {
      expect(s.fan?.who, id).not.toBe('siwy');
      expect(s.fan?.who, id).not.toBe(s.act?.who);
    });
  });

  it('dymek ma jedną albo dwie linijki, mieści się w kadrze i powtarza się w tekście zastępczym', () => {
    ALL.forEach(([id, s]) => {
      expect(s.bubble.length, id).toBeGreaterThanOrEqual(1);
      expect(s.bubble.length, id).toBeLessThanOrEqual(2);
      // Kadr ma 600 jednostek, dymek stoi co najmniej 8 od krawędzi.
      expect(bubbleWidth(s.bubble), id).toBeLessThanOrEqual(584);
      s.bubble.forEach((l) => expect(s.alt, id).toContain(l.replace(/^— /, '')));
    });
  });

  it('żart jest o gorylach i meblach, nigdy o wadze ani o jedzeniu', () => {
    ALL.forEach(([id, s]) =>
      expect(`${s.bubble.join(' ')} ${s.alt}`, id).not.toMatch(/grub|tłust|tłuszcz|boczk|schudn|diet|wstyd|leń/i),
    );
  });
});

describe('wybór sceny', () => {
  it('trening spoza biblioteki dostaje scenę wspólną — także klucz z prototypu obiektu', () => {
    expect(workoutScene('A')).toBe(WORKOUT_SCENES.A);
    expect(workoutScene('w-1712345678')).toBe(OWN_WORKOUT_SCENE);
    expect(workoutScene('constructor')).toBe(OWN_WORKOUT_SCENE);
  });

  it('plan po rodzaju: z celem po identyfikatorze, klasyczny po poziomie, własny wspólna', () => {
    expect(planScene(GOAL_PLANS[0]!)).toBe(PLAN_SCENES[GOAL_PLANS[0]!.id]);
    PLANS.forEach((p) => expect(planScene(p)).toBe(LEVEL_SCENES[p.level]));
    // Plan własny też ma poziom — scena planu klasycznego byłaby o czymś innym.
    expect(planScene({ id: 'own-1', kind: 'own', level: 'strong' })).toBe(OWN_PLAN_SCENE);
    expect(planScene({ id: 'cel-zniknal', kind: 'goal', level: 'zero' })).toBe(OWN_PLAN_SCENE);
  });
});

describe('obrazek', () => {
  it('ma tekst zastępczy z dymkiem i proporcje 2:1', () => {
    const html = renderToStaticMarkup(createElement(WorkoutArt, { id: 'legs-gym' }));
    expect(html).toContain('viewBox="0 0 600 300"');
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${WORKOUT_SCENES['legs-gym']!.alt}"`);
    expect(html).toContain('class="scene-art"');
  });

  it('każda scena na liście przycina się własnym clipPath, a nie pierwszym na stronie', () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(WorkoutArt, { id: 'A' }),
        createElement(WorkoutArt, { id: 'B' }),
        createElement(PlanArt, { plan: GOAL_PLANS[0]! }),
      ),
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(html).toContain(`url(#${id})`));
  });

  it('każda scena rysuje się bez błędu', () => {
    ALL.forEach(([, s]) => {
      const html = renderToStaticMarkup(
        createElement(WorkoutArt, { id: Object.keys(WORKOUT_SCENES).find((k) => WORKOUT_SCENES[k] === s) ?? 'own' }),
      );
      expect(html.length).toBeGreaterThan(1000);
    });
    [...GOAL_PLANS, ...PLANS].forEach((p) =>
      expect(renderToStaticMarkup(createElement(PlanArt, { plan: p }))).toContain(planScene(p).bubble[0]!),
    );
  });
});
