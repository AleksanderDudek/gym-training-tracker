import { Check, Navigation } from 'lucide-react';
import { useState } from 'react';
import { text } from '../../../i18n';
import type { Food } from '../../diet/foods';
import { logFood } from '../../diet/store';
import type { Context, Suggestion } from '../../diet/suggest';
import { formatNumber } from '../../lib/format';
import type { RankedPlace } from '../../nearby/eat';
import { directionsUrl, geoUri, type MapsPlatform } from '../../nearby/navigate';
import type { Chain } from '../../restaurants/types';
import type { Unpublished } from '../../restaurants/unpublished';
import { Sheet } from '../common/Sheet';
import { FitBadge, MacroLine } from '../diet/SuggestionList';
import { distanceText, ET, openText } from './eatText';

const T = text({
  pl: {
    go: 'Prowadź',
    goHint: 'Trasa pieszo w aplikacji map',
    other: 'Inna aplikacja',
    fits: 'Co tu zjesz',
    fitsLead: (kcal: string, protein: string) => `Najlepsze na teraz — na ten posiłek ok. ${kcal} kcal i ${protein} g białka.`,
    nothingFits: 'Nic stąd nie mieści się teraz w celu. Jeśli musisz, wybierz z listy niżej najlżejsze.',
    more: (n: number) => `Pokaż wszystko (${n})`,
    notNow: (n: number) => `Lepiej nie teraz (${n})`,
    eaten: 'Zjadłem',
    eatenLabel: (name: string) => `Zjadłem: ${name}`,
    saved: (name: string, kcal: string) => `Zapisane w dzienniku: ${name} · ${kcal} kcal. Lista liczy się już od nowa.`,
    saveFailed: 'Nie udało się zapisać. Spróbuj jeszcze raz.',
    noData: 'Nie znam menu tego miejsca.',
    unpublished: (name: string, partial: string, checked: string) =>
      `Sieć ${name} nie publikuje wartości odżywczych${partial} (sprawdzone ${checked}).`,
    onlyKcal: ' — podaje tylko kalorie, bez makroskładników',
    onlyAllergens: ' — podaje tylko alergeny',
    cuisine: (c: string) => `Kuchnia według OpenStreetMap: ${c}.`,
    tip: 'Na cel najprościej: porcja białka (mięso, ryba, jajka, ser, strączki), do tego warzywa; sosy i smażone ostrożnie.',
    source: (chain: string, title: string, checked: string) => `Wartości z tabeli sieci ${chain} (${title}), sprawdzone ${checked}.`,
    market: (m: string) => ` Polska sieć nie publikuje własnej — liczby z rynku ${m}.`,
    sourceLink: 'Źródło',
    privacy: '„Prowadź” przekazuje cel trasy aplikacji map (Apple albo Google).',
  },
  en: {
    go: 'Directions',
    goHint: 'Walking route in your maps app',
    other: 'Another app',
    fits: 'What you can eat here',
    fitsLead: (kcal: string, protein: string) => `Best for now — this meal about ${kcal} kcal and ${protein} g protein.`,
    nothingFits: 'Nothing here fits today’s goal right now. If you must, pick the lightest from the list below.',
    more: (n: number) => `Show everything (${n})`,
    notNow: (n: number) => `Better not now (${n})`,
    eaten: 'Eaten',
    eatenLabel: (name: string) => `Eaten: ${name}`,
    saved: (name: string, kcal: string) => `Saved to the diary: ${name} · ${kcal} kcal. The list is recounted.`,
    saveFailed: 'Couldn’t save. Try again.',
    noData: 'I don’t know this place’s menu.',
    unpublished: (name: string, partial: string, checked: string) =>
      `${name} doesn’t publish nutrition values${partial} (checked ${checked}).`,
    onlyKcal: ' — only calories, no macros',
    onlyAllergens: ' — only allergens',
    cuisine: (c: string) => `Cuisine according to OpenStreetMap: ${c}.`,
    tip: 'Simplest for your goal: a portion of protein (meat, fish, eggs, cheese, pulses) with vegetables; go easy on sauces and fried food.',
    source: (chain: string, title: string, checked: string) => `Values from ${chain}’s own table (${title}), checked ${checked}.`,
    market: (m: string) => ` The Polish chain publishes none — numbers from the ${m} market.`,
    sourceLink: 'Source',
    privacy: '“Directions” passes the destination to your maps app (Apple or Google).',
  },
});

/** How many fitting items show before „Pokaż wszystko” — a pizzeria's menu runs past a hundred. */
const FIRST = 12;

interface Props {
  place: RankedPlace;
  menu: Chain | null;
  /** The chain is known not to publish nutrition: the card says so instead of "unknown menu". */
  unpublished?: Unpublished | null;
  ctx: Context;
  mealKcal: number;
  today: string;
  now: Date;
  platform: MapsPlatform;
  onClose: () => void;
}

/** A dish without its chain in brackets (and both halves of a pair without it). */
const nameOf = (food: Food, menu: Chain | null) => (menu ? food.name.replaceAll(` (${menu.name})`, '') : food.name);

/**
 * The place card: where it is and whether it is open, „Prowadź” to the device's maps app, and
 * everything to eat there that fits now - best first, with the diary's rating and „Zjadłem”, which
 * logs it to today (the ranking behind the card follows). What does not fit waits folded below.
 */
export function PlaceSheet({ place, menu, unpublished, ctx, mealKcal, today, now, platform, onClose }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const p = place.place;
  const fits = place.options.filter((s) => s.fit.level !== 'avoid' && s.food.nutrients.kcal <= ctx.remaining.kcal + 100);
  const notNow = place.options.filter((s) => !fits.includes(s));
  const shown = all ? fits : fits.slice(0, FIRST);
  const open = openText(place.open, now) ?? ET.hoursUnknown;

  const eat = async (s: Suggestion) => {
    try {
      await logFood(today, s.food);
      setStatus(T.saved(nameOf(s.food, menu), formatNumber(s.food.nutrients.kcal, 0)));
    } catch {
      setStatus(T.saveFailed);
    }
  };

  const row = (s: Suggestion) => (
    <li key={s.food.key} className="fd-diet-row">
      <div className="fd-diet-row-main">
        <p className="fd-diet-name">
          {nameOf(s.food, menu)} <FitBadge fit={s.fit} />
        </p>
        <p className="fd-diet-meta">
          <MacroLine food={s.food} /> · {s.food.amountLabel}
        </p>
        {s.reasons.length > 0 && <p className="fd-near-eat-why">{s.reasons.slice(0, 2).join(' · ')}</p>}
      </div>
      <button
        type="button"
        className="btn ghost sm fd-diet-act"
        onClick={() => void eat(s)}
        aria-label={T.eatenLabel(nameOf(s.food, menu))}
      >
        <Check size={20} strokeWidth={2} aria-hidden /> {T.eaten}
      </button>
    </li>
  );

  return (
    <Sheet
      open
      full
      onClose={onClose}
      title={p.name}
      // The chain only when the venue is named otherwise („Żabka” for „Żabka Nano”), never twice.
      subtitle={[place.label !== p.name ? place.label : null, ET.kinds[p.kind]].filter(Boolean).join(' · ')}
    >
      <div className="fd-near-card-head">
        <p>{[p.address, distanceText(place.distance, place.walkMin)].filter(Boolean).join(' · ')}</p>
        <p className={place.open && !place.open.open ? 'fd-near-closed' : 'fd-near-soft'}>{open}</p>
        <div className="btnrow">
          <a
            className="btn"
            href={directionsUrl(p, platform)}
            target="_blank"
            rel="noopener noreferrer"
            title={T.goHint}
          >
            <Navigation size={20} strokeWidth={2} aria-hidden /> {T.go}
          </a>
          {platform === 'android' && (
            <a className="btn ghost sm" href={geoUri(p, p.name)}>
              {T.other}
            </a>
          )}
        </div>
        <p className="hint">{T.privacy}</p>
      </div>
      <p role="status" className="fd-near-card-status">
        {status}
      </p>

      {place.options.length === 0 ? (
        <div className="fd-near-card-nodata">
          <p>
            {unpublished
              ? T.unpublished(
                  unpublished.name,
                  unpublished.partial === 'kcal' ? T.onlyKcal : unpublished.partial === 'allergens' ? T.onlyAllergens : '',
                  unpublished.checked.split('-').reverse().join('.'),
                )
              : T.noData}
          </p>
          {p.cuisine && <p className="fd-near-soft">{T.cuisine(p.cuisine.replaceAll(';', ', '))}</p>}
          <p>{T.tip}</p>
        </div>
      ) : (
        <>
          <h3 className="fd-near-card-h">{T.fits}</h3>
          <p className="fd-near-card-lead">
            {fits.length
              ? T.fitsLead(formatNumber(Math.round(mealKcal / 10) * 10, 0), formatNumber(Math.round(ctx.remaining.protein / ctx.mealsLeft), 0))
              : T.nothingFits}
          </p>
          {fits.length > 0 && <ul className="fd-diet-list">{shown.map(row)}</ul>}
          {fits.length > shown.length && (
            <button type="button" className="btn ghost sm" onClick={() => setAll(true)}>
              {T.more(fits.length)}
            </button>
          )}
          {notNow.length > 0 && (
            <details className="fd-near-card-notnow" open={fits.length === 0}>
              <summary>{T.notNow(notNow.length)}</summary>
              <ul className="fd-diet-list">{notNow.map(row)}</ul>
            </details>
          )}
          {menu && (
            <p className="hint fd-near-card-source">
              {T.source(menu.name, menu.source.title, menu.source.checked)}
              {menu.market !== 'PL' && T.market(menu.market)}{' '}
              <a href={menu.source.url} target="_blank" rel="noopener noreferrer">
                {T.sourceLink}
              </a>
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
