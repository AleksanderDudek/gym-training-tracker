import { beforeEach, describe, expect, it } from 'vitest';
import {
  PLANS_PATH,
  PLAN_CLASSIC_PATH,
  PLAN_NEW_PATH,
  PROMO_PATH,
  SECTIONS,
  SETTINGS_PATH,
  TABS,
  WATCH_PATH,
  activeTab,
  forgetSections,
  isDeviceLink,
  planEditPath,
  planPath,
  restaurantPath,
  rememberSection,
  sectionHref,
  tabHref,
  workoutEditPath,
  workoutNewPath,
  workoutPath,
  cardioAddPath,
  cardioPath,
  exercisePath,
  isFoodRoute,
  isTabRoot,
  parseHash,
  screenOf,
  snackAddPath,
  snacksPath,
  statsPath,
} from './routing';
import type { Route } from './types';
import type { TabKey } from './types';

describe('zakładki i sekcje', () => {
  beforeEach(() => forgetSections());

  it('dolny pasek: Dziś · Trening · Jedzenie · Osiągnięcia · Profil', () => {
    expect(TABS.map((t) => [t.key, t.label])).toEqual([
      ['train', 'Dziś'],
      ['work', 'Trening'],
      ['food', 'Jedzenie'],
      ['ach', 'Osiągnięcia'],
      ['prog', 'Profil'],
    ]);
  });

  it('sekcje Jedzenia i podstrony dziennika mają własne adresy', () => {
    expect(parseHash('#/jedzenie')).toEqual({ kind: 'food', section: 'diary' });
    expect(parseHash('#/przepisy')).toEqual({ kind: 'food', section: 'recipes' });
    expect(parseHash('#/produkty')).toEqual({ kind: 'food', section: 'products' });
    expect(parseHash('#/w-poblizu')).toEqual({ kind: 'food', section: 'nearby' });
    expect(parseHash('#/jedzenie/plan')).toEqual({ kind: 'diet', page: 'plan' });
    expect(parseHash('#/jedzenie/postep')).toEqual({ kind: 'diet', page: 'progress' });
    expect(parseHash('#/jedzenie/profil')).toEqual({ kind: 'diet', page: 'profile' });
    expect(parseHash('#/jedzenie/zakupy')).toEqual({ kind: 'diet', page: 'shopping' });
    expect(parseHash('#/jedzenie/plany')).toEqual({ kind: 'diet', page: 'plans' });
    // Nieznana podstrona dziennika prowadzi do dziennika, a nie na ekran Dziś.
    expect(parseHash('#/jedzenie/cos')).toEqual({ kind: 'food', section: 'diary' });
  });

  it('Lokale to podstrona Produktów, a menu sieci — podstrona Lokali', () => {
    expect(parseHash('#/lokale')).toEqual({ kind: 'restaurants', chain: null });
    expect(parseHash('#/lokale?q=big+mac')).toEqual({ kind: 'restaurants', chain: null });
    expect(parseHash('#/lokale/kfc?kat=kurczak')).toEqual({ kind: 'restaurants', chain: 'kfc' });
    expect(parseHash(restaurantPath('burger-king'))).toEqual({ kind: 'restaurants', chain: 'burger-king' });
    expect(screenOf(parseHash('#/lokale'))).toEqual({ title: 'Lokale', parent: '#/produkty' });
    expect(screenOf(parseHash('#/lokale/kfc'))).toEqual({ title: 'Menu', parent: '#/lokale' });
    expect(activeTab(parseHash('#/lokale/kfc'))).toBe('food' as TabKey);
    expect(isFoodRoute(parseHash('#/lokale'))).toBe(true);
    expect(isFoodRoute(parseHash('#/jedzenie/plan'))).toBe(true);
    expect(isFoodRoute(parseHash('#/treningi'))).toBe(false);
    // Podstrona, nie korzeń sekcji: ze strzałką wstecz i bez pamięci przełącznika.
    expect(isTabRoot('#/lokale')).toBe(false);
  });

  it('zapytanie w hashu to stan strony, nie część trasy — także na starych adresach', () => {
    expect(parseHash('#/produkty?q=skyr')).toEqual({ kind: 'food', section: 'products' });
    expect(parseHash('#/produkty?q=skyr&p=5901234')).toEqual({ kind: 'food', section: 'products' });
    expect(parseHash('#/jedzenie?dodaj=1')).toEqual({ kind: 'food', section: 'diary' });
    expect(parseHash('#/jedzenie/postep?od=2026-01-01')).toEqual({ kind: 'diet', page: 'progress' });
    expect(parseHash('#/treningi?x=1')).toEqual({ kind: 'tab', tab: 'work' });
    expect(parseHash('#/cwiczenia/swing2?x=1')).toEqual({ kind: 'exercise', id: 'swing2' });
    expect(parseHash('#/plan?x')).toEqual({ kind: 'tab', tab: 'plan' });
  });

  it('Plan, Treningi i Ćwiczenia z podstronami podświetlają Trening', () => {
    const work = [
      '#/plan',
      PLANS_PATH,
      PLAN_CLASSIC_PATH,
      PLAN_NEW_PATH,
      planPath('cel-ppl-60'),
      planEditPath('p1'),
      '#/treningi',
      workoutPath('A'),
      workoutNewPath(),
      workoutEditPath('w1'),
      '#/cwiczenia',
      exercisePath('swing2'),
    ];
    work.forEach((h) => expect(activeTab(parseHash(h)), h).toBe('work' as TabKey));
  });

  it('sekcje i podstrony jedzenia podświetlają Jedzenie', () => {
    ['#/jedzenie', '#/przepisy', '#/produkty?q=a', '#/w-poblizu', '#/jedzenie/plan', '#/jedzenie/postep', '#/jedzenie/profil', '#/jedzenie/zakupy'].forEach(
      (h) => expect(activeTab(parseHash(h)), h).toBe('food' as TabKey),
    );
  });

  it('korzenie sekcji nie mają strzałki wstecz, podstrony dziennika wracają do dziennika', () => {
    const roots: [string, string][] = [
      ['#/plan', 'Plan'],
      ['#/treningi', 'Treningi'],
      ['#/cwiczenia', 'Ćwiczenia'],
      ['#/jedzenie', 'Jedzenie'],
      ['#/przepisy', 'Przepisy'],
      ['#/produkty', 'Produkty'],
      ['#/w-poblizu', 'W pobliżu'],
    ];
    roots.forEach(([h, title]) => expect(screenOf(parseHash(h)), h).toEqual({ title, parent: null }));
    expect(screenOf(parseHash('#/jedzenie/plan'))).toEqual({ title: 'Plan posiłków', parent: '#/jedzenie' });
    expect(screenOf(parseHash('#/jedzenie/postep'))).toEqual({ title: 'Postęp', parent: '#/jedzenie' });
    expect(screenOf(parseHash('#/jedzenie/profil'))).toEqual({ title: 'Profil diety', parent: '#/jedzenie' });
    // Lista zakupów wraca do planu, z którego powstała.
    expect(screenOf(parseHash('#/jedzenie/zakupy'))).toEqual({ title: 'Lista zakupów', parent: '#/jedzenie/plan' });
  });

  it('przełącznik sekcji: Plan · Treningi · Ćwiczenia i Dziennik · Przepisy · Produkty · W pobliżu', () => {
    expect(SECTIONS.work.map((s) => [s.path, s.label])).toEqual([
      ['#/plan', 'Plan'],
      ['#/treningi', 'Treningi'],
      ['#/cwiczenia', 'Ćwiczenia'],
    ]);
    expect(SECTIONS.food.map((s) => [s.path, s.label])).toEqual([
      ['#/jedzenie', 'Dziennik'],
      ['#/przepisy', 'Przepisy'],
      ['#/produkty', 'Produkty'],
      ['#/w-poblizu', 'W pobliżu'],
    ]);
    // Każda sekcja należy do swojej zakładki.
    SECTIONS.work.forEach((s) => expect(activeTab(parseHash(s.path))).toBe('work' as TabKey));
    SECTIONS.food.forEach((s) => expect(activeTab(parseHash(s.path))).toBe('food' as TabKey));
  });

  it('pierwsze wejście w Trening: Plan, gdy plan trwa, inaczej Treningi; w Jedzenie — Dziennik', () => {
    expect(tabHref('work', { hasPlan: true })).toBe('#/plan');
    expect(tabHref('work', { hasPlan: false })).toBe('#/treningi');
    expect(tabHref('food', { hasPlan: false })).toBe('#/jedzenie');
    expect(tabHref('train', { hasPlan: true })).toBe('#/sesja');
    expect(tabHref('ach', { hasPlan: true })).toBe('#/osiagniecia');
    expect(tabHref('prog', { hasPlan: true })).toBe('#/profil');
  });

  it('zakładka wraca do ostatniej sekcji — razem z jej stanem w zapytaniu', () => {
    rememberSection('#/cwiczenia');
    expect(tabHref('work', { hasPlan: true })).toBe('#/cwiczenia');
    rememberSection('#/produkty?q=skyr&ns=a');
    expect(tabHref('food', { hasPlan: false })).toBe('#/produkty?q=skyr&ns=a');
    // Podstrona nie jest sekcją: zakładka wraca do sekcji, z której się w nią weszło.
    rememberSection(exercisePath('swing2'));
    rememberSection('#/jedzenie/postep');
    expect(tabHref('work', { hasPlan: true })).toBe('#/cwiczenia');
    expect(tabHref('food', { hasPlan: false })).toBe('#/produkty?q=skyr&ns=a');
    // Zakładki bez sekcji mają stały adres, cokolwiek się zapamiętało.
    rememberSection('#/sesja');
    expect(tabHref('train', { hasPlan: false })).toBe('#/sesja');
    rememberSection('#/plan');
    expect(tabHref('work', { hasPlan: false })).toBe('#/plan');
    forgetSections();
    expect(tabHref('work', { hasPlan: false })).toBe('#/treningi');
  });

  it('każda sekcja pamięta swój adres z zapytaniem — przełącznik sekcji do niego wraca', () => {
    expect(sectionHref('#/produkty')).toBe('#/produkty');
    rememberSection('#/produkty?q=skyr');
    rememberSection('#/przepisy?czas=15');
    rememberSection('#/jedzenie');
    // Zakładka idzie do ostatniej sekcji, a każda pozycja przełącznika — do ostatniego adresu swojej sekcji.
    expect(tabHref('food', { hasPlan: false })).toBe('#/jedzenie');
    expect(sectionHref('#/produkty')).toBe('#/produkty?q=skyr');
    expect(sectionHref('#/przepisy')).toBe('#/przepisy?czas=15');
    expect(sectionHref('#/w-poblizu')).toBe('#/w-poblizu');
    // Wyczyszczone wyszukiwanie też się pamięta.
    rememberSection('#/produkty');
    expect(sectionHref('#/produkty')).toBe('#/produkty');
    expect(tabHref('food', { hasPlan: false })).toBe('#/produkty');
  });

  it('przewinięcie pamięta się na korzeniach wszystkich sekcji, z zapytaniem i bez', () => {
    ['#/plan', '#/treningi', '#/cwiczenia', '#/jedzenie', '#/przepisy', '#/produkty', '#/w-poblizu'].forEach((h) => {
      expect(isTabRoot(h), h).toBe(true);
      expect(isTabRoot(`${h}?q=a`), `${h}?q=a`).toBe(true);
    });
    expect(isTabRoot('#/jedzenie/plan')).toBe(false);
    expect(isTabRoot(PLANS_PATH)).toBe(false);
  });
});

describe('trasy', () => {
  it('każda zakładka ma własną, unikalną ścieżkę', () => {
    expect(new Set(TABS.map((t) => t.key)).size).toBe(TABS.length);
    expect(new Set(TABS.map((t) => t.path)).size).toBe(TABS.length);
  });

  it('ścieżka każdej zakładki wraca do tej samej zakładki', () => {
    TABS.forEach((t) => {
      const route = parseHash(t.path);
      expect(activeTab(route)).toBe(t.key);
    });
  });

  it('dolny pasek ma od trzech do pięciu pozycji, jak w Material 3 i Apple HIG', () => {
    expect(TABS.length).toBeGreaterThanOrEqual(3);
    expect(TABS.length).toBeLessThanOrEqual(5);
    TABS.forEach((t) => expect(t.icon.length).toBeGreaterThan(2));
  });

  it('etykiety zakładek to jedno słowo — dwa łamałyby się pod ikoną', () => {
    TABS.forEach((t) => expect(t.label).not.toMatch(/\s/));
  });

  it('treningi mają zakładkę, a atlas ćwiczeń jest jej drugą sekcją', () => {
    expect(TABS.find((t) => t.key === 'work')?.path).toBe('#/treningi');
    expect(TABS.some((t) => t.key === 'atlas')).toBe(false);
    expect(parseHash('#/treningi')).toEqual({ kind: 'tab', tab: 'work' });
    expect(activeTab({ kind: 'tab', tab: 'work' })).toBe('work' as TabKey);
    expect(screenOf({ kind: 'tab', tab: 'work' }).parent).toBeNull();
    // Atlas nie ma strzałki wstecz — to sekcja z przełącznikiem, a nie podstrona.
    expect(screenOf({ kind: 'atlas' }).parent).toBeNull();
    expect(activeTab({ kind: 'atlas' })).toBe('work' as TabKey);
  });

  it('podgląd i kreator treningu mają adresy w zakładce Treningi', () => {
    expect(parseHash(workoutPath('push-gym'))).toEqual({ kind: 'workout', id: 'push-gym' });
    expect(parseHash(workoutNewPath())).toEqual({ kind: 'workoutEdit', from: undefined });
    expect(parseHash(workoutNewPath('A'))).toEqual({ kind: 'workoutEdit', from: 'A' });
    expect(parseHash(workoutEditPath('w123'))).toEqual({ kind: 'workoutEdit', id: 'w123' });
    // Z atlasu: kreator otwiera się z ćwiczeniem do dopisania — w nowym treningu, kopii albo własnym.
    expect(parseHash(workoutNewPath(undefined, 'goblet'))).toEqual({ kind: 'workoutEdit', from: undefined, add: 'goblet' });
    expect(parseHash(workoutNewPath('A', 'goblet'))).toEqual({ kind: 'workoutEdit', from: 'A', add: 'goblet' });
    expect(parseHash(workoutEditPath('w123', 'goblet'))).toEqual({ kind: 'workoutEdit', id: 'w123', add: 'goblet' });
    (
      [{ kind: 'workout', id: 'A' }, { kind: 'workoutEdit' }, { kind: 'exercise', id: 'swing2' }] as Route[]
    ).forEach((r) => {
      expect(activeTab(r), r.kind).toBe('work' as TabKey);
      expect(screenOf(r).parent, r.kind).toBeTruthy();
    });
  });

  it('katalog, podgląd, kreator planów i konfigurator klasyczny to podstrony sekcji Plan w Treningu', () => {
    expect(parseHash(PLANS_PATH)).toEqual({ kind: 'plans' });
    expect(parseHash(PLAN_CLASSIC_PATH)).toEqual({ kind: 'planClassic' });
    expect(parseHash(PLAN_NEW_PATH)).toEqual({ kind: 'planEdit' });
    expect(parseHash(planPath('cel-ppl-60'))).toEqual({ kind: 'planDetail', id: 'cel-ppl-60' });
    expect(parseHash(planEditPath('p1'))).toEqual({ kind: 'planEdit', id: 'p1' });
    // Stary adres zakładki Plan prowadzi tam, gdzie prowadził — teraz do sekcji Treningu.
    expect(parseHash('#/plan')).toEqual({ kind: 'tab', tab: 'plan' });
    expect(screenOf({ kind: 'tab', tab: 'plan' })).toEqual({ title: 'Plan', parent: null });
    (
      [{ kind: 'plans' }, { kind: 'planClassic' }, { kind: 'planDetail', id: 'x' }, { kind: 'planEdit' }] as Route[]
    ).forEach((r) => {
      expect(activeTab(r), r.kind).toBe('work' as TabKey);
      expect(screenOf(r).parent, r.kind).toBeTruthy();
    });
  });

  it('korzenie zakładek nie mają strzałki wstecz, podstrony mają', () => {
    TABS.forEach((t) => expect(screenOf(parseHash(t.path)).parent, t.path).toBeNull());
    const subpages: Route[] = [
      { kind: 'exercise', id: 'swing2' },
      { kind: 'exstats', id: 'swing2' },
      { kind: 'snacks' },
      { kind: 'snackAdd', id: 'swing2' },
      { kind: 'cardio' },
      { kind: 'cardioAdd', sport: 'bike' },
      { kind: 'tab', tab: 'set' },
    ];
    subpages.forEach((r) => {
      const s = screenOf(r);
      expect(s.parent, r.kind).toBeTruthy();
      expect(s.title.length, r.kind).toBeGreaterThan(2);
    });
  });

  it('przewinięcie pamięta się na korzeniach zakładek, a pusty adres to ekran Dziś', () => {
    expect(isTabRoot('#/cwiczenia')).toBe(true);
    expect(isTabRoot('')).toBe(true);
    expect(isTabRoot('#/')).toBe(true);
    expect(isTabRoot(exercisePath('swing2'))).toBe(false);
    expect(isTabRoot(snackAddPath())).toBe(false);
  });

  it('ustawienia są poza paskiem, ale wciąż mają działający adres', () => {
    expect(TABS.some((t) => t.key === 'set')).toBe(false);
    expect(parseHash(SETTINGS_PATH)).toEqual({ kind: 'tab', tab: 'set' });
  });

  it('#/zegarek to ustawienia z kartą zegarka — także z modelem w zapytaniu', () => {
    // Dawniej nieznany adres lądował na ekranie Dziś.
    expect(parseHash('#/zegarek')).toEqual({ kind: 'tab', tab: 'set' });
    expect(parseHash('#/zegarek?model=fr265')).toEqual({ kind: 'tab', tab: 'set' });
    expect(WATCH_PATH).toBe('#/zegarek');
    expect(screenOf(parseHash(WATCH_PATH))).toEqual({ title: 'Ustawienia', parent: '#/profil' });
    expect(activeTab(parseHash(WATCH_PATH))).toBe('set' as TabKey);
    expect(isTabRoot(WATCH_PATH)).toBe(false);
  });

  it('link do karty urządzenia: #/zegarek i #/ustawienia?karta=…, nic więcej', () => {
    expect(isDeviceLink('#/zegarek')).toBe(true);
    expect(isDeviceLink('#/zegarek?model=vivoactive3')).toBe(true);
    expect(isDeviceLink('#/ustawienia?karta=zegarek')).toBe(true);
    expect(isDeviceLink('#/ustawienia?karta=telefon')).toBe(true);
    expect(isDeviceLink('#/ustawienia')).toBe(false);
    expect(isDeviceLink('#/ustawienia?karta=')).toBe(false);
    expect(isDeviceLink('#/sesja')).toBe(false);
    expect(isDeviceLink('#/cardio?karta=zegarek')).toBe(false);
    expect(isDeviceLink('')).toBe(false);
  });

  it('sesja ma własny adres, a stary link do treningu dalej działa', () => {
    expect(parseHash('#/sesja')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/trening')).toEqual({ kind: 'tab', tab: 'train' });
    expect(TABS.find((t) => t.key === 'train')?.path).toBe('#/sesja');
    expect(TABS.find((t) => t.key === 'train')?.label).toBe('Dziś');
  });

  it('osiągnięcia mają własny adres', () => {
    expect(parseHash('#/osiagniecia')).toEqual({ kind: 'tab', tab: 'ach' });
    expect(TABS.find((t) => t.key === 'ach')?.path).toBe('#/osiagniecia');
  });

  it('pusty i nieznany adres lądują na treningu', () => {
    expect(parseHash('')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/cos-czego-nie-ma')).toEqual({ kind: 'tab', tab: 'train' });
    // Nazwy z prototypu obiektu to też nieznane adresy, a nie „zakładka” w postaci funkcji.
    expect(parseHash('#/constructor')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/toString')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/jedzenie/constructor')).toEqual({ kind: 'food', section: 'diary' });
  });

  it('atlas ma spis i podstrony ćwiczeń', () => {
    expect(parseHash('#/cwiczenia')).toEqual({ kind: 'atlas' });
    expect(parseHash(exercisePath('swing2'))).toEqual({ kind: 'exercise', id: 'swing2' });
  });

  it('podstrona ćwiczenia podświetla Treningi, bo atlas jest ich sekcją', () => {
    expect(activeTab({ kind: 'exercise', id: 'swing2' })).toBe('work' as TabKey);
    expect(activeTab({ kind: 'atlas' })).toBe('work' as TabKey);
  });

  it('profil ma zakładkę, podstrony ćwiczeń i stary adres poziomów', () => {
    expect(parseHash('#/profil')).toEqual({ kind: 'tab', tab: 'prog' });
    expect(parseHash('#/poziomy')).toEqual({ kind: 'tab', tab: 'prog' });
    expect(parseHash(statsPath('swing2'))).toEqual({ kind: 'exstats', id: 'swing2' });
    expect(TABS.find((t) => t.key === 'prog')?.label).toBe('Profil');
  });

  it('historia ćwiczenia podświetla profil, a nie atlas', () => {
    // Ten sam ruch ma dwie podstrony: w atlasie technikę, w profilu własną przeszłość.
    expect(activeTab({ kind: 'exstats', id: 'swing2' })).toBe('prog' as TabKey);
    expect(statsPath('swing2')).not.toBe(exercisePath('swing2'));
  });

  it('przekąski mają adres bez zakładki i podświetlają sesję', () => {
    // Siódma pozycja w pasku zeszłaby poniżej celu dotykowego — przekąski wchodzą adresem.
    expect(TABS.some((t) => t.path.includes('przekaski'))).toBe(false);
    expect(parseHash(snacksPath())).toEqual({ kind: 'snacks' });
    expect(activeTab({ kind: 'snacks' })).toBe('train' as TabKey);
  });

  it('zapis przekąski ma własny widok, z ćwiczeniem albo bez', () => {
    expect(parseHash(snackAddPath())).toEqual({ kind: 'snackAdd' });
    expect(parseHash(snackAddPath('squat_air'))).toEqual({ kind: 'snackAdd', id: 'squat_air' });
    // Dawne linki `#/przekaski/<id>` prowadziły do formularza z tym ćwiczeniem — dalej prowadzą.
    expect(parseHash('#/przekaski/squat_air')).toEqual({ kind: 'snackAdd', id: 'squat_air' });
    expect(activeTab({ kind: 'snackAdd' })).toBe('train' as TabKey);
  });

  it('kroki i cardio mają adresy bez zakładki, a formularz mówi adresem, co się wpisuje', () => {
    expect(TABS.some((t) => t.path.includes('cardio'))).toBe(false);
    expect(parseHash(cardioPath())).toEqual({ kind: 'cardio' });
    (['steps', 'treadmill', 'bike', 'dance'] as const).forEach((sport) =>
      expect(parseHash(cardioAddPath(sport))).toEqual({ kind: 'cardioAdd', sport }),
    );
    expect(cardioAddPath()).toBe('#/cardio/kroki');
    expect(parseHash('#/cardio/bieznia')).toEqual({ kind: 'cardioAdd', sport: 'treadmill' });
    // Nieznany rodzaj otwiera kroki, zamiast wyrzucać na ekran startowy.
    expect(parseHash('#/cardio/kajak')).toEqual({ kind: 'cardioAdd', sport: 'steps' });
    expect(parseHash('#/cardio/constructor')).toEqual({ kind: 'cardioAdd', sport: 'steps' });
    expect(parseHash('#/cardio/toString')).toEqual({ kind: 'cardioAdd', sport: 'steps' });
    expect(activeTab({ kind: 'cardio' })).toBe('train' as TabKey);
    expect(activeTab({ kind: 'cardioAdd', sport: 'bike' })).toBe('train' as TabKey);
    expect(screenOf({ kind: 'cardioAdd', sport: 'treadmill' }).title).toBe('Bieżnia');
    expect(parseHash('#/cardio/taniec')).toEqual({ kind: 'cardioAdd', sport: 'dance' });
    expect(screenOf({ kind: 'cardioAdd', sport: 'dance' }).title).toBe('Taniec');
    expect(isTabRoot(cardioPath())).toBe(false);
  });

  it('zepsuty adres nie wywraca aplikacji — zostaje surowy fragment', () => {
    expect(() => parseHash('#/treningi/%E0%A4%A')).not.toThrow();
    expect(parseHash('#/treningi/%E0%A4%A')).toEqual({ kind: 'workout', id: '%E0%A4%A' });
  });

  it('identyfikator ze znakami specjalnymi przechodzi w obie strony', () => {
    // Ukośnik w identyfikatorze wychodzi jako %2F, więc podział ścieżki go nie rozcina.
    const id = 'ćwiczenie/dziwne';
    expect(parseHash(exercisePath(id))).toEqual({ kind: 'exercise', id });
    expect(parseHash(statsPath(id))).toEqual({ kind: 'exstats', id });
    expect(parseHash(snackAddPath(id))).toEqual({ kind: 'snackAdd', id });
  });

  it('plakat polecający ma własny adres, wraca do ustawień i podświetla profil', () => {
    expect(parseHash(PROMO_PATH)).toEqual({ kind: 'promo' });
    expect(screenOf({ kind: 'promo' })).toEqual({ title: 'Poleć znajomym', parent: SETTINGS_PATH });
    expect(activeTab({ kind: 'promo' })).toBe('prog' as TabKey);
  });
});
