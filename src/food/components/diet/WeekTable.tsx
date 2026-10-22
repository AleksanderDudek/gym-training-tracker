import type { GoalDirection } from '../../diet/energy';
import { addDays, shortDay } from '../../diet/model';
import { MIN_WEEKS, onGoal, type DayFacts, type Finding, type Findings, type WeekRow } from '../../diet/weeks';
import { formatNumber, plural } from '../../lib/format';

interface Props {
  rows: WeekRow[];
  found: Findings;
  direction: GoalDirection;
  stepsGoal: number;
  today: string;
  /** Energy in a kilogram (`Profile.kcalPerKg`) — what a food difference means on the scale. */
  kcalPerKg: number;
}

const num = (n: number) => formatNumber(Math.round(n), 0);
/** „−0,4 kg”: the sign always, so a gain never reads as a loss. */
const signedKg = (n: number) => `${n > 0.005 ? '+' : n < -0.005 ? '−' : ''}${formatNumber(Math.abs(n), 1)} kg`;
const signedKcal = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;

/** „13–19.10”, across months „28.09–4.10”; the current week is „ten tydzień”. */
function weekLabel(r: WeekRow): string {
  if (!r.complete) return 'ten tydzień';
  const end = addDays(r.monday, 6);
  const [, m1, d1] = r.monday.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  return m1 === m2 ? `${d1}–${d2}.${String(m2).padStart(2, '0')}` : `${d1}.${String(m1).padStart(2, '0')}–${d2}.${String(m2).padStart(2, '0')}`;
}

type Food = 'ok' | 'off' | 'none';

const foodOf = (d: DayFacts, direction: GoalDirection): Food =>
  d.eaten === null ? 'none' : onGoal(d.eaten, d.goal, direction) ? 'ok' : 'off';

/** A day in words for screen readers and the tooltip: „pn 13.10: 1 950 kcal (cel 2 000) · 9 800 kroków · trening”. */
function dayText(d: DayFacts, stepsGoal: number, today: string): string {
  const parts = [
    d.eaten === null ? 'bez zapisów jedzenia' : `${num(d.eaten)} kcal (cel ${num(d.goal)})`,
    d.steps !== null ? `${num(d.steps)} ${plural(d.steps, 'krok', 'kroki', 'kroków')}${d.steps >= stepsGoal ? ' – cel kroków' : ''}` : null,
    d.workouts ? (d.workouts === 1 ? 'trening' : `${d.workouts} treningi`) : null,
    d.snacks ? `${d.snacks} ${plural(d.snacks, 'przekąska ruchowa', 'przekąski ruchowe', 'przekąsek ruchowych')}` : null,
    d.outings ? `cardio${d.outings > 1 ? ` ×${d.outings}` : ''}` : null,
  ];
  return `${shortDay(d.date)}${d.date === today ? ' (dzień trwa)' : ''}: ${parts.filter(Boolean).join(' · ')}`;
}

/** The week's seven days: food as the cell, habits as marks — shapes, not only colours. */
function DayGrid({
  days,
  direction,
  stepsGoal,
  today,
}: {
  days: DayFacts[];
  direction: GoalDirection;
  stepsGoal: number;
  today: string;
}) {
  return (
    <span className="fd-diet-wgrid" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => {
        const d = days[i];
        if (!d) return <span key={i} className="fd-diet-wday fd-diet-wfuture" />;
        return (
          <span key={d.date} className="fd-diet-wday" title={dayText(d, stepsGoal, today)}>
            <i className={`fd-diet-wfood fd-diet-wf-${foodOf(d, direction)}`} />
            <i className={`fd-diet-wm fd-diet-wtrain${d.workouts ? '' : ' fd-diet-wm-off'}`} />
            <i className={`fd-diet-wm fd-diet-wsteps${d.steps !== null && d.steps >= stepsGoal ? '' : ' fd-diet-wm-off'}`} />
            <i className={`fd-diet-wm fd-diet-wsnack${d.snacks ? '' : ' fd-diet-wm-off'}`} />
            <i className={`fd-diet-wm fd-diet-wcardio${d.outings ? '' : ' fd-diet-wm-off'}`} />
          </span>
        );
      })}
    </span>
  );
}

/** „co najmniej 3 treningi w tygodniu” — the side of a finding with more of the habit. */
function moreText(f: Finding): string {
  const t = f.threshold ?? 0;
  switch (f.factor) {
    case 'eating':
      return 'jedzenie w celu przez większość dni';
    case 'workouts':
      return `co najmniej ${t} ${plural(t, 'trening', 'treningi', 'treningów')} w tygodniu`;
    case 'steps':
      return `średnio co najmniej ${num(t)} kroków dziennie`;
    case 'snacks':
      return `co najmniej ${t} ${plural(t, 'przekąska ruchowa', 'przekąski ruchowe', 'przekąsek ruchowych')} w tygodniu`;
    case 'outings':
      return `co najmniej ${t} ${plural(t, 'wyjście', 'wyjścia', 'wyjść')} na cardio w tygodniu`;
  }
}

const weeksWord = (n: number) => `${n} ${plural(n, 'tydzień', 'tygodnie', 'tygodni')}`;
const pace = (kg: number) => `${signedKg(kg)}/tydz.`;
const STRENGTH: Record<Finding['strength'], string> = { weak: 'słaby', moderate: 'umiarkowany', clear: 'wyraźny' };

function FindingItem({ f, kcalPerKg }: { f: Finding; kcalPerKg: number }) {
  const verdict = f.helps === null ? 'bez wyraźnej różnicy' : f.helps ? 'sprzyja celowi' : 'nie sprzyja celowi';
  const tone = f.helps === null ? 'flat' : f.helps ? 'good' : 'bad';
  const gap = f.kcalGap !== null && Math.abs(f.kcalGap) >= 50 ? f.kcalGap : null;
  return (
    <li className="fd-diet-finding">
      <p className="fd-diet-fhead">
        <strong>{moreText(f)}</strong> <span className={`fd-diet-fchip fd-diet-w${tone}`}>{verdict}</span>
      </p>
      <p className="fd-diet-fbody">
        Średnio {pace(f.more.change)} ({weeksWord(f.more.weeks)}) · w pozostałych {pace(f.less.change)} (
        {weeksWord(f.less.weeks)}). Związek {STRENGTH[f.strength]}.
        {gap !== null &&
          ` W tych tygodniach jedzenie było średnio o ${num(Math.abs(gap))} kcal dziennie ${gap < 0 ? 'niższe' : 'wyższe'} — to samo w sobie ok. ${formatNumber((Math.abs(gap) * 7) / kcalPerKg, 2)} kg tygodniowo.`}
      </p>
    </li>
  );
}

/**
 * „Co działa u ciebie”: tydzień po tygodniu jedzenie, ruch i waga — z siatką dni, w której widać
 * treningi, kroki, przekąski ruchowe i cardio — a pod nią, co z tego idzie w parze z postępem.
 */
export function WeekTable({ rows, found, direction, stepsGoal, today, kcalPerKg }: Props) {
  if (!rows.length) return null;
  return (
    <section className="grp" aria-labelledby="fd-diet-weeks-title">
      <h2 id="fd-diet-weeks-title">Co działa u ciebie</h2>
      <p className="tight fd-diet-soft">
        Tydzień po tygodniu: jedzenie, ruch i waga. Waga to trend z ważeń od poniedziałku do następnego poniedziałku — z
        jednego ważenia trendu nie widać.
      </p>
      <div className="fd-diet-scroll" tabIndex={0} role="region" aria-label="Tabela tygodni – przewiń w bok">
        <table className="fd-diet-weeks">
          <thead>
            <tr>
              <th scope="col">Tydzień</th>
              <th scope="col" className="n">
                Waga
              </th>
              <th scope="col" className="n">
                Jedzenie
              </th>
              <th scope="col" className="n">
                Kroki
              </th>
              <th scope="col" className="n">
                Treningi
              </th>
              <th scope="col" className="n">
                Przekąski ruchowe
              </th>
              <th scope="col" className="n">
                Cardio
              </th>
              <th scope="col" className="n">
                Minuty ruchu
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.monday}>
                <th scope="row">
                  <span className="fd-diet-wlabel">{weekLabel(r)}</span>
                  <DayGrid days={r.days} direction={direction} stepsGoal={stepsGoal} today={today} />
                  <span className="sr-only">{r.days.map((d) => dayText(d, stepsGoal, today)).join('. ')}</span>
                </th>
                <td className="n">
                  {r.weight ? (
                    <span className={`fd-diet-wchange fd-diet-w${r.verdict}`}>{signedKg(r.weight.change)}</span>
                  ) : (
                    <span className="fd-diet-soft" title="Za mało ważeń: potrzeba dwóch, co najmniej cztery dni od siebie">
                      –<span className="sr-only"> za mało ważeń</span>
                    </span>
                  )}
                </td>
                <td className="n">
                  {r.eaten ? (
                    <>
                      {num(r.eaten.avg)}
                      <small>
                        {signedKcal(r.eaten.avg - r.eaten.goal)} · {r.eaten.days}{' '}
                        {plural(r.eaten.days, 'dzień', 'dni', 'dni')}
                      </small>
                    </>
                  ) : (
                    <span className="fd-diet-soft">–</span>
                  )}
                </td>
                <td className="n">
                  {r.steps ? (
                    <>
                      {num(r.steps.avg)}
                      <small>cel: {r.steps.goalDays}×</small>
                    </>
                  ) : (
                    <span className="fd-diet-soft">–</span>
                  )}
                </td>
                <td className="n">{r.workouts}</td>
                <td className="n">{r.snacks}</td>
                <td className="n">{r.outings}</td>
                <td className="n">{num(r.activeMin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="fd-diet-wlegend" aria-label="Legenda siatki dni">
        <li>
          <i className="fd-diet-wfood fd-diet-wf-ok" aria-hidden /> jedzenie w celu
        </li>
        <li>
          <i className="fd-diet-wfood fd-diet-wf-off" aria-hidden /> poza celem
        </li>
        <li>
          <i className="fd-diet-wfood fd-diet-wf-none" aria-hidden /> bez zapisów
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wtrain" aria-hidden /> trening
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wsteps" aria-hidden /> cel kroków
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wsnack" aria-hidden /> przekąska ruchowa
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wcardio" aria-hidden /> cardio
        </li>
      </ul>
      <p className="tight fd-diet-soft">
        Jedzenie: średnia z dni z zapisami, pod nią różnica wobec celu dnia i liczba dni. Kroki: średnia i ile dni z
        celem. Obie bez dzisiejszego dnia, który jeszcze trwa. Cardio: bieżnia, rower, taniec oraz biegi i marsze z
        zegarka od 10 minut.
      </p>

      <h3 className="fd-diet-wsub">Co idzie w parze z postępem</h3>
      {found.findings.length ? (
        <ul className="fd-diet-findings">
          {found.findings.map((f) => (
            <FindingItem key={f.factor} f={f} kcalPerKg={kcalPerKg} />
          ))}
        </ul>
      ) : (
        <p className="tight">
          Porównanie tygodni pojawi się po {MIN_WEEKS} pełnych tygodniach z co najmniej dwoma ważeniami (np. w poniedziałek
          i w piątek), w których coś się różniło – liczba treningów, kroków, przekąsek ruchowych albo jedzenie. Teraz:{' '}
          {weeksWord(found.weeks)}.
        </p>
      )}
      <p className="tight fd-diet-soft">
        To skojarzenia z twoich tygodni, nie dowód: punktów jest mało, a waga skacze od wody. Najwięcej robi jedzenie – jeśli
        w „lepszych” tygodniach było go mniej, to ono mogło zrobić różnicę.
      </p>
    </section>
  );
}
