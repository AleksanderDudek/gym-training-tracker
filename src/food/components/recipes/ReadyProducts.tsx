import { useRef, useState } from 'react';
import { text } from '../../../i18n';
import { formatNumber } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import type { ReadyGroup } from '../../recipes/ready';
import { ProductCard } from '../common/ProductCard';
import './recipes.css';

const T = text({
  pl: {
    more: (n: string, of: string) => `Pokaż więcej (${n} z ${of})`,
    less: 'Zwiń',
    none: 'Brak gotowych produktów spełniających zasadę w tym sklepie.',
  },
  en: {
    more: (n: string, of: string) => `Show more (${n} of ${of})`,
    less: 'Show less',
    none: 'No ready products meet the rule in this shop.',
  },
});

const VISIBLE = 6;
const STEP = 24;

function Group({ group, dict, onOpen }: { group: ReadyGroup; dict: Dictionaries; onOpen: (code: string) => void }) {
  // Rośnie krokami, więc da się dojść do każdego produktu, który liczy nagłówek.
  const [visible, setVisible] = useState(VISIBLE);
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = group.items.slice(0, visible);
  const hidden = group.items.length - shown.length;
  const headingId = `fd-rec-ready-${group.id}`;

  // Zwinięcie zabiera przycisk spod palca i skraca listę o setki pikseli: wraca się do nagłówka
  // grupy, a fokus staje na nim — inaczej zostałby na niczym, gdzieś pod spodem strony.
  const collapse = () => {
    setVisible(VISIBLE);
    requestAnimationFrame(() => {
      heading.current?.scrollIntoView?.({ block: 'nearest' });
      heading.current?.focus({ preventScroll: true });
    });
  };

  return (
    <section className="fd-rec-ready-group" aria-labelledby={headingId}>
      <h3 id={headingId} ref={heading} tabIndex={-1} className="fd-rec-ready-title">
        {group.label} <span>({formatNumber(group.items.length, 0)})</span>
      </h3>
      <ul className="fd-grid">
        {shown.map((p) => (
          <li key={p.code}>
            <ProductCard product={p} dict={dict} onOpen={onOpen} headingLevel={4} />
          </li>
        ))}
      </ul>
      {(hidden > 0 || visible > VISIBLE) && (
        <div className="btnrow fd-rec-ready-more">
          {hidden > 0 && (
            <button type="button" className="btn sm ghost" onClick={() => setVisible((v) => v + STEP)}>
              {T.more(formatNumber(Math.min(hidden, STEP), 0), formatNumber(hidden, 0))}
            </button>
          )}
          {visible > VISIBLE && (
            <button type="button" className="btn sm ghost" onClick={collapse}>
              {T.less}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Produkty, które już same spełniają zasadę na 100 g: otwierasz i jesz. */
export function ReadyProducts({
  groups,
  dict,
  onOpen,
}: {
  groups: ReadyGroup[];
  dict: Dictionaries;
  onOpen: (code: string) => void;
}) {
  if (groups.length === 0) {
    return <p className="hint">{T.none}</p>;
  }
  return (
    <div className="fd-rec-ready-groups">
      {groups.map((group) => (
        <Group key={group.id} group={group} dict={dict} onOpen={onOpen} />
      ))}
    </div>
  );
}
