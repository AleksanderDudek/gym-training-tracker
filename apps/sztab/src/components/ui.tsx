import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Area } from '@gymtracker/link';
import { text } from '@gt/i18n';
import { L } from '../lib/labels';
import { linkClick } from '../lib/router';

const T = text({
  pl: { close: 'Zamknij', loading: 'Wczytuję…', retry: 'Spróbuj ponownie' },
  en: { close: 'Close', loading: 'Loading…', retry: 'Try again' },
});

export function Link({ to, children, className, current }: { to: string; children: ReactNode; className?: string; current?: boolean }) {
  return (
    <a href={to} className={className} aria-current={current ? 'page' : undefined} onClick={(e) => linkClick(e, to)}>
      {children}
    </a>
  );
}

export function AreaChips({ areas }: { areas: readonly Area[] }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      {areas.map((a) => (
        <span key={a} className={`chip ${a}`}>
          {L.area[a]}
        </span>
      ))}
    </span>
  );
}

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.x)')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="x" aria-label={T.close} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading() {
  return <p className="soft" role="status">{T.loading}</p>;
}

export function Failure({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="note warn" role="alert">
      <span>{error}</span>
      {retry ? (
        <button type="button" className="btn link" onClick={retry}>
          {T.retry}
        </button>
      ) : null}
    </div>
  );
}

/** Wczytanie z ponowieniem: `data`, `error`, `reload`. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): { data: T | undefined; error: string | null; reload: () => void } {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    load().then(
      (d) => alive && setData(d),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, reload: () => setN((x) => x + 1) };
}

let toastSet: ((s: string | null) => void) | null = null;
export const toast = (msg: string) => toastSet?.(msg);

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setMsg;
    return () => {
      toastSet = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

/** „2 godz. temu” — słowa o czasie, jak w stanie zegarka w GYM TRACKERze. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(document.documentElement.lang || 'pl', { numeric: 'auto' });
  if (min < 1) return rtf.format(0, 'minute');
  if (min < 60) return rtf.format(-min, 'minute');
  const h = Math.round(min / 60);
  if (h < 36) return rtf.format(-h, 'hour');
  return rtf.format(-Math.round(h / 24), 'day');
}

export const fmtDate = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
