import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, isoWeek } from '@gymtracker/link';
import type { AssignmentV1, FormBody, FormQuestion, SnapshotV1 } from '@gymtracker/link';
import type { Connection, SentAssignment } from '../src/lib/data';

vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

const { FormForm, emptyForm } = await import('../src/components/editors/FormEditor');
const { AnswersTab } = await import('../src/pages/client/AnswersTab');
const { dayIn } = await import('../src/lib/forms');

function Harness({ initial, seen }: { initial: FormBody; seen: (v: FormBody) => void }) {
  const [v, setV] = useState(initial);
  return (
    <FormForm
      value={v}
      onChange={(x) => {
        setV(x);
        seen(x);
      }}
    />
  );
}

function editor(initial: FormBody = emptyForm()) {
  let last = initial;
  render(<Harness initial={initial} seen={(v) => (last = v)} />);
  return () => last;
}

describe('Kreator formularza', () => {
  it('od wzoru: check-in z gotowymi pytaniami, potem własne pytanie z nowym numerem, kopia, przestawienie i usunięcie', async () => {
    const user = userEvent.setup();
    const value = editor();
    expect(screen.getByRole('status')).toHaveTextContent('Do uzupełnienia: 2');

    await user.click(screen.getByRole('button', { name: /^Cotygodniowy check-in/ }));
    expect(screen.getByRole('textbox', { name: 'Tytuł formularza' })).toHaveValue('Check-in tygodniowy');
    expect(screen.getByRole('radio', { name: 'Co tydzień' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Czeka od' })).toHaveValue('1');
    expect(screen.getByRole('status')).toHaveTextContent('Gotowe: 8 pytań, wymagane: 4.');
    expect(within(screen.getByRole('complementary', { name: 'Podgląd na telefonie' })).getByText('Check-in tygodniowy')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Skala' }));
    const label = screen.getByRole('textbox', { name: 'Treść pytania 9' });
    expect(label).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Do uzupełnienia: 1');
    expect(screen.getByText('Pytanie 9: wpisz treść pytania.')).toBeInTheDocument();
    await user.type(label, 'Ból kolana');
    expect(screen.getByRole('status')).toHaveTextContent('Gotowe: 9 pytań');
    expect(value().questions.at(-1)).toMatchObject({ id: 'q9', type: 'scale', label: 'Ból kolana', min: 0, max: 10 });

    await user.click(screen.getByRole('button', { name: 'Duplikuj pytanie 9' }));
    expect(value().questions.map((q) => q.id).slice(-2)).toEqual(['q9', 'q10']);
    expect(screen.getByRole('textbox', { name: 'Treść pytania 10' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Pytanie 2 wyżej' }));
    expect(value().questions.slice(0, 2).map((q) => q.id)).toEqual(['q2', 'q1']);
    await user.click(screen.getByRole('button', { name: 'Usuń pytanie 1' }));
    expect(value().questions.map((q) => q.id)).toEqual(['q1', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10']);
    const ids = value().questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pytanie z wyborem: pola odpowiedzi, granice 2–12 i słowa o pustym polu', async () => {
    const user = userEvent.setup();
    const value = editor({ ...emptyForm(), title: 'Ankieta' });
    await user.click(screen.getByRole('button', { name: '+ Jeden wybór' }));
    await user.type(screen.getByRole('textbox', { name: 'Treść pytania 1' }), 'Gdzie trenujesz?');
    expect(screen.getByRole('button', { name: 'Usuń odpowiedź 1' })).toBeDisabled();
    expect(screen.getByText('Pytanie 1: potrzebne co najmniej 2 odpowiedzi do wyboru.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Odpowiedź 1' }), 'Siłownia');
    await user.type(screen.getByRole('textbox', { name: 'Odpowiedź 2' }), 'Dom');
    await user.click(screen.getByRole('button', { name: '+ Dodaj odpowiedź' }));
    expect(screen.getByText('Pytanie 1: puste pole odpowiedzi — uzupełnij je albo usuń.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usuń odpowiedź 3' }));
    expect(screen.getByRole('status')).toHaveTextContent('Gotowe: 1 pytanie');
    expect(value().questions[0]).toMatchObject({ type: 'choice', options: ['Siłownia', 'Dom'] });

    // Zmiana rodzaju zostawia treść i odpowiedzi.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rodzaj pytania 1' }), 'multi');
    expect(value().questions[0]).toMatchObject({ type: 'multi', label: 'Gdzie trenujesz?', options: ['Siłownia', 'Dom'] });
  });

  it('powtarzanie: wywiad tylko przy jednorazowym, dzień tygodnia przy cotygodniowym; wzór na niepusty formularz pyta o zgodę', async () => {
    const user = userEvent.setup();
    const value = editor({ ...emptyForm(), title: 'Mój' });
    await user.click(screen.getByRole('checkbox', { name: /Wywiad na start/ }));
    expect(value()).toMatchObject({ repeat: 'once', intake: true, weekday: null });
    await user.click(screen.getByRole('radio', { name: 'Co tydzień' }));
    expect(value()).toMatchObject({ repeat: 'weekly', intake: false, weekday: 1 });
    expect(screen.queryByRole('checkbox', { name: /Wywiad na start/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Czeka od' }), '5');
    expect(value().weekday).toBe(5);
    await user.click(screen.getByRole('radio', { name: 'Codziennie' }));
    expect(value()).toMatchObject({ repeat: 'daily', weekday: null });

    // Formularz nie jest pusty — wzór najpierw pyta.
    await user.click(screen.getByText('Zacznij od gotowego'));
    await user.click(screen.getByRole('button', { name: /^Skala bólu/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Zastąpić obecny formularz wzorem „Skala bólu”?');
    expect(value().title).toBe('Mój');
    await user.click(screen.getByRole('button', { name: 'Zastąp' }));
    expect(value()).toMatchObject({ title: 'Skala bólu', repeat: 'daily' });
    expect(value().questions).toHaveLength(5);
  });
});

/* ── Odpowiedzi ────────────────────────────────────────────────────────────────────── */

const q = (id: string, type: FormQuestion['type'], label: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id,
  type,
  label,
  help: '',
  required: false,
  unit: '',
  min: type === 'scale' ? 0 : null,
  max: type === 'scale' ? 10 : null,
  options: [],
  ...extra,
});

const checkin: FormBody = {
  kind: 'form',
  title: 'Check-in',
  intro: '',
  repeat: 'weekly',
  weekday: 1,
  intake: false,
  questions: [
    q('q1', 'number', 'Waga', { unit: 'kg', min: 30, max: 300 }),
    q('q2', 'scale', 'Energia', { required: true }),
    q('q3', 'multi', 'Gdzie', { options: ['Siłownia', 'Dom', 'Basen'] }),
    q('q4', 'text', 'Co było trudne?'),
  ],
};
const intake: FormBody = {
  kind: 'form',
  title: 'Wywiad',
  intro: '',
  repeat: 'once',
  weekday: null,
  intake: true,
  questions: [q('q1', 'choice', 'Cel', { options: ['Schudnąć', 'Siła'] }), q('q2', 'yesno', 'Kontuzje?')],
};
const pain: FormBody = { kind: 'form', title: 'Skala bólu', intro: '', repeat: 'daily', weekday: null, intake: false, questions: [q('q1', 'scale', 'Ból')] };

const sentRow = (id: string, body: FormBody, patch: Partial<SentAssignment> = {}): SentAssignment => ({
  id,
  kind: 'form',
  area: 'training',
  createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  withdrawnAt: null,
  visibleFrom: null,
  envelope: { v: 1, id, area: 'training', sentAt: Date.now() - 30 * 86_400_000, from: { name: 'Ola', profession: 'trainer' }, body } as AssignmentV1,
  receipt: null,
  ...patch,
});

const conn = { id: 'c0ffee00-0000-4000-8000-000000000001' } as Connection;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function snapshot(): SnapshotV1 {
  const today = dayIn(tz, Date.now());
  const week = (n: number) => isoWeek(addDays(today, -7 * n));
  return {
    v: 1,
    at: Date.now() - 2 * 3600_000,
    tz,
    lang: 'pl',
    app: 'test',
    scopes: [],
    coaching: {
      answers: [
        { assignmentId: 'a1', period: week(2), at: 1, values: { q1: 84, q2: 5, q3: [0], q4: 'Mało snu' } },
        { assignmentId: 'a1', period: week(1), at: 2, values: { q1: 83.2, q2: 6, q3: [0, 2] } },
        { assignmentId: 'a1', period: week(0), at: 3, values: { q1: 82.5, q2: 8, q3: [1] } },
        { assignmentId: 'a2', period: 'once', at: 4, values: { q1: 1, q2: true } },
        { assignmentId: 'a4', period: week(0), at: 5, values: { q1: 99 } },
      ],
      habits: [],
      meals: [],
    },
  };
}

describe('Odpowiedzi', () => {
  it('formularze z odpowiedziami: stan, wykresy pytań liczbowych, tabela okresów; wycofany znika', () => {
    render(
      <AnswersTab
        c={conn}
        s={snapshot()}
        sent={[sentRow('a1', checkin), sentRow('a2', intake), sentRow('a3', pain), sentRow('a4', { ...checkin, title: 'Stary check-in' }, { withdrawnAt: new Date().toISOString() })]}
      />,
    );
    expect(screen.getByText(/^Paczka z telefonu: 2 godziny temu/)).toBeInTheDocument();
    const sections = screen.getAllByRole('region');
    expect(sections.map((s) => within(s).getByRole('heading', { level: 2 }).textContent)).toEqual(['Wywiad', 'Check-in', 'Skala bólu']);
    expect(screen.queryByText('Stary check-in')).not.toBeInTheDocument();

    const [wywiad, check, bol] = sections as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(wywiad).getByText('Wywiad na start')).toBeInTheDocument();
    expect(within(wywiad).getByText('Jest odpowiedź')).toBeInTheDocument();
    expect(within(within(wywiad).getByRole('row', { name: /Cel/ })).getByRole('cell')).toHaveTextContent('Siła');
    expect(within(within(wywiad).getByRole('row', { name: /Kontuzje/ })).getByRole('cell')).toHaveTextContent('Tak');

    expect(within(check).getByText(/^Za ten tydzień: jest odpowiedź · następny od /)).toBeInTheDocument();
    expect(within(check).getByText(/odpowiedzi: 3 z \d+ tygodni/)).toBeInTheDocument();
    const weight = within(check).getByRole('img', { name: 'Waga' });
    expect(weight).toHaveAccessibleDescription(/ostatnio 82,5 kg/);
    expect(within(check).getByRole('img', { name: 'Energia' })).toBeInTheDocument();
    const rows = within(check).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent('ten tydzień');
    expect(within(rows[1]!).getAllByRole('cell').map((c) => c.textContent)).toEqual(['83,2', '6', 'Siłownia, Basen', '—']);
    expect(within(rows[2]!).getByText('Mało snu')).toBeInTheDocument();

    expect(within(bol).getByText(/^Jeszcze bez odpowiedzi/)).toBeInTheDocument();
    expect(within(bol).getByText(/^Zaległy: wczoraj bez odpowiedzi/)).toBeInTheDocument();
  });

  it('długa historia codziennego: najpierw ostatnie 14 dni, reszta na życzenie', async () => {
    const user = userEvent.setup();
    const today = dayIn(tz, Date.now());
    const s = snapshot();
    s.coaching = {
      answers: Array.from({ length: 20 }, (_, i) => ({ assignmentId: 'a3', period: addDays(today, -i), at: i, values: { q1: i % 11 } })),
      habits: [],
      meals: [],
    };
    render(<AnswersTab c={conn} s={s} sent={[sentRow('a3', pain)]} />);
    const table = screen.getByRole('table', { name: 'Odpowiedzi: Skala bólu' });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 14);
    expect(screen.getByText(/odpowiedzi: 20 z \d+ dni/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pokaż wszystkie (20)' }));
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 20);
    expect(screen.getByRole('button', { name: 'Pokaż tylko ostatnie 14' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('telefon bez części „coaching”: „brak danych z tej wersji aplikacji” zamiast „zaległy”', () => {
    const s = snapshot();
    delete s.coaching;
    render(<AnswersTab c={conn} s={s} sent={[sentRow('a1', checkin), sentRow('a3', pain)]} />);
    expect(screen.getByText(/starszą wersję GYM TRACKERa.*brak danych z tej wersji aplikacji/)).toBeInTheDocument();
    expect(screen.getAllByText('brak danych z tej wersji aplikacji')).toHaveLength(2);
    expect(screen.queryByText(/Zaległy/)).not.toBeInTheDocument();
    expect(screen.queryByText(/odpowiedzi: \d+ z/)).not.toBeInTheDocument();
  });

  it('zaplanowany i odrzucony formularz: tylko wzmianka, nie karta „czeka na odpowiedź”; odpowiedzi pod numerem wiersza bez względu na wielkość liter', () => {
    const inFiveDays = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const later = sentRow('a5', { ...pain, title: 'Skala od grudnia' }, { visibleFrom: inFiveDays });
    const declined = sentRow('a6', { ...intake, title: 'Wywiad odrzucony' }, { receipt: { v: 1, assignmentId: 'a6', status: 'declined', at: 0, ticked: [], comment: '', updatedAt: '' } });
    const upper = { ...sentRow('a2', intake), id: 'A2' };
    render(<AnswersTab c={conn} s={snapshot()} sent={[later, declined, upper]} />);
    expect(screen.getAllByRole('region').map((r) => within(r).getByRole('heading', { level: 2 }).textContent)).toEqual(['Wywiad']);
    expect(screen.getByText('Jest odpowiedź')).toBeInTheDocument();
    expect(screen.getByText(/„Skala od grudnia” — zaplanowany na /)).toBeInTheDocument();
    expect(screen.getByText('„Wywiad odrzucony” — odrzucony przez podopiecznego')).toBeInTheDocument();
    expect(screen.queryByText('Czeka na odpowiedź')).not.toBeInTheDocument();
  });

  it('bez formularzy: podpowiedź, skąd go wysłać; bez listy zaleceń — wczytywanie', () => {
    const { unmount } = render(<AnswersTab c={conn} s={snapshot()} sent={[]} />);
    expect(screen.getByRole('heading', { name: 'Nie wysłano jeszcze żadnego formularza' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Formularz w bibliotece' })).toHaveAttribute('href', '/biblioteka/nowy/form');
    unmount();
    render(<AnswersTab c={conn} s={snapshot()} sent={undefined} />);
    expect(screen.getByText('Wczytuję…')).toBeInTheDocument();
  });
});
