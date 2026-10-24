// The hand-kept part of the watch list: what the SDK cannot know (spec 2026-10-24 §4.11).
// Names are product names (never translated) — apart from the two „first generation” labels, which
// say it in the page's language. Reasons are codes; the UI turns them into sentences. An item's
// first name is the one a brand-only query is titled with („samsung” → „Samsung Galaxy Watch”).
import { say } from '../i18n';

export type ExtraReason = 'noCiq' | 'notWatch' | 'notYet' | 'regional' | 'otherBrand';

export interface ExtraItem {
  key: string;
  names: string[];
  reason: ExtraReason;
  /** notWatch: what it is instead. otherBrand: a watch or a bike computer. */
  kind?: 'band' | 'scale' | 'bike' | 'watch';
  /** regional: the supported product whose Asian version this is. */
  of?: string;
  /** otherBrand: the brand's phone app, named in the advice — only where it is certain. */
  app?: string;
  /** otherBrand: Apple Watch pairs with an iPhone only. */
  only?: 'ios';
  /** Series word for the grouped list. */
  series?: string;
  /**
   * Names that stand for a whole line: any model words after them get the same answer
   * („Edge 1060”, „Galaxy Watch 7”, „vívosmart 6”). `true` — every name of the item.
   */
  open?: true | string[];
}

/** The chips under the empty field („Popularne”), as supported product ids. */
export const POPULAR = ['fr55', 'fr165', 'fr265', 'venu3', 'vivoactive5', 'fenix7'] as const;

/** Extra names for supported products that neither the SDK nor the store catalog has. */
export const NICKNAMES: Record<string, string[]> = {
  legacyherocaptainmarvel: ['Legacy Hero Captain Marvel', 'Marvel Captain Marvel'],
  legacyherofirstavenger: ['Legacy Hero First Avenger', 'Marvel First Avenger', 'Captain America'],
  legacysagadarthvader: ['Legacy Saga Darth Vader', 'Star Wars Darth Vader'],
  legacysagarey: ['Legacy Saga Rey', 'Star Wars Rey'],
};

export const EXTRA: ExtraItem[] = [
  // Garmin watches without Connect IQ apps (absent from the SDK and from the store catalog).
  {
    key: 'instinct1',
    series: 'Instinct',
    reason: 'noCiq',
    names: [say('Instinct® (1. generacja)', 'Instinct® (1st gen)'), 'Instinct®', 'Instinct® Solar', 'Instinct® Tactical', 'Instinct® Solar Tactical', 'Instinct® Esports', 'Instinct® Solar Surf', 'Instinct® Camo'],
  },
  { key: 'vivomove', series: 'vívomove', reason: 'noCiq', names: ['vívomove®', 'vívomove® HR', 'vívomove® 3', 'vívomove® Style', 'vívomove® Luxe', 'vívomove® Sport', 'vívomove® Trend'], open: ['vívomove®'] },
  { key: 'lily', series: 'Lily', reason: 'noCiq', names: ['Lily®', 'Lily® 2', 'Lily® 2 Active'], open: ['Lily®'] },
  { key: 'fr-basic', series: 'Forerunner', reason: 'noCiq', names: ['Forerunner® 10', 'Forerunner® 15', 'Forerunner® 25', 'Forerunner® 30', 'Forerunner® 35'] },
  { key: 'approach-basic', series: 'Approach', reason: 'noCiq', names: ['Approach® S10', 'Approach® S12', 'Approach® S20', 'Approach® S40', 'Approach® S42', 'Approach® S44'] },
  { key: 'bounce', series: 'Bounce', reason: 'noCiq', names: ['Bounce™', 'Bounce™ 2'], open: ['Bounce™'] },
  { key: 'swim1', series: 'Swim', reason: 'noCiq', names: [say('Garmin Swim™ (1. generacja)', 'Garmin Swim™ (1st gen)')] },
  // Not watches.
  { key: 'vivosmart', series: 'vívosmart', reason: 'notWatch', kind: 'band', names: ['vívosmart®', 'vívosmart® 3', 'vívosmart® 4', 'vívosmart® 5', 'vívosmart® HR', 'vívosmart® HR+'], open: ['vívosmart®'] },
  { key: 'vivofit', series: 'vívofit', reason: 'notWatch', kind: 'band', names: ['vívofit®', 'vívofit® 3', 'vívofit® 4', 'vívofit® jr. 3'], open: ['vívofit®'] },
  { key: 'index', series: 'Index', reason: 'notWatch', kind: 'scale', names: ['Index™ S2', 'Index™ Smart Scale', 'Index™ BPM', 'Index™'], open: ['Index™'] },
  { key: 'edge-any', series: 'Edge', reason: 'notWatch', kind: 'bike', names: ['Edge® 1060', 'Edge®'], open: ['Edge®'] },
  // In the store catalog, newer than the SDK device files used for the build.
  { key: 'marq3', series: 'MARQ', reason: 'notYet', names: ['MARQ® Adventurer (Gen 3)', 'MARQ® Athlete (Gen 3)', 'MARQ® Aviator (Gen 3)', 'MARQ® Commander (Gen 3)', 'MARQ® Diver (Gen 3)', 'MARQ® Golfer (Gen 3)', 'MARQ® (Gen 3)'] },
  // Asian versions the store marks incompatible (their part numbers are missing from the SDK definitions).
  { key: 'descentmk343mm-apac', reason: 'regional', of: 'descentmk343mm', names: ['Descent™ Mk3 43mm (APAC)', 'Descent™ Mk3i 43mm (APAC)'] },
  { key: 'descentmk351mm-apac', reason: 'regional', of: 'descentmk351mm', names: ['Descent™ Mk3i 51mm (APAC)'] },
  { key: 'fr945lte-apac', reason: 'regional', of: 'fr945lte', names: ['Forerunner® 945 LTE (APAC)'] },
  { key: 'marq2-apac', reason: 'regional', of: 'marq2', names: ['MARQ® (Gen 2) (APAC)'] },
  // Other brands: recognised, so the answer is „not a Garmin — this is what works” instead of „unknown”.
  { key: 'apple', reason: 'otherBrand', kind: 'watch', app: 'Zdrowie', only: 'ios', names: ['Apple Watch'], open: true },
  { key: 'samsung', reason: 'otherBrand', kind: 'watch', app: 'Samsung Health', names: ['Samsung Galaxy Watch', 'Galaxy Watch', 'Galaxy Fit', 'Samsung Gear'], open: true },
  { key: 'pixel', reason: 'otherBrand', kind: 'watch', app: 'Fitbit', names: ['Google Pixel Watch', 'Pixel Watch'], open: true },
  { key: 'fitbit', reason: 'otherBrand', kind: 'watch', app: 'Fitbit', names: ['Fitbit', 'Fitbit Charge', 'Fitbit Versa', 'Fitbit Sense', 'Fitbit Inspire', 'Fitbit Luxe', 'Fitbit Ace'], open: true },
  { key: 'xiaomi', reason: 'otherBrand', kind: 'watch', app: 'Mi Fitness', names: ['Xiaomi', 'Xiaomi Mi Band', 'Mi Band', 'Xiaomi Smart Band', 'Mi Smart Band', 'Smart Band', 'Redmi Watch', 'Xiaomi Watch'], open: true },
  { key: 'amazfit', reason: 'otherBrand', kind: 'watch', app: 'Zepp', names: ['Amazfit', 'Amazfit GTR', 'Amazfit GTS', 'Amazfit Bip', 'Amazfit T-Rex', 'Amazfit Balance', 'Amazfit Active', 'Amazfit Cheetah', 'Amazfit Falcon', 'Amazfit Helio'], open: true },
  { key: 'huawei', reason: 'otherBrand', kind: 'watch', app: 'Huawei Health', names: ['Huawei', 'Huawei Watch', 'Huawei Watch GT', 'Huawei Watch Fit', 'Huawei Band'], open: true },
  { key: 'honor', reason: 'otherBrand', kind: 'watch', names: ['Honor Watch', 'Honor Band'], open: true },
  { key: 'polar', reason: 'otherBrand', kind: 'watch', app: 'Polar Flow', names: ['Polar', 'Polar Vantage', 'Polar Grit X', 'Polar Pacer', 'Polar Ignite', 'Polar Unite', 'Polar Vertex', 'Polar Loop'], open: true },
  { key: 'suunto', reason: 'otherBrand', kind: 'watch', app: 'Suunto', names: ['Suunto', 'Suunto Race', 'Suunto Vertical', 'Suunto Ocean', 'Suunto Run', 'Suunto 9', 'Suunto 5'], open: true },
  { key: 'coros', reason: 'otherBrand', kind: 'watch', app: 'COROS', names: ['COROS', 'COROS Pace', 'COROS Apex', 'COROS Vertix', 'COROS Dura', 'COROS Nomad'], open: true },
  { key: 'withings', reason: 'otherBrand', kind: 'watch', app: 'Withings', names: ['Withings', 'Withings ScanWatch', 'Withings Steel HR', 'Withings Move'], open: true },
  { key: 'oura', reason: 'otherBrand', kind: 'watch', app: 'Oura', names: ['Oura', 'Oura Ring'], open: true },
  { key: 'whoop', reason: 'otherBrand', kind: 'watch', app: 'WHOOP', names: ['WHOOP'], open: true },
  { key: 'ticwatch', reason: 'otherBrand', kind: 'watch', names: ['TicWatch', 'Mobvoi TicWatch'], open: true },
  { key: 'oneplus', reason: 'otherBrand', kind: 'watch', names: ['OnePlus Watch'], open: true },
  { key: 'wahoo', reason: 'otherBrand', kind: 'bike', app: 'Wahoo', names: ['Wahoo ELEMNT', 'Wahoo ELEMNT Bolt', 'Wahoo ELEMNT Roam'], open: true },
  { key: 'hammerhead', reason: 'otherBrand', kind: 'bike', names: ['Hammerhead Karoo'], open: true },
];
