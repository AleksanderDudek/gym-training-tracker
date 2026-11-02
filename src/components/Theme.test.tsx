// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY } from '../theme';
import { ThemeCard } from './Theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe('karta „Wygląd”', () => {
  it('trzy opcje, domyślnie „Automatycznie”, i to, co mówi system', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    render(<ThemeCard />);
    expect(screen.getByRole('heading', { name: 'Wygląd' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Wygląd' });
    expect(group).toHaveTextContent('AutomatycznieJasnyCiemny');
    expect(screen.getByRole('button', { name: 'Automatycznie' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/System: ciemny\./)).toBeInTheDocument();
    expect(screen.getByText(/Obrazki do udostępnienia zostają jasne/)).toBeInTheDocument();
  });

  it('wybór działa od razu, bez przeładowania, i zostaje w tej przeglądarce', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<ThemeCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Ciemny' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Ciemny' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Jasny' }));
    expect(document.documentElement.dataset.theme).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: 'Automatycznie' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('zapisany wybór widać po otwarciu karty', () => {
    localStorage.setItem(THEME_KEY, 'light');
    render(<ThemeCard />);
    expect(screen.getByRole('button', { name: 'Jasny' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/System: jasny\./)).toBeInTheDocument();
  });
});
