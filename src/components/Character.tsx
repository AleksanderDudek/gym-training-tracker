import { Gorilla, WHO_NAME } from './Gorilla';
import type { TraineeMood } from './Gorilla';
import { Segmented } from './ui';
import { XP, levelFor, xpSummary } from '../engine/xp';
import type { LevelState, XpSummary } from '../engine/xp';
import { dayKey, daysBetween } from '../engine/schedule';
import { snacksOf } from '../engine/snacks';
import { LEVEL_UP, pick, plural } from '../engine/quips';
import type { AppState } from '../types';

/**
 * Postać: goryl, który rośnie razem z punktami doświadczenia.
 *
 * Mina reaguje na to, kiedy był ostatni ruch, ale nigdy nie jest jedynym nośnikiem —
 * obok zawsze stoi to samo zdaniem. Poziom i pasek mówią, ile brakuje; tytuł mówi,
 * kim goryl jest teraz. Srebrnego grzbietu nie da się kupić, więc i tu go nie ma za darmo.
 */

export type Avatar = 'gustaw' | 'gosia';

const num = (n: number): string => Math.round(n).toLocaleString('pl-PL');

export const avatarOf = (state: AppState): Avatar => state.cfg.avatar ?? 'gustaw';

/** Ostatni dzień z jakimkolwiek ruchem — treningiem albo przekąską. */
export function lastActiveDay(state: AppState): string | null {
  const days = [...state.log.map((e) => dayKey(e.date)), ...snacksOf(state).map((s) => dayKey(s.at))];
  return days.length ? days.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Mina postaci i to samo zdaniem. */
export function characterMood(
  state: AppState,
  sum: XpSummary,
  today: string = dayKey(Date.now()),
): { mood: TraineeMood; line: string } {
  // Ruch dziś to trening albo przekąska dziś. Samo doświadczenie z odznak się nie liczy —
  // próg dopięty przy starcie aplikacji nie znaczy, że ktoś się dziś ruszał.
  const last = lastActiveDay(state);
  if (last === today)
    return sum.move >= XP.workout
      ? { mood: 'proud', line: 'Dziś w ruchu, i to porządnie' }
      : { mood: 'happy', line: 'Dziś w ruchu' };
  if (!last) return { mood: 'longing', line: 'Czeka na pierwszy ruch' };
  const gap = daysBetween(last, today);
  if (gap <= 1) return { mood: 'content', line: 'Wczoraj w ruchu' };
  return { mood: 'longing', line: `Ostatni ruch ${gap} dni temu` };
}

function XpBar({ lv }: { lv: LevelState }) {
  return (
    <div
      className="xpbar"
      role="progressbar"
      aria-label={`Postęp do poziomu ${lv.level + 1}`}
      aria-valuemin={0}
      aria-valuemax={lv.ceil - lv.floor}
      aria-valuenow={Math.round(lv.xp - lv.floor)}
    >
      <i style={{ width: `${Math.max(2, Math.round(lv.progress * 100))}%` }} />
    </div>
  );
}

/** Karta postaci w profilu: poziom, tytuł, pasek, skąd przyszło doświadczenie i wybór goryla. */
export function CharacterCard({ state, onAvatar }: { state: AppState; onAvatar: (a: Avatar) => void }) {
  const sum = xpSummary(state);
  const lv = levelFor(sum.total);
  const who = avatarOf(state);
  const { mood, line } = characterMood(state, sum);

  return (
    <div className="grp char">
      <div className="char-top">
        <span className="char-art" aria-hidden="true">
          <Gorilla who={who} mood={mood} size={112} />
        </span>
        <div className="char-body">
          <div className="today-tag light">Twoja postać · {WHO_NAME[who]}</div>
          <div className="char-level">Poziom {lv.level}</div>
          <div className="char-title">{lv.title}</div>
          <XpBar lv={lv} />
          <div className="char-meta">
            {num(lv.xp)} XP · do poziomu {lv.level + 1} brakuje {num(lv.toNext)} XP
          </div>
        </div>
      </div>
      <p className="tight">
        {line}. Ostatnie siedem dni: +{num(sum.week)} XP, z tego dziś +{num(sum.today)} XP.
      </p>
      {lv.nextTitle && (
        <p className="tight">
          Kolejny tytuł na poziomie {lv.nextTitle.level}: {lv.nextTitle.name}.
        </p>
      )}
      <p className="tight">
        Skąd: treningi {num(sum.parts.trening)} · przekąski {num(sum.parts.przekaska)} · odznaki{' '}
        {num(sum.parts.odznaka)} XP.
      </p>

      <div className="segline">Kto rośnie razem z tobą</div>
      <Segmented<Avatar>
        value={who}
        onChange={onAvatar}
        options={[
          { key: 'gustaw', label: 'Gustaw' },
          { key: 'gosia', label: 'Gosia' },
        ]}
      />

      <details className="why">
        <summary>Skąd się bierze doświadczenie</summary>
        <div>
          <p className="tight">
            <b>Zamknięty trening: {XP.workout} XP.</b> Kolejny tego samego dnia: {XP.workoutAgain} XP —
            te same wzorce ruchu dwa razy dziennie nie budują dwa razy szybciej.
          </p>
          <p className="tight">
            <b>Przekąska ruchowa: {XP.snack} XP</b>, do {XP.snackCap} dziennie. Kolejne liczą się do
            odznak, ale już bez doświadczenia: przekąski mają rozkładać ruch na cały dzień, a nie
            zamieniać się w klikanie.
          </p>
          <p className="tight">
            <b>Próg odznaki: od {XP.band[1]} do {XP.band[5]} XP</b>, zależnie od tworzywa. Odznaki
            ćwiczeń płacą połowę, bo jest ich po cztery na każdy ruch.
          </p>
          <p className="tight">
            Każdy poziom kosztuje o sto więcej niż poprzedni. Ciężar i tonaż nie dają niczego —
            doświadczenie za kilogramy rosłoby najszybciej tuż przed kontuzją.
          </p>
          <p className="tight">
            Stopień w planie to co innego: liczy punkty za terminy i istnieje tylko z planem.
            Poziom postaci liczy każdy ruch, także bez planu.
          </p>
        </div>
      </details>
    </div>
  );
}

/**
 * Pasek postaci na ekranie sesji: poziom i ile brakuje, bez goryla — ten ekran ma już
 * trenera w banerze, a jedna postać na ekran to zasada obsady.
 */
export function CharacterStrip({ state }: { state: AppState }) {
  const sum = xpSummary(state);
  const lv = levelFor(sum.total);
  return (
    <a className="charstrip" href="#/profil" aria-label={`Postać: poziom ${lv.level}, ${lv.title}. Szczegóły w profilu.`}>
      <span className="charstrip-lvl">
        <small>poziom</small>
        {lv.level}
      </span>
      <span className="charstrip-body">
        <span className="charstrip-title">
          {lv.title}
          {sum.today > 0 && <em> · dziś +{num(sum.today)} XP</em>}
        </span>
        <XpBar lv={lv} />
        <span className="charstrip-meta">do poziomu {lv.level + 1} brakuje {num(lv.toNext)} XP</span>
      </span>
      <span className="go" aria-hidden="true">
        →
      </span>
    </a>
  );
}

/** Treść okna awansu. Nowy tytuł, jeśli wpadł, i ile do następnego poziomu. */
export function LevelUp({ before, after }: { before: LevelState; after: LevelState }) {
  const titled = after.title !== before.title;
  const jump = after.level - before.level;
  return (
    <div className="lvlup">
      <div className="lvlup-num">Poziom {after.level}</div>
      <p className="lvlup-title">{titled ? <>Nowy tytuł: <b>{after.title}</b></> : after.title}</p>
      <p>
        {num(after.xp)} XP. Do poziomu {after.level + 1} brakuje {num(after.toNext)} XP.
        {jump > 1 ? ` Przeskok o ${jump} ${plural(jump, ['poziom', 'poziomy', 'poziomów'])} naraz.` : ''}
      </p>
      <p className="tight joke">{pick(LEVEL_UP, after.level)}</p>
    </div>
  );
}
