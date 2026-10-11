import type { MouseEvent } from 'react';
import { sectionHref } from '../routing';
import type { SectionLink } from '../routing';

/**
 * Przełącznik sekcji zakładki: Plan · Treningi · Ćwiczenia albo Dziennik · Przepisy · Produkty ·
 * W pobliżu. Odnośniki, a nie przyciski: każda sekcja ma własny adres, więc „wstecz” wraca do
 * poprzedniej sekcji, a adres da się zapisać i wysłać. Wygląda jak przełącznik segmentowy, bo
 * tak działa — jedna pozycja jest zawsze wybrana, a sekcje leżą obok siebie, nie w głąb.
 *
 * Każda pozycja prowadzi do ostatniego adresu swojej sekcji, z zapytaniem: z produktów do
 * przepisów i z powrotem — wyszukiwanie i filtry czekają, jak w Produktach PL.
 *
 * Stuknięcie w sekcję, na której się jest, nic nie robi — jak w każdym przełączniku. Inaczej
 * zapamiętany adres podmieniłby bieżący stan strony starszym.
 */
export function Sections({
  'aria-label': label,
  items,
  current,
}: {
  'aria-label': string;
  items: readonly SectionLink[];
  /** Ścieżka bieżącej sekcji, bez zapytania. */
  current: string;
}) {
  const stay = (e: MouseEvent<HTMLAnchorElement>) => e.preventDefault();
  return (
    // `data-n`: cztery pozycje na ekranie 320 px potrzebują ciaśniejszego kroju niż dwie czy trzy.
    <nav className="seg sect-switch" aria-label={label} data-n={items.length}>
      {items.map((s) => {
        const on = s.path === current;
        return (
          <a key={s.path} href={on ? s.path : sectionHref(s.path)} aria-current={on ? 'page' : undefined} onClick={on ? stay : undefined}>
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}
