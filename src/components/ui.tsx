import { useEffect, useState, type ReactNode } from 'react';
import { STAGES, ex, kbColor } from '../data/exercises';
import { P } from '../engine/plan';
import type { AppState, ExerciseId, HistoryPoint, Notice } from '../types';

/* ---------------- Modal ---------------- */

export interface ModalRequest {
  title: string;
  body: ReactNode;
  ok: string;
  cancel?: string;
  resolve: (v: boolean) => void;
}

export function Modal({ req }: { req: ModalRequest | null }) {
  if (!req) return null;
  return (
    <div id="modal" role="dialog" aria-modal="true">
      <div className="mbox">
        <h3>{req.title}</h3>
        <div className="mtext">{req.body}</div>
        <div className="btnrow">
          {req.cancel && (
            <button className="btn ghost" onClick={() => req.resolve(false)}>
              {req.cancel}
            </button>
          )}
          <button className="btn" autoFocus onClick={() => req.resolve(true)}>
            {req.ok}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Toast ---------------- */

export function Toast({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

/* ---------------- Banner ---------------- */

export function Banner({ notice }: { notice: Notice }) {
  return (
    <div className={`banner${notice.level === 'good' ? ' good' : ''}`}>
      <h4>{notice.title}</h4>
      <p>{notice.text}</p>
    </div>
  );
}

/* ---------------- Kafelek ciężaru ---------------- */

export function Chip({ state, id }: { state: AppState; id: ExerciseId }) {
  const p = P(state, id);
  const m = ex(id);

  if (m.mode === 'stage' && m.stages) {
    return (
      <div className="chip bw">
        <span className="n">
          ETAP
          <br />
          {(p.stage ?? 0) + 1}
        </span>
      </div>
    );
  }
  if (p.weight === null) {
    return (
      <div className="chip bw">
        <span className="n">
          MASA
          <br />
          CIAŁA
        </span>
      </div>
    );
  }
  if (p.trans) {
    return (
      <div className="chip" style={{ background: kbColor(p.weight) }}>
        <span className="split">
          <i />
          <i style={{ background: kbColor(p.trans.to) }} />
        </span>
        <span className="lbl">
          <span className="n">
            {p.weight}/{p.trans.to}
          </span>
          <span className="u">KG</span>
        </span>
      </div>
    );
  }
  return (
    <div className="chip" style={{ background: kbColor(p.weight) }}>
      <span className="n">{p.weight}</span>
      <span className="u">KG</span>
    </div>
  );
}

export const stageLabel = (id: ExerciseId, stage: number): string => {
  const s = ex(id).stages;
  return s ? (STAGES[s][stage] ?? '') : '';
};

/* ---------------- Przełącznik segmentowy ---------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.key} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Wykres szacowanego maksimum ---------------- */

export function Sparkline({ hist }: { hist: HistoryPoint[] }) {
  const pts = hist
    .filter((h): h is HistoryPoint & { e1rm: number } => h.e1rm !== null)
    .slice(-14)
    .map((h) => h.e1rm);
  if (pts.length < 3) return null;

  const w = 64;
  const h = 18;
  const mn = Math.min(...pts);
  const range = Math.max(...pts) - mn || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - mn) / range) * h}`).join(' ');

  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={d} fill="none" stroke="var(--steel)" strokeWidth="1.5" />
    </svg>
  );
}

/* ---------------- Hook okna dialogowego ---------------- */

export function useModal() {
  const [req, setReq] = useState<ModalRequest | null>(null);

  const open = (title: string, body: ReactNode, ok: string, cancel?: string): Promise<boolean> =>
    new Promise((resolve) => {
      setReq({
        title,
        body,
        ok,
        cancel,
        resolve: (v) => {
          setReq(null);
          resolve(v);
        },
      });
    });

  return {
    req,
    say: (title: string, body: ReactNode) => open(title, body, 'OK'),
    ask: (title: string, body: ReactNode, ok = 'Tak') => open(title, body, ok, 'Anuluj'),
  };
}
