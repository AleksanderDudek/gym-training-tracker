import type { ReactNode } from 'react';

/**
 * Ikony nawigacji. Rysowane inline, bo cała aplikacja ma się mieścić w jednym pliku bez
 * zewnętrznych zasobów, a pasek zakładek bez ikon zmusza do etykiet na 9,5 px — poniżej
 * minimum każdej wytycznej. Jedna siatka 24×24, jedna grubość linii, kolor dziedziczony.
 */
export type IconName = 'session' | 'plan' | 'levels' | 'awards' | 'workouts' | 'atlas' | 'settings';

const PATHS: Record<IconName, ReactNode> = {
  // Hantla: dwa obciążniki i gryf.
  session: (
    <>
      <path d="M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5" />
      <path d="M6.5 12h11" />
    </>
  ),
  // Kalendarz z odhaczonym terminem.
  plan: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
      <path d="M8.5 14.5l2.5 2.5 4.5-4.5" />
    </>
  ),
  // Słupki rosnące w prawo.
  levels: <path d="M5 20.5V14M12 20.5V9M19 20.5V4.5" />,
  // Puchar: czasza, uszy, nóżka i podstawa. Czytelniejszy w 23 px niż medal na wstążce,
  // w którym wstążka i krążek zlewają się w klepsydrę.
  awards: (
    <>
      <path d="M7.5 4h9v4.8a4.5 4.5 0 0 1-9 0V4Z" />
      <path d="M7.5 5.6H5.3a2.2 2.2 0 0 0 2.2 2.6M16.5 5.6h2.2a2.2 2.2 0 0 1-2.2 2.6" />
      <path d="M12 13.3v3.4M8.3 20.3h7.4" />
    </>
  ),
  // Lista z punktorami.
  workouts: (
    <>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
    </>
  ),
  // Siatka kafelków — atlas jako katalog.
  atlas: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  // Suwaki — czytelniejsze w małym rozmiarze niż zębatka.
  settings: (
    <>
      <path d="M4 7h8M16 7h4M4 12h4M12 12h8M4 17h8M16 17h4" />
      <circle cx="14" cy="7" r="2.2" />
      <circle cx="10" cy="12" r="2.2" />
      <circle cx="14" cy="17" r="2.2" />
    </>
  ),
};

export function Icon({ name, size = 23 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
