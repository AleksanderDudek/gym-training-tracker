import { describe, expect, it } from 'vitest';
import { COACH_MOODS, TRAINEE_MOODS, WHO_NAME } from './Gorilla';
import { BAND_MOOD, BAND_NAME } from './BadgeArt';
import { COACH_TIPS } from '../engine/quips';

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
