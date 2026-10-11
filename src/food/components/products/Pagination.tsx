import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { formatNumber } from '../../lib/format';

interface Props {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

/** Pierwsza, ostatnia i `near` stron po obu stronach bieżącej, z przerwami oznaczonymi „…”. */
export function pageNumbers(page: number, pageCount: number, near = 2): (number | 'gap')[] {
  const wanted = new Set([1, pageCount, page]);
  for (let d = 1; d <= near; d++) {
    wanted.add(page - d);
    wanted.add(page + d);
  }
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  for (const p of pages) {
    const last = out[out.length - 1];
    if (typeof last === 'number' && p - last > 1) out.push('gap');
    out.push(p);
  }
  return out;
}

const NARROW = '(min-width: 400px)';
const WIDE = '(min-width: 560px)';

/** Nasłuch zmian szerokości — w zasięgu modułu, żeby React nie zapisywał się od nowa przy każdym renderze. */
function subscribeWidth(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const queries = [window.matchMedia(NARROW), window.matchMedia(WIDE)];
  for (const q of queries) q.addEventListener('change', onChange);
  return () => {
    for (const q of queries) q.removeEventListener('change', onChange);
  };
}

/**
 * Ile sąsiednich stron mieści się w rzędzie przy 44 px na przycisk: na telefonie 320–399 px
 * tylko bieżąca (z pierwszą i ostatnią), do 559 px po jednej z każdej strony, szerzej — jak
 * w Produktach PL, po dwie. Bez `matchMedia` (testy) — pełny rząd.
 */
function neighboursNow(): number {
  if (typeof window.matchMedia !== 'function') return 2;
  if (window.matchMedia(WIDE).matches) return 2;
  return window.matchMedia(NARROW).matches ? 1 : 0;
}

const neighboursOnServer = () => 2;

export function Pagination({ page, pageCount, onPage }: Props) {
  const near = useSyncExternalStore(subscribeWidth, neighboursNow, neighboursOnServer);
  if (pageCount <= 1) return null;

  return (
    <nav className="fd-pages" aria-label="Strony wyników">
      <button type="button" className="fd-page-step" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Poprzednia strona">
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      {pageNumbers(page, pageCount, near).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="fd-page-gap" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Strona ${formatNumber(p, 0)}`}
          >
            {formatNumber(p, 0)}
          </button>
        ),
      )}
      <button
        type="button"
        className="fd-page-step"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        aria-label="Następna strona"
      >
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </button>
    </nav>
  );
}
