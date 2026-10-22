import { SUPPORT_URL } from './engine/share';
import { text } from './i18n';

/**
 * Kontakt z autorem poza aplikacją: Instagram, serwer na Discordzie i wsparcie. Wszystko to
 * zwykłe odnośniki — nic stąd nie jest pobierane, więc w polityce bezpieczeństwa stoją tylko
 * jako adresy nawigacji (`csp.test.ts`).
 */

/** Profil autora na Instagramie (podany przez autora 2026-10-15). Pusty — wiersz Instagrama znika. */
export const INSTAGRAM_URL: string | null = 'https://instagram.com/aleksanderdudek';

/** Serwer społeczności na Discordzie. Rozmowy idą po polsku, więc odnośnik widzi tylko Polska. */
export const DISCORD_URL = 'https://discord.gg/U6jCW6tvg';

/**
 * Wsparcie spoza Polski. buycoffee.to to serwis polski (BLIK, przelewy); poza Polską ten sam
 * autor przyjmuje kawę w buymeacoffee.com — tak jak w jego drugiej aplikacji, Teleo.
 */
export const SUPPORT_URL_WORLD = 'https://buymeacoffee.com/atd_uriel';

/** Co przeglądarka mówi o miejscu: preferowane języki i strefa czasowa. */
export interface Whereabouts {
  languages: readonly string[];
  timeZone: string | undefined;
}

/**
 * Polska: polski wśród preferowanych języków albo polska strefa czasowa. Bez pytania o lokalizację
 * — do wyboru odnośnika wystarczy, a obejmuje i Polaków za granicą, i telefony po angielsku w kraju.
 */
export function isPoland({ languages, timeZone }: Whereabouts): boolean {
  return languages.some((l) => /^pl(-|$)/i.test(l)) || timeZone === 'Europe/Warsaw';
}

/** To, co wie ta przeglądarka. Poza przeglądarką (testy w node) — nic. */
export function whereabouts(): Whereabouts {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  const languages = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  return { languages, timeZone };
}

/** Czy ta przeglądarka jest „w Polsce” w rozumieniu `isPoland`. */
export const inPoland = (): boolean => isPoland(whereabouts());

/** Kawa dla autora: polski serwis w Polsce, międzynarodowy gdzie indziej. */
export const supportUrl = (pl: boolean): string => (pl ? SUPPORT_URL : SUPPORT_URL_WORLD);

/** Adres do pokazania pod nazwą: bez protokołu, `www.` i ukośnika na końcu. */
export const shortUrl = (url: string): string => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export interface ContactLink {
  id: 'instagram' | 'discord' | 'support';
  name: string;
  /** Po co tam iść — jedno zdanie pod nazwą. */
  note: string;
  href: string;
}

const T = text({
  pl: {
    instagram: 'Kulisy aplikacji i wiadomość prosto do autora.',
    discord: 'Serwer po polsku: pytania, pomysły, rozmowy o treningu.',
    espresso: 'Postaw espresso',
    supportPl: 'Wsparcie autora przez buycoffee.to.',
    supportWorld: 'Wsparcie autora — płatność kartą z każdego kraju.',
  },
  en: {
    instagram: 'Behind the scenes of the app, and messages straight to the author.',
    discord: 'A Polish-language server: questions, ideas, training talk.',
    espresso: 'Buy an espresso',
    supportPl: 'Support the author via buycoffee.to.',
    supportWorld: 'Support the author — pay by card from any country.',
  },
});

/** Odnośniki kontaktowe dla tego miejsca, w kolejności pokazywania. */
export function contactLinks(pl: boolean, instagram: string | null = INSTAGRAM_URL): ContactLink[] {
  const links: ContactLink[] = [];
  if (instagram)
    links.push({ id: 'instagram', name: 'Instagram', note: T.instagram, href: instagram });
  if (pl)
    links.push({ id: 'discord', name: 'Discord', note: T.discord, href: DISCORD_URL });
  links.push(
    pl
      ? { id: 'support', name: T.espresso, note: T.supportPl, href: SUPPORT_URL }
      : { id: 'support', name: 'Buy me a coffee', note: T.supportWorld, href: SUPPORT_URL_WORLD },
  );
  return links;
}
