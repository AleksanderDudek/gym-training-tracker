import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { EX, GEAR_LABEL, gearOf } from '../data/exercises';
import { ALPHABETICAL, findExercises, splitHits } from '../engine/find';
import { plural } from '../engine/quips';
import type { ExerciseId } from '../types';

/**
 * Wybór ćwiczenia z podpowiedziami.
 *
 * Zwykły `select` ze stu pięcioma pozycjami w siedmiu grupach kazał przewijać, a na telefonie
 * nie dało się w nim pisać. Tu pole zachowuje się jak wyszukiwarka: po wejściu pokazuje całą
 * listę alfabetycznie, ustawioną na bieżącym ćwiczeniu, a każda wpisana litera ją zawęża.
 *
 * `datalist` byłby krótszy, ale na telefonach zachowuje się każdy inaczej, nie da się go
 * ostylować, a polskie ogonki dopasowuje albo nie — zależnie od przeglądarki. Ten komponent
 * trzyma się wzorca combobox z wytycznych WAI-ARIA: strzałki chodzą po liście, Enter wybiera,
 * Escape zamyka i przywraca poprzedni wybór, a czytnik ekranu słyszy, ile jest wyników.
 */
export function ExercisePicker({
  value,
  onChange,
  label,
}: {
  value: ExerciseId;
  onChange: (id: ExerciseId) => void;
  label: string;
}) {
  const uid = useId();
  const inputId = `${uid}-in`;
  const listId = `${uid}-list`;
  const optId = (id: ExerciseId): string => `${uid}-opt-${id}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const found = open ? findExercises(query) : [];
  const current = EX[value]?.name ?? '';
  const activeId = found[active]?.id;

  // Podświetlona pozycja zawsze w polu widzenia — także po wejściu, gdy lista staje
  // na bieżącym ćwiczeniu gdzieś w połowie alfabetu.
  useEffect(() => {
    if (!open || !activeId) return;
    const el = document.getElementById(optId(activeId));
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeId]);

  const openList = () => {
    setQuery('');
    setActive(Math.max(0, ALPHABETICAL.indexOf(value)));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (id: ExerciseId) => {
    close();
    if (id !== value) onChange(id);
    // Fokus zostaje w polu, a nazwa jest zaznaczona: kolejna litera zaczyna nowe szukanie,
    // zamiast doklejać się do wybranej nazwy.
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => Math.min(found.length - 1, Math.max(0, a + step)));
      return;
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (activeId) choose(activeId);
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') close();
  };

  return (
    <div className="picker">
      <label className="picker-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="picker-box">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeId ? optId(activeId) : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          // Po wejściu pole jest puste, a obecne ćwiczenie stoi w podpowiedzi — pisze się od razu,
          // bez kasowania nazwy literka po literce.
          placeholder={open ? `${current} — wpisz, żeby zawęzić` : 'Wpisz nazwę ćwiczenia'}
          value={open ? query : current}
          onFocus={openList}
          onClick={() => !open && openList()}
          onBlur={close}
          onChange={(e) => {
            // Przy zamkniętej liście w polu stoi nazwa wybranego ćwiczenia. Jeśli ktoś pisze
            // za nią, zamiast ją zastąpić, szukamy tylko tego, co dopisał.
            const v = e.target.value;
            setQuery(!open && v.startsWith(current) ? v.slice(current.length) : v);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKey}
        />
        <span className="picker-caret" aria-hidden="true">
          ▾
        </span>
      </div>

      {open && (
        <ul className="picker-list" id={listId} role="listbox" aria-label={label}>
          {found.length ? (
            found.map((f, i) => {
              const name = EX[f.id]!.name;
              return (
                <li
                  key={f.id}
                  id={optId(f.id)}
                  role="option"
                  aria-selected={i === active}
                  className={`picker-opt${f.id === value ? ' current' : ''}`}
                  // Wciśnięcie nie może zabrać pola fokusu — blur zamknąłby listę przed kliknięciem.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => choose(f.id)}
                >
                  <span className="picker-name">
                    {splitHits(name, f.hits).map((p, k) =>
                      p.on ? <mark key={k}>{p.text}</mark> : <span key={k}>{p.text}</span>,
                    )}
                    {f.id === value && <span className="picker-now"> · wybrane</span>}
                  </span>
                  <span className="picker-sub">
                    {EX[f.id]!.group} · {GEAR_LABEL[gearOf(f.id)]}
                  </span>
                </li>
              );
            })
          ) : (
            <li className="picker-empty" role="option" aria-selected={false} aria-disabled="true">
              Nic nie pasuje do „{query.trim()}”. Spróbuj początku nazwy, np. „pomp” albo „przys”.
            </li>
          )}
        </ul>
      )}

      <span className="sr-only" aria-live="polite">
        {open ? `${found.length} ${plural(found.length, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])}` : ''}
      </span>
    </div>
  );
}
