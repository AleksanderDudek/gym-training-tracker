import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  STALE,
  bgOf,
  buildList,
  changedIds,
  cmpVersion,
  expand,
  parseManifest,
  sdkVersion,
  serialize,
  storeOnly,
  trimStore,
  unsupportedReason,
  type Manifest,
  type SdkDevice,
  type SdkPart,
  type StoreDevice,
} from './lib';

/* ---------- fixtures, shaped like the SDK 9.2.0 device files ---------- */

const ALL_API = '<getStressHistory/> <getBodyBatteryHistory/> <getUserActivityHistory/>';

/** A part number: global (with Polish) unless `pol: false` (the Asian version). */
const part = (number: string, ciq: string, o: { fw?: number; pol?: boolean } = {}): SdkPart => ({
  number,
  connectIQVersion: ciq,
  ...(o.fw !== undefined && { firmwareVersion: o.fw }),
  languages: o.pol === false ? [{ code: 'eng' }, { code: 'jpn' }, { code: 'zhs' }] : [{ code: 'eng' }, { code: 'pol' }],
});

const device = (
  id: string,
  displayName: string,
  parts: SdkPart[],
  o: { api?: string; bg?: number; types?: string[]; group?: string } = {},
): SdkDevice => ({
  id,
  displayName,
  webDocDeviceGroup: o.group ?? 'Watches/Wearables',
  appTypes: (o.types ?? ['watchApp', 'background', 'watchFace']).map((type) => ({
    type,
    memoryLimit: type === 'background' ? (o.bg ?? 65536) : 131072,
  })),
  partNumbers: parts,
  api: o.api ?? ALL_API,
});

const fenix5plus = device('fenix5plus', 'fēnix® 5 Plus', [part('006-B3110-00', '3.3.3', { fw: 1910 }), part('006-B3089-00', '3.2.8', { fw: 1720, pol: false })], {
  api: '<getStressHistory/> <getUserActivityHistory/>',
  bg: 32768,
});
const venud = device('venud', 'Venu® Mercedes-Benz® Collection', [part('006-B3740-00', '3.2.6', { fw: 630 }), part('006-B3737-00', '3.3.6', { fw: 800, pol: false })], {
  api: '',
});
const instinct2 = device('instinct2', 'Instinct® 2 / Solar / Dual Power / dēzl Edition', [part('006-B3888-00', '3.4.2', { fw: 1223 }), part('006-B4071-00', '3.2.7', { pol: false })], {
  bg: 32768,
});
const fr265 = device('fr265', 'Forerunner® 265', [part('006-B4257-00', '5.2.0', { fw: 2502 })]);
const vivoactive3m = device('vivoactive3m', 'vívoactive® 3 Music', [part('006-B2988-00', '3.2.0', { fw: 600 })], { api: '' });

const edge540 = device('edge540', 'Edge® 540 / 540 Solar', [part('006-B4061-00', '6.0.0', { fw: 3133 })], { group: 'Edge', types: ['background', 'datafield', 'watchApp'] });
const gpsmap66 = device('gpsmap66', 'GPSMAP® 66s / 66i / 66sr / 66st', [part('006-B3284-00', '3.4.0')], { group: 'Outdoor Handhelds' });
const fr45 = device('fr45', 'Forerunner® 45', [part('006-B3282-00', '1.4.5'), part('006-B3469-00', '1.4.5', { pol: false })], { types: ['watchFace'] });
const fr235 = device('fr235', 'Forerunner® 235', [part('006-B2431-00', '1.4.4', { fw: 760 }), part('006-B2397-00', '1.4.5', { fw: 840, pol: false })], {
  types: ['watchFace', 'watchApp', 'widget', 'datafield'],
});
const vivoactive3 = device('vivoactive3', 'vívoactive® 3', [part('006-B2700-00', '3.1.6', { fw: 720 }), part('006-B2976-00', '3.1.9', { fw: 770, pol: false }), part('006-B3446-00', '3.0.3', { pol: false })], {
  bg: 32768,
});
const vivoactive3mlte = device('vivoactive3mlte', 'vívoactive® 3 Music LTE', [part('006-B3473-00', '3.1.4')]);

const manifest = (ids: string[]): Manifest => ({ ids, appId: '23e4c6b5e09245379ec788ddc26b4c2a', minCiq: '3.2.0' });

/* ---------- tests ---------- */

/** Every multi-name display name of the manifest's products in SDK 9.2.0, and what it expands to. */
const MULTI: [string, string[]][] = [
  ['Descent™ G1 / G1 Solar', ['Descent™ G1', 'Descent™ G1 Solar']],
  ['Descent™ Mk2 / Mk2i', ['Descent™ Mk2', 'Descent™ Mk2i']],
  ['Descent™ Mk3 43mm / Mk3i 43mm', ['Descent™ Mk3 43mm', 'Descent™ Mk3i 43mm']],
  ['epix™ (Gen 2) / quatix® 7 Sapphire', ['epix™ (Gen 2)', 'quatix® 7 Sapphire']],
  ['epix™ Pro (Gen 2) 47mm / quatix® 7 Pro', ['epix™ Pro (Gen 2) 47mm', 'quatix® 7 Pro']],
  ['epix™ Pro (Gen 2) 51mm / D2™ Mach 1 Pro / tactix® 7 – AMOLED Edition', ['epix™ Pro (Gen 2) 51mm', 'D2™ Mach 1 Pro', 'tactix® 7 – AMOLED Edition']],
  ['fēnix® 6 / 6 Solar / 6 Dual Power', ['fēnix® 6', 'fēnix® 6 Solar', 'fēnix® 6 Dual Power']],
  [
    'fēnix® 6 Pro / 6 Sapphire / 6 Pro Solar / 6 Pro Dual Power / quatix® 6',
    ['fēnix® 6 Pro', 'fēnix® 6 Sapphire', 'fēnix® 6 Pro Solar', 'fēnix® 6 Pro Dual Power', 'quatix® 6'],
  ],
  ['fēnix® 6S / 6S Solar / 6S Dual Power', ['fēnix® 6S', 'fēnix® 6S Solar', 'fēnix® 6S Dual Power']],
  ['fēnix® 6S Pro / 6S Sapphire / 6S Pro Solar / 6S Pro Dual Power', ['fēnix® 6S Pro', 'fēnix® 6S Sapphire', 'fēnix® 6S Pro Solar', 'fēnix® 6S Pro Dual Power']],
  [
    'fēnix® 6X Pro / 6X Sapphire / 6X Pro Solar / tactix® Delta Sapphire / Delta Solar / Delta Solar - Ballistics Edition / quatix® 6X / 6X Solar / 6X Dual Power',
    [
      'fēnix® 6X Pro',
      'fēnix® 6X Sapphire',
      'fēnix® 6X Pro Solar',
      'tactix® Delta Sapphire',
      'tactix® Delta Solar',
      'tactix® Delta Solar - Ballistics Edition',
      'quatix® 6X',
      'quatix® 6X Solar',
      'quatix® 6X Dual Power',
    ],
  ],
  ['fēnix® 7 / quatix® 7', ['fēnix® 7', 'quatix® 7']],
  ['fēnix® 7X / tactix® 7 / quatix® 7X Solar / Enduro™ 2', ['fēnix® 7X', 'tactix® 7', 'quatix® 7X Solar', 'Enduro™ 2']],
  [
    'fēnix® 8 47mm / 51mm / tactix® 8 47mm / 51mm / quatix® 8 47mm / 51mm',
    ['fēnix® 8 47mm', 'fēnix® 8 51mm', 'tactix® 8 47mm', 'tactix® 8 51mm', 'quatix® 8 47mm', 'quatix® 8 51mm'],
  ],
  [
    'fēnix® 8 Pro 47mm / 51mm / MicroLED / quatix® 8 Pro 47mm / 51mm',
    ['fēnix® 8 Pro 47mm', 'fēnix® 8 Pro 51mm', 'fēnix® 8 Pro MicroLED', 'quatix® 8 Pro 47mm', 'quatix® 8 Pro 51mm'],
  ],
  ['fēnix® 8 Solar 51mm / tactix® 8 Solar 51mm', ['fēnix® 8 Solar 51mm', 'tactix® 8 Solar 51mm']],
  ['fēnix® 9 47mm / 51mm', ['fēnix® 9 47mm', 'fēnix® 9 51mm']],
  ['Forerunner® 955 / Solar', ['Forerunner® 955', 'Forerunner® 955 Solar']],
  ['Instinct® 2 / Solar / Dual Power / dēzl Edition', ['Instinct® 2', 'Instinct® 2 Solar', 'Instinct® 2 Dual Power', 'Instinct® 2 dēzl Edition']],
  ['Instinct® 2S / Solar / Dual Power', ['Instinct® 2S', 'Instinct® 2S Solar', 'Instinct® 2S Dual Power']],
  ['Instinct® 3 Solar 45mm / 50mm', ['Instinct® 3 Solar 45mm', 'Instinct® 3 Solar 50mm']],
  [
    'MARQ® (Gen 2) Athlete / Adventurer / Captain / Golfer / Carbon Edition / Commander - Carbon Edition',
    [
      'MARQ® (Gen 2) Athlete',
      'MARQ® (Gen 2) Adventurer',
      'MARQ® (Gen 2) Captain',
      'MARQ® (Gen 2) Golfer',
      'MARQ® (Gen 2) Carbon Edition',
      'MARQ® (Gen 2) Commander - Carbon Edition',
    ],
  ],
  ['MARQ® Captain / MARQ® Captain: American Magic Edition', ['MARQ® Captain', 'MARQ® Captain: American Magic Edition']],
  ['Venu® 4 45mm / D2™ Air X15', ['Venu® 4 45mm', 'D2™ Air X15']],
];

describe('expand: every marketing name of an SDK display name', () => {
  test.each(MULTI)('%s', (displayName, names) => {
    expect(expand(displayName)).toEqual(names);
  });

  test('the table holds all 24 multi-name products; a single name stays as it is', () => {
    expect(MULTI).toHaveLength(24);
    expect(new Set(MULTI.map(([d]) => d)).size).toBe(24);
    expect(expand('Forerunner® 265')).toEqual(['Forerunner® 265']);
  });
});

describe('why a device is not supported', () => {
  test.each([
    ['Edge: a bike computer', edge540, { reason: 'notWatch', kind: 'bike' }],
    ['GPSMAP: a handheld', gpsmap66, { reason: 'notWatch', kind: 'handheld' }],
    ['Forerunner 45: watch faces only', fr45, { reason: 'noApps', ciq: '1.4.5' }],
    ['Forerunner 235: apps, but no background', fr235, { reason: 'noBackground', ciq: '1.4.5' }],
    ['vívoactive 3: Connect IQ below 3.2 on every part', vivoactive3, { reason: 'oldCiq', ciq: '3.1.9' }],
    ['a watch that passes the rule: not listed', fr265, { reason: 'notListed', ciq: '5.2.0' }],
  ])('%s', (_, d, why) => {
    expect(unsupportedReason(d, '3.2.0')).toEqual(why);
  });
});

describe('what each model sends', () => {
  test('fēnix 5 Plus: no Body Battery; stress and rides only with the newest firmware; less on the Asian part', () => {
    const { list } = buildList({ manifest: manifest(['fenix5plus']), devices: [fenix5plus], store: [], sdk: '9.2.0' });
    expect(list.supported[0]).toEqual({
      id: 'fenix5plus',
      series: 'fēnix',
      label: 'fēnix® 5 Plus',
      names: ['fēnix® 5 Plus'],
      ciq: '3.3.3',
      bg: 32,
      parts: ['006-B3110-00', '006-B3089-00'],
      lacks: ['bodyBattery'],
      newest: ['stress', 'rides'],
      apac: { lacks: ['stress', 'rides'] },
    });
  });

  test('Venu Mercedes-Benz: steps and heart rate only — the global firmware has Connect IQ 3.2.6 and no history APIs', () => {
    const { list } = buildList({ manifest: manifest(['venud']), devices: [venud], store: [], sdk: '9.2.0' });
    const s = list.supported[0]!;
    expect(s.lacks).toEqual(['stress', 'bodyBattery', 'rides']);
    expect(s.newest).toBeUndefined();
    expect(s.apac).toBeUndefined();
    expect(s.ciq).toBe('3.2.6');
  });

  test('Instinct 2: full on the European version; „Dual Power” names belong to the Asian one, which sends less', () => {
    const store: StoreDevice[] = [
      { partNumber: '006-B3888-00', name: 'Instinct® 2', additionalNames: ['Instinct® 2 - Camo Edition', 'Instinct® 2 Solar - Tactical Edition'] },
      { partNumber: '006-B4071-00', name: 'Instinct® 2', additionalNames: ['Instinct® 2 Dual Power', 'Instinct® 2 Dual Power ONE PIECE LUFFY '] },
    ];
    const { list } = buildList({ manifest: manifest(['instinct2']), devices: [instinct2], store, sdk: '9.2.0' });
    const s = list.supported[0]!;
    expect(s.lacks).toBeUndefined();
    expect(s.newest).toBeUndefined();
    expect(s.names).toEqual(['Instinct® 2', 'Instinct® 2 Solar', 'Instinct® 2 dēzl Edition']);
    expect(s.aliases).toEqual(['Instinct® 2 - Camo Edition', 'Instinct® 2 Solar - Tactical Edition']);
    expect(s.apac).toEqual({ lacks: ['stress', 'bodyBattery', 'rides'], names: ['Instinct® 2 Dual Power', 'Instinct® 2 Dual Power ONE PIECE LUFFY'] });
    expect(s.bg).toBe(32);
  });

  test('an API the device lists still needs Connect IQ 3.3 on the part', () => {
    const old = device('x', 'Forerunner® 999', [part('006-B9999-00', '3.2.9', { fw: 100 })]);
    const { list } = buildList({ manifest: manifest(['x']), devices: [old], store: [], sdk: '9.2.0' });
    expect(list.supported[0]!.lacks).toEqual(['stress', 'bodyBattery', 'rides']);
  });
});

describe('background memory', () => {
  test('32 under 64 kB, 64 from 64 kB; no background is an error', () => {
    expect(bgOf(device('a', 'A', [], { bg: 32768 }))).toBe(32);
    expect(bgOf(device('a', 'A', [], { bg: 49152 }))).toBe(32);
    expect(bgOf(device('a', 'A', [], { bg: 65536 }))).toBe(64);
    expect(bgOf(device('a', 'A', [], { bg: 131072 }))).toBe(64);
    expect(() => bgOf(device('a', 'A', [], { types: ['watchApp'] }))).toThrow(/background/);
  });
});

describe('aliases from the store catalog', () => {
  const instinct3a = device('instinct3amoled50mm', 'Instinct® 3 AMOLED 50mm', [part('006-B4586-00', '5.1.0', { fw: 100 })]);
  const instinct3s = device('instinct3solar45mm', 'Instinct® 3 Solar 45mm / 50mm', [part('006-B4587-00', '5.1.0', { fw: 100 })]);
  const store: StoreDevice[] = [
    // A one-word fragment of „…, Solar, Tactical”, and a name two products share.
    { partNumber: '006-B4586-00', name: 'Instinct® 3 – 50 mm, AMOLED', additionalNames: ['Instinct® 3 – 50 mm', 'Solar', 'Tactical'] },
    { partNumber: '006-B4587-00', name: 'Instinct® 3 – 45 mm, Solar', additionalNames: ['Instinct® 3 – 50 mm, Solar', 'Instinct® 3 – 50 mm'] },
    // The SDK name in other punctuation is no alias; a new spelling is.
    { partNumber: '006-B4257-00', name: 'Forerunner® (265)', additionalNames: ['ForeAthlete 265', 'Forerunner® 265 – Black'] },
    // The LTE model's store name spells the supported Music model.
    { partNumber: '006-B3473-00', name: 'vívoactive® 3 Music LTE', additionalNames: ['vívoactive® 3 Music'] },
  ];
  const devices = [instinct3a, instinct3s, fr265, vivoactive3m, vivoactive3mlte];
  const { list, warnings } = buildList({ manifest: manifest(['fr265', 'instinct3amoled50mm', 'instinct3solar45mm', 'vivoactive3m']), devices, store, sdk: '9.2.0' });
  const byId = (id: string) => [...list.supported, ...list.unsupported].find((x) => x.id === id)!;

  test('store names minus the SDK names, minus one-word fragments; sorted', () => {
    expect(byId('fr265').aliases).toEqual(['ForeAthlete 265', 'Forerunner® 265 – Black']);
    expect(byId('instinct3amoled50mm').aliases).toEqual(['Instinct® 3 – 50 mm, AMOLED']);
    expect(byId('instinct3solar45mm').aliases).toEqual(['Instinct® 3 – 45 mm, Solar', 'Instinct® 3 – 50 mm, Solar']);
  });

  test('a store name under two products is dropped from both, with a warning', () => {
    expect(JSON.stringify(list)).not.toContain('"Instinct® 3 – 50 mm"');
    expect(warnings).toContainEqual(expect.stringContaining('Instinct® 3 – 50 mm'));
  });

  test('an unsupported device does not take a supported model’s name', () => {
    expect(byId('vivoactive3mlte')).toMatchObject({ reason: 'oldCiq', names: ['vívoactive® 3 Music LTE'] });
    expect(byId('vivoactive3mlte').aliases).toBeUndefined();
    expect(warnings).toContainEqual(expect.stringContaining('vívoactive® 3 Music'));
  });
});

describe('the whole list', () => {
  const devices = [fenix5plus, venud, instinct2, fr265, vivoactive3m, edge540, gpsmap66, fr45, fr235, vivoactive3, vivoactive3mlte];
  const ids = ['fenix5plus', 'fr265', 'instinct2', 'venud', 'vivoactive3m'];
  const store: StoreDevice[] = [{ partNumber: '006-B4071-00', name: 'Instinct® 2', additionalNames: ['Instinct® 2 Dual Power'] }];

  test('deterministic: the same bytes for the same input, in any order', () => {
    const a = serialize(buildList({ manifest: manifest(ids), devices, store, sdk: '9.2.0' }).list);
    const b = serialize(buildList({ manifest: manifest(ids), devices: [...devices].reverse(), store, sdk: '9.2.0' }).list);
    expect(b).toBe(a);
    expect(a.endsWith('}\n')).toBe(true);
    expect(a).toContain('\n  "supported": [\n    {\n      "id": "fenix5plus",');
  });

  test('supported in manifest order, unsupported by name, with the header', () => {
    const { list, warnings } = buildList({ manifest: manifest(ids), devices, store, sdk: '9.2.0' });
    expect(list.supported.map((s) => s.id)).toEqual(ids);
    expect(list.unsupported.map((u) => u.id)).toEqual(['edge540', 'fr235', 'fr45', 'gpsmap66', 'vivoactive3', 'vivoactive3mlte']);
    expect(list).toMatchObject({ sdk: '9.2.0', appId: '23e4c6b5e09245379ec788ddc26b4c2a', minCiq: '3.2.0' });
    expect(list.$comment).toMatch(/npm run garmin:watches/);
    expect(warnings).toEqual([]);
  });

  test('a manifest product the SDK lacks is an error; so is a product without a Polish part', () => {
    expect(() => buildList({ manifest: manifest(['fr265', 'marq3']), devices, store, sdk: '9.2.0' })).toThrow(/marq3/);
    const asianOnly = device('x', 'Forerunner® 999', [part('006-B9999-00', '5.0.0', { pol: false })]);
    expect(() => buildList({ manifest: manifest(['x']), devices: [asianOnly], store: [], sdk: '9.2.0' })).toThrow(/polskiego/);
  });

  test('a watch that passes the manifest rule but is not in it is a warning', () => {
    const { list, warnings } = buildList({ manifest: manifest(['fenix5plus']), devices: [fenix5plus, fr265], store: [], sdk: '9.2.0' });
    expect(list.unsupported).toMatchObject([{ id: 'fr265', reason: 'notListed' }]);
    expect(warnings).toEqual([expect.stringContaining('fr265')]);
  });

  test('changedIds names what --check found different', () => {
    const before = buildList({ manifest: manifest(ids), devices, store, sdk: '9.2.0' }).list;
    const after = buildList({ manifest: manifest(ids.filter((id) => id !== 'venud')), devices, store, sdk: '9.2.0' }).list;
    // venud moved from supported to unsupported („notListed”).
    expect(changedIds(before, after)).toEqual(['venud']);
    expect(changedIds(before, before)).toEqual([]);
    expect(STALE).toContain('npm run garmin:watches');
  });
});

describe('inputs', () => {
  test('the real manifest: 118 products, the production app id, Connect IQ 3.2', () => {
    const m = parseManifest(readFileSync(new URL('../../garmin/manifest.xml', import.meta.url), 'utf8'));
    expect(m.ids).toHaveLength(118);
    expect(m.appId).toBe('23e4c6b5e09245379ec788ddc26b4c2a');
    expect(m.minCiq).toBe('3.2.0');
    expect(() => parseManifest('<iq:manifest/>')).toThrow(/manifest/);
  });

  test('the SDK version from current-sdk.cfg or an SDK path', () => {
    expect(sdkVersion('/Users/x/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-9.2.0-2026-06-09-92a1605b2/\n')).toBe('9.2.0');
    expect(sdkVersion('C:\\sdk\\connectiq-sdk-win-8.1.1-2025-03-27-66dae750f')).toBe('8.1.1');
    expect(sdkVersion('')).toBeNull();
  });

  test('versions compare as numbers', () => {
    expect(cmpVersion('3.3.3', '3.10.0')).toBeLessThan(0);
    expect(cmpVersion('3.2', '3.2.0')).toBe(0);
    expect(cmpVersion('6.0.3', '5.2.0')).toBeGreaterThan(0);
  });

  test('the store catalog: checked, trimmed to part number and names, sorted by part number', () => {
    const raw = [
      { id: '20', partNumber: '006-B2431-00', name: 'Forerunner® 235', additionalNames: [], imageUrl: 'x', urlName: 'forerunner235' },
      { id: '5', partNumber: '006-B2050-00', name: 'fēnix® 3', additionalNames: ['quatix® 3', 7, 'tactix® Bravo'] },
    ];
    expect(trimStore(raw)).toEqual([
      { partNumber: '006-B2050-00', name: 'fēnix® 3', additionalNames: ['quatix® 3', 'tactix® Bravo'] },
      { partNumber: '006-B2431-00', name: 'Forerunner® 235' },
    ]);
    expect(() => trimStore({ deviceTypes: [] })).toThrow();
    expect(() => trimStore([])).toThrow();
    expect(() => trimStore([{ partNumber: '006-B2431-00' }])).toThrow(/name/);
  });

  test('the committed store catalog is already in that form', () => {
    const text = readFileSync(new URL('../../garmin/store-devices.json', import.meta.url), 'utf8');
    const store = JSON.parse(text) as unknown;
    expect(serialize(trimStore(store))).toBe(text);
    expect(trimStore(store)).toHaveLength(343);
  });

  test('store devices the SDK knows neither by part nor by name: newer than the SDK download', () => {
    const store: StoreDevice[] = [
      { partNumber: '006-B4257-00', name: 'Forerunner® 265' },
      { partNumber: '006-B2312-00', name: 'Forerunner® 235' },
      { partNumber: '006-B5000-00', name: 'MARQ® Adventurer (Gen 3)', additionalNames: ['MARQ® Athlete (Gen 3)'] },
    ];
    expect(storeOnly(store, [fr265, fr235]).map((s) => s.partNumber)).toEqual(['006-B5000-00']);
  });
});
