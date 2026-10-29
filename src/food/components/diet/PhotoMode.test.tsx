// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll } from '../../diet/store';
import { dishById } from '../../photo/dishes';
import { resetModelState, setModelState } from '../../photo/modelState';
import type { Food } from '../../diet/foods';
import type { Progress } from '../../photo/recognize';
import { KcalShown } from './kcalShown';
import { PhotoMode } from './PhotoMode';

const recognize = vi.hoisted(() => vi.fn());
const downloadModel = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const prepare = vi.hoisted(() => vi.fn());
const release = vi.hoisted(() => vi.fn());
const restartDownload = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const grabFrame = vi.hoisted(() => vi.fn());
vi.mock('../../photo/frame', () => ({ grabFrame }));
const kept = vi.hoisted(() => ({ photo: null as Blob | null, gate: null as Promise<void> | null }));
const failLog = vi.hoisted(() => ({ after: Infinity, calls: 0 }));
vi.mock('../../diet/store', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../diet/store')>();
  return {
    ...real,
    logFood: async (...args: Parameters<typeof real.logFood>) => {
      if (failLog.calls++ >= failLog.after) throw new Error('quota');
      return real.logFood(...args);
    },
  };
});
vi.mock('../../photo/recognize', () => ({
  MODEL_MB: 20,
  recognize,
  prepare,
  downloadModel,
  release,
  restartDownload,
  failureOf: (e: unknown) => (e instanceof Error && /memory/.test(e.message) ? 'memory' : 'error'),
}));
vi.mock('../../photo/pending', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../photo/pending')>();
  return {
    ...real,
    pendingPhoto: async () => kept.photo,
    // A slow phone: keeping the photo takes a moment before it goes to the model.
    markReading: async (photo: Blob, tries?: number) => {
      await real.markReading(photo, tries);
      await kept.gate;
    },
  };
});

const DATE = '2026-10-14';
const MARKER = 'gt-photo-run';

beforeEach(async () => {
  await clearAll();
  localStorage.clear();
  recognize.mockReset();
  downloadModel.mockClear();
  prepare.mockClear();
  release.mockClear();
  restartDownload.mockClear();
  grabFrame.mockReset();
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  kept.photo = null;
  kept.gate = null;
  resetModelState();
  URL.createObjectURL = vi.fn(() => 'blob:photo');
  URL.revokeObjectURL = vi.fn();
});

const photo = () => new File([new Uint8Array([1, 2, 3])], 'obiad.jpg', { type: 'image/jpeg' });
const inputs = (c: HTMLElement) => c.querySelectorAll<HTMLInputElement>('input[type=file]');

describe('Zdjęcie posiłku', () => {
  test('pewne danie od razu na talerzu z kcal; porcja suwakiem, „jak tłuste?”, zapis z nazwą i szacunkiem', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('pierogiRuskie')!, score: 0.62 },
      { dish: dishById('gyoza')!, score: 0.12 },
    ]);
    const onLogged = vi.fn();
    const onDone = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={onLogged} onDone={onDone} />);
    await user.upload(inputs(container)[1]!, photo());

    const answer = await screen.findByRole('region', { name: 'Wynik ze zdjęcia' });
    expect(answer).toHaveTextContent('Pierogi ruskie — pewne (62%)');
    expect(answer).toHaveTextContent(/ok\. \d+ kcal\s*\d+–\d+ kcal/);
    expect(answer).toHaveTextContent(/B [\d,]+ g · W [\d,]+ g · T [\d,]+ g/);
    expect(screen.getByRole('button', { name: /^Pierogi ruskie/ })).toHaveAttribute('aria-pressed', 'true');
    const plate = screen.getByRole('region', { name: 'Na talerzu' });
    expect(within(plate).queryByText('wstępnie')).toBeNull();
    expect(within(plate).getByText(/ok\. \d+ kcal/)).toBeInTheDocument();
    const slider = within(plate).getByRole('slider', { name: 'Porcja' });
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('zwykła porcja'));
    // Z 1 porcji (indeks 3) na 1½ (indeks 5).
    fireEvent.change(slider, { target: { value: '5' } });
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('1,5 × porcja'));
    await user.click(within(plate).getByRole('button', { name: 'tłuste' }));
    await user.click(within(plate).getByRole('button', { name: 'Dodaj do dziennika' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({ date: DATE, source: 'dish', key: 'dish:pierogiRuskie', name: 'Pierogi ruskie (tłuste)', amountLabel: '420 g' });
    expect(entry!.kcal).toBeGreaterThan(800);
    expect(onLogged).toHaveBeenCalledWith(expect.stringMatching(/ze zdjęcia — ok\. \d/));
  });

  test('niepewny model: i tak szacunek (wstępny, z zakresem na inne dania); stuknięta propozycja go zastępuje; wyszukane dochodzi', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('padThai')!, score: 0.21 },
      { dish: dishById('ramen')!, score: 0.19 },
      { dish: dishById('pho')!, score: 0.01 },
    ]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[0]!, photo());
    const answer = await screen.findByRole('region', { name: 'Wynik ze zdjęcia' });
    // Pho has too little of the probability to count as one of the other likely dishes.
    expect(answer).toHaveTextContent('Najpewniej Pad thai (21%), może też: ramen');
    expect(answer).toHaveTextContent(/ok\. \d+ kcal/);
    expect(answer).toHaveTextContent(/Wstępny szacunek/);
    const plate = screen.getByRole('region', { name: 'Na talerzu' });
    expect(within(plate).getByText('wstępnie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pad thai/ })).toHaveTextContent(/\d+ kcal/);
    await user.click(screen.getByRole('button', { name: /^Ramen/ }));
    expect(within(plate).queryByText('Pad thai')).toBeNull();
    expect(within(plate).getByText('Ramen')).toBeInTheDocument();
    expect(within(plate).queryByText('wstępnie')).toBeNull();
    await user.type(screen.getByLabelText('Szukaj dania'), 'sajgonki');
    await user.click(await screen.findByRole('button', { name: /Sajgonki/ }));
    expect(screen.getByText(/Razem:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj 2 pozycje' })).toBeInTheDocument();
  });

  test('pewne danie, niepewny rodzaj: „To chyba pierogi — wybierz rodzaj”', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('pierogiRuskie')!, score: 0.35 },
      { dish: dishById('pierogiMeat')!, score: 0.3 },
      { dish: dishById('gyoza')!, score: 0.1 },
    ]);
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await userEvent.setup().upload(inputs(container)[1]!, photo());
    expect(await screen.findByText('To chyba pierogi — rodzaj niepewny')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Na talerzu' })).getByText('Pierogi ruskie')).toBeInTheDocument();
  });

  test('zapis przerwany w połowie: zapisane schodzi z talerza, ponowne „Dodaj” nie dubluje', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('padThai')!, score: 0.5 },
      { dish: dishById('springRolls')!, score: 0.3 },
    ]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    // Pad thai is on the plate already (a first guess); spring rolls come from the search.
    await screen.findByRole('region', { name: 'Na talerzu' });
    await user.type(screen.getByLabelText('Szukaj dania'), 'sajgonki');
    await user.click((await screen.findAllByRole('button', { name: /^Sajgonki/ })).at(-1)!);
    Object.assign(failLog, { after: 1, calls: 0 });
    await user.click(screen.getByRole('button', { name: 'Dodaj 2 pozycje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Nie udało się zapisać/);
    expect(await db.entries.count()).toBe(1);
    failLog.after = Infinity;
    await user.click(screen.getByRole('button', { name: 'Dodaj do dziennika' }));
    await waitFor(async () => expect((await db.entries.toArray()).map((e) => e.key).sort()).toEqual(['dish:padThai', 'dish:springRolls']));
  });

  test('błąd modelu: powód, szczegóły, „Spróbuj ponownie” na tym samym zdjęciu; bez liczenia kalorii nie ma kcal', async () => {
    recognize.mockRejectedValueOnce(new Error('could not allocate memory')).mockResolvedValueOnce([{ dish: dishById('padThai')!, score: 0.9 }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { container } = render(
      <KcalShown.Provider value={false}>
        <PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />
      </KcalShown.Provider>,
    );
    await user.upload(inputs(container)[1]!, photo());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/zabrakło pamięci/);
    expect(alert).toHaveTextContent(/could not allocate memory/);
    expect(localStorage.getItem(MARKER)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByText(/Pad thai — pewne/)).toBeInTheDocument();
    expect(recognize).toHaveBeenCalledTimes(2);
    expect(recognize.mock.calls[1]![0]).toBe(recognize.mock.calls[0]![0]);
    expect(screen.queryByText(/kcal/)).toBeNull();
  });

  test('kroki analizy: zdjęcie odebrane, pobieranie modelu z procentem, uruchamianie, rozpoznawanie', async () => {
    let report: (p: Progress) => void = () => undefined;
    let finish: (v: unknown) => void = () => undefined;
    recognize.mockImplementation((_: Blob, onProgress: (p: Progress) => void) => {
      report = onProgress;
      return new Promise((resolve) => (finish = resolve));
    });
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await userEvent.setup().upload(inputs(container)[1]!, photo());
    await waitFor(() => expect(container.querySelector('.fd-diet-steps')).not.toBeNull());
    const steps = container.querySelector<HTMLElement>('.fd-diet-steps')!;
    expect(steps).toHaveTextContent('Zdjęcie odebrane');
    expect(steps).toHaveTextContent('Czekam na model');
    act(() => report({ step: 'load', share: 0.4, source: 'network' }));
    expect(steps).toHaveTextContent('Pobieram model: 40%');
    act(() => report({ step: 'start', share: null }));
    expect(steps).toHaveTextContent('Model gotowy');
    expect(steps).toHaveTextContent('Uruchamiam model');
    act(() => report({ step: 'read', share: null }));
    expect(steps).toHaveTextContent('Rozpoznaję danie');
    // While the photo is in the model, a crash would leave this marker for the next start.
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'reading', tries: 1 });
    await act(async () => finish([{ dish: dishById('padThai')!, score: 0.3 }]));
    expect(localStorage.getItem(MARKER)).toBeNull();
  });

  test('galeria zostawia znacznik i zaczyna pobieranie (nie wczytuje modelu); anulowanie go zdejmuje', async () => {
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    const camera = inputs(container)[1]!;
    const click = vi.spyOn(camera, 'click').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: /Z galerii/ }));
    expect(click).toHaveBeenCalled();
    expect(prepare).toHaveBeenCalled();
    expect(recognize).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'camera' });
    fireEvent(camera, new Event('cancel'));
    expect(localStorage.getItem(MARKER)).toBeNull();
  });
});

describe('Nie jedzenie i porównanie z bazą', () => {
  test('na zdjęciu nie ma jedzenia: mówi to i nic nie kładzie na talerz; „To jednak jedzenie” pokazuje propozycje', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('padThai')!, score: 0.3, cos: 0.06 },
      { dish: dishById('ramen')!, score: 0.2, cos: 0.05 },
    ]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    expect(await screen.findByText(/nie widzę jedzenia/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Na talerzu' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pad thai/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'To jednak jedzenie — pokaż propozycje' }));
    expect(within(screen.getByRole('region', { name: 'Na talerzu' })).getByText('Pad thai')).toBeInTheDocument();
  });

  test('podobne w bazie: zakres kcal/100 g obok wartości dania; „Użyj” liczy z produktu, wpis mówi skąd', async () => {
    recognize.mockResolvedValue([{ dish: dishById('pierogiRuskie')!, score: 0.9, cos: 0.17 }]);
    const food = (key: string, name: string, kcal: number): Food => ({
      key,
      name,
      detail: 'produkt',
      source: 'product',
      amountLabel: '100 g',
      nutrients: { kcal, protein: 7, carbs: 30, fat: 8 },
      per100: { kcal, protein: 7, carbs: 30, fat: 8 },
      grams: 100,
      stores: [],
      atHome: false,
      role: 'main',
    });
    const find = vi.fn((q: string) => (/pierogi/i.test(q) ? [food('product:1', 'Pierogi ruskie Jawo', 220), food('product:2', 'Pierogi z serem', 180)] : []));
    const onDone = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} find={find} onLogged={vi.fn()} onDone={onDone} />);
    await user.upload(inputs(container)[1]!, photo());
    const plate = await screen.findByRole('region', { name: 'Na talerzu' });
    expect(find).toHaveBeenCalledWith('Pierogi ruskie');
    expect(within(plate).getByText(/Podobne w bazie \(2\): 180–220 kcal\/100 g · to danie \d+ kcal\/100 g/)).toBeInTheDocument();
    const before = within(plate).getByText(/^ok\. \d+ kcal \(/).textContent;
    await user.click(within(plate).getByRole('button', { name: 'Użyj wartości: Pierogi ruskie Jawo' }));
    expect(within(plate).getByText(/Liczę z wartości: Pierogi ruskie Jawo/)).toBeInTheDocument();
    const after = within(plate).getByText(/^ok\. \d+ kcal \(/).textContent;
    expect(after).not.toBe(before);
    // 280 g at 220 kcal/100 g.
    expect(after).toMatch(/^ok\. 616 kcal/);
    await user.click(within(plate).getByRole('button', { name: 'Dodaj do dziennika' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({ kcal: 616, amountLabel: '280 g, wartości jak Pierogi ruskie Jawo' });
  });

  test('baza się jeszcze wczytuje: nie mówi „nic nie ma”; wybrane wartości da się cofnąć, nawet gdy listy już nie ma', async () => {
    recognize.mockResolvedValue([{ dish: dishById('pierogiRuskie')!, score: 0.9, cos: 0.17 }]);
    const ref = { key: 'product:1', name: 'Pierogi ruskie Jawo', detail: '', source: 'product', amountLabel: '100 g', nutrients: { kcal: 220, protein: 7, carbs: 30, fat: 8 }, per100: { kcal: 220, protein: 7, carbs: 30, fat: 8 }, grams: 100, stores: [], atHome: false, role: 'main' } satisfies Food;
    const user = userEvent.setup();
    const { container, rerender } = render(<PhotoMode date={DATE} find={() => []} findLoading onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    const plate = await screen.findByRole('region', { name: 'Na talerzu' });
    expect(within(plate).getByText(/Szukam podobnych/)).toBeInTheDocument();
    rerender(<PhotoMode date={DATE} find={() => [ref]} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.click(within(plate).getByRole('button', { name: 'Użyj wartości: Pierogi ruskie Jawo' }));
    rerender(<PhotoMode date={DATE} find={() => []} onLogged={vi.fn()} onDone={vi.fn()} />);
    expect(within(plate).getByText(/W bazie nie ma nic/)).toBeInTheDocument();
    await user.click(within(plate).getByRole('button', { name: 'Wróć do wartości dania' }));
    expect(within(plate).queryByText(/Liczę z wartości/)).toBeNull();
  });
});

describe('Wstępne danie przy kilku zdjęciach', () => {
  test('stuknięte wstępne danie zostaje, potwierdzone', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('padThai')!, score: 0.3 },
      { dish: dishById('ramen')!, score: 0.25 },
    ]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    const plate = await screen.findByRole('region', { name: 'Na talerzu' });
    await user.click(screen.getByRole('button', { name: /^Pad thai/ }));
    expect(within(plate).getByText('Pad thai')).toBeInTheDocument();
    expect(within(plate).queryByText('wstępnie')).toBeNull();
  });

  test('drugie zdjęcie nie zastępuje dania z pierwszego', async () => {
    recognize
      .mockResolvedValueOnce([
        { dish: dishById('pierogiRuskie')!, score: 0.4 },
        { dish: dishById('pierogiMeat')!, score: 0.1 },
      ])
      .mockResolvedValueOnce([
        { dish: dishById('padThai')!, score: 0.3 },
        { dish: dishById('ramen')!, score: 0.25 },
      ]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    const plate = await screen.findByRole('region', { name: 'Na talerzu' });
    expect(within(plate).getByText('wstępnie')).toBeInTheDocument();
    // The first photo's guess is left untouched; the second photo's chip is about the second photo.
    await user.upload(inputs(container)[1]!, photo());
    await screen.findByText(/Najpewniej Pad thai/);
    await user.click(screen.getByRole('button', { name: /^Ramen/ }));
    const names = within(plate).getAllByText(/^(Pierogi ruskie|Pad thai|Ramen)$/).map((n) => n.textContent);
    expect(names).toEqual(['Pierogi ruskie', 'Ramen']);
  });

  test('zdjęcie bez jedzenia po zdjęciu z daniem: talerz zostaje, ale bez „wstępnie”; pusty wynik to też „nie widzę”', async () => {
    recognize
      .mockResolvedValueOnce([
        { dish: dishById('padThai')!, score: 0.3 },
        { dish: dishById('ramen')!, score: 0.25 },
      ])
      .mockResolvedValueOnce([{ dish: dishById('padThai')!, score: 0.3, cos: 0.05 }])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    const plate = await screen.findByRole('region', { name: 'Na talerzu' });
    expect(within(plate).getByText('wstępnie')).toBeInTheDocument();
    await user.upload(inputs(container)[1]!, photo());
    expect(await screen.findByText(/nie widzę jedzenia/)).toBeInTheDocument();
    expect(within(plate).queryByText('wstępnie')).toBeNull();
    await user.upload(inputs(container)[1]!, photo());
    await waitFor(() => expect(recognize).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/nie widzę jedzenia/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /To jednak jedzenie/ })).toBeNull();
  });
});

describe('Znacznik na wypadek zamknięcia przez telefon', () => {
  test('powrót na stronę bez zdjęcia zdejmuje znacznik aparatu; zdjęcie w analizie go zostawia', async () => {
    let finish: (v: unknown) => void = () => undefined;
    recognize.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    vi.spyOn(inputs(container)[1]!, 'click').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: /Z galerii/ }));
    fireEvent(window, new Event('focus'));
    expect(localStorage.getItem(MARKER)).toBeNull();

    await user.upload(inputs(container)[1]!, photo());
    await waitFor(() => expect(recognize).toHaveBeenCalled());
    // The gallery in the middle of the analysis (its button is off then; the input itself still works), then back without one.
    fireEvent(inputs(container)[1]!, new Event('cancel'));
    fireEvent(window, new Event('focus'));
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'reading' });
    await act(async () => finish([]));
  });

  test('arkusz zamknięty, zanim zdjęcie trafiło do modelu: model się nie wczytuje, znacznika nie ma', async () => {
    let open: () => void = () => undefined;
    kept.gate = new Promise((resolve) => (open = resolve));
    const { container, unmount } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await userEvent.setup().upload(inputs(container)[1]!, photo());
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'reading' });
    unmount();
    await act(async () => open());
    expect(recognize).not.toHaveBeenCalled();
    expect(localStorage.getItem(MARKER)).toBeNull();
  });

  test('wyjaśnienie po awarii pokazuje się raz: znacznik schodzi, gdy ekran je pokaże', () => {
    localStorage.setItem(MARKER, JSON.stringify({ stage: 'camera', at: Date.now(), tries: 0 }));
    render(<PhotoMode date={DATE} resume={{ stage: 'camera', tries: 0 }} onLogged={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(localStorage.getItem(MARKER)).toBeNull();
  });
});

describe('Model rozpoznawania', () => {
  test('brak modelu: „Pobierz teraz” zaczyna pobieranie, potem procent i pasek, na końcu „jest w telefonie”', async () => {
    setModelState({ kind: 'missing', wait: null });
    const user = userEvent.setup();
    render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Model rozpoznawania' });
    expect(card).toHaveTextContent(/Jeszcze go nie ma w telefonie \(ok\. 20 MB\)/);
    await user.click(within(card).getByRole('button', { name: 'Pobierz teraz (ok. 20 MB)' }));
    expect(downloadModel).toHaveBeenCalled();
    act(() => setModelState({ kind: 'downloading', share: 0.5 }));
    expect(card).toHaveTextContent(/Pobieram: 50% \(27 z 55 MB\)/);
    expect(within(card).getByRole('progressbar')).toHaveAttribute('value', '0.5');
    expect(within(card).queryByRole('button')).toBeNull();
    act(() => setModelState({ kind: 'ready' }));
    expect(card).toHaveTextContent(/Jest w telefonie \(55 MB\)/);
  });

  test('przy oszczędzaniu danych mówi, czemu czeka; bez sieci nie proponuje pobrania; po błędzie „Spróbuj ponownie”', () => {
    setModelState({ kind: 'missing', wait: 'saver' });
    render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Model rozpoznawania' });
    expect(card).toHaveTextContent(/oszczędzanie danych/);
    expect(within(card).getByRole('button', { name: /Pobierz teraz/ })).toBeInTheDocument();
    act(() => setModelState({ kind: 'missing', wait: 'offline' }));
    expect(card).toHaveTextContent(/nie ma internetu/);
    expect(within(card).queryByRole('button')).toBeNull();
    act(() => setModelState({ kind: 'failed', reason: 'storage' }));
    expect(card).toHaveTextContent(/brakuje miejsca/);
    expect(within(card).getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
  });
});

describe('Po zamknięciu aplikacji przez telefon', () => {
  test('w trakcie aparatu: wyjaśnienie, a „Zrób zdjęcie” od razu pod spodem', () => {
    setModelState({ kind: 'ready' });
    render(<PhotoMode date={DATE} resume={{ stage: 'camera', tries: 0 }} onLogged={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/nie dotarło — telefon zamknął aplikację, kiedy był włączony aparat/);
    expect(screen.getByRole('button', { name: /Zrób zdjęcie/ })).toBeEnabled();
  });

  test('w trakcie analizy: zachowane zdjęcie i „Spróbuj ponownie”; za drugim razem rada, żeby wyszukać', async () => {
    kept.photo = new Blob([new Uint8Array([9])], { type: 'image/jpeg' });
    recognize.mockResolvedValue([{ dish: dishById('padThai')!, score: 0.8 }]);
    const user = userEvent.setup();
    render(<PhotoMode date={DATE} resume={{ stage: 'reading', tries: 2 }} onLogged={vi.fn()} onDone={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Analiza poprzedniego zdjęcia została przerwana/);
    expect(alert).toHaveTextContent(/2 razy z rzędu/);
    expect(await within(alert).findByText('Zdjęcie jest zachowane:')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Zdjęcie posiłku' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(recognize.mock.calls[0]![0]).toBe(kept.photo);
    expect(await screen.findByText(/Pad thai — pewne/)).toBeInTheDocument();
  });
});

/** A camera that gives a stream with one track; `fail` makes `getUserMedia` refuse. */
function fakeCamera(fail?: string) {
  const stop = vi.fn();
  const track = { stop, getCapabilities: () => ({}) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const getUserMedia = vi.fn(() => (fail ? Promise.reject(new DOMException('no', fail)) : Promise.resolve(stream)));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  return { stop, getUserMedia };
}

describe('Aparat w aplikacji i model', () => {
  test('bez modelu nie da się zrobić zdjęcia: mówi czemu; w trakcie pobierania procent; z modelem przyciski działają', () => {
    setModelState({ kind: 'missing', wait: null });
    render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Zrób zdjęcie/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Z galerii/ })).toBeDisabled();
    expect(screen.getByText(/Najpierw pobierz model/)).toBeInTheDocument();
    act(() => setModelState({ kind: 'downloading', share: 0.4 }));
    expect(screen.getByText('Zdjęcie zrobisz, gdy model się pobierze (40%).')).toBeInTheDocument();
    act(() => setModelState({ kind: 'ready' }));
    expect(screen.getByRole('button', { name: /Zrób zdjęcie/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Z galerii/ })).toBeEnabled();
  });

  test('„Zrób zdjęcie” otwiera aparat w aplikacji, model wczytuje się w tym czasie; migawka od razu rozpoznaje, aparat gaśnie', async () => {
    setModelState({ kind: 'ready' });
    const cam = fakeCamera();
    const shot = new Blob([new Uint8Array([7])], { type: 'image/jpeg' });
    grabFrame.mockResolvedValue(shot);
    recognize.mockResolvedValue([{ dish: dishById('padThai')!, score: 0.9, cos: 0.17 }]);
    const user = userEvent.setup();
    render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Zrób zdjęcie/ }));
    expect(cam.getUserMedia).toHaveBeenCalled();
    // A marker while the camera is on, so a closed tab comes back here; no model yet.
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'camera' });
    expect(recognize).not.toHaveBeenCalled();
    const shutter = await screen.findByRole('button', { name: 'Zrób zdjęcie' });
    // No shutter before the camera shows a picture.
    expect(shutter).toBeDisabled();
    fireEvent(document.querySelector('video')!, new Event('playing'));
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    expect(await screen.findByText(/Pad thai — pewne/)).toBeInTheDocument();
    expect(recognize.mock.calls[0]![0]).toBe(shot);
    // The camera was off before the model started.
    expect(cam.stop.mock.invocationCallOrder[0]).toBeLessThan(recognize.mock.invocationCallOrder[0]!);
    expect(localStorage.getItem(MARKER)).toBeNull();
  });

  test('bez zgody na aparat: mówi czemu i daje aparat telefonu (z znacznikiem) oraz galerię', async () => {
    setModelState({ kind: 'ready' });
    fakeCamera('NotAllowedError');
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Zrób zdjęcie/ }));
    expect(await screen.findByText(/Brak zgody na aparat w aplikacji/)).toBeInTheDocument();
    const system = vi.spyOn(inputs(container)[0]!, 'click').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: /Aparat telefonu/ }));
    expect(system).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'camera' });
  });

  test('po pierwszej przerwanej analizie zachowane zdjęcie wraca do modelu samo, raz', async () => {
    setModelState({ kind: 'ready' });
    kept.photo = new Blob([new Uint8Array([9])], { type: 'image/jpeg' });
    recognize.mockResolvedValue([{ dish: dishById('padThai')!, score: 0.8 }]);
    render(<PhotoMode date={DATE} resume={{ stage: 'reading', tries: 1 }} onLogged={vi.fn()} onDone={vi.fn()} />);
    expect(await screen.findByText(/Pad thai — pewne/)).toBeInTheDocument();
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(recognize.mock.calls[0]![0]).toBe(kept.photo);
  });

  test('wizjer zamknięty bez zdjęcia zdejmuje znacznik; spóźniona klatka po zamknięciu wyjścia nic nie psuje', async () => {
    setModelState({ kind: 'ready' });
    fakeCamera();
    let frame: (b: Blob) => void = () => undefined;
    grabFrame.mockImplementation(() => new Promise((resolve) => (frame = resolve)));
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Zrób zdjęcie/ }));
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'camera' });
    await user.click(await screen.findByRole('button', { name: /Anuluj/ }));
    expect(localStorage.getItem(MARKER)).toBeNull();

    // From the viewfinder to the gallery: the gallery leaves its own marker.
    await user.click(screen.getByRole('button', { name: /Zrób zdjęcie/ }));
    const gallery = vi.spyOn(inputs(container)[1]!, 'click').mockImplementation(() => undefined);
    await user.click(await screen.findByRole('button', { name: /Z galerii/ }));
    expect(gallery).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(MARKER)!)).toMatchObject({ stage: 'camera' });

    await user.click(screen.getByRole('button', { name: /Zrób zdjęcie/ }));
    fireEvent(document.querySelector('video')!, new Event('playing'));
    const shutter = await screen.findByRole('button', { name: 'Zrób zdjęcie' });
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    expect(screen.getByRole('button', { name: /Anuluj/ })).toBeDisabled();
    expect(recognize).not.toHaveBeenCalled();
    await act(async () => frame(new Blob([new Uint8Array([1])])));
    expect(recognize).toHaveBeenCalledTimes(1);
  });

  test('arkusz zamknięty w trakcie robienia zdjęcia: klatka nie trafia do modelu', async () => {
    setModelState({ kind: 'ready' });
    fakeCamera();
    let frame: (b: Blob) => void = () => undefined;
    grabFrame.mockImplementation(() => new Promise((resolve) => (frame = resolve)));
    const user = userEvent.setup();
    const { unmount } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Zrób zdjęcie/ }));
    fireEvent(document.querySelector('video')!, new Event('playing'));
    const shutter = await screen.findByRole('button', { name: 'Zrób zdjęcie' });
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    unmount();
    await act(async () => frame(new Blob([new Uint8Array([1])])));
    expect(recognize).not.toHaveBeenCalled();
  });

  test('pobieranie, które stoi pół minuty: wyjaśnienie i „Spróbuj ponownie” zaczyna je od nowa', () => {
    vi.useFakeTimers();
    setModelState({ kind: 'downloading', share: 0.3 });
    render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Model rozpoznawania' });
    act(() => void vi.advanceTimersByTime(20_000));
    act(() => setModelState({ kind: 'downloading', share: 0.31 }));
    act(() => void vi.advanceTimersByTime(20_000));
    expect(within(card).queryByRole('button')).toBeNull();
    act(() => void vi.advanceTimersByTime(11_000));
    expect(card).toHaveTextContent(/stoi od pół minuty/);
    fireEvent.click(within(card).getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(restartDownload).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('słabo widać jedzenie (patelnia na kuchence): i tak szacunek, ale wstępny, z „sprawdź i popraw”', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('stirFry')!, score: 0.7, cos: 0.106 },
      { dish: dishById('padThai')!, score: 0.2, cos: 0.1 },
    ]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    const answer = await screen.findByRole('region', { name: 'Wynik ze zdjęcia' });
    expect(answer).toHaveTextContent(/Słabo widać tu jedzenie — może to/);
    expect(answer).toHaveTextContent(/ok\. \d+ kcal/);
    expect(within(screen.getByRole('region', { name: 'Na talerzu' })).getByText('wstępnie')).toBeInTheDocument();
  });

  test('na pierwszym miejscu typ „inne”: „nie znam dokładnie tego dania — to chyba zupa krem”, szacunek wstępny', async () => {
    recognize.mockResolvedValue([
      { dish: dishById('genericCreamSoup')!, score: 0.8, cos: 0.15 },
      { dish: dishById('zupaDyniowa')!, score: 0.1, cos: 0.14 },
    ]);
    const user = userEvent.setup();
    const { container } = render(<PhotoMode date={DATE} onLogged={vi.fn()} onDone={vi.fn()} />);
    await user.upload(inputs(container)[1]!, photo());
    const answer = await screen.findByRole('region', { name: 'Wynik ze zdjęcia' });
    expect(answer).toHaveTextContent('Nie znam dokładnie tego dania — to chyba zupa krem.');
    expect(answer).toHaveTextContent(/ok\. \d+ kcal/);
    expect(within(screen.getByRole('region', { name: 'Na talerzu' })).getByText('wstępnie')).toBeInTheDocument();
  });
});

