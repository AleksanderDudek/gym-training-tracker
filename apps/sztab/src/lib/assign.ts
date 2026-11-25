import { parseAssignment } from '@gymtracker/link';
import type { Area, AssignmentBody } from '@gymtracker/link';
import type { Coach, LibraryItem, SendableBody } from './data';

/**
 * Treść z biblioteki zamieniona na zalecenie: plan dostaje treningi z biblioteki, do których odsyła.
 * (Osobno od okna wysyłki — używa go też uruchomienie programu i wydruk.)
 */
export function toAssignment(body: SendableBody, library: readonly LibraryItem[], note: string): AssignmentBody {
  switch (body.kind) {
    case 'workout':
      return { kind: 'workout', workout: body.workout, videos: body.videos, note };
    case 'plan': {
      const mine = library.flatMap((i) => (i.body.kind === 'workout' && body.plan.cycle.includes(i.body.workout.id) ? [i.body] : []));
      return {
        kind: 'plan',
        plan: body.plan,
        workouts: mine.map((w) => w.workout),
        videos: Object.assign({}, ...mine.map((w) => w.videos)) as Record<string, string>,
        note,
      };
    }
    default:
      return body;
  }
}

/** To samo sprawdzenie, które zrobi telefon — lepiej odmówić tu niż wysłać coś, co tam przepadnie. */
export const passesCheck = (coach: Pick<Coach, 'display_name' | 'profession'>, area: Area, body: AssignmentBody): boolean =>
  parseAssignment({ v: 1, id: 'check', area, sentAt: Date.now(), from: { name: coach.display_name, profession: coach.profession }, body }) !== null;
