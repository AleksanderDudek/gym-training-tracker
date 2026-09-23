/**
 * Szkielet manekina do animacji ćwiczeń.
 *
 * Pozy opisane są kątami bezwzględnymi w stopniach: 0 to kierunek w górę, wartości rosną
 * zgodnie z ruchem wskazówek zegara. Kąty bezwzględne autorsko są wygodniejsze od względnych
 * — „udo pod 130°” czyta się wprost, a błąd w jednym stawie nie przesuwa całej reszty łańcucha.
 *
 * Moduł jest czystą matematyką bez Reacta: da się go przetestować bez DOM-u.
 */

export interface Pose {
  /** Biodro — punkt zaczepienia całego szkieletu. */
  rootX?: number;
  rootY?: number;
  torso?: number;
  head?: number;
  /** Bliższa ręka: ramię i przedramię. */
  armA?: number;
  armB?: number;
  farArmA?: number;
  farArmB?: number;
  /** Bliższa noga: udo, podudzie, stopa. */
  legA?: number;
  legB?: number;
  foot?: number;
  farLegA?: number;
  farLegB?: number;
  farFoot?: number;
  /**
   * `ground` dosuwa sylwetkę tak, żeby najniższy punkt ciała dotykał podłoża — dzięki temu
   * przysiad nie wisi w powietrzu, a autor pozy nie musi liczyć wysokości bioder.
   * `free` zostawia biodro tam, gdzie je postawiono: do zwisu na drążku i do leżenia.
   */
  anchor?: 'ground' | 'free';
}

export const SEG = {
  torso: 32,
  head: 13,
  upperArm: 21,
  forearm: 19,
  thigh: 26,
  shin: 26,
  foot: 9,
} as const;

export const STAGE = { w: 160, h: 150, ground: 134 } as const;

/** Postawa stojąca — punkt odniesienia dla wszystkich pól, których poza nie podaje. */
export const STAND: Required<Omit<Pose, 'anchor'>> & { anchor: 'ground' | 'free' } = {
  rootX: 78,
  rootY: 62,
  torso: 0,
  head: 0,
  armA: 177,
  armB: 177,
  farArmA: 183,
  farArmB: 183,
  legA: 180,
  legB: 180,
  foot: 92,
  farLegA: 180,
  farLegB: 180,
  farFoot: 92,
  anchor: 'ground',
};

export type FullPose = typeof STAND;

/**
 * Uzupełnienie pozy o wartości domyślne. Dalsza ręka i noga idą za bliższą, więc pozy
 * symetryczne — przysiad, martwy ciąg, wyciskanie obunóż — opisuje się połową pól.
 */
export function resolve(p: Pose): FullPose {
  const armA = p.armA ?? STAND.armA;
  const armB = p.armB ?? armA;
  const legA = p.legA ?? STAND.legA;
  const legB = p.legB ?? legA;
  return {
    rootX: p.rootX ?? STAND.rootX,
    rootY: p.rootY ?? STAND.rootY,
    torso: p.torso ?? STAND.torso,
    head: p.head ?? p.torso ?? STAND.head,
    armA,
    armB,
    farArmA: p.farArmA ?? armA + 5,
    farArmB: p.farArmB ?? p.farArmA ?? armB + 5,
    legA,
    legB,
    foot: p.foot ?? STAND.foot,
    farLegA: p.farLegA ?? legA,
    farLegB: p.farLegB ?? p.farLegA ?? legB,
    farFoot: p.farFoot ?? p.foot ?? STAND.farFoot,
    anchor: p.anchor ?? STAND.anchor,
  };
}

export interface Pt {
  x: number;
  y: number;
}

const step = (from: Pt, deg: number, len: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return { x: from.x + Math.sin(a) * len, y: from.y - Math.cos(a) * len };
};

export interface Skeleton {
  hip: Pt;
  neck: Pt;
  head: Pt;
  elbowN: Pt;
  wristN: Pt;
  elbowF: Pt;
  wristF: Pt;
  kneeN: Pt;
  ankleN: Pt;
  toeN: Pt;
  kneeF: Pt;
  ankleF: Pt;
  toeF: Pt;
}

/** Punkty stawów z kątów. Ramię wychodzi z karku, noga z biodra. */
export function skeleton(pose: Pose): Skeleton {
  const p = resolve(pose);
  const hip: Pt = { x: p.rootX, y: p.rootY };
  const neck = step(hip, p.torso, SEG.torso);
  const head = step(neck, p.head, SEG.head);
  const elbowN = step(neck, p.armA, SEG.upperArm);
  const elbowF = step(neck, p.farArmA, SEG.upperArm);
  const kneeN = step(hip, p.legA, SEG.thigh);
  const kneeF = step(hip, p.farLegA, SEG.thigh);
  const ankleN = step(kneeN, p.legB, SEG.shin);
  const ankleF = step(kneeF, p.farLegB, SEG.shin);

  const raw: Skeleton = {
    hip,
    neck,
    head,
    elbowN,
    wristN: step(elbowN, p.armB, SEG.forearm),
    elbowF,
    wristF: step(elbowF, p.farArmB, SEG.forearm),
    kneeN,
    ankleN,
    toeN: step(ankleN, p.foot, SEG.foot),
    kneeF,
    ankleF,
    toeF: step(ankleF, p.farFoot, SEG.foot),
  };

  if (p.anchor === 'free') return raw;

  // Najniższy punkt ciała ląduje na podłodze. W układzie ekranu „niżej” znaczy większe y.
  const low = Math.max(...Object.values(raw).map((q) => q.y));
  const dy = STAGE.ground - low;
  const out = {} as Skeleton;
  (Object.keys(raw) as (keyof Skeleton)[]).forEach((k) => {
    out[k] = { x: raw[k].x, y: raw[k].y + dy };
  });
  return out;
}

/**
 * Łamana jako atrybut `d`. Każda liczba dostaje własny separator: sklejenie „90.1” z „89.2”
 * daje „90.189.2”, a parser SVG czyta to jako 90.189 i .2 — i sylwetka rozjeżdża się po całym
 * kadrze zamiast rzucić błędem.
 */
export function polyline(points: Pt[]): string {
  if (!points.length) return '';
  const n = (v: number): string => v.toFixed(1);
  const [first, ...rest] = points;
  return `M ${n(first!.x)} ${n(first!.y)}${rest.map((q) => ` L ${n(q.x)} ${n(q.y)}`).join('')}`;
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export function lerpPose(a: Pose, b: Pose, t: number): FullPose {
  const x = resolve(a);
  const y = resolve(b);
  const out = { ...x };
  (Object.keys(x) as (keyof FullPose)[]).forEach((k) => {
    if (k === 'anchor') return;
    (out[k] as number) = mix(x[k] as number, y[k] as number, t);
  });
  // Kotwica nie jest liczbą — w połowie przejścia trzyma się pozy docelowej, żeby sylwetka
  // nie skakała między dwoma układami odniesienia w trakcie jednego ruchu.
  out.anchor = t < 0.5 ? x.anchor : y.anchor;
  return out;
}

export interface Keyframe {
  /** Moment w cyklu, 0–1. */
  at: number;
  pose: Pose;
}

/** Wygładzenie tempa: ruch zwalnia na końcach zakresu, tak jak prawdziwe powtórzenie. */
const ease = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2;

/**
 * Poza w danym momencie cyklu. Cykl domyka się sam — ostatnia klatka wraca do pierwszej,
 * więc powtórzenie zapętla się bez przeskoku.
 */
export function sampleCycle(frames: Keyframe[], t: number): FullPose {
  if (!frames.length) return resolve({});
  if (frames.length === 1) return resolve(frames[0]!.pose);

  const u = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1]!.at <= u) i++;

  const cur = frames[i]!;
  const nxt = frames[i + 1] ?? { at: 1, pose: frames[0]!.pose };
  const span = nxt.at - cur.at;
  const local = span <= 0 ? 0 : (u - cur.at) / span;
  return lerpPose(cur.pose, nxt.pose, ease(Math.min(1, Math.max(0, local))));
}
