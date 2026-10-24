import type { ReactNode } from 'react';
import { pluralEn, text } from '../../../i18n';
import { dayState, type DayTotals } from '../../diet/day';
import type { DayNeeds } from '../../diet/now';
import { kcalStatus } from '../../diet/target';
import { formatNumber, plural } from '../../lib/format';
import { dayLines, gramsOf, kcalOf, overLine } from './dayText';
import { DT } from './dietText';
import { useKcalShown } from './kcalShown';

const n = (value: number) => formatNumber(Math.round(value), 0);

const T = text({
  pl: {
    balance: 'Bilans dnia',
    kcal: 'Kalorie',
    pastHead: (eaten: string, target: string) => `Zjedzone ${eaten} kcal · cel ${target}`,
    futureHead: (kcal: string, g: string) => `Cel na ten dzień: ${kcal} kcal i ${g} g białka`,
    unknown: (count: number) =>
      `${count} ${plural(count, 'wpis ma', 'wpisy mają', 'wpisów ma')} tylko kalorie – suma białka może być zaniżona.`,
    carbsFat: 'Węglowodany i tłuszcz',
    limit: (eaten: string, max: string) => `${eaten} z ${max} g (limit)`,
    overLimit: (eaten: string, max: string, over: string) => `${eaten} z ${max} g — ${over} g ponad limit`,
  },
  en: {
    balance: 'Day balance',
    kcal: 'Calories',
    pastHead: (eaten: string, target: string) => `Eaten ${eaten} kcal · target ${target}`,
    futureHead: (kcal: string, g: string) => `Target for that day: ${kcal} kcal and ${g} g protein`,
    unknown: (count: number) =>
      `${count} ${pluralEn(count, 'entry has', 'entries have')} calories only – the protein total may be too low.`,
    carbsFat: 'Carbs and fat',
    limit: (eaten: string, max: string) => `${eaten} of ${max} g (limit)`,
    overLimit: (eaten: string, max: string, over: string) => `${eaten} of ${max} g — ${over} g over the limit`,
  },
});

/**
 * A day's progress bar. One neutral fill for everything: no colour judges the day, the words beside
 * it do. A minimum to reach (protein) simply fills up when it is done; a ceiling (calories) stops
 * full, and the sentence above says by how much it went over.
 */
export function Bar({ value, target, label, unit }: { value: number; target: number; label: string; unit: 'g' | 'kcal' }) {
  const share = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <div
      className="fd-diet-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(target)}
      aria-valuenow={Math.round(Math.min(Math.max(0, value), target))}
      aria-valuetext={unit === 'g' ? gramsOf(value, target) : kcalOf(value, target)}
    >
      <i style={{ width: `${share * 100}%` }} />
    </div>
  );
}

/** One macro: its name and „96 z 150 g” in a row, the bar under them. */
function Row({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="fd-diet-macro">
      <div className="fd-diet-macro-head">
        <span>{label}</span>
        <span className="fd-diet-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

interface Props {
  /** The day's needs at its target (`dayNeeds` with `targetOn(profile, date)`). */
  needs: DayNeeds;
  /** What is eaten alone, without a planned bigger meal. */
  eaten: DayTotals;
  /** Today says what is left; a closed day what was eaten; a day still to come its target. */
  when: 'today' | 'past' | 'future';
  /** The day's actions under the numbers — „Dodaj zjedzone”, „Ulubione”, „Większy posiłek”. */
  children?: ReactNode;
}

/**
 * The day card (spec §4.2): the same headline as the Today card („Zostało ok. 650 kcal i 54 g
 * białka”), protein and calories with their numbers, the calm over and planned-meal lines, and
 * carbohydrates and fat folded away — open for diets with a carb limit. A closed day says what was
 * eaten against its own target; ±100 kcal is still the target there too. Without calories on
 * screen only the protein row is left.
 */
export function MacroBars({ needs, eaten, when, children }: Props) {
  const shown = useKcalShown();
  const { targets } = needs;
  const today = when === 'today' ? dayLines(dayState(needs, eaten), shown) : null;
  const closed = kcalStatus(targets.kcal, eaten.kcal);
  const headline =
    today?.headline ??
    (!shown
      ? null
      : when === 'past'
        ? T.pastHead(n(eaten.kcal), n(targets.kcal))
        : T.futureHead(n(targets.kcal), n(targets.protein.target)));
  const over = today ? today.over : shown && when === 'past' && closed.kind === 'over' ? overLine(closed.kcal) : null;
  const carbsMax = targets.carbs.max;
  const carbsOver = carbsMax !== null ? Math.round(eaten.carbs - carbsMax) : 0;
  const carbs =
    carbsMax === null
      ? gramsOf(eaten.carbs, targets.carbs.target)
      : carbsOver > 0
        ? T.overLimit(n(eaten.carbs), n(carbsMax), n(carbsOver))
        : T.limit(n(eaten.carbs), n(carbsMax));

  return (
    <section className="grp fd-diet-balance" aria-label={T.balance}>
      {headline && <h2 className="fd-diet-headline">{headline}</h2>}
      <div className="fd-diet-macros">
        <Row label={DT.protein} value={gramsOf(eaten.protein, targets.protein.target)}>
          <Bar value={eaten.protein} target={targets.protein.target} label={DT.protein} unit="g" />
        </Row>
        {shown && (
          <Row label={T.kcal} value={kcalOf(eaten.kcal, targets.kcal)}>
            <Bar value={eaten.kcal} target={targets.kcal} label={T.kcal} unit="kcal" />
          </Row>
        )}
      </div>
      {over && <p className="tight">{over}</p>}
      {today?.reserved && <p className="tight">{today.reserved}</p>}
      {eaten.unknownMacros > 0 && <p className="tight">{T.unknown(eaten.unknownMacros)}</p>}
      {shown && (
        // Diets with a carb limit (keto, low carb) watch carbohydrates every day: open from the start.
        <details className="fd-diet-carbsfat" open={carbsMax !== null}>
          <summary>{T.carbsFat}</summary>
          <div className="fd-diet-macros">
            <Row label={DT.carbs} value={carbs}>
              <Bar value={eaten.carbs} target={carbsMax ?? targets.carbs.target} label={DT.carbs} unit="g" />
            </Row>
            <Row label={DT.fat} value={gramsOf(eaten.fat, targets.fat.target)}>
              <Bar value={eaten.fat} target={targets.fat.target} label={DT.fat} unit="g" />
            </Row>
          </div>
        </details>
      )}
      {children}
    </section>
  );
}
