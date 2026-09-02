import { EX, STAGES, ex } from '../data/exercises';
import { VIDEOS } from '../data/videos';
import { MODE_NAMES } from '../engine/hints';
import { P, exercisesByGroup, levelLabel, planLabel } from '../engine/plan';
import { exercisePath, go } from '../routing';
import { Chip } from './ui';
import { VideoEmbed } from './VideoEmbed';
import type { AppState, ExerciseId } from '../types';

/* ---------------- Spis ćwiczeń ---------------- */

export function AtlasView({ state }: { state: AppState }) {
  const groups = exercisesByGroup();
  return (
    <>
      <div className="wrap">
        <h2>Atlas ćwiczeń</h2>
        <p className="lead">
          Każde ćwiczenie ma własną podstronę z filmami pokazującymi technikę. Adres podstrony da się
          wysłać albo zapisać w zakładkach.
        </p>
      </div>
      {Object.entries(groups).map(([g, ids]) => (
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
                    {count ? `${count} ${count === 1 ? 'film' : count < 5 ? 'filmy' : 'filmów'}` : 'brak filmów'}
                    {' · '}
                    {levelLabel(state, id)}
                  </div>
                </div>
                <div className="go">→</div>
              </button>
            );
          })}
        </div>
      ))}
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
            <div className="ex-group">{m.group}</div>
            <h2 className="ex-h">{m.name}</h2>
            <div className="ex-target">{planLabel(state, id)}</div>
          </div>
        </div>
      </div>

      <div className="grp">
        <h3>Na co uważać</h3>
        <p>{m.hint}</p>
        <p className="tight">
          Typ progresji: {MODE_NAMES[m.mode]}
          {m.side ? '. Powtórzenia liczone osobno na każdą stronę' : ''}.
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

      <div className="sect-label">Jak to trenować — wideo</div>
      <div className="grp">
        {videos.main.length ? (
          <>
            <p className="tight">
              Najpopularniejsze nagrania techniki z YouTube, wybrane po liczbie wyświetleń i
              trafności. Odtwarzacz ładuje się dopiero po kliknięciu.
            </p>
            <div className="vids">
              {videos.main.map((v) => (
                <VideoEmbed key={v.id} video={v} />
              ))}
            </div>
          </>
        ) : (
          <p>Dla tego ćwiczenia nie ma jeszcze wybranych filmów.</p>
        )}
      </div>

      {videos.kb.length > 0 && (
        <>
          <div className="sect-label">To samo ćwiczenie z kettlebell</div>
          <div className="grp">
            <p className="tight">
              Nagrania pokazujące wariant z odważnikiem kulowym — chwyt, ustawienie ciężaru i różnice
              względem wersji podstawowej.
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
