import type { Area, AssignmentV1, Profession, Scope } from '@gymtracker/link';
import { text } from '../i18n';

/**
 * Nazwy we współpracy z prowadzącym — wspólne dla karty w profilu, uwagi na ekranie Dziś
 * i stron współpracy. Wartości zapisane (`trainer`, `training`) zostają kluczami; tłumaczą się
 * tylko etykiety.
 */
export const W = text({
  pl: {
    profession: {
      trainer: 'Trener',
      dietitian: 'Dietetyk',
      physio: 'Fizjoterapeuta',
      doctor: 'Lekarz',
      other: 'Prowadzący',
    } as Record<Profession, string>,
    area: {
      training: 'Trening',
      nutrition: 'Żywienie',
      rehab: 'Rehabilitacja',
      insight: 'Wgląd',
    } as Record<Area, string>,
    areaHint: {
      training: 'układa plany i treningi',
      nutrition: 'ustala cele jedzenia, zleca badania',
      rehab: 'układa ćwiczenia po urazie',
      insight: 'tylko ogląda dane i zleca badania',
    } as Record<Area, string>,
    scope: {
      training: 'Treningi, serie i plan',
      movement: 'Kroki, cardio, zegarek i telefon',
      food: 'Jedzenie i napoje',
      body: 'Waga i obwody',
      labs: 'Badania',
    } as Record<Scope, string>,
    kind: {
      plan: 'plan',
      workout: 'trening',
      targets: 'cele',
      labs: 'badania do zrobienia',
      note: 'zalecenie',
    } as Record<AssignmentV1['body']['kind'], string>,
  },
  en: {
    profession: { trainer: 'Trainer', dietitian: 'Dietitian', physio: 'Physiotherapist', doctor: 'Doctor', other: 'Coach' },
    area: { training: 'Training', nutrition: 'Nutrition', rehab: 'Rehab', insight: 'Overview' },
    areaHint: {
      training: 'plans your training',
      nutrition: 'sets food targets, orders lab tests',
      rehab: 'plans exercises after an injury',
      insight: 'only views your data and orders lab tests',
    },
    scope: {
      training: 'Workouts, sets and plan',
      movement: 'Steps, cardio, watch and phone',
      food: 'Food and drinks',
      body: 'Weight and measurements',
      labs: 'Lab results',
    },
    kind: { plan: 'plan', workout: 'workout', targets: 'targets', labs: 'lab tests to do', note: 'note' },
  },
});

/** Tytuł zalecenia jednym kawałkiem: „plan „Siła 8 tyg.””, „trening „Góra A””, „Jak spać”. */
export function assignmentTitle(a: AssignmentV1): string {
  const b = a.body;
  switch (b.kind) {
    case 'plan':
      return `${W.kind.plan} „${b.plan.name}”`;
    case 'workout':
      return `${W.kind.workout} „${b.workout.name}”`;
    case 'note':
      return b.title;
    default:
      return W.kind[b.kind];
  }
}
