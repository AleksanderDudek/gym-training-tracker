import { Check } from 'lucide-react';
import { text } from '../../../i18n';
import { addDays } from '../../diet/model';
import { PREPARE, SCENARIOS } from '../../labs/guide';
import { MARKERS } from '../../labs/markers';
import type { Assessment } from '../../labs/assess';
import type { Latest } from '../../labs/verdict';

const T = text({
  pl: {
    title: 'Co zbadać',
    lead: 'Cztery realne drogi: dwie za darmo z NFZ i dwie płatne. Zaznaczam badania, które masz z ostatniego roku.',
    have: 'masz z ostatniego roku',
    maybe: 'czasem także',
    personal: 'Na podstawie twoich wyników',
    prepare: 'Jak się przygotować',
  },
  en: {
    title: 'What to test',
    lead: 'Four real ways: two free through NFZ and two paid. Tests you have from the last year are ticked.',
    have: 'you have it from the last year',
    maybe: 'sometimes also',
    personal: 'Based on your results',
    prepare: 'How to prepare',
  },
});

export function GuideView({ latest, today, missing }: { latest: Map<string, Latest>; today: string; missing: Assessment['missing'] }) {
  const yearAgo = addDays(today, -365);
  const fresh = (id: string) => (latest.get(id)?.date ?? '') >= yearAgo;
  const chip = (id: string) => {
    const m = MARKERS[id];
    if (!m) return null;
    const ok = fresh(id);
    return (
      <li key={id} className={ok ? 'fd-lab-chip fd-lab-chip-have' : 'fd-lab-chip'}>
        {ok && <Check aria-hidden="true" size={12} />}
        {m.short ?? m.name}
        {ok && <span className="sr-only"> — {T.have}</span>}
      </li>
    );
  };
  return (
    <>
      <section className="grp" aria-labelledby="fd-lab-guide">
        <h2 id="fd-lab-guide">{T.title}</h2>
        <p className="tight">{T.lead}</p>
      </section>
      {missing.length > 0 && (
        <section className="grp" aria-labelledby="fd-lab-personal">
          <h2 id="fd-lab-personal">{T.personal}</h2>
          <ul className="fd-lab-list">
            {missing.map((m) => (
              <li key={m.marker}>
                <b>{MARKERS[m.marker]!.name}</b> — {m.why}
              </li>
            ))}
          </ul>
        </section>
      )}
      {SCENARIOS.map((s) => (
        <section key={s.id} className="grp" aria-labelledby={`fd-lab-sc-${s.id}`}>
          <h2 id={`fd-lab-sc-${s.id}`}>{s.title}</h2>
          <p className="tight">{s.how}</p>
          <ul className="fd-lab-chips">{s.markers.map(chip)}</ul>
          {s.maybe && (
            <>
              <p className="fd-lab-food-meta">{T.maybe}:</p>
              <ul className="fd-lab-chips">{s.maybe.map(chip)}</ul>
            </>
          )}
          <p className="fd-lab-food-meta">{s.note}</p>
        </section>
      ))}
      <section className="grp" aria-labelledby="fd-lab-prepare">
        <h2 id="fd-lab-prepare">{T.prepare}</h2>
        <ul className="fd-lab-list">
          {PREPARE.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
