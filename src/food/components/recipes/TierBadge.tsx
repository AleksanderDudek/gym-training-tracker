import { CookingPot, Timer, Zap } from 'lucide-react';
import { TIER_LABELS, type TimeTier } from '../../recipes/tiers';

const ICONS = { szybkie: Zap, chwila: Timer, dluzej: CookingPot } as const;

/** Ikona grupy czasu. Błyskawica szybkich jest wypełniona, więc widać ją od razu. */
export function TierIcon({ tier, size = 16 }: { tier: TimeTier; size?: number }) {
  const Icon = ICONS[tier];
  return <Icon className={`fd-rec-tier-icon fd-rec-${tier}`} size={size} strokeWidth={2} aria-hidden />;
}

/**
 * Grupa czasu przepisu. Szybkie to te, po które przychodzi się w biegu, więc tylko one się
 * wyróżniają (złoty akcent i błyskawica); pozostałe to spokojna etykieta. Nazwa grupy zawsze
 * stoi słowem — kolor i ikona tylko ją wzmacniają.
 */
export function TierBadge({ tier }: { tier: TimeTier }) {
  return (
    <span className={`fd-rec-tier fd-rec-${tier}`}>
      <TierIcon tier={tier} />
      {TIER_LABELS[tier]}
    </span>
  );
}
