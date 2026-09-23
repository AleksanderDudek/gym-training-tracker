import { describe, expect, it } from 'vitest';
import { planById, planId } from '../data/plans';
import { freshState } from './plan';
import { GROUPS_OF_EX } from './metrics';
import { ART_NAMES, bandFor, hasArt } from '../components/BadgeArt';
import { buildSchedule, planStats } from './schedule';
import { ACHIEVEMENTS, achCtx, achievementProgress, migrateBadges, syncBadges, tierKey } from './badges';
import { advise } from './advice';
import { bankPoints, snapshot } from './snapshot';
import type { ActivePlan, AppState, LogEntry } from '../types';

const t3 = planById(planId('base', 'any', 3))!;
const activePlan = (start: string): ActivePlan => ({
  templateId: t3.id,
  start,
  weekdays: t3.weekdays,
  policy: 'shift',
  ticked: {},
});

const entry = (date: string): LogEntry => ({
  date: `${date}T18:00:00.000Z`,
  workout: 'A',
  ready: 'ok',
  items: [{ id: 'swing2', sets: [{ reps: 10, w: 16 }], effort: 'solid' }],
});

const withLog = (dates: string[]): AppState => {
  const s = freshState();
  s.log = dates.map(entry);
  s.plan = activePlan('2026-08-31');
  return s;
};

const ctx = (s: AppState, today: string) => {
  const logged = [...new Set(s.log.map((e) => e.date.slice(0, 10)))].sort();
  const schedule = buildSchedule(t3, s.plan!, logged, today);
  return achCtx(s, schedule, planStats(schedule, today), today);
};

/** Które rodziny dostały nowy próg. */
const ids = (hits: { ach: { id: string } }[]): string[] => hits.map((h) => h.ach.id);

describe('odznaki', () => {
  it('każda rodzina ma opis, znacznik i rosnące progi', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    ACHIEVEMENTS.forEach((a) => {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
      // Medal niesie albo piktogram, albo napis — nigdy nic.
      expect(hasArt(a.art) || a.mark.length > 0).toBe(true);
      expect(a.tiers.length).toBeGreaterThan(0);
      a.tiers.forEach((t, i) => {
        if (i > 0) expect(t).toBeGreaterThan(a.tiers[i - 1]!);
      });
    });
  });

  it('żadna rodzina nie wywraca się na pustym stanie', () => {
    const rows = achievementProgress(achCtx(freshState(), null, null, '2026-08-31'));
    expect(rows).toHaveLength(ACHIEVEMENTS.length);
    rows.forEach((r) => {
      expect(Number.isFinite(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(1);
    });
  });

  it('każda partia ruchu z biblioteki ma swoją rodzinę odznak', () => {
    const covered = new Set(
      ACHIEVEMENTS.filter((a) => a.group === 'partie').map((a) => a.desc.match(/„(.+)”/)?.[1]),
    );
    GROUPS_OF_EX.forEach((g) => expect(covered.has(g)).toBe(true));
  });

  it('okna czasu idą od doby aż po rok', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    [
      'dzien-powtorzenia',
      'tydzien-powtorzenia',
      'dwa-tygodnie-powtorzenia',
      'trzy-tygodnie-powtorzenia',
      'miesiac-powtorzenia',
      'kwartal-powtorzenia',
      'polrocze-powtorzenia',
      'rok-powtorzenia',
    ].forEach((id) => expect(ids).toContain(id));
  });

  it('drabiny sięgają dalej niż rok regularnych treningów', () => {
    const top = (id: string): number => {
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      return a.tiers[a.tiers.length - 1]!;
    };
    // Trzy sesje w tygodniu przez rok to jakieś 156 treningów i 16 000 powtórzeń.
    expect(top('treningi')).toBeGreaterThan(156);
    expect(top('powtorzenia')).toBeGreaterThan(16_000);
    expect(top('rytm')).toBeGreaterThan(52);
  });

  it('każda rodzina ma puentę i żadna nie dokucza użytkownikowi', () => {
    // Zwroty, nie pojedyncze słowa — „bez wstydu” pociesza, a nie dokucza.
    const harsh = /wstydź się|jesteś (słab|leni|gruby)|za słab|nieudacznik|żałosn|leniu|do niczego/i;
    ACHIEVEMENTS.forEach((a) => {
      expect({ id: a.id, ok: (a.quip ?? '').length > 15 }).toEqual({ id: a.id, ok: true });
      expect(a.quip).not.toMatch(harsh);
    });
  });

  it('puenta nie zastępuje opisu — informacja i żart stoją osobno', () => {
    ACHIEVEMENTS.forEach((a) => {
      expect(a.desc.length).toBeGreaterThan(20);
      expect(a.quip).not.toBe(a.desc);
    });
  });

  it('każdy piktogram odznaki istnieje w rejestrze rysunków', () => {
    ACHIEVEMENTS.forEach((a) => {
      if (a.art) expect(ART_NAMES).toContain(a.art);
    });
  });

  it('napis na medalu mieści się w kształcie', () => {
    ACHIEVEMENTS.filter((a) => !a.art).forEach((a) => {
      expect(a.mark.length).toBeGreaterThan(0);
      expect(a.mark.length).toBeLessThanOrEqual(3);
    });
  });

  it('tworzywo rośnie z postępem, a domknięcie rodziny daje szmaragd', () => {
    expect(bandFor(0, 6)).toBe(0);
    expect(bandFor(1, 10)).toBe(1);
    expect(bandFor(10, 10)).toBe(5);
    expect(bandFor(3, 3)).toBe(5);
    // Odznaka jednorazowa to złoto, nie szmaragd — jeden trening przed ósmą nie waży tyle,
    // co domknięta dziesięcioprogowa rodzina.
    expect(bandFor(1, 1)).toBe(3);

    ACHIEVEMENTS.forEach((a) => {
      const bands = a.tiers.map((_, i) => bandFor(i + 1, a.tiers.length));
      expect(bands[bands.length - 1]).toBe(a.tiers.length === 1 ? 3 : 5);
      bands.forEach((b, i) => {
        if (i > 0) expect(b).toBeGreaterThanOrEqual(bands[i - 1]!);
      });
    });
  });

  it('żadne dwie rodziny w tej samej grupie nie noszą tego samego rysunku', () => {
    const byGroup = new Map<string, string[]>();
    ACHIEVEMENTS.forEach((a) => {
      const key = a.art ?? `mark:${a.mark}`;
      byGroup.set(a.group, [...(byGroup.get(a.group) ?? []), key]);
    });
    byGroup.forEach((keys, group) => {
      const dupes = keys.filter((k, i) => !k.startsWith('mark:') && keys.indexOf(k) !== i);
      expect({ group, dupes }).toEqual({ group, dupes: [] });
    });
  });

  it('pierwszy trening odblokowuje pierwszy próg dorobku', () => {
    const s = withLog(['2026-08-31']);
    const fresh = syncBadges(s, ctx(s, '2026-08-31'));
    expect(ids(fresh)).toContain('treningi');
    expect(s.award.badges[tierKey('treningi', 1)]).toBe('2026-08-31');
  });

  it('nie przyznaje tego samego progu dwa razy', () => {
    const s = withLog(['2026-08-31']);
    syncBadges(s, ctx(s, '2026-08-31'));
    const again = syncBadges(s, ctx(s, '2026-09-02'));
    expect(ids(again)).not.toContain('treningi');
    expect(s.events.filter((e) => e.id === `badge:${tierKey('treningi', 1)}`)).toHaveLength(1);
  });

  it('jeden skok wartości potrafi zabrać kilka progów naraz', () => {
    const s = withLog(['2026-08-31']);
    // Jedna sesja z dużą objętością przeskakuje pierwszy próg powtórzeń.
    s.log[0]!.items = [{ id: 'swing2', sets: [{ reps: 600, w: 16 }], effort: 'solid' }];
    const fresh = syncBadges(s, ctx(s, '2026-08-31'));
    const reps = fresh.filter((h) => h.ach.id === 'powtorzenia');
    expect(reps.length).toBeGreaterThanOrEqual(1);
    expect(reps[0]!.tier).toBe(1);
  });

  it('seria trzech terminów w terminie daje pierwszy próg serii', () => {
    const s = withLog(['2026-08-31', '2026-09-02', '2026-09-04']);
    const fresh = ids(syncBadges(s, ctx(s, '2026-09-04')));
    expect(fresh).toContain('seria');
    expect(fresh).toContain('czysty-tydzien');
  });

  it('nadrobiony termin daje odznakę za nadrobienie', () => {
    const s = withLog(['2026-09-01']);
    expect(ids(syncBadges(s, ctx(s, '2026-09-01')))).toContain('nadrabiacz');
  });

  it('odznaka raz zdobyta zostaje po zmianie planu', () => {
    const s = withLog(['2026-08-31']);
    syncBadges(s, ctx(s, '2026-08-31'));
    s.plan = null;
    expect(s.award.badges[tierKey('treningi', 1)]).toBeTruthy();
  });

  it('każdy zdobyty próg trafia do dziennika', () => {
    const s = withLog(['2026-08-31']);
    syncBadges(s, ctx(s, '2026-08-31')).forEach((h) => {
      expect(s.events.some((e) => e.id === `badge:${tierKey(h.ach.id, h.tier)}`)).toBe(true);
    });
  });

  it('postęp liczy drogę od zdobytego progu do następnego', () => {
    const s = withLog(['2026-08-31', '2026-09-02', '2026-09-04', '2026-09-07', '2026-09-09']);
    const rows = achievementProgress(ctx(s, '2026-09-09'));
    const treningi = rows.find((r) => r.ach.id === 'treningi')!;
    expect(treningi.value).toBe(5);
    expect(treningi.tier).toBe(1);
    expect(treningi.next).toBe(10);
    // Pięć treningów to cztery kroki z dziewięciu dzielących próg pierwszy od drugiego.
    expect(treningi.progress).toBeCloseTo(4 / 9, 5);

    const atlas = rows.find((r) => r.ach.id === 'atlas')!;
    expect(atlas.value).toBe(1);
    expect(atlas.tier).toBe(0);
    expect(atlas.progress).toBeCloseTo(1 / 5, 5);
  });

  it('rodziny zależne od planu milczą, gdy planu nie ma', () => {
    const s = withLog(['2026-08-31']);
    s.plan = null;
    const rows = achievementProgress(achCtx(s, null, null, '2026-08-31'));
    expect(rows.find((r) => r.ach.id === 'seria')!.value).toBe(0);
    // Dorobek liczy się dalej — nie zależy od kalendarza.
    expect(rows.find((r) => r.ach.id === 'treningi')!.value).toBe(1);
  });

  it('przenosi odznaki sprzed wprowadzenia progów', () => {
    const out = migrateBadges({
      'pierwszy-krok': '2026-01-02',
      setka: '2026-03-04',
      'seria-10': '2026-02-02',
      'treningi:2': '2026-05-05',
      nieznana: '2026-06-06',
    });
    expect(out['treningi:1']).toBe('2026-01-02');
    expect(out['treningi:5']).toBe('2026-03-04');
    expect(out['seria:2']).toBe('2026-02-02');
    expect(out['treningi:2']).toBe('2026-05-05');
    expect(out['nieznana']).toBeUndefined();
  });
});

describe('dorobek', () => {
  it('punkty z zamkniętego planu przechodzą do dorobku', () => {
    const s = withLog(['2026-08-31']);
    const before = snapshot(s, '2026-08-31')!.score.points;
    const banked = bankPoints(s, '2026-08-31');
    expect(banked).toBe(before);
    expect(s.award.banked).toBe(before);
  });

  it('dorobek doliczany do punktów kolejnego planu', () => {
    const s = withLog(['2026-08-31']);
    s.award.banked = 1000;
    const snap = snapshot(s, '2026-08-31')!;
    expect(snap.points).toBe(1000 + snap.score.points);
  });
});

describe('podpowiedzi', () => {
  const tip = (s: AppState, today: string) => {
    const snap = snapshot(s, today)!;
    return advise(s, snap.template, snap.plan, snap.stats, today);
  };

  it('w dniu terminu zachęca do treningu', () => {
    const s = withLog([]);
    expect(tip(s, '2026-08-31')[0]!.kind).toBe('due');
  });

  it('po terminie proponuje nadrobienie i podaje, ile zostało czasu', () => {
    const s = withLog([]);
    const a = tip(s, '2026-09-01')[0]!;
    expect(a.kind).toBe('makeup');
    expect(a.text).toContain('nadrobienie');
  });

  it('w dzień wolny mówi o przerwie, nie o zaległości', () => {
    const s = withLog(['2026-08-31']);
    expect(tip(s, '2026-08-31')[0]!.kind).toBe('rest');
  });

  it('przy niskiej realizacji proponuje rzadszy wariant', () => {
    const s = withLog(['2026-08-31']);
    const a = tip(s, '2026-09-21').find((x) => x.kind === 'slower');
    expect(a).toBeDefined();
    expect(a!.freq).toBe(2);
  });

  it('przy pełnej realizacji proponuje gęstszy wariant', () => {
    const dates = buildSchedule(t3, activePlan('2026-08-31'), [], '2026-08-31')
      .days.slice(0, 9)
      .map((d) => d.date);
    const s = withLog(dates);
    const a = tip(s, dates[dates.length - 1]!).find((x) => x.kind === 'faster');
    expect(a).toBeDefined();
    expect(a!.freq).toBe(4);
  });

  it('po długiej przerwie ostrzega przed ciężkim wejściem', () => {
    const s = withLog(['2026-08-31']);
    expect(tip(s, '2026-09-21').some((x) => x.kind === 'layoff')).toBe(true);
  });
});
