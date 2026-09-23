import { describe, expect, it } from 'vitest';
import { MOVES } from '../data/moves';
import { ANIM } from '../data/anim';
import { EX } from '../data/exercises';
import { SEG, STAGE, lerpPose, polyline, resolve, sampleCycle, skeleton } from './pose';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('łamana SVG', () => {
  it('rozdziela liczby, choćby obie miały część dziesiętną', () => {
    // Sklejenie dałoby „90.189.2”, a parser przeczytałby 90.189 i .2.
    const d = polyline([
      { x: 89.2, y: 90.1 },
      { x: 89.2, y: 90.1 },
    ]);
    expect(d).toBe('M 89.2 90.1 L 89.2 90.1');
    expect(d).not.toMatch(/\d\.\d+\.\d/);
  });

  it('rysuje kończynę jako dwa odcinki przez staw', () => {
    const d = polyline([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
    ]);
    expect(d.match(/L/g)).toHaveLength(2);
  });

  it('pusta lista nie produkuje śmieci', () => {
    expect(polyline([])).toBe('');
  });
});

describe('szkielet', () => {
  it('trzyma stałe długości segmentów niezależnie od pozy', () => {
    const poses = [
      {},
      { torso: 70, legA: 128, legB: 212 },
      { anchor: 'free' as const, rootY: 40, armA: 12, armB: 300 },
    ];
    poses.forEach((p) => {
      const s = skeleton(p);
      expect(dist(s.hip, s.neck)).toBeCloseTo(SEG.torso, 3);
      expect(dist(s.neck, s.elbowN)).toBeCloseTo(SEG.upperArm, 3);
      expect(dist(s.elbowN, s.wristN)).toBeCloseTo(SEG.forearm, 3);
      expect(dist(s.hip, s.kneeN)).toBeCloseTo(SEG.thigh, 3);
      expect(dist(s.kneeN, s.ankleN)).toBeCloseTo(SEG.shin, 3);
    });
  });

  it('kąt zero kieruje segment w górę, a 180 w dół', () => {
    const up = skeleton({ anchor: 'free', torso: 0 });
    expect(up.neck.y).toBeCloseTo(up.hip.y - SEG.torso, 3);
    const down = skeleton({ anchor: 'free', torso: 180 });
    expect(down.neck.y).toBeCloseTo(down.hip.y + SEG.torso, 3);
  });

  it('kotwica na podłożu stawia najniższy punkt ciała na linii ziemi', () => {
    const s = skeleton({ torso: 34, legA: 128, legB: 212 });
    const low = Math.max(...Object.values(s).map((q) => q.y));
    expect(low).toBeCloseTo(STAGE.ground, 3);
  });

  it('kotwica swobodna zostawia biodro tam, gdzie je postawiono', () => {
    const s = skeleton({ anchor: 'free', rootX: 78, rootY: 50 });
    expect(s.hip).toEqual({ x: 78, y: 50 });
  });

  it('dalsze kończyny idą za bliższymi, gdy poza ich nie podaje', () => {
    const p = resolve({ armA: 100, legA: 140 });
    expect(p.farArmA).toBeCloseTo(105, 3);
    expect(p.farLegA).toBeCloseTo(140, 3);
  });
});

describe('cykl powtórzenia', () => {
  const frames = [
    { at: 0, pose: { torso: 0 } },
    { at: 0.5, pose: { torso: 60 } },
  ];

  it('zaczyna i kończy w tej samej pozie, więc pętla nie przeskakuje', () => {
    const a = sampleCycle(frames, 0);
    const b = sampleCycle(frames, 1);
    expect(b.torso).toBeCloseTo(a.torso, 3);
  });

  it('w połowie przejścia jest w połowie drogi', () => {
    expect(sampleCycle(frames, 0.25).torso).toBeCloseTo(30, 3);
  });

  it('zwalnia na krańcach zakresu', () => {
    // Wygładzenie tempa: ćwierć drogi w czasie daje mniej niż ćwierć drogi w kącie.
    expect(sampleCycle(frames, 0.125).torso).toBeLessThan(15);
  });

  it('radzi sobie z wartościami spoza zakresu', () => {
    expect(sampleCycle(frames, 2.25).torso).toBeCloseTo(30, 3);
    expect(sampleCycle(frames, -0.75).torso).toBeCloseTo(30, 3);
  });

  it('pojedyncza klatka to poza nieruchoma', () => {
    const one = [{ at: 0, pose: { torso: 20 } }];
    expect(sampleCycle(one, 0.7).torso).toBe(20);
  });

  it('mieszanie póz nie gubi kotwicy', () => {
    const p = lerpPose({ anchor: 'free' }, { anchor: 'ground' }, 0.9);
    expect(p.anchor).toBe('ground');
  });
});

describe('katalog ruchów', () => {
  it('każdy ruch ma klatki w rosnącej kolejności i sensowne tempo', () => {
    Object.entries(MOVES).forEach(([name, m]) => {
      expect({ name, frames: m.frames.length > 1 }).toEqual({ name, frames: true });
      expect(m.secs).toBeGreaterThan(0.5);
      expect(m.secs).toBeLessThan(10);
      expect(m.alt.length).toBeGreaterThan(20);
      m.frames.forEach((f, i) => {
        expect(f.at).toBeGreaterThanOrEqual(0);
        expect(f.at).toBeLessThanOrEqual(1);
        if (i > 0) expect(f.at).toBeGreaterThan(m.frames[i - 1]!.at);
      });
    });
  });

  it('sylwetka nie wychodzi poza kadr w żadnej klatce żadnego ruchu', () => {
    Object.entries(MOVES).forEach(([name, m]) => {
      for (let t = 0; t < 1; t += 0.05) {
        const s = skeleton(sampleCycle(m.frames, t));
        Object.entries(s).forEach(([joint, q]) => {
          const inside = q.x > -12 && q.x < STAGE.w + 12 && q.y > -12 && q.y < STAGE.h + 12;
          expect({ name, joint, inside }).toEqual({ name, joint, inside: true });
        });
      }
    });
  });

  it('żadna stopa nie wchodzi pod podłogę przy kotwicy na podłożu', () => {
    Object.entries(MOVES).forEach(([name, m]) => {
      for (let t = 0; t < 1; t += 0.05) {
        const pose = sampleCycle(m.frames, t);
        if (pose.anchor !== 'ground') continue;
        const low = Math.max(...Object.values(skeleton(pose)).map((q) => q.y));
        expect({ name, low: Math.round(low) }).toEqual({ name, low: STAGE.ground });
      }
    });
  });
});

describe('przypisanie ćwiczeń do ruchów', () => {
  it('każdy wpis wskazuje istniejące ćwiczenie i istniejący ruch', () => {
    Object.entries(ANIM).forEach(([id, move]) => {
      expect({ id, known: !!EX[id] }).toEqual({ id, known: true });
      expect({ id, move: move! in MOVES }).toEqual({ id, move: true });
    });
  });

  it('pokrywa większość biblioteki', () => {
    const total = Object.keys(EX).length;
    expect(Object.keys(ANIM).length / total).toBeGreaterThan(0.6);
  });
});
