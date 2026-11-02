// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { THEME_KEY } from '../theme';
import { ThemeCard } from './Theme';

const POLISH = /[ąćęłńóśźż]/i;

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('appearance card (English visit)', () => {
  it('English heading, options and note — no Polish letters', async () => {
    const { container } = render(<ThemeCard />);
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Appearance' })).toHaveTextContent('AutomaticLightDark');
    expect(screen.getByText(/System: light\. Images for sharing stay light/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(POLISH);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
