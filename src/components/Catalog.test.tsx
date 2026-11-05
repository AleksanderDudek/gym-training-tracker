// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN } from '../data/exercises';
import { isAdopted, resetCatalogForTests } from '../data/catalog/adopt';
import { freshState } from '../engine/plan';
import type { AppState, Session } from '../types';
import { AtlasView, ExercisePage } from './atlas';
import { ExercisePicker } from './ExercisePicker';
import { GuidedSession } from './Guided';
import { TechniqueButton } from './TechniqueButton';

const noop = () => {};
const A = BUILTIN.find((w) => w.id === 'A')!;

const guidedProps = (state: AppState) => ({
  state,
  workout: A,
  onReady: noop,
  onBegin: noop,
  onStartPart: noop,
  onSkipPart: noop,
  onClockPref: noop,
  onLogSet: noop,
  onUndo: noop,
  onEffort: noop,
  onRest: noop,
  onSkip: noop,
  onNote: noop,
  onFinish: noop,
  onList: noop,
  onToast: noop,
});

beforeEach(() => {
  sessionStorage.clear();
  location.hash = '';
});
afterEach(() => resetCatalogForTests());

describe('„Jak to zrobić?” w treningu prowadzonym', () => {
  it('stoi pod nazwą ćwiczenia i otwiera arkusz z ruchem, wskazówką i mięśniami', async () => {
    const state = freshState();
    const now = Date.now();
    const session: Session = {
      workout: A.id,
      started: new Date().toISOString(),
      ready: 'ok',
      res: {},
      done: {},
      skip: {},
      clock: { begin: now, parts: { 1: { start: now } } },
    };
    state.session = session;
    render(<GuidedSession {...guidedProps(state)} />);
    const btn = screen.getByRole('button', { name: /^Technika: .+ — animacja, mięśnie i wskazówki$/ });
    expect(btn).toHaveTextContent('Jak to zrobić?');
    // Przycisk przed „Zrobione”, nie pod nim.
    const done = screen.getByRole('button', { name: 'Zrobione' });
    expect(btn.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Technika', { selector: 'summary' })).toBeNull();

    fireEvent.click(btn);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Na co uważać' })).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'Pracujące mięśnie' })).toBeInTheDocument();
    expect(within(sheet).getByText('Główne', { exact: false })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /Pełna strona ćwiczenia/ })).toHaveAttribute('href', expect.stringMatching(/^#\/cwiczenia\//));
  });

  it('dla ćwiczenia z bliźniakiem w katalogu pokazuje kroki', async () => {
    render(<TechniqueButton state={freshState()} id="bench" />);
    expect(screen.getByRole('button', { name: /^Technika: / })).toHaveTextContent('kroki');
    fireEvent.click(screen.getByRole('button', { name: /^Technika: / }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Krok po kroku' })).toBeInTheDocument();
    await waitFor(() => expect(within(sheet).getAllByRole('listitem').length).toBeGreaterThan(2));
  });
});

describe('arkusz w przerwie', () => {
  it('nie znika, gdy przerwa mija i panel przerwy zamienia się w serię', async () => {
    const state = freshState();
    const now = Date.now();
    const base: Session = {
      workout: A.id,
      started: new Date().toISOString(),
      ready: 'ok',
      res: {},
      done: {},
      skip: {},
      clock: { begin: now, parts: { 1: { start: now } } },
    };
    state.session = { ...base, rest: { until: now + 60_000, secs: 90 } };
    const view = render(<GuidedSession {...guidedProps(state)} />);
    fireEvent.click(screen.getByRole('button', { name: /^Technika: / }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const after = { ...state, session: { ...base, rest: { until: now - 1_000, secs: 90 } } };
    view.rerender(<GuidedSession {...guidedProps(after)} />);
    expect(screen.getByRole('button', { name: 'Zrobione' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('strona ćwiczenia', () => {
  it('ma mapę mięśni między torem ruchu a filmami', () => {
    render(<ExercisePage state={freshState()} id="swing2" />);
    const labels = [...document.querySelectorAll('.sect-label')].map((e) => e.textContent);
    const path = labels.indexOf('Tor ruchu');
    const muscles = labels.indexOf('Pracujące mięśnie');
    const video = labels.indexOf('Jak to trenować — wideo');
    expect(path).toBeGreaterThanOrEqual(0);
    expect(muscles).toBe(path + 1);
    expect(video).toBe(muscles + 1);
    expect(screen.getByText('Pośladki, Tył uda')).toBeInTheDocument();
  });

  it('z katalogu: kroki, mięśnie, wideo i dodanie do treningu adoptuje ćwiczenie', async () => {
    render(<ExercisePage state={freshState()} id="kat-0001" />);
    expect(await screen.findByRole('heading', { name: 'Krok po kroku' })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('.cat-steps li').length).toBeGreaterThan(2));
    expect(screen.getByText('Pracujące mięśnie')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Szukaj nagrań w YouTube/ })).toHaveAttribute(
      'href',
      expect.stringContaining('youtube.com/results'),
    );
    expect(screen.getByText(/licencja MIT/)).toBeInTheDocument();
    expect(isAdopted('kat-0001')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Nowy trening z tym ćwiczeniem' }));
    expect(isAdopted('kat-0001')).toBe(true);
    expect(location.hash).toContain('kat-0001');
  });

  it('bliźniak z katalogu odsyła do biblioteki', async () => {
    render(<ExercisePage state={freshState()} id="kat-0025" />);
    expect(await screen.findByRole('heading', { name: 'To ćwiczenie jest w bibliotece' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nowy trening z tym ćwiczeniem' })).toBeNull();
  });
});

describe('atlas: katalog', () => {
  it('przełącza na katalog, szuka bez ogonków i chowa bliźniaki', async () => {
    render(<AtlasView state={freshState()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Katalog · 1300+' }));
    expect(await screen.findByText(/^1\s?2\d\d ćwiczeń$/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Szukaj w katalogu'), { target: { value: 'wioslowanie sztanga' } });
    const rows = await screen.findAllByRole('button', { name: /Wiosłowanie/ });
    expect(rows.length).toBeGreaterThan(0);
    // „Wiosłowanie sztangą w opadzie tułowia” jest w bibliotece — katalog go nie powtarza.
    expect(screen.queryByRole('button', { name: /^Wiosłowanie sztangą w opadzie tułowia/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Partia mięśni'), { target: { value: 'lydki' } });
    fireEvent.change(screen.getByLabelText('Szukaj w katalogu'), { target: { value: '' } });
    await waitFor(() => expect(screen.getAllByText(/Łydki i podudzie/).length).toBeGreaterThan(5));
  });
});

describe('wybór ćwiczenia', () => {
  it('podpowiada też z katalogu i adoptuje wybrane', async () => {
    let picked = '';
    render(<ExercisePicker label="dodaj ćwiczenie" value={null} onChange={(id) => (picked = id)} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'spacer farm' } });
    // „Spacer farmera” z hantlami to bliźniak biblioteki — nie wraca z katalogu drugi raz.
    fireEvent.change(box, { target: { value: 'skier' } });
    const opt = (await screen.findByText('Skier', { selector: 'mark' })).closest('li')!;
    expect(opt).toHaveTextContent('Skier ze sztangą');
    expect(opt).toHaveAttribute('role', 'option');
    expect(screen.getByText(/^Z katalogu/)).toBeInTheDocument();
    fireEvent.click(opt);
    expect(picked).toBe('kat-0100');
    expect(isAdopted('kat-0100')).toBe(true);
  });
});
