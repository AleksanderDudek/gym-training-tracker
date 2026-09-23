import type { ExerciseId } from '../types';
import type { MoveName } from './moves';

/**
 * Przypisanie ćwiczeń do wzorców ruchu. Ćwiczenia bez wpisu po prostu nie mają animacji —
 * lepiej nie pokazać nic niż pokazać ruch, który tylko przypomina właściwy.
 */
export const ANIM: Partial<Record<ExerciseId, MoveName>> = {
  /* Zawias biodrowy */
  swing2: 'swing',
  swing1: 'swing',
  clean_kb: 'swing',
  snatch_kb: 'swing',
  rdl: 'hinge',
  rdl_bb: 'hinge',
  rdl_db: 'hinge',
  rdl_single: 'hinge',
  deadlift: 'hinge',
  deadlift_sumo: 'hinge',
  goodmorning: 'hinge',
  hyper: 'hinge',
  pullthrough: 'hinge',
  legcurl: 'legCurl',

  /* Przysiad */
  goblet: 'squat',
  squat_back: 'squat',
  squat_front: 'squat',
  squat_box: 'squat',
  hacksquat: 'squat',
  squat_air: 'squat',
  sissy: 'squat',
  pistol: 'squat',
  lunge: 'lunge',
  lunge_walk: 'lunge',
  bulgarian: 'lunge',
  stepup: 'lunge',
  legext: 'legExtension',

  /* Ciągnięcie */
  row: 'row',
  row_bb: 'row',
  row_db: 'row',
  row_tbar: 'row',
  row_cable: 'row',
  row_inverted: 'row',
  facepull: 'row',
  pullup: 'pullup',
  chinup: 'pullup',
  latpulldown: 'pullup',
  curl: 'curl',
  curl_bb: 'curl',
  curl_db: 'curl',
  curl_hammer: 'curl',
  curl_preacher: 'curl',

  /* Pchanie */
  press: 'pressOverhead',
  ohp_bb: 'pressOverhead',
  ohp_db: 'pressOverhead',
  arnold: 'pressOverhead',
  bench: 'benchPress',
  bench_incline: 'benchPress',
  bench_db: 'benchPress',
  bench_close: 'benchPress',
  chestpress: 'benchPress',
  floor: 'benchPress',
  pushup: 'pushup',
  pushup_diamond: 'pushup',
  pushup_pike: 'pushup',
  dip: 'dip',
  dip_bench: 'dip',
  lateral: 'lateral',
  frontraise: 'lateral',

  /* Całe ciało */
  thruster: 'squat',
  wallball: 'squat',
  boxjump: 'squat',
  clean_jerk: 'pressOverhead',
  burpee: 'pushup',
  sled: 'carry',

  /* Core i carry */
  carry: 'carry',
  farmer: 'carry',
  carry_oh: 'carry',
  carry_rack: 'carry',
  sled_drag: 'carry',
  plank: 'plank',
  plank_side: 'plank',
  abwheel: 'plank',
  copenhagen: 'plank',
  core: 'crunch',
  hollow: 'crunch',
  deadbug: 'crunch',
  crunch_cable: 'crunch',
  russian: 'crunch',

  /* Nogi — dodatkowe */
  calf: 'calf',
  calf1: 'calf',
  calf_seated: 'calf',
  calf_press: 'calf',
  tibialis: 'calf',
};
