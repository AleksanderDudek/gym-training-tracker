import type { Area, AssignmentKind, Profession, Scope } from '@gymtracker/link';
import { text } from '@gt/i18n';

/** Nazwy obszarów, zakresów, zawodów i rodzajów zaleceń — te same słowa co w GYM TRACKERze. */
export const L = text({
  pl: {
    area: { training: 'Trening', nutrition: 'Żywienie', rehab: 'Rehabilitacja', insight: 'Wgląd' } as Record<Area, string>,
    areaHint: {
      training: 'Układasz plany i treningi. Jeden prowadzący trening naraz.',
      nutrition: 'Ustalasz cele, zalecenia i badania. Jeden prowadzący żywienie naraz.',
      rehab: 'Ćwiczenia po urazie lub operacji. Jeden fizjoterapeuta naraz.',
      insight: 'Oglądasz dane i zlecasz badania, bez planów. Do trzech osób naraz.',
    } as Record<Area, string>,
    scope: {
      training: 'Treningi, serie i plan',
      movement: 'Kroki, cardio, zegarek i telefon',
      food: 'Jedzenie i napoje',
      body: 'Waga i obwody',
      labs: 'Badania',
    } as Record<Scope, string>,
    scopeShort: { training: 'treningi', movement: 'ruch', food: 'jedzenie', body: 'ciało', labs: 'badania' } as Record<Scope, string>,
    profession: {
      trainer: 'Trener personalny',
      dietitian: 'Dietetyk',
      physio: 'Fizjoterapeuta',
      doctor: 'Lekarz',
      other: 'Specjalista',
    } as Record<Profession, string>,
    kind: { plan: 'Plan treningowy', workout: 'Trening', targets: 'Cele', labs: 'Badania do zrobienia', note: 'Zalecenie' } as Record<
      AssignmentKind,
      string
    >,
  },
  en: {
    area: { training: 'Training', nutrition: 'Nutrition', rehab: 'Rehab', insight: 'Insight' } as Record<Area, string>,
    areaHint: {
      training: 'You build plans and workouts. One training coach at a time.',
      nutrition: 'You set targets, advice and lab tests. One nutrition coach at a time.',
      rehab: 'Exercises after an injury or surgery. One physio at a time.',
      insight: 'You review data and order lab tests, no plans. Up to three at a time.',
    } as Record<Area, string>,
    scope: {
      training: 'Workouts, sets and plan',
      movement: 'Steps, cardio, watch and phone',
      food: 'Food and drinks',
      body: 'Weight and measurements',
      labs: 'Lab results',
    } as Record<Scope, string>,
    scopeShort: { training: 'workouts', movement: 'movement', food: 'food', body: 'body', labs: 'labs' } as Record<Scope, string>,
    profession: {
      trainer: 'Personal trainer',
      dietitian: 'Dietitian',
      physio: 'Physiotherapist',
      doctor: 'Doctor',
      other: 'Specialist',
    } as Record<Profession, string>,
    kind: { plan: 'Training plan', workout: 'Workout', targets: 'Targets', labs: 'Lab tests to do', note: 'Advice' } as Record<
      AssignmentKind,
      string
    >,
  },
});

export const APP_NAME = 'GYM TRACKER Sztab';
