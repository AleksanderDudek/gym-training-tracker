import type { ReactNode } from 'react';

/**
 * Odznaki jako przedmioty, nie znaki typograficzne.
 *
 * Trzy rzeczy robią różnicę między „zaliczone” a „zdobyte”: kształt, który wygląda jak
 * medal, tworzywo rosnące razem z progiem (brąz → srebro → złoto → platyna → diament)
 * i widoczny stan zablokowany, w którym nadal widać, co jest do wzięcia. Ostatnie jest
 * najważniejsze: szary, ale czytelny piktogram pokazuje cel, a nie ścianę.
 */

/** Tworzywo odznaki. Zero znaczy „jeszcze nie zdobyta”. */
export type Band = 0 | 1 | 2 | 3 | 4 | 5;

export const BAND_NAME: Record<Band, string> = {
  0: 'niezdobyta',
  1: 'brąz',
  2: 'srebro',
  3: 'złoto',
  4: 'platyna',
  5: 'diament',
};

/**
 * Tworzywo z postępu w obrębie rodziny, a nie z gołego numeru progu. Dzięki temu domknięcie
 * dowolnej rodziny kończy się diamentem — także tej trzyprogowej — a rodzina dziesięcioprogowa
 * rozkłada te same pięć pasm na dłuższą drogę.
 */
export const bandFor = (tier: number, total: number): Band => {
  if (tier <= 0 || total <= 0) return 0;
  // Odznaka jednorazowa dostaje złoto, nie diament. Inaczej „Ranny ptaszek” za jeden trening
  // przed ósmą stałby na półce w tym samym tworzywie, co domknięta dziesięcioprogowa rodzina.
  if (total === 1) return 3;
  return Math.max(1, Math.min(5, Math.ceil((tier / total) * 5))) as Band;
};

/* ---------------- Piktogramy ---------------- */

const P = (d: string): ReactNode => <path d={d} />;

/** Siatka 24×24, ta sama grubość linii co w nawigacji. */
const ART: Record<string, ReactNode> = {
  dumbbell: P('M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11'),
  sigma: P('M17.5 4.5h-11l7 7.5-7 7.5h11'),
  bars: P('M5 20V13M12 20V8M19 20V4'),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  plate: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  // Kettlebell — o ciężarze mówi sylwetka sprzętu, nie kolejny okrąg.
  kettlebell: P(
    'M8.8 9.4a3.4 3.4 0 1 1 6.4 0c2.8 1.7 4.4 4.4 4.4 7.4a3.2 3.2 0 0 1-3.2 3.2H7.6a3.2 3.2 0 0 1-3.2-3.2c0-3 1.6-5.7 4.4-7.4Z',
  ),
  // Stos krążków widziany z boku — dorobek, który się piętrzy.
  plates: (
    <>
      <ellipse cx="12" cy="7" rx="7.5" ry="2.8" />
      <path d="M4.5 7v9.8c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V7" />
      <path d="M4.5 11.9c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 2M9.5 3h5M12 3v3" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 5.5v15" />
    </>
  ),
  hinge: P('M4 8c3.5 6 12.5 6 16 0M6.5 18.5 4 14M17.5 18.5 20 14'),
  squat: P('M6 4v5l3 4v7M18 4v5l-3 4v7M9 13h6'),
  pullup: P('M12 20.5V6M12 6 7 11M12 6l5 5M4.5 3.5h15'),
  push: P('M12 3.5V18M12 18l-5-5M12 18l5-5M4.5 20.5h15'),
  star: P('m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8Z'),
  core: (
    <>
      <path d="M12 3.5c4 0 7 1.2 7 1.2v6.5c0 5-3.5 7.8-7 9.3-3.5-1.5-7-4.3-7-9.3V4.7s3-1.2 7-1.2Z" />
      <path d="M9 11h6" />
    </>
  ),
  legs: P('M8 3.5v7l-2 10M16 3.5v7l2 10M8 10.5h8'),
  ruler: P('M4 19.5 19.5 4M9 5.5l3.5 3.5M5.5 9l3.5 3.5M12.5 2 22 11.5 11.5 22 2 12.5Z'),
  arrowRight: P('M3.5 12h17M20.5 12l-5.5-5M20.5 12l-5.5 5'),
  hourglass: P('M6.5 3.5h11M6.5 20.5h11M7.5 3.5v3.7c0 2.6 4.5 3.7 4.5 4.8 0-1.1 4.5-2.2 4.5-4.8V3.5M7.5 20.5v-3.7c0-2.6 4.5-3.7 4.5-4.8 0 1.1 4.5 2.2 4.5 4.8v3.7'),
  wave: P('M3 14c2.5-6 5-6 7.5 0s5 6 7.5 0M3 19.5h18'),
  dots: P('M4.5 12h.01M9.5 12h.01M14.5 12h.01M19.5 12h.01'),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 5-3.6 7.8-8 9.5C7.6 19.8 4 17 4 12V6Z" />
      <path d="m8.8 12 2.4 2.4 4-4.6" />
    </>
  ),
  equals: P('M4.5 9.5h15M4.5 15h15'),
  stairs: P('M3.5 20.5h5v-5h5v-5h5v-5h2.5'),
  refresh: P('M20 12a8 8 0 1 1-2.6-5.9M20 3.5V8h-4.5'),
  triangleUp: P('M12 4.5 20.5 19H3.5Z'),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </>
  ),
  moon: P('M20 14.5A8.6 8.6 0 0 1 9.5 4 8.6 8.6 0 1 0 20 14.5Z'),
  chain: P('M9.5 14.5 14.5 9.5M9 6.5l1.8-1.8a4.2 4.2 0 0 1 6 6L15 12.5M9 11.5l-1.8 1.8a4.2 4.2 0 0 0 6 6L15 17.5'),
  circleCheck: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.2 12 2.6 2.6 5-5.4" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4M8.5 14.5l2.5 2.5 4.5-4.5" />
    </>
  ),
  rewind: P('M11 6.5 4.5 12l6.5 5.5ZM20 6.5 13.5 12l6.5 5.5Z'),
  check: P('m4.5 12.5 5 5 10-11'),
  half: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v4.8a4.5 4.5 0 0 1-9 0V4Z" />
      <path d="M7.5 5.6H5.3a2.2 2.2 0 0 0 2.2 2.6M16.5 5.6h2.2a2.2 2.2 0 0 1-2.2 2.6" />
      <path d="M12 13.3v3.4M8.3 20.3h7.4" />
    </>
  ),
};

export const ART_NAMES = Object.keys(ART);
export const hasArt = (name: string | undefined): boolean => !!name && name in ART;

/* ---------------- Tworzywa ---------------- */

interface Metal {
  light: string;
  base: string;
  dark: string;
  ink: string;
}

const METALS: Record<Exclude<Band, 0>, Metal> = {
  1: { light: '#D9A275', base: '#A8703F', dark: '#6B4021', ink: '#FCEFE3' },
  2: { light: '#EEF1F4', base: '#B4BCC4', dark: '#767F88', ink: '#2A3138' },
  3: { light: '#F8E39B', base: '#E0AE33', dark: '#96690F', ink: '#4A3204' },
  4: { light: '#EAF4F6', base: '#9FC2C9', dark: '#5C838B', ink: '#1E3136' },
  5: { light: '#DCD2FF', base: '#9C82F0', dark: '#5636B4', ink: '#F6F2FF' },
};

/** Gradienty definiowane raz w dokumencie — inaczej każdy medal niósłby własną kopię. */
export function BadgeDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        {(Object.keys(METALS) as unknown as Exclude<Band, 0>[]).map((b) => {
          const m = METALS[b];
          return (
            <linearGradient key={b} id={`bm${b}`} x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0%" stopColor={m.light} />
              <stop offset="45%" stopColor={m.base} />
              <stop offset="100%" stopColor={m.dark} />
            </linearGradient>
          );
        })}
        <linearGradient id="bmShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const HEX = 'M24 2.6 42.6 13.3v21.4L24 45.4 5.4 34.7V13.3Z';
const HEX_IN = 'M24 7.4 38.5 15.7v16.6L24 40.6 9.5 32.3V15.7Z';

/**
 * Medal jednej odznaki. Bez tworzywa (pasmo 0) rysuje się płasko i przygaszony, ale
 * z czytelnym piktogramem — po to, żeby widać było, co jest do zdobycia.
 */
export function BadgeMedal({
  art,
  mark,
  band,
  size = 34,
  title,
}: {
  art?: string | undefined;
  /** Napis na medalu, gdy rodzina nie ma piktogramu — zwykle długość okna, np. „30D”. */
  mark?: string | undefined;
  band: Band;
  size?: number;
  title?: string | undefined;
}) {
  const metal = band > 0 ? METALS[band as Exclude<Band, 0>] : null;
  const face = metal ? `url(#bm${band})` : 'var(--surface-2)';
  const ink = metal ? metal.ink : 'var(--ink-soft)';
  const glyph = art && ART[art];
  const text = !glyph ? (mark ?? '') : '';

  return (
    <svg
      className={`medal band-${band}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      <path d={HEX} fill={face} stroke={metal ? metal.dark : 'var(--line)'} strokeWidth="1.4" />
      {metal && <path d={HEX_IN} fill="none" stroke={metal.light} strokeWidth="1" opacity="0.55" />}
      {metal && <path d="M24 2.6 42.6 13.3 24 24 5.4 13.3Z" fill="url(#bmShine)" />}
      {glyph ? (
        <g
          transform="translate(12 12) scale(0.72) translate(4.65 4.65)"
          fill="none"
          stroke={ink}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={metal ? 1 : 0.55}
        >
          {glyph}
        </g>
      ) : (
        <text
          x="24"
          y="24"
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          opacity={metal ? 1 : 0.55}
          style={{
            fontFamily: 'var(--display)',
            fontWeight: 600,
            fontSize: text.length > 3 ? 12 : text.length === 3 ? 14 : 18,
            letterSpacing: '-0.02em',
          }}
        >
          {text}
        </text>
      )}
    </svg>
  );
}
