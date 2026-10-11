// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RootBoundary } from './RootBoundary';
import { lookForFix, reloadFresh } from '../pwa';

// Ekran awarii woła service worker tylko przez `pwa.ts` — tu atrapa, testy nie potrzebują go wcale.
vi.mock('../pwa', () => ({
  lookForFix: vi.fn(),
  reloadFresh: vi.fn(async () => undefined),
}));

function Boom(): never {
  throw new Error('wywrotka w renderze');
}

beforeEach(() => {
  // React zgłasza złapany błąd w konsoli — w teście to szum, nie informacja.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(lookForFix).mockClear();
  vi.mocked(reloadFresh).mockClear();
});

describe('granica błędu całej aplikacji', () => {
  it('bez błędu pokazuje aplikację', () => {
    render(
      <RootBoundary>
        <p>Dziś</p>
      </RootBoundary>,
    );
    expect(screen.getByText('Dziś')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(lookForFix).not.toHaveBeenCalled();
  });

  it('błąd w renderze daje ekran „Coś poszło nie tak” i od razu pyta o poprawkę', () => {
    render(
      <RootBoundary>
        <Boom />
      </RootBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Coś poszło nie tak');
    expect(screen.getByRole('button', { name: 'Odśwież' })).toBeEnabled();
    expect(lookForFix).toHaveBeenCalledTimes(1);
  });

  it('„Odśwież” wpuszcza nową wersję i nie rusza zapisanych danych', () => {
    window.localStorage.setItem('kb-trener-v3', '{"log":[1]}');
    window.localStorage.setItem('gt:diet', '1');
    render(
      <RootBoundary>
        <Boom />
      </RootBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież' }));
    expect(reloadFresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Odświeżam…' })).toBeDisabled();
    expect(window.localStorage.getItem('kb-trener-v3')).toBe('{"log":[1]}');
    expect(window.localStorage.getItem('gt:diet')).toBe('1');
  });
});
