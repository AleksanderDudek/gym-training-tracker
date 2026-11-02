import { useSyncExternalStore } from 'react';
import { text } from '../i18n';
import { onThemeChange, setTheme, systemDark, useThemeChoice, type ThemeChoice } from '../theme';
import { Segmented } from './ui';

const T = text({
  pl: {
    title: 'Wygląd',
    lead: 'Jasny albo ciemny. „Automatycznie” idzie za ustawieniem telefonu albo komputera. Wybór zostaje w tej przeglądarce — kopia danych go nie przenosi.',
    auto: 'Automatycznie',
    light: 'Jasny',
    dark: 'Ciemny',
    now: (dark: boolean) => `System: ${dark ? 'ciemny' : 'jasny'}.`,
    share: 'Obrazki do udostępnienia zostają jasne — to kartki dla innych.',
  },
  en: {
    title: 'Appearance',
    lead: 'Light or dark. “Automatic” follows your phone or computer setting. The choice stays in this browser — a data backup doesn’t carry it.',
    auto: 'Automatic',
    light: 'Light',
    dark: 'Dark',
    now: (dark: boolean) => `System: ${dark ? 'dark' : 'light'}.`,
    share: 'Images for sharing stay light — they’re cards for other people.',
  },
});

/**
 * Wybór wyglądu w ustawieniach. Zmiana działa od razu, bez przeładowania (`src/theme.ts`), i jak
 * język zostaje w tej przeglądarce, a nie w kopii danych.
 */
export function ThemeCard() {
  const value = useThemeChoice();
  const dark = useSyncExternalStore(onThemeChange, systemDark, () => false);
  return (
    <div className="grp">
      <h2>{T.title}</h2>
      <p className="tight">{T.lead}</p>
      <Segmented<ThemeChoice>
        label={T.title}
        options={[
          { key: 'auto', label: T.auto },
          { key: 'light', label: T.light },
          { key: 'dark', label: T.dark },
        ]}
        value={value}
        onChange={(v) => {
          if (v !== value) setTheme(v);
        }}
      />
      <p className="hint">
        {T.now(dark)} {T.share}
      </p>
    </div>
  );
}
