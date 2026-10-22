import type { ReactNode } from 'react';
import { Gorilla, WHO_NAME } from './Gorilla';
import type { TraineeMood } from './Gorilla';
import { Segmented } from './ui';
import { XP, levelFor, xpSummary } from '../engine/xp';
import type { LevelState, XpSummary } from '../engine/xp';
import { dayKey, daysBetween } from '../engine/schedule';
import { snacksOf } from '../engine/snacks';
import { BASE_STEPS, activeMinutes, cardioOf } from '../engine/cardio';
import { LEVEL_UP, pick, plural } from '../engine/quips';
import type { AppState } from '../types';
import { LOCALE, pluralEn, text } from '../i18n';

const T = text({
  pl: {
    proud: 'Dziś w ruchu, i to porządnie',
    happy: 'Dziś w ruchu',
    first: 'Czeka na pierwszy ruch',
    yesterday: 'Wczoraj w ruchu',
    ago: (n: number) => `Ostatni ruch ${n} dni temu`,
    progressAria: (n: number) => `Postęp do poziomu ${n}`,
    yours: (name: string) => `Twoja postać · ${name}`,
    level: (n: number) => `Poziom ${n}`,
    meta: (xp: string, next: number, left: string) => `${xp} XP · do poziomu ${next} brakuje ${left} XP`,
    week: (line: string, week: string, today: string) => `${line}. Ostatnie siedem dni: +${week} XP, z tego dziś +${today} XP.`,
    nextTitle: (level: number, name: string) => `Kolejny tytuł na poziomie ${level}: ${name}.`,
    from: (workouts: string, snacks: string, cardio: string, badges: string) =>
      `Skąd: treningi ${workouts} · przekąski ${snacks} · kroki i cardio ${cardio} · odznaki ${badges} XP.`,
    who: 'Kto rośnie razem z tobą',
    whyXp: 'Skąd się bierze doświadczenie',
    xpWorkout: (w: number, again: number): ReactNode => (
      <>
        <b>Zamknięty trening: {w} XP.</b> Kolejny tego samego dnia: {again} XP — te same wzorce ruchu dwa razy dziennie
        nie budują dwa razy szybciej.
      </>
    ),
    xpSnack: (snack: number, cap: number): ReactNode => (
      <>
        <b>Przekąska ruchowa: {snack} XP</b>, do {cap} dziennie. Kolejne liczą się do odznak, ale już bez doświadczenia:
        przekąski mają rozkładać ruch na cały dzień, a nie zamieniać się w klikanie.
      </>
    ),
    xpCardio: (perMin: number, cap: number, base: string): ReactNode => (
      <>
        <b>Kroki i cardio: {perMin} XP za minutę ruchu</b>, do {cap} dziennie. Minuta intensywna (bieg, szybki rower)
        liczy się podwójnie, jak w zaleceniach WHO; z kroków liczy się to, co ponad {base}, przy 100 na minutę, a z zajęć
        tańca — sam taniec, bez tłumaczenia. Sufit to połowa treningu — spacer ma dokładać, a nie zastępować.
      </>
    ),
    xpBadge: (low: number, high: number): ReactNode => (
      <>
        <b>
          Próg odznaki: od {low} do {high} XP
        </b>
        , zależnie od tworzywa. Odznaki ćwiczeń płacą połowę, bo jest ich po cztery na każdy ruch.
      </>
    ),
    xpLevels:
      'Każdy poziom kosztuje o sto więcej niż poprzedni. Ciężar i tonaż nie dają niczego — doświadczenie za kilogramy rosłoby najszybciej tuż przed kontuzją.',
    xpRank:
      'Stopień w planie to co innego: liczy punkty za terminy i istnieje tylko z planem. Poziom postaci liczy każdy ruch, także bez planu.',
    levelSmall: 'poziom',
    today: (xp: string) => ` · dziś +${xp} XP`,
    toNext: (next: number, left: string) => `do poziomu ${next} brakuje ${left} XP`,
    newTitle: (title: string): ReactNode => (
      <>
        Nowy tytuł: <b>{title}</b>
      </>
    ),
    upText: (xp: string, next: number, left: string) => `${xp} XP. Do poziomu ${next} brakuje ${left} XP.`,
    jump: (n: number) => ` Przeskok o ${n} ${plural(n, ['poziom', 'poziomy', 'poziomów'])} naraz.`,
  },
  en: {
    proud: 'On the move today, and properly',
    happy: 'On the move today',
    first: 'Waiting for your first move',
    yesterday: 'On the move yesterday',
    ago: (n: number) => `Last moved ${n} days ago`,
    progressAria: (n: number) => `Progress to level ${n}`,
    yours: (name: string) => `Your character · ${name}`,
    level: (n: number) => `Level ${n}`,
    meta: (xp: string, next: number, left: string) => `${xp} XP · ${left} XP to level ${next}`,
    week: (line: string, week: string, today: string) => `${line}. Last seven days: +${week} XP, +${today} XP of it today.`,
    nextTitle: (level: number, name: string) => `Next title at level ${level}: ${name}.`,
    from: (workouts: string, snacks: string, cardio: string, badges: string) =>
      `From: workouts ${workouts} · exercise snacks ${snacks} · steps & cardio ${cardio} · badges ${badges} XP.`,
    who: 'Who grows with you',
    whyXp: 'Where XP comes from',
    xpWorkout: (w: number, again: number): ReactNode => (
      <>
        <b>Finished workout: {w} XP.</b> Another one the same day: {again} XP — the same movement patterns twice a day
        don’t build twice as fast.
      </>
    ),
    xpSnack: (snack: number, cap: number): ReactNode => (
      <>
        <b>Exercise snack: {snack} XP</b>, up to {cap} a day. Any more still count towards badges, but without XP: snacks
        are meant to spread movement through the day, not turn into tapping.
      </>
    ),
    xpCardio: (perMin: number, cap: number, base: string): ReactNode => (
      <>
        <b>Steps &amp; cardio: {perMin} XP per active minute</b>, up to {cap} a day. A vigorous minute (running, fast
        cycling) counts double, as in the WHO guidelines; for steps, what counts is everything above {base}, at 100 a
        minute, and for dance classes — just the dancing, not the explaining. The cap is half a workout — a walk should
        add to training, not replace it.
      </>
    ),
    xpBadge: (low: number, high: number): ReactNode => (
      <>
        <b>
          Badge tier: {low} to {high} XP
        </b>
        , depending on the material. Exercise badges pay half, because there are four for every movement.
      </>
    ),
    xpLevels:
      'Each level costs a hundred more than the one before. Weight and tonnage earn nothing — XP for kilograms would grow fastest just before an injury.',
    xpRank:
      'Your plan rank is something else: it counts points for deadlines and only exists with a plan. Your character level counts every move, plan or no plan.',
    levelSmall: 'level',
    today: (xp: string) => ` · today +${xp} XP`,
    toNext: (next: number, left: string) => `${left} XP to level ${next}`,
    newTitle: (title: string): ReactNode => (
      <>
        New title: <b>{title}</b>
      </>
    ),
    upText: (xp: string, next: number, left: string) => `${xp} XP. ${left} XP to level ${next}.`,
    jump: (n: number) => ` A jump of ${n} ${pluralEn(n, 'level', 'levels')} at once.`,
  },
});

/**
 * Postać: goryl, który rośnie razem z punktami doświadczenia.
 *
 * Mina reaguje na to, kiedy był ostatni ruch, ale nigdy nie jest jedynym nośnikiem —
 * obok zawsze stoi to samo zdaniem. Poziom i pasek mówią, ile brakuje; tytuł mówi,
 * kim goryl jest teraz. Srebrnego grzbietu nie da się kupić, więc i tu go nie ma za darmo.
 */

export type Avatar = 'gustaw' | 'gosia';

const num = (n: number): string => Math.round(n).toLocaleString(LOCALE);

export const avatarOf = (state: AppState): Avatar => state.cfg.avatar ?? 'gustaw';

/** Ostatni dzień z jakimkolwiek ruchem — treningiem, przekąską, krokami, cardio albo tańcem. */
export function lastActiveDay(state: AppState): string | null {
  const days = [
    ...state.log.map((e) => dayKey(e.date)),
    ...snacksOf(state).map((s) => dayKey(s.at)),
    // Dzień wpisu, nie chwila zapisu — kroki z wczoraj wpisane dziś rano to ruch wczoraj.
    // Zegarek i telefon liczą kroki każdego dnia, także po mieszkaniu, więc ich dzień jest
    // ruchem dopiero z minutami ruchu — inaczej postać nigdy by nie zatęskniła.
    ...cardioOf(state)
      .filter((c) => !c.src || activeMinutes(state, c) > 0)
      .map((c) => c.day),
  ];
  return days.length ? days.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Mina postaci i to samo zdaniem. */
export function characterMood(
  state: AppState,
  sum: XpSummary,
  today: string = dayKey(Date.now()),
): { mood: TraineeMood; line: string } {
  // Ruch dziś to trening, przekąska albo kroki i cardio z dzisiejszą datą. Samo doświadczenie z odznak się nie liczy —
  // próg dopięty przy starcie aplikacji nie znaczy, że ktoś się dziś ruszał.
  const last = lastActiveDay(state);
  if (last === today)
    return sum.move >= XP.workout
      ? { mood: 'proud', line: T.proud }
      : { mood: 'happy', line: T.happy };
  if (!last) return { mood: 'longing', line: T.first };
  const gap = daysBetween(last, today);
  if (gap <= 1) return { mood: 'content', line: T.yesterday };
  return { mood: 'longing', line: T.ago(gap) };
}

function XpBar({ lv }: { lv: LevelState }) {
  return (
    <div
      className="xpbar"
      role="progressbar"
      aria-label={T.progressAria(lv.level + 1)}
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
          <div className="today-tag light">{T.yours(WHO_NAME[who])}</div>
          <div className="char-level">{T.level(lv.level)}</div>
          <div className="char-title">{lv.title}</div>
          <XpBar lv={lv} />
          <div className="char-meta">{T.meta(num(lv.xp), lv.level + 1, num(lv.toNext))}</div>
        </div>
      </div>
      <p className="tight">{T.week(line, num(sum.week), num(sum.today))}</p>
      {lv.nextTitle && <p className="tight">{T.nextTitle(lv.nextTitle.level, lv.nextTitle.name)}</p>}
      <p className="tight">
        {T.from(num(sum.parts.trening), num(sum.parts.przekaska), num(sum.parts.cardio), num(sum.parts.odznaka))}
      </p>

      <div className="segline">{T.who}</div>
      <Segmented<Avatar>
        value={who}
        onChange={onAvatar}
        options={[
          { key: 'gustaw', label: 'Gustaw' },
          { key: 'gosia', label: 'Gosia' },
        ]}
      />

      <details className="why">
        <summary>{T.whyXp}</summary>
        <div>
          <p className="tight">{T.xpWorkout(XP.workout, XP.workoutAgain)}</p>
          <p className="tight">{T.xpSnack(XP.snack, XP.snackCap)}</p>
          <p className="tight">{T.xpCardio(XP.cardioPerMin, XP.cardioCap, BASE_STEPS.toLocaleString(LOCALE))}</p>
          <p className="tight">{T.xpBadge(XP.band[1], XP.band[5])}</p>
          <p className="tight">{T.xpLevels}</p>
          <p className="tight">{T.xpRank}</p>
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
    <a className="charstrip" href="#/profil">
      <span className="charstrip-lvl">
        <small>{T.levelSmall}</small>
        {lv.level}
      </span>
      <span className="charstrip-body">
        <span className="charstrip-title">
          {lv.title}
          {sum.today > 0 && <em>{T.today(num(sum.today))}</em>}
        </span>
        <XpBar lv={lv} />
        <span className="charstrip-meta">{T.toNext(lv.level + 1, num(lv.toNext))}</span>
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
      <div className="lvlup-num">{T.level(after.level)}</div>
      <p className="lvlup-title">{titled ? T.newTitle(after.title) : after.title}</p>
      <p>
        {T.upText(num(after.xp), after.level + 1, num(after.toNext))}
        {jump > 1 ? T.jump(jump) : ''}
      </p>
      <p className="tight joke">{pick(LEVEL_UP, after.level)}</p>
    </div>
  );
}
