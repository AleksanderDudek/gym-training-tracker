import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { AssignmentBody } from '@gymtracker/link';
import { EX } from '@gt/data/exercises';
import { PrintView, printTitle } from '../src/components/Print';

const coach = { display_name: 'Anna Nowak', profession: 'dietitian' as const };
const printedAt = new Date(2026, 10, 25, 12);

const workout = { id: 'w-a', name: 'Góra A', items: [{ ex: 'swing2' }, { ex: 'goblet', pair: true }], kind: 'upper' as const, rest: 90 };
const workoutB = { id: 'w-b', name: 'Dół B', items: [{ ex: 'goblet' }] };

const bodies: Record<AssignmentBody['kind'], AssignmentBody> = {
  workout: { kind: 'workout', workout, videos: { swing2: 'https://example.com/swing' }, note: 'Spokojnie z ciężarem.' },
  plan: {
    kind: 'plan',
    plan: { id: 'p-1', name: 'Plan 2 tyg.', level: 'base', sex: 'any', daysPerWeek: 3, weeks: 2, loadFactor: 1, cycle: ['w-a', 'w-b'], weekdays: [1, 3, 5], desc: 'Start.', kind: 'own', deload: [2] },
    workouts: [workout, workoutB],
    videos: {},
    note: '',
  },
  meals: {
    kind: 'meals',
    title: 'Jadłospis 1800',
    days: [
      {
        label: 'Poniedziałek',
        meals: [
          { slot: 'Śniadanie', name: 'Owsianka', recipe: null, kcal: 500, protein: 30, carbs: 60, fat: 12, note: '' },
          { slot: 'Obiad', name: 'Kurczak z ryżem', recipe: null, kcal: 700, protein: null, carbs: 80, fat: 15, note: 'bez sosu' },
        ],
      },
    ],
    start: null,
    note: '',
  },
  form: {
    kind: 'form',
    title: 'Check-in tygodniowy',
    intro: 'Kilka pytań.',
    questions: [
      { id: 'q1', type: 'scale', label: 'Jak się czujesz?', help: '', required: true, unit: '', min: 0, max: 10, options: [] },
      { id: 'q2', type: 'choice', label: 'Sen', help: '', required: false, unit: '', min: null, max: null, options: ['dobrze', 'źle'] },
      { id: 'q3', type: 'number', label: 'Waga', help: 'rano, na czczo', required: false, unit: 'kg', min: null, max: null, options: [] },
      { id: 'q4', type: 'text', label: 'Uwagi', help: '', required: false, unit: '', min: null, max: null, options: [] },
      { id: 'q5', type: 'yesno', label: 'Trening zrobiony?', help: '', required: false, unit: '', min: null, max: null, options: [] },
    ],
    repeat: 'weekly',
    weekday: 1,
    intake: false,
  },
  habits: {
    kind: 'habits',
    title: 'Nawyki na zimę',
    items: [
      { label: 'Witamina D', dose: '2000 IU', when: 'morning', days: [1, 2, 3, 4, 5, 6, 7] },
      { label: 'Spacer', dose: '', when: 'any', days: [6, 7] },
    ],
    note: '',
    until: null,
  },
  note: { kind: 'note', title: 'Przed zawodami', text: 'Śpij 8 godzin.', checklist: ['Woda', 'Rozgrzewka'] },
  targets: { kind: 'targets', kcal: 2200, protein: 150, steps: 9000, workoutsPerWeek: 3, weightGoal: null, weeklyRate: -0.5, note: 'Bez pośpiechu.' },
  labs: { kind: 'labs', tests: [{ name: 'Witamina D', note: '' }, { name: 'Ferrytyna', note: 'na czczo' }], by: '2026-12-15', note: '' },
};

describe('Wydruk: kartka dla każdego rodzaju', () => {
  for (const [kind, body] of Object.entries(bodies)) {
    it(`${kind}: nagłówek z prowadzącym, numerem i tytułem`, () => {
      const { container } = render(<PrintView body={body} coach={coach} clientId="GT-7K4Q-9XM2" sentAt={printedAt.getTime()} printedAt={printedAt} />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(printTitle(body));
      expect(container).toHaveTextContent('Anna Nowak');
      expect(container).toHaveTextContent(/Dietetyk|Dietitian/);
      expect(container).toHaveTextContent('GT-7K4Q-9XM2');
      expect(container).toHaveTextContent(/25 (listopada|November) 2026/);
    });
  }

  it('bez numeru podopiecznego (z biblioteki) — nie ma go na kartce', () => {
    const { container } = render(<PrintView body={bodies.note} coach={coach} printedAt={printedAt} />);
    expect(container).not.toHaveTextContent('GT-');
    expect(container).not.toHaveTextContent(/Podopieczny|Client/);
  });

  it('trening: ćwiczenia z atlasu, serie, komentarz i wideo', () => {
    const { container } = render(<PrintView body={bodies.workout} coach={coach} printedAt={printedAt} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText(EX.swing2!.name)).toBeInTheDocument();
    expect(within(table).getByText(EX.goblet!.name)).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(container).toHaveTextContent('Spokojnie z ciężarem.');
    expect(container).toHaveTextContent('https://example.com/swing');
  });

  it('plan: rozpiska tygodni z kolejnością treningów i tygodniem lżejszym', () => {
    render(<PrintView body={bodies.plan} coach={coach} printedAt={printedAt} />);
    const grid = screen.getAllByRole('table')[0]!;
    const rows = within(grid).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent(/1.*A.*B.*A/);
    expect(rows[2]).toHaveTextContent(/2.*(lżejszy|lighter).*B.*A.*B/);
    expect(screen.getByRole('heading', { name: /A · Góra A/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /B · Dół B/ })).toBeInTheDocument();
  });

  it('jadłospis: posiłki z makro i suma dnia', () => {
    const { container } = render(<PrintView body={bodies.meals} coach={coach} printedAt={printedAt} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Owsianka')).toBeInTheDocument();
    const foot = within(table).getAllByRole('row').at(-1)!;
    expect(foot).toHaveTextContent(/(Razem|Total)/);
    expect(foot).toHaveTextContent(/1[\s,. ]?200/);
    expect(foot).toHaveTextContent('30');
    expect(container).toHaveTextContent('bez sosu');
  });

  it('formularz: pytania z miejscem na odpowiedź', () => {
    const { container } = render(<PrintView body={bodies.form} coach={coach} printedAt={printedAt} />);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(container).toHaveTextContent('Jak się czujesz? *');
    expect(container.querySelectorAll('.sz-print-scale span')).toHaveLength(11);
    expect(container).toHaveTextContent('dobrze');
    expect(container).toHaveTextContent('kg');
    expect(container.querySelectorAll('.sz-print-lines span')).toHaveLength(3);
    expect(container).toHaveTextContent(/Tak|Yes/);
  });

  it('nawyki: tygodniowa kratka, pola tylko w dni nawyku', () => {
    render(<PrintView body={bodies.habits} coach={coach} printedAt={printedAt} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[0]!.querySelectorAll('th')).toHaveLength(8);
    expect(rows[1]!.querySelectorAll('.sz-print-check')).toHaveLength(7);
    expect(rows[2]!.querySelectorAll('.sz-print-check')).toHaveLength(2);
  });

  it('zalecenie, cele i badania', () => {
    const note = render(<PrintView body={bodies.note} coach={coach} printedAt={printedAt} />);
    expect(note.container).toHaveTextContent('Śpij 8 godzin.');
    expect(note.container.querySelectorAll('.sz-print-checklist li')).toHaveLength(2);
    note.unmount();
    const targets = render(<PrintView body={bodies.targets} coach={coach} printedAt={printedAt} />);
    expect(targets.container).toHaveTextContent(/2[\s,. ]?200 kcal/);
    expect(targets.container).toHaveTextContent('150 g');
    expect(targets.container).toHaveTextContent(/−0[.,]50/);
    targets.unmount();
    const labs = render(<PrintView body={bodies.labs} coach={coach} printedAt={printedAt} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    expect(labs.container).toHaveTextContent(/15 (grudnia|December) 2026/);
  });
});
