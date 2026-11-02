import { useEffect, useId, useRef, useState } from 'react';
import { NOTE_MAX, cleanNote } from '../engine/notes';
import { EX } from '../data/exercises';
import { LOCALE, text } from '../i18n';
import type { ExerciseId, LogEntry } from '../types';
import { Icon } from './icons';

const T = text({
  pl: {
    lastOn: (date: string) => `Ostatnio (${date})`,
    add: 'Notatka',
    edit: 'Zmień notatkę',
    exLabel: (name: string) => `Notatka do ćwiczenia: ${name}`,
    save: 'Zapisz notatkę',
    cancel: 'Anuluj',
    count: (n: number, max: number) => `${n} z ${max} znaków`,
    workoutLabel: 'Notatka do treningu',
    workoutHint: 'Na przykład: po nocce, siłownia pełna, nowe buty. Zapisze się sama.',
    saved: 'Zapisane',
    history: 'Notatki',
    historyEdit: 'Zmień notatki',
    historyAria: (name: string, date: string) => `Notatki treningu ${name} z ${date}`,
    saveAll: 'Zapisz notatki',
  },
  en: {
    lastOn: (date: string) => `Last time (${date})`,
    add: 'Note',
    edit: 'Edit note',
    exLabel: (name: string) => `Note for ${name}`,
    save: 'Save note',
    cancel: 'Cancel',
    count: (n: number, max: number) => `${n} of ${max} characters`,
    workoutLabel: 'Workout note',
    workoutHint: 'For example: after a night shift, busy gym, new shoes. It saves by itself.',
    saved: 'Saved',
    history: 'Notes',
    historyEdit: 'Edit notes',
    historyAria: (name: string, date: string) => `Notes for ${name} on ${date}`,
    saveAll: 'Save notes',
  },
});

/**
 * Notatki w sesji i w historii: „Ostatnio: …” przy ćwiczeniu, ołówek otwierający pole i pole
 * notatki treningu w podsumowaniu. Teksty i limit z `engine/notes.ts`.
 */

const shortDate = (iso: string): string => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'numeric' });

/** „Ostatnio (12.10): wyżej siodełko” — notatka z poprzedniej sesji tego ćwiczenia. */
export function LastNote({ note, clamp = false }: { note: { note: string; date: string } | null; clamp?: boolean }) {
  if (!note) return null;
  return (
    <p className={`note-last${clamp ? ' clamp' : ''}`}>
      <b>{T.lastOn(shortDate(note.date))}:</b> {note.note}
    </p>
  );
}

/** Licznik znaków pod polem — tekst, nie tylko kolor. */
const counter = (v: string): string => T.count([...v].length, NOTE_MAX);

/**
 * Notatka ćwiczenia za ołówkiem: zwinięta to jeden mały przycisk (z treścią, gdy już jest),
 * rozwinięta — pole, „Zapisz notatkę” i „Anuluj”. Nie stoi w drodze „Zrobione”: miejsce daje
 * jej ekran, który ją wywołuje, zawsze pod głównym przyciskiem.
 */
export function NoteEditor({
  value,
  name,
  onSave,
}: {
  value: string;
  /** Nazwa ćwiczenia — do etykiety pola. */
  name: string;
  onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const id = useId();

  if (!open)
    return (
      <div className="note-ed">
        {value && <p className="note-now">{value}</p>}
        <button
          type="button"
          className="btn ghost sm note-btn"
          aria-label={value ? `${T.edit}: ${name}` : T.exLabel(name)}
          onClick={() => {
            setDraft(value);
            setOpen(true);
          }}
        >
          <Icon name="note" size={18} />
          <span>{value ? T.edit : T.add}</span>
        </button>
      </div>
    );

  return (
    <div className="note-ed open">
      <label className="note-fld" htmlFor={id}>
        {T.exLabel(name)}
      </label>
      <textarea
        id={id}
        className="note-area"
        rows={3}
        maxLength={NOTE_MAX}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
      />
      <p className="note-count">{counter(draft)}</p>
      <div className="btnrow">
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            onSave(cleanNote(draft) ?? '');
            setOpen(false);
          }}
        >
          {T.save}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
          {T.cancel}
        </button>
      </div>
    </div>
  );
}

/**
 * Notatka całego treningu w podsumowaniu po zamknięciu. Pole stoi od razu (podsumowanie zamyka
 * się jednym „OK”, więc ołówek byłby krokiem, którego nikt by nie zrobił) i zapisuje się samo
 * przy wyjściu z pola — także wtedy, gdy wyjściem jest stuknięcie w „OK”.
 */
export function WorkoutNote({ initial = '', onSave }: { initial?: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const id = useId();
  // Okno zamknięte bez wyjścia z pola (Escape, nawigacja) nie wywoła `blur` — wtedy zapis
  // idzie przy odmontowaniu, z ostatniej wersji tekstu.
  // Tekst i `onSave` trafiają do refa w efekcie, nie w renderze. Ostatni zapis wpisuje do niego
  // tylko `store` — od razu, żeby odmontowanie tuż po `blur` (stuknięcie w „OK”) nie zapisało
  // tego samego drugi raz.
  const latest = useRef({ v, saved, onSave });
  useEffect(() => {
    latest.current = { ...latest.current, v, onSave };
  });
  useEffect(
    () => () => {
      const { v: last, saved: was, onSave: save } = latest.current;
      const n = cleanNote(last) ?? '';
      if (n !== was) save(n);
    },
    [],
  );
  const store = () => {
    const n = cleanNote(v) ?? '';
    if (n !== latest.current.saved) {
      onSave(n);
      latest.current = { ...latest.current, saved: n };
      setSaved(n);
    }
  };
  return (
    <div className="note-ed open note-workout">
      <label className="note-fld" htmlFor={id}>
        <Icon name="note" size={16} /> {T.workoutLabel}
      </label>
      <textarea
        id={id}
        className="note-area"
        rows={2}
        maxLength={NOTE_MAX}
        value={v}
        placeholder={T.workoutHint}
        onChange={(e) => setV(e.target.value)}
        onBlur={store}
      />
      <p className="note-count" aria-live="polite">
        {counter(v)}
        {saved && saved === (cleanNote(v) ?? '') ? ` · ${T.saved}` : ''}
      </p>
    </div>
  );
}

/**
 * Notatki zapisanego treningu w historii: notatka całości i każdego ćwiczenia naraz, za jednym
 * ołówkiem. Zapis dopiero po „Zapisz notatki” — w historii nic nie zmienia się przypadkiem.
 */
export function LogNotesEditor({
  entry,
  name,
  onSave,
}: {
  entry: LogEntry;
  /** Nazwa treningu w języku wizyty — do etykiety. */
  name: string;
  onSave: (notes: { note: string; items: Record<ExerciseId, string> }) => void;
}) {
  const [open, setOpen] = useState(false);
  const fresh = () => ({
    note: entry.note ?? '',
    items: Object.fromEntries(entry.items.map((i) => [i.id, i.note ?? ''])) as Record<ExerciseId, string>,
  });
  const [draft, setDraft] = useState(fresh);
  const base = useId();
  const any = !!entry.note || entry.items.some((i) => i.note);

  if (!open)
    return (
      <button
        type="button"
        className="btn ghost sm note-btn"
        aria-label={T.historyAria(name, shortDate(entry.date))}
        onClick={() => {
          setDraft(fresh());
          setOpen(true);
        }}
      >
        <Icon name="note" size={18} />
        <span>{any ? T.historyEdit : T.history}</span>
      </button>
    );

  return (
    <div className="note-ed open">
      <label className="note-fld" htmlFor={`${base}-w`}>
        {T.workoutLabel}
      </label>
      <textarea
        id={`${base}-w`}
        className="note-area"
        rows={2}
        maxLength={NOTE_MAX}
        value={draft.note}
        autoFocus
        onChange={(e) => setDraft({ ...draft, note: e.target.value })}
      />
      {entry.items.map((i, n) => (
        <div key={`${i.id}-${n}`}>
          <label className="note-fld" htmlFor={`${base}-${n}`}>
            {T.exLabel(EX[i.id]?.name ?? i.id)}
          </label>
          <textarea
            id={`${base}-${n}`}
            className="note-area"
            rows={2}
            maxLength={NOTE_MAX}
            value={draft.items[i.id] ?? ''}
            onChange={(e) => setDraft({ ...draft, items: { ...draft.items, [i.id]: e.target.value } })}
          />
        </div>
      ))}
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            onSave(draft);
            setOpen(false);
          }}
        >
          {T.saveAll}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
          {T.cancel}
        </button>
      </div>
    </div>
  );
}
