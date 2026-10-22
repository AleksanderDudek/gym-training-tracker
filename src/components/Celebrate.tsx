import { useEffect } from 'react';
import { BAND_NAME, BadgeMedal, bandFor } from './BadgeArt';
import { formatTier } from '../engine/badges';
import { CHEERS, pick } from '../engine/quips';
import type { AchievementHit } from '../types';
import { text } from '../i18n';

const T = text({
  pl: {
    tier: (n: number, of: number) => `próg ${n} z ${of}`,
    oneOff: 'odznaka jednorazowa',
    sameSession: 'W tej samej sesji',
    more: (n: number) => `…i jeszcze ${n}. Cała półka jest w zakładce Osiągnięcia.`,
  },
  en: {
    tier: (n: number, of: number) => `tier ${n} of ${of}`,
    oneOff: 'one-off badge',
    sameSession: 'In the same session',
    more: (n: number) => `…and ${n} more. The whole shelf is in the Achievements tab.`,
  },
});

/**
 * Moment odblokowania. Lista punktowana odnotowuje fakt; medal, który wjeżdża z promieniami
 * i konfetti, zostaje w pamięci — a o to w odznakach chodzi. Najwyższe zdobyte pasmo dostaje
 * scenę, reszta ustawia się pod spodem, bo dwanaście równorzędnych gratulacji to już hałas.
 *
 * Ruch jest w całości wyłączany przy `prefers-reduced-motion`; wtedy zostaje sam medal,
 * bez animacji i bez konfetti.
 */

const CONFETTI = 18;
// Konfetti w palecie Claude — te same trzy akcenty, co na medalach i w ikonach.
const COLORS = ['#D97757', '#6A9BCC', '#788C5D', '#D9A157', '#B0AEA5', '#94452C'];

const tierLabel = (h: AchievementHit): string =>
  h.ach.tiers.length > 1 ? T.tier(h.tier, h.ach.tiers.length) : T.oneOff;

export function Celebrate({
  hits,
  context = T.sameSession,
}: {
  hits: AchievementHit[];
  /** Podpis nad resztą medali — po przekąsce to nie była sesja. */
  context?: string;
}) {
  // Najwyższe pasmo na scenę: zdobycie złota nie może zniknąć pod brązem tylko dlatego,
  // że brąz wpadł pierwszy w kolejności rodzin.
  const ranked = [...hits].sort(
    (a, b) => bandFor(b.tier, b.ach.tiers.length) - bandFor(a.tier, a.ach.tiers.length),
  );
  const hero = ranked[0]!;
  const rest = ranked.slice(1, 5);
  const band = bandFor(hero.tier, hero.ach.tiers.length);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([16, 38, 16, 38, 70]);
  }, []);

  return (
    <div className="celebrate">
      <div className="cel-stage">
        <svg className="cel-rays" viewBox="0 0 200 200" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d="M100 100 L92 6 L108 6 Z"
              fill="currentColor"
              opacity={i % 2 ? 0.16 : 0.3}
              transform={`rotate(${i * 30} 100 100)`}
            />
          ))}
        </svg>
        <div className="cel-pop">
          <BadgeMedal art={hero.ach.art} mark={hero.ach.mark} band={band} size={104} />
        </div>
        <div className="cel-confetti" aria-hidden="true">
          {Array.from({ length: CONFETTI }, (_, i) => (
            <i
              key={i}
              style={{
                // Kąt i dystans rozrzucone deterministycznie — losowość przy każdym renderze
                // powodowałaby przeskok konfetti w trakcie animacji.
                '--a': `${(i * 360) / CONFETTI + (i % 3) * 7}deg`,
                '--d': `${64 + ((i * 37) % 46)}px`,
                '--t': `${(i % 5) * 60}ms`,
                background: COLORS[i % COLORS.length],
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <div className="cel-band">{BAND_NAME[band]}</div>
      <h4 className="cel-name">{hero.ach.name}</h4>
      <p className="cel-sub">
        {tierLabel(hero)} · {formatTier(hero.ach, hero.threshold)}
      </p>
      <p className="cel-desc">{hero.ach.desc}</p>
      {/* Puenta rodziny jest celniejsza od uniwersalnej — ta druga wchodzi tylko awaryjnie. */}
      <p className="cel-quip">
        {hero.ach.quip || pick(CHEERS, hero.tier + hero.ach.tiers.length + hits.length)}
      </p>

      {rest.length > 0 && (
        <div className="cel-more">
          <div className="cel-more-label">
            {hits.length === rest.length + 1 ? context : `${context} (${hits.length - 1})`}
          </div>
          <div className="cel-row">
            {rest.map((h, i) => (
              <div className="cel-mini" key={`${h.ach.id}:${h.tier}`} style={{ animationDelay: `${180 + i * 90}ms` }}>
                <BadgeMedal
                  art={h.ach.art}
                  mark={h.ach.mark}
                  band={bandFor(h.tier, h.ach.tiers.length)}
                  size={40}
                />
                <span>{h.ach.name}</span>
              </div>
            ))}
          </div>
          {hits.length > rest.length + 1 && (
            <p className="cel-rest">{T.more(hits.length - rest.length - 1)}</p>
          )}
        </div>
      )}
    </div>
  );
}
