import type { RestPlan } from './rests';
import type { EffortKey, ExerciseId, Session, SetResult } from '../types';

/**
 * Zapis sesji seria po serii — dla prowadzenia, w którym robi się jedną serię na raz.
 *
 * Serie trafiają do tego samego `session.res` co w widoku listy, więc oba widoki widzą to samo
 * i przejście między nimi niczego nie gubi. Ćwiczenie jest zamknięte (`done`) dopiero po
 * ostatniej serii i odpowiedzi „ile zostało w zapasie” — tej, na której stoi progresja.
 * Funkcje działają na przekazanej sesji; aplikacja woła je na kopii stanu.
 */

/** Dopisuje serię. Po ostatniej ćwiczenie czeka na ocenę zapasu (`ask`). */
export function addSet(s: Session, id: ExerciseId, row: SetResult, of: number): void {
  const r = (s.res[id] ??= { rows: [], effort: 'solid' });
  r.rows.push(row);
  s.last = id;
  if (r.rows.length >= of) s.ask = [...(s.ask ?? []).filter((x) => x !== id), id];
}

/** Cofa ostatnią serię ćwiczenia — pomyłka w liczbie albo stuknięcie za wcześnie. */
export function undoSet(s: Session, id: ExerciseId): void {
  const r = s.res[id];
  if (!r) return;
  r.rows.pop();
  if (!r.rows.length) delete s.res[id];
  delete s.done[id];
  s.ask = (s.ask ?? []).filter((x) => x !== id);
}

/**
 * Ćwiczenie wychodzi z kolejki ocen — zapisane albo wyczyszczone w widoku listy, zamienione,
 * pominięte. Inaczej pytanie o zapas wróciłoby po pierwszej serii od nowa.
 */
export function forgetAsk(s: Session, ...ids: ExerciseId[]): void {
  if (s.ask) s.ask = s.ask.filter((x) => !ids.includes(x));
}

/** Odpowiedź „ile zostało w zapasie” zamyka ćwiczenie. */
export function answerEffort(s: Session, id: ExerciseId, effort: EffortKey): void {
  const r = s.res[id];
  if (!r) return;
  r.effort = effort;
  s.done[id] = true;
  s.ask = (s.ask ?? []).filter((x) => x !== id);
}

/** Przerwa liczona od teraz. Koniec zapisany jako chwila — liczy się dalej po odświeżeniu i przy zgaszonym ekranie. */
export function startRest(s: Session, plan: RestPlan | null, now: number): void {
  if (!plan) {
    delete s.rest;
    return;
  }
  s.rest = { until: now + plan.secs * 1000, secs: plan.secs, kind: plan.kind, ...(plan.why ? { why: plan.why } : {}) };
}

export function extendRest(s: Session, secs: number, now: number): void {
  if (!s.rest) return;
  const from = Math.max(s.rest.until, now);
  s.rest = { ...s.rest, until: from + secs * 1000, secs: s.rest.secs + secs };
}

export function skipRest(s: Session): void {
  delete s.rest;
}

/**
 * Ćwiczenia z zapisanymi seriami, ale bez zamknięcia — trening skończony w połowie ćwiczenia
 * albo bez odpowiedzi o zapas. Zrobione serie są prawdziwe, więc idą do wyniku z oceną
 * „Solidnie”; pominięte ćwiczenia zostają pominięte.
 */
export function settleOpen(s: Session): ExerciseId[] {
  const open = Object.keys(s.res).filter((id) => !s.done[id] && !s.skip[id] && s.res[id]!.rows.length);
  open.forEach((id) => {
    s.done[id] = true;
  });
  delete s.ask;
  delete s.rest;
  return open;
}
