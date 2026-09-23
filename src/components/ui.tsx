import { useEffect, useState, type ReactNode } from 'react';
import { STAGES, ex, kbColor, kbInkIsLight } from '../data/exercises';
import { P } from '../engine/plan';
import { Gorilla } from './Gorilla';
import type { CoachMood, TraineeMood, Who } from './Gorilla';
import type { AppState, ExerciseId, HistoryPoint, Notice } from '../types';

/**
 * Kto reaguje na dany komunikat. Postać nigdy nie niesie informacji sama — obok niej
 * stoi to samo słowem, więc czytnik ekranu i osoba nierozróżniająca min dostają tyle samo.
 */
export interface Cast {
  who: Who;
  mood: TraineeMood | CoachMood;
}

/* ---------------- Modal ---------------- */

export interface ModalRequest {
  title: string;
  body: ReactNode;
  ok: string;
  cancel?: string;
  /** Wariant okna — np. `celebrate-box` wyśrodkowuje całość na moment zdobycia odznaki. */
  tone?: string;
  /** Postać nad tytułem. Brak oznacza okno bez obsady — tak jak przy zwykłym pytaniu. */
  cast?: Cast;
  resolve: (v: boolean) => void;
}

export function Modal({ req }: { req: ModalRequest | null }) {
  if (!req) return null;
  return (
    <div id="modal" role="dialog" aria-modal="true">
      <div className={`mbox${req.tone ? ` ${req.tone}` : ''}${req.cast ? ' with-cast' : ''}`}>
        {req.cast && (
          <span className="cast-bust" aria-hidden="true">
            <Gorilla who={req.cast.who} mood={req.cast.mood} size={120} />
          </span>
        )}
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

export function Toast({
  msg,
  onDone,
  cast = { who: 'gustaw', mood: 'content' },
}: {
  msg: string | null;
  onDone: () => void;
  cast?: Cast;
}) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return (
    <div className="toast with-cast">
      <span className="cast-face" aria-hidden="true">
        <Gorilla who={cast.who} mood={cast.mood} crop="face" size={30} />
      </span>
      <span>{msg}</span>
    </div>
  );
}

/* ---------------- Banner ---------------- */

/**
 * Ostrzeżenie mówi trener — spokojnie, nigdy z pretensją. Dobra wiadomość to radość
 * podopiecznego. Tytuł i tak nazywa rzecz po imieniu, więc mina jest dodatkiem.
 */
export function Banner({ notice, who = 'gustaw' }: { notice: Notice; who?: 'gustaw' | 'gosia' }) {
  const cast: Cast =
    notice.level === 'good' ? { who, mood: 'happy' } : { who: 'siwy', mood: 'wise' };
  return (
    <div className={`banner with-cast${notice.level === 'good' ? ' good' : ''}`}>
      <span className="cast-face" aria-hidden="true">
        <Gorilla who={cast.who} mood={cast.mood} crop="face" size={44} />
      </span>
      <div>
        <h4>{notice.title}</h4>
        <p>{notice.text}</p>
      </div>
    </div>
  );
}

/* ---------------- Pusty stan ---------------- */

/**
 * Pusta lista z postacią. Zaprasza, nigdy nie wyrzuca: jedno zdanie i jedno wyjście.
 * Domyślnie tęskni podopieczny; pusty plan wita spokojny trener.
 */
export function EmptyState({
  title,
  text,
  action,
  cast = { who: 'gustaw', mood: 'longing' },
}: {
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  cast?: Cast;
}) {
  return (
    <div className="empty with-cast">
      <Gorilla who={cast.who} mood={cast.mood} size={132} />
      <b className="empty-title">{title}</b>
      {text && <span className="empty-text">{text}</span>}
      {action && <span className="empty-action">{action}</span>}
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
    // Przejście dzieli kafelek na dwa kolory, więc jeden kolor napisu nie zadziała na obu.
    // Numer idzie wtedy na własnej, stalowej etykiecie — czytelnej na każdym tle.
    return (
      <div className="chip dark" style={{ background: kbColor(p.weight) }}>
        <span className="split">
          <i />
          <i style={{ background: kbColor(p.trans.to) }} />
        </span>
        <span className="lbl plate">
          <span className="n">
            {p.weight}/{p.trans.to}
          </span>
          <span className="u">KG</span>
        </span>
      </div>
    );
  }
  return (
    <div
      className={`chip${kbInkIsLight(p.weight) ? ' dark' : ''}`}
      style={{ background: kbColor(p.weight) }}
    >
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

/* ---------------- Wykres historii ćwiczenia ---------------- */

/**
 * Większy brat `Sparkline`. Tamten stoi w wierszu listy i ma pokazać kształt; ten stoi
 * na podstronie i ma pozwolić odczytać wartości, więc dostaje skrajne liczby pod spodem,
 * kropki na punktach i zdanie w `aria-label` — czytnik ekranu nie zobaczy linii, ale
 * usłyszy, skąd dokąd ona idzie.
 */
export function Trendline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;

  const w = 320;
  const h = 96;
  const pad = 8;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  // Płaski ciąg podzieliłby przez zero, a narysowany w połowie wysokości czyta się uczciwiej
  // niż linia przyklejona do dolnej krawędzi.
  const range = mx - mn || 1;
  const x = (i: number): number => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number): number => h - pad - ((v - mn) / range) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);

  return (
    <div className="trendbox">
      <svg
        className="trendline"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${label}: od ${values[0]} do ${values[values.length - 1]}, najniżej ${mn}, najwyżej ${mx}, ${values.length} sesji.`}
      >
        <polygon className="area" points={`${pts.join(' ')} ${w - pad},${h} ${pad},${h}`} />
        <polyline className="line" points={pts.join(' ')} />
        {values.map((v, i) => (
          <circle className="dot" key={i} cx={x(i)} cy={y(v)} r={mx === mn ? 2 : 2.6} />
        ))}
      </svg>
      <div className="trend-scale">
        <span>{label}</span>
        <span>
          {mn} – {mx}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Hook okna dialogowego ---------------- */

export function useModal() {
  const [req, setReq] = useState<ModalRequest | null>(null);

  const open = (
    title: string,
    body: ReactNode,
    ok: string,
    cancel?: string,
    tone?: string,
    cast?: Cast,
  ): Promise<boolean> =>
    new Promise((resolve) => {
      setReq({
        title,
        body,
        ok,
        cancel,
        tone,
        cast,
        resolve: (v) => {
          setReq(null);
          resolve(v);
        },
      });
    });

  return {
    req,
    say: (title: string, body: ReactNode, opts?: { ok?: string; tone?: string; cast?: Cast }) =>
      open(title, body, opts?.ok ?? 'OK', undefined, opts?.tone, opts?.cast),
    ask: (title: string, body: ReactNode, ok = 'Tak', cast?: Cast) =>
      open(title, body, ok, 'Anuluj', undefined, cast),
  };
}
