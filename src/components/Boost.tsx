import { boost } from '../engine/boost';
import { snapshot } from '../engine/snapshot';
import { snackAddPath, go } from '../routing';
import type { AppState } from '../types';
import { text } from '../i18n';

const T = text({
  pl: {
    title: 'Na postęp w dzień wolny',
    snack: 'Zapisz przekąskę',
    extra: 'Zacznij trening dodatkowy',
    hint: 'Wolne też pracuje — to w przerwie rośnie siła. Podpowiedź, nie obowiązek.',
  },
  en: {
    title: 'Progress on a rest day',
    snack: 'Log an exercise snack',
    extra: 'Start an extra workout',
    hint: 'Rest days work too — strength grows during the break. A suggestion, not an obligation.',
  },
});

/**
 * „Na postęp w dzień wolny”: przekąska albo lekki trening dodatkowy, gdy plan ma dziś
 * wolne. Stoi na zakładce Plan i na ekranie Dziś w dzień bez terminu. Pusty — nic nie stoi,
 * bo dzień bez podpowiedzi to też dobra odpowiedź.
 */
export function BoostCard({ state, today, onStart }: { state: AppState; today: string; onStart: (id: string) => void }) {
  const snap = snapshot(state, today);
  const tips = snap ? boost(state, snap, today) : [];
  if (!tips.length) return null;
  return (
    <div className="grp">
      <h2>{T.title}</h2>
      {tips.map((t) => (
        <div className="boost" key={`${t.kind}-${t.ex ?? t.workout}`}>
          <b>{t.title}</b>
          <p className="tight">{t.text}</p>
          {t.kind === 'snack' && t.ex && (
            <button className="btn sm ghost" onClick={() => go(snackAddPath(t.ex))}>
              {T.snack}
            </button>
          )}
          {t.kind === 'extra' && t.workout && (
            <button className="btn sm ghost" onClick={() => onStart(t.workout!)}>
              {T.extra}
            </button>
          )}
        </div>
      ))}
      <p className="hint">{T.hint}</p>
    </div>
  );
}
