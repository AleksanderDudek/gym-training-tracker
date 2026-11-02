// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import css from './styles.css?raw';
import html from '../index.html?raw';
import {
  THEME_EVENT,
  THEME_KEY,
  TOP_COLORS,
  applyTheme,
  currentTheme,
  onThemeChange,
  resolveTheme,
  savedTheme,
  setTheme,
  setThemeColor,
} from './theme';

/** `matchMedia` z zapytaniem o ciemny system — jsdom go nie ma. */
function stubSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    matches: dark,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal('matchMedia', (q: string) => (q.includes('dark') ? mq : { ...mq, matches: false }));
  return {
    flip(next: boolean) {
      mq.matches = next;
      listeners.forEach((cb) => cb());
    },
    listeners,
  };
}

function addMeta(content: string, media: string) {
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.setAttribute('content', content);
  m.setAttribute('media', media);
  document.head.appendChild(m);
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.querySelectorAll('meta').forEach((m) => m.remove());
});

describe('wygląd: wybór i system', () => {
  it('bez wyboru — za systemem; wybór wygrywa z systemem', () => {
    expect(savedTheme()).toBe('auto');
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    stubSystem(true);
    expect(currentTheme()).toBe('dark');
    localStorage.setItem(THEME_KEY, 'light');
    expect(currentTheme()).toBe('light');
  });

  it('śmieci w zapisie i zablokowany localStorage to „automatycznie”', () => {
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(savedTheme()).toBe('auto');
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('zablokowane');
      },
    });
    expect(savedTheme()).toBe('auto');
  });

  it('wybór staje na <html> od razu i zostaje w tej przeglądarce; „automatycznie” zdejmuje atrybut', () => {
    const heard = vi.fn();
    addEventListener(THEME_EVENT, heard);
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    setTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(heard).toHaveBeenCalledTimes(2);
    removeEventListener(THEME_EVENT, heard);
  });

  it('start strony stawia zapisany wybór (main.tsx woła applyTheme przed renderem)', () => {
    localStorage.setItem(THEME_KEY, 'light');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('przełączenie systemu dochodzi do słuchaczy; po odpięciu już nie', () => {
    const sys = stubSystem(false);
    const cb = vi.fn();
    const off = onThemeChange(cb);
    sys.flip(true);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    sys.flip(false);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(sys.listeners.size).toBe(0);
  });
});

describe('pasek systemowy (theme-color)', () => {
  it('z dwóch znaczników z `media` zostaje jeden, z kolorem wprost', () => {
    addMeta('#FAFAF8', '(prefers-color-scheme: light)');
    addMeta('#1C201D', '(prefers-color-scheme: dark)');
    setThemeColor(TOP_COLORS.dark.surface);
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]!.getAttribute('content')).toBe('#1C201D');
    expect(metas[0]!.hasAttribute('media')).toBe(false);
  });

  it('bez znacznika — dopisuje go', () => {
    setThemeColor('#123456');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#123456');
  });

  it('kolory paska są tokenami tła i karty z arkusza, w obu wyglądach', () => {
    const value = (block: string, name: string) => block.match(new RegExp(`--${name}:(#[0-9A-Fa-f]{6})`))?.[1];
    const light = css.slice(0, css.indexOf('}'));
    const darkAt = css.indexOf(':root[data-theme=dark]{');
    const dark = css.slice(darkAt, css.indexOf('}', darkAt));
    expect(value(light, 'bg')).toBe(TOP_COLORS.light.bg);
    expect(value(light, 'surface')).toBe(TOP_COLORS.light.surface);
    expect(value(dark, 'bg')).toBe(TOP_COLORS.dark.bg);
    expect(value(dark, 'surface')).toBe(TOP_COLORS.dark.surface);
  });

  it('index.html: przed skryptem pasek idzie za systemem, a strona zna oba wyglądy', () => {
    expect(html).toContain(`content="${TOP_COLORS.light.surface}" media="(prefers-color-scheme: light)"`);
    expect(html).toContain(`content="${TOP_COLORS.dark.surface}" media="(prefers-color-scheme: dark)"`);
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    // Żadnego skryptu w treści strony: polityka bezpieczeństwa wpuszcza tylko pliki z serwera.
    expect(html).not.toMatch(/<script>/);
  });
});
