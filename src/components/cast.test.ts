import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COACH_MOODS, Gorilla, TRAINEE_MOODS, WHO_NAME } from './Gorilla';
import type { GorillaMood, Who } from './Gorilla';
import { BAND_MOOD, BAND_NAME } from './BadgeArt';
import { certificateCast } from './Share';
import { COACH_TIPS } from '../engine/quips';
import { inlineVars } from '../engine/share';
import { characterMood } from './Character';
import { freshState } from '../engine/plan';
import { addSnack } from '../engine/snacks';
import { addCardio } from '../engine/cardio';
import { mergeWatch } from '../engine/watch';
import { tierKey } from '../engine/badges';
import { xpSummary } from '../engine/xp';

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

describe('mina postaci', () => {
  const today = '2026-09-27';
  const workout = (iso: string) => ({
    date: iso,
    workout: 'A',
    ready: 'ok' as const,
    items: [{ id: 'swing2', sets: [{ reps: 10, w: 16 }], effort: 'solid' as const }],
  });

  it('próg dopięty dziś przy starcie nie udaje dzisiejszego ruchu', () => {
    // Po aktualizacji aplikacja dopina odznaki ćwiczeń z dawnej historii z dzisiejszą datą.
    const s = freshState();
    s.log = [workout('2026-09-20T08:00:00Z')];
    s.award.badges[tierKey('treningi', 1)] = today;
    const m = characterMood(s, xpSummary(s, today), today);
    expect(m.line).toBe('Ostatni ruch 7 dni temu');
    expect(m.mood).toBe('longing');
  });

  it('przekąska dziś to ruch dziś, trening dziś — ruch porządny', () => {
    const s = freshState();
    addSnack(s, 'squat_air', 10, null, Date.parse(`${today}T09:00:00Z`));
    expect(characterMood(s, xpSummary(s, today), today).mood).toBe('happy');
    s.log = [workout(`${today}T18:00:00Z`)];
    expect(characterMood(s, xpSummary(s, today), today).mood).toBe('proud');
  });

  it('kroki i cardio też są ruchem — liczy się dzień wpisu, nie chwila zapisu', () => {
    const s = freshState();
    addCardio(s, { kind: 'steps', steps: 9000 }, today);
    expect(characterMood(s, xpSummary(s, today), today).mood).toBe('happy');
    const y = freshState();
    // Kroki z wczoraj wpisane dziś rano: wczoraj w ruchu, a nie dziś.
    addCardio(y, { kind: 'steps', steps: 9000 }, '2026-09-26', Date.parse(`${today}T07:00:00Z`));
    expect(characterMood(y, xpSummary(y, today), today).line).toBe('Wczoraj w ruchu');
  });

  it('dzień z zegarka to ruch dopiero z minutami ruchu — sam licznik po mieszkaniu nie', () => {
    const s = freshState();
    const at = Date.parse(`${today}T20:00:00Z`) / 1000;
    const day = (steps: number) => [{ day: today, steps, m: null, floors: null, active: null }];
    mergeWatch(s, { t: at, days: day(2000), acts: [], health: [] });
    expect(characterMood(s, xpSummary(s, today), today).line).toBe('Czeka na pierwszy ruch');
    mergeWatch(s, { t: at + 60, days: day(9000), acts: [], health: [] });
    expect(characterMood(s, xpSummary(s, today), today).mood).toBe('happy');
  });

  it('bez żadnego ruchu postać czeka, a mina zawsze ma zdanie obok', () => {
    const s = freshState();
    const m = characterMood(s, xpSummary(s, today), today);
    expect(m.line).toBe('Czeka na pierwszy ruch');
    expect(TRAINEE_MOODS[m.mood]).toBeTruthy();
  });
});
