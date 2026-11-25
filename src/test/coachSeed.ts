import type { AssignmentBody, Profession } from '@gymtracker/link';
import { LINK_KEY, reloadLink } from '../link/store';
import type { LinkConnection, LinkState, StoredAssignment, StoredMessage } from '../link/store';

/**
 * Zapis współprac ułożony wprost (bez Sztabu i kryptografii) — dla testów ekranów, które czytają tylko
 * `gt-link`: karta „Od prowadzącego”, listy planów i treningów, jadłospis w dzienniku, cele.
 * Współpraca bez tokenu: potwierdzenia i paczki nigdzie nie idą (i nie sięgają po sieć).
 */

export const COACH = { name: 'Ola Nowak', profession: 'dietitian' as Profession };

export function connection(over: Partial<LinkConnection> = {}): LinkConnection {
  return {
    id: 'c1',
    inviteId: 'i1',
    coachId: 'k1',
    coach: { ...COACH },
    areas: ['training', 'nutrition'],
    scopes: ['training'],
    pseudonym: '0123456789ABCDEFGHJK',
    attempt: 0,
    token: null,
    privateJwk: null,
    coachKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
    createdAt: 1,
    lastPushAt: null,
    lastPullAt: null,
    status: 'active',
    endedBy: null,
    endedAt: null,
    ...over,
  };
}

let n = 0;

/** Zalecenie o numerze w kształcie UUID; `id` — gdy test potrzebuje konkretnego. */
export function assignment(body: AssignmentBody, over: Partial<StoredAssignment> = {}): StoredAssignment {
  n += 1;
  const id = over.id ?? `a${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`;
  return {
    id,
    connectionId: 'c1',
    a: { v: 1, id, area: 'nutrition', sentAt: Date.now() - 60_000, from: { ...COACH }, body },
    receivedAt: Date.now(),
    status: 'seen',
    ticked: [],
    sent: 'seen',
    ...over,
  };
}

export function message(text: string, over: Partial<StoredMessage> = {}): StoredMessage {
  n += 1;
  return { id: `m${n}`, connectionId: 'c1', author: 'coach', text, ref: null, at: Date.now(), serverAt: new Date().toISOString(), readAt: null, ...over };
}

/** Zapis jak po synchronizacji: do `localStorage` i od nowa do pamięci modułu. */
export function seedLink(s: Partial<LinkState>): void {
  const full: LinkState = { connections: [], assignments: [], broken: [], unsupported: [], messages: [], answers: [], ticks: {}, ...s };
  localStorage.setItem(LINK_KEY, JSON.stringify(full));
  reloadLink();
}

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

export const HABITS: AssignmentBody = {
  kind: 'habits',
  title: 'Codzienne',
  note: '',
  until: null,
  items: [
    { label: 'Kreatyna', dose: '5 g', when: 'morning', days: EVERY_DAY },
    { label: 'Woda', dose: '2 l', when: 'any', days: EVERY_DAY },
  ],
};

export const MEALS: AssignmentBody = {
  kind: 'meals',
  title: 'Redukcja 2000',
  start: null,
  note: '',
  days: [
    {
      label: '',
      meals: [
        { slot: 'Śniadanie', name: 'Owsianka z jagodami', recipe: null, kcal: 450, protein: 20, carbs: 60, fat: 12, note: '' },
        { slot: 'Obiad', name: 'Kurczak z ryżem', recipe: null, kcal: 650, protein: 45, carbs: 70, fat: 15, note: '' },
        { slot: 'Kolacja', name: 'Coś lekkiego', recipe: null, kcal: null, protein: null, carbs: null, fat: null, note: '' },
      ],
    },
  ],
};

export const FORM: AssignmentBody = {
  kind: 'form',
  title: 'Wywiad na start',
  intro: '',
  questions: [{ id: 'q1', type: 'text', label: 'Cel?', help: '', required: true, unit: '', min: null, max: null, options: [] }],
  repeat: 'once',
  weekday: null,
  intake: true,
};
