import { describe, expect, it } from 'vitest';
import { assignment, connection } from '../test/coachSeed';
import { coachId, coachPrefix } from './assign';
import type { LinkState } from './store';
import { byCoach, coachOf } from './today';

/** Kto przysłał plan albo trening (`coach-<8 znaków>-…`) — z zapisu współprac, bez sieci. */

const state = (over: Partial<LinkState>): LinkState => ({ connections: [], assignments: [], broken: [], unsupported: [], messages: [], answers: [], ticks: {}, ...over });

const planBody = {
  kind: 'plan' as const,
  plan: { id: 'sila', name: 'Siła', level: 'base' as const, sex: 'any' as const, daysPerWeek: 2, weeks: 8, loadFactor: 1, cycle: ['a'], weekdays: [1, 4], desc: '', kind: 'own' as const },
  workouts: [{ id: 'a', name: 'Góra A', items: [{ ex: 'swing2' }] }],
  videos: {},
  note: '',
};

describe('coachOf', () => {
  it('plan i treningi z rotacji: po zaleceniu, z którego powstały; nazwisko z bieżącej współpracy', () => {
    const a = assignment(planBody, { made: { plan: coachId('x', 'nie-ten') } });
    const s = state({ connections: [connection({ coach: { name: 'Ola Kowalska', profession: 'trainer' } })], assignments: [a] });
    const who = coachOf(s, coachId(a.id, 'sila'));
    expect(who).toMatchObject({ name: 'Ola Kowalska', profession: 'trainer', active: true });
    expect(who?.assignment.id).toBe(a.id);
    // Trening z rotacji tego planu — ten sam początek numeru.
    expect(coachOf(s, coachId(a.id, 'a'))?.assignment.id).toBe(a.id);
  });

  it('`made` wygrywa z początkiem numeru; zakończona współpraca nie jest „aktywna”; obcy numer — nic', () => {
    const a = assignment(planBody);
    const b = assignment(planBody, { made: { plan: `${coachPrefix(a.id)}sila` }, connectionId: 'c2' });
    const s = state({ connections: [connection(), connection({ id: 'c2', status: 'ended', coach: { name: 'Jan', profession: 'physio' } })], assignments: [a, b] });
    expect(coachOf(s, `${coachPrefix(a.id)}sila`)).toMatchObject({ name: 'Jan', active: false });
    expect(coachOf(s, 'moj-plan')).toBeNull();
    expect(coachOf(s, 'coach-zzzzzzzz-x')).toBeNull();
    expect(coachOf(s, `coach-ffffffff-sila`)).toBeNull();
    expect(coachOf(s, undefined)).toBeNull();
  });

  it('bez współpracy w zapisie — nazwisko z zalecenia, nie aktywna', () => {
    const a = assignment(planBody, { connectionId: 'zniknela' });
    expect(coachOf(state({ assignments: [a] }), coachId(a.id, 'sila'))).toMatchObject({ connection: null, name: 'Ola Nowak', active: false });
  });
});

describe('byCoach', () => {
  it('tylko trwające współprace, po prowadzących, wskazany pierwszy w swojej grupie', () => {
    const a = assignment(planBody);
    const b = assignment(planBody, { connectionId: 'c2' });
    const ended = assignment(planBody, { connectionId: 'c3' });
    const s = state({
      connections: [connection(), connection({ id: 'c2', coach: { name: 'Jan', profession: 'physio' } }), connection({ id: 'c3', status: 'ended' })],
      assignments: [a, b, ended],
    });
    const list = [{ id: 'moj' }, { id: coachId(a.id, 'x') }, { id: coachId(b.id, 'y') }, { id: coachId(a.id, 'z') }, { id: coachId(ended.id, 'q') }];
    expect(byCoach(s, list, coachId(a.id, 'z'))).toEqual([
      { key: 'c1', name: 'Ola Nowak', items: [{ id: coachId(a.id, 'z') }, { id: coachId(a.id, 'x') }] },
      { key: 'c2', name: 'Jan', items: [{ id: coachId(b.id, 'y') }] },
    ]);
  });
});
