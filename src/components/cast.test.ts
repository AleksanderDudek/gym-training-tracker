import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COACH_MOODS, Gorilla, TRAINEE_MOODS, WHO_NAME } from './Gorilla';
import type { GorillaMood, Who } from './Gorilla';
import { BAND_MOOD, BAND_NAME } from './BadgeArt';
import { certificateCast } from './Share';
import { COACH_TIPS } from '../engine/quips';
import { inlineVars } from '../engine/share';

/**
 * Obsada trzyma się trzech zasad, których nie widać w typach, więc pilnuje ich test:
 * postać reaguje i nigdy nie niesie informacji sama, trener nigdy nie beszta, a rada
 * dnia daje coś wartościowego, zanim padnie słowo o kawie.
 */

describe('miny obsady', () => {
  it('każda mina ma opis, z którego da się zrobić tekst zastępczy', () => {
    for (const [mood, spec] of [...Object.entries(TRAINEE_MOODS), ...Object.entries(COACH_MOODS)]) {
      expect(spec.label.length, mood).toBeGreaterThan(3);
    }
  });

  it('każde pasmo odznaki ma minę i nazwę', () => {
    // Medal mówi, co zdobyte, postać — jak to jest. Ale nazwa pasma stoi obok obu,
    // bo ani metal, ani mina nie mogą być jedynym nośnikiem.
    for (const band of [0, 1, 2, 3, 4, 5] as const) {
      expect(BAND_MOOD[band], `pasmo ${band}`).toBeTruthy();
      expect(TRAINEE_MOODS[BAND_MOOD[band]]).toBeTruthy();
      expect(BAND_NAME[band].length).toBeGreaterThan(2);
    }
  });

  it('radość rośnie razem z pasmem, a nie skacze', () => {
    const order = Object.keys(TRAINEE_MOODS);
    const bands = [0, 1, 2, 3, 4, 5].map((b) => order.indexOf(BAND_MOOD[b as 0]));
    expect(bands).toEqual([...bands].sort((a, b) => a - b));
  });

  it('obsada ma trzy osoby z imionami', () => {
    expect(Object.keys(WHO_NAME)).toHaveLength(3);
    expect(WHO_NAME.siwy).toMatch(/Siwy/);
  });
});

describe('rada dnia', () => {
  it('starcza na ponad tydzień, więc jutro jest po co wrócić', () => {
    expect(COACH_TIPS.length).toBeGreaterThanOrEqual(7);
  });

  it('najpierw wartość, dopiero potem kawa', () => {
    for (const t of COACH_TIPS) {
      expect(t.tip.length).toBeGreaterThan(20);
      // Rada ma stać sama: gdyby mówiła o kawie, byłaby reklamą, a nie radą.
      expect(t.tip).not.toMatch(/kaw|espresso|postaw/i);
      expect(t.joke).toMatch(/kaw|espresso|filiżank/i);
    }
  });

  it('trener nie beszta i o nic nie błaga', () => {
    for (const t of COACH_TIPS) {
      const both = `${t.tip} ${t.joke}`;
      expect(both).not.toMatch(/musisz|powinieneś|wstyd|lenist|zawiod|błagam|ostatnia szansa/i);
    }
  });

  it('każda rada ma minę, którą trener naprawdę umie zrobić', () => {
    for (const t of COACH_TIPS) expect(COACH_MOODS[t.mood], t.mood).toBeTruthy();
  });
});

describe('obsada na blankiecie', () => {
  const KINDS = ['badge', 'session', 'progress'] as const;
  const subject = (kind: (typeof KINDS)[number], seed: number, band?: string) => ({
    kind,
    seed,
    title: 'Gęsty tydzień',
    lines: ['próg 4 z 6'],
    ...(band ? { band } : {}),
  });

  it('po lewej podopieczny, po prawej trener jako komisja', () => {
    KINDS.forEach((kind) => {
      for (let seed = 0; seed < 6; seed++) {
        const [left, right] = certificateCast(subject(kind, seed, 'złoto'));
        expect(['gustaw', 'gosia']).toContain(left.who);
        expect(left.mood in TRAINEE_MOODS, `${kind}/${seed}: ${left.mood}`).toBe(true);
        expect(right.who).toBe('siwy');
        expect(right.mood in COACH_MOODS, `${kind}/${seed}: ${right.mood}`).toBe(true);
      }
    });
  });

  it('na świadectwie odznaki mina rośnie razem z tworzywem', () => {
    // Ta sama drabina co w oknie zdobycia — karta nie może cieszyć się inaczej niż ekran.
    for (const band of [1, 2, 3, 4, 5] as const) {
      const [left] = certificateCast(subject('badge', band, BAND_NAME[band]));
      expect(left.mood, BAND_NAME[band]).toBe(BAND_MOOD[band]);
    }
  });

  it('nikt nie udostępnia dokumentu, na którym ktoś jest smutny', () => {
    KINDS.forEach((kind) => {
      for (let seed = 0; seed < 12; seed++) {
        const [left] = certificateCast(subject(kind, seed, 'brąz'));
        expect(['longing', 'missed']).not.toContain(left.mood);
      }
    });
  });

  it('ta sama karta zawsze ma tę samą obsadę', () => {
    expect(certificateCast(subject('session', 7))).toEqual(certificateCast(subject('session', 7)));
  });

  it('twarz obsady przenosi się do samodzielnego obrazka bez zmiennych arkusza', () => {
    // Obrazek z `data:` nie widzi arkusza strony: zmienna bez wartości zapasowej zostałaby
    // czarną plamą. Każda twarz, każda mina — bo na karcie może wypaść każda.
    const WHO: Who[] = ['gustaw', 'gosia', 'siwy'];
    WHO.forEach((who) => {
      const moods = Object.keys(who === 'siwy' ? COACH_MOODS : TRAINEE_MOODS) as GorillaMood[];
      moods.forEach((mood) => {
        const markup = renderToStaticMarkup(createElement(Gorilla, { who, mood, crop: 'face', size: 320 }));
        expect(inlineVars(markup), `${who}/${mood}`).not.toMatch(/var\(/);
      });
    });
  });
});
