// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { LANG, LANG_KEY, LOCALE, num, text } from '../i18n';
import { LanguageCard } from './Language';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('language card (English visit)', () => {
  it('the English half of a catalog and English number format', () => {
    expect(LANG).toBe('en');
    expect(LOCALE).toBe('en-GB');
    expect(text({ pl: { a: 'Zapisz' }, en: { a: 'Save' } }).a).toBe('Save');
    expect(num(12345.5, 1)).toBe('12,345.5');
  });

  it('a bilingual heading, language names in themselves; a choice is saved and the page reloads', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<LanguageCard />);
    expect(screen.getByRole('heading', { name: 'Język · Language' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Język · Language' });
    expect(group).toHaveTextContent('AutomaticPolskiEnglish');
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(localStorage.getItem(LANG_KEY)).toBe('pl');
    expect(reload).toHaveBeenCalled();
  });
});
