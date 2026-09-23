import { useState } from 'react';
import { EX, GEAR_LABEL, STAGES, ex, gearOf } from '../data/exercises';
import { VIDEOS } from '../data/videos';
import { ANIM } from '../data/anim';
import { EX_JOKES } from '../data/exjokes';
import { AnimatedMannequin } from './Mannequin';
import { MODE_NAMES } from '../engine/hints';
import { P, exercisesByGroup, levelLabel, planLabel } from '../engine/plan';
import { exercisePath, go } from '../routing';
import { Chip } from './ui';
import { VideoEmbed } from './VideoEmbed';
import { SupportLine } from './Support';
import type { AppState, ExerciseId, Gear } from '../types';

/* ---------------- Spis ćwiczeń ---------------- */

/** Filtry sprzętu. „Wszystko” zostaje pierwsze, bo to domyślny widok. */
const GEAR_FILTERS: (Gear | 'all')[] = [
  'all',
  'kettlebell',
  'barbell',
  'dumbbell',
  'machine',
  'bodyweight',
];

export function AtlasView({ state }: { state: AppState }) {
  const groups = exercisesByGroup();
  const [gear, setGear] = useState<Gear | 'all'>('all');
  const match = (id: ExerciseId): boolean => gear === 'all' || gearOf(id) === gear;
  const shown = Object.entries(groups)
    .map(([g, ids]) => [g, ids.filter(match)] as const)
    .filter(([, ids]) => ids.length);
  const total = shown.reduce((n, [, ids]) => n + ids.length, 0);

  return (
    <>
      <div className="wrap">
        <h2>Atlas ćwiczeń</h2>
        <p className="lead">
          Każde ćwiczenie ma własną podstronę z opisem techniki, a te z pierwszej biblioteki także
          z filmami. Adres podstrony da się wysłać albo zapisać w zakładkach.
        </p>
        <div className="gearfilter">
          {GEAR_FILTERS.map((g) => (
            <button key={g} aria-pressed={gear === g} onClick={() => setGear(g)}>
              {g === 'all' ? 'wszystko' : GEAR_LABEL[g]}
            </button>
          ))}
        </div>
        <p className="tight" style={{ marginTop: 8 }}>
          {total} z {Object.values(groups).reduce((n, ids) => n + ids.length, 0)} ćwiczeń.
        </p>
      </div>
      {shown.map(([g, ids]) => (
        <div key={g}>
          <div className="sect-label">{g}</div>
          {ids.map((id) => {
            const v = VIDEOS[id];
            const count = (v?.main.length ?? 0) + (v?.kb.length ?? 0);
            return (
              <button className="atlas-row" key={id} onClick={() => go(exercisePath(id))}>
                <Chip state={state} id={id} />
                <div>
                  <div className="ex-name">{ex(id).name}</div>
                  <div className="ex-target">
                    {GEAR_LABEL[gearOf(id)]}
                    {' · '}
                    {levelLabel(state, id)}
                    {count > 0 && ` · ${count} ${count === 1 ? 'film' : count < 5 ? 'filmy' : 'filmów'}`}
                  </div>
                </div>
                <div className="go">→</div>
              </button>
            );
          })}
        </div>
      ))}
      <div className="wrap">
        <SupportLine seed={total} />
      </div>
    </>
  );
}

/* ---------------- Podstrona ćwiczenia ---------------- */

export function ExercisePage({ state, id }: { state: AppState; id: ExerciseId }) {
  const m = EX[id];

  if (!m) {
    return (
      <div className="wrap">
        <button className="back" onClick={() => go('#/cwiczenia')}>
          ← Atlas ćwiczeń
        </button>
        <div className="empty">Nie ma ćwiczenia o identyfikatorze „{id}”.</div>
      </div>
    );
  }

  const p = P(state, id);
  const move = ANIM[id];
  const videos = VIDEOS[id] ?? { main: [], kb: [] };
  const stages = m.stages ? STAGES[m.stages] : null;

  return (
    <>
      <div className="wrap">
        <button className="back" onClick={() => go('#/cwiczenia')}>
          ← Atlas ćwiczeń
        </button>
      </div>

      <div className="wrap">
        <div className="ex-hero">
          <Chip state={state} id={id} />
          <div>
            <div className="ex-group">
              {m.group} · {GEAR_LABEL[gearOf(id)]}
            </div>
            <h2 className="ex-h">{m.name}</h2>
            <div className="ex-target">{planLabel(state, id)}</div>
          </div>
        </div>
      </div>

      <div className="grp">
        <h3>Na co uważać</h3>
        <p>{m.hint}</p>
        {EX_JOKES[id] && <p className="exjoke">{EX_JOKES[id]}</p>}
        <p className="tight">
          Typ progresji: {MODE_NAMES[m.mode]}
          {m.side ? '. Powtórzenia liczone osobno na każdą stronę' : ''}.
        </p>
        <p className="tight">
          Jednostka: <b>{m.unit === 'secs' ? 'sekundy' : 'powtórzenia'}</b>
          {m.unit === 'secs' && ' — w sesji dostajesz stoper albo odliczanie'}. Sprzęt:{' '}
          <b>{GEAR_LABEL[gearOf(id)]}</b>.
        </p>
      </div>

      {stages && (
        <div className="grp">
          <h3>Etapy trudności</h3>
          <ol className="stages">
            {stages.map((s, i) => (
              <li key={s} className={i === (p.stage ?? 0) ? 'now' : i < (p.stage ?? 0) ? 'past' : ''}>
                {s}
                {i === (p.stage ?? 0) && <span className="badge">tutaj jesteś</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {move && (
        <>
          <div className="sect-label">Tor ruchu</div>
          <div className="grp">
            <AnimatedMannequin move={move} gear={gearOf(id)} />
            <p className="tight" style={{ marginTop: 10 }}>
              Sylwetka rysowana w aplikacji z kątów stawów — bez nagrań, bez reklam i bez
              zapytań na zewnątrz. Pokazuje tor ruchu i tempo, nie zastępuje instruktażu.
            </p>
          </div>
        </>
      )}

      <div className="sect-label">Jak to trenować — wideo</div>
      <div className="grp">
        {videos.main.length ? (
          <>
            <p className="tight">
              Najpopularniejsze nagrania techniki z YouTube, wybrane po liczbie wyświetleń i
              trafności. Odtwarzacz ładuje się dopiero po kliknięciu w miniaturę.
            </p>
            <div className="vids">
              {videos.main.map((v) => (
                <VideoEmbed key={v.id} video={v} />
              ))}
            </div>
          </>
        ) : (
          <p>
            Dla tego ćwiczenia nie ma jeszcze wybranych filmów. Tor ruchu wyżej i opis techniki
            wystarczą, żeby je poprawnie zaplanować.
          </p>
        )}
      </div>

      {videos.kb.length > 0 && (
        <>
          <div className="sect-label">To samo ćwiczenie z kettlebell</div>
          <div className="grp">
            <p className="tight">
              Nagrania pokazujące wariant z odważnikiem kulowym — chwyt, ustawienie ciężaru i
              różnice względem wersji podstawowej.
            </p>
            <div className="vids">
              {videos.kb.map((v) => (
                <VideoEmbed key={v.id} video={v} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="wrap">
        <p className="disclaimer">
          Filmy pochodzą od zewnętrznych autorów i nie są częścią tej aplikacji. Przy bólu lub kontuzji
          skonsultuj technikę ze specjalistą.
        </p>
      </div>
    </>
  );
}
