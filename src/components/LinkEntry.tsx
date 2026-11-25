import { linkConfigured } from '../link/config';
import { activeConnections, newAssignments, useLink } from '../link/store';
import { LINK_PATH, go } from '../routing';
import { text } from '../i18n';
import { W } from './Link.words';

/**
 * Wejścia do współpracy z prowadzącym, w głównej paczce: karta w profilu i w ustawieniach oraz
 * uwaga na ekranie Dziś. Same strony współpracy (i kryptografia) przychodzą leniwie. Bez Sztabu
 * w buildzie nic tu się nie pokazuje.
 */

const T = text({
  pl: {
    title: 'Współpraca z prowadzącym',
    none: 'Trener, dietetyk, fizjoterapeuta albo lekarz może prowadzić cię w GYM TRACKER Sztab. Przysyła link zaproszenia, a ty decydujesz, co widzi — bez konta, bez maila i bez nazwiska.',
    some: (n: number) => (n === 1 ? 'Prowadzi cię jedna osoba.' : `Prowadzą cię ${n} osoby.`),
    who: (name: string, prof: string, areas: string) => `${name} (${prof}) — ${areas}`,
    unread: (n: number) => (n === 1 ? '1 nowe zalecenie.' : `Nowe zalecenia: ${n}.`),
    open: 'Współpraca',
  },
  en: {
    title: 'Working with a coach',
    none: 'A trainer, dietitian, physio or doctor can coach you in GYM TRACKER Sztab. They send an invitation link, and you decide what they see — no account, no email, no name.',
    some: (n: number) => (n === 1 ? 'One person is coaching you.' : `${n} people are coaching you.`),
    who: (name: string, prof: string, areas: string) => `${name} (${prof}) — ${areas}`,
    unread: (n: number) => (n === 1 ? '1 new item from your coach.' : `${n} new items from your coaches.`),
    open: 'Open',
  },
});

/** Karta w profilu i w ustawieniach. */
export function LinkCard() {
  const s = useLink();
  if (!linkConfigured()) return null;
  const active = activeConnections(s);
  const unread = newAssignments(s).length;
  return (
    <div className="grp">
      <h2>{T.title}</h2>
      {active.length ? (
        <>
          <p className="tight">{T.some(active.length)}</p>
          <ul className="link-list">
            {active.map((c) => (
              <li key={c.id}>{T.who(c.coach.name, W.profession[c.coach.profession], c.areas.map((a) => W.area[a]).join(', '))}</li>
            ))}
          </ul>
          {unread > 0 && <p className="tight">{T.unread(unread)}</p>}
        </>
      ) : (
        <p className="tight">{T.none}</p>
      )}
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go(LINK_PATH)}>
        {T.open}
      </button>
    </div>
  );
}

/**
 * Uwaga na ekranie Dziś to dziś karta „Od prowadzącego” (`CoachToday.tsx`); dawna nazwa zostaje dla
 * testów i wejść, które ją znają.
 */
export { CoachToday as LinkNotice } from './CoachToday';
