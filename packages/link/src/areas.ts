/**
 * Obszary prowadzenia i zakres danych.
 *
 * **Obszar** to to, co prowadzący układa: trening, żywienie, rehabilitację — albo tylko ogląda
 * (wgląd, np. lekarz zlecający badania). **Zakres** to to, co podopieczny pokazuje. Zaproszenie
 * proponuje jedno i drugie, podopieczny przyjmuje obszary i odhacza zakres po swojemu.
 *
 * **Wyłączność.** W treningu, żywieniu i rehabilitacji prowadzi jedna osoba naraz — dwa plany
 * treningowe albo dwie diety jednocześnie się wykluczają. Jedna osoba może prowadzić kilka
 * obszarów. Wgląd planów nie układa, więc nie koliduje: do trzech naraz.
 *
 * Pilnuje tego telefon, bo tylko on wie, kto kogo prowadzi: serwer nie łączy współprac jednej
 * osoby (każdy prowadzący widzi inne ID) i nie powinien.
 */

export const AREAS = ['training', 'nutrition', 'rehab', 'insight'] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LIMIT: Record<Area, number> = { training: 1, nutrition: 1, rehab: 1, insight: 3 };

export const SCOPES = ['training', 'movement', 'food', 'body', 'labs'] as const;
export type Scope = (typeof SCOPES)[number];

/** Co zaproszenie proponuje pokazać, gdy prowadzący nie wybierze sam. */
export const SUGGESTED_SCOPES: Record<Area, readonly Scope[]> = {
  training: ['training', 'movement', 'body'],
  nutrition: ['food', 'body', 'labs', 'movement'],
  rehab: ['training', 'movement', 'body'],
  insight: ['body', 'labs'],
};

export const isArea = (v: unknown): v is Area => typeof v === 'string' && (AREAS as readonly string[]).includes(v);
export const isScope = (v: unknown): v is Scope => typeof v === 'string' && (SCOPES as readonly string[]).includes(v);

/** Lista z sieci albo z zapisu: tylko znane wartości, bez powtórzeń, w kolejności stałej. */
export const cleanAreas = (v: unknown): Area[] => (Array.isArray(v) ? AREAS.filter((a) => v.includes(a)) : []);
export const cleanScopes = (v: unknown): Scope[] => (Array.isArray(v) ? SCOPES.filter((s) => v.includes(s)) : []);

export const suggestScopes = (areas: readonly Area[]): Scope[] =>
  SCOPES.filter((s) => areas.some((a) => SUGGESTED_SCOPES[a].includes(s)));

/** Trwająca współpraca, tak jak widzi ją telefon. */
export interface Held {
  id: string;
  coachId: string;
  coachName: string;
  areas: readonly Area[];
}

export interface AreaCheck {
  area: Area;
  /** Wolne — można przyjąć. */
  free: boolean;
  /** Kto zajmuje obszar (przy wglądzie — wszyscy, gdy limit jest pełny). */
  holders: Held[];
  /** Ten sam prowadzący już prowadzi ten obszar — przyjęcie niczego nie zmienia, tylko odświeża. */
  same: boolean;
}

/**
 * Co z zaproszenia da się przyjąć przy obecnych współpracach. Współpraca z tym samym
 * prowadzącym nie zajmuje miejsca — nowe zaproszenie od niego ją zastępuje.
 */
export function checkAreas(held: readonly Held[], coachId: string, invited: readonly Area[]): AreaCheck[] {
  return invited.map((area) => {
    const others = held.filter((h) => h.coachId !== coachId && h.areas.includes(area));
    const same = held.some((h) => h.coachId === coachId && h.areas.includes(area));
    return { area, free: others.length < AREA_LIMIT[area], holders: others, same };
  });
}

/**
 * Plan przyjęcia: obszary, które podopieczny wybrał, i współprace, które trzeba w tych obszarach
 * zakończyć (zamiana prowadzącego). Współpraca traci tylko zamieniane obszary; gdy nie zostaje jej
 * żaden, kończy się cała. Dawna współpraca z tym samym prowadzącym kończy się zawsze — nowa ją
 * zastępuje. Zwraca `null`, gdy wybór łamie wyłączność bez zgody na zamianę.
 */
export interface AcceptPlan {
  areas: Area[];
  /** Współprace do zakończenia w całości. */
  end: string[];
  /** Współprace, którym zostaje mniej obszarów. */
  shrink: { id: string; areas: Area[] }[];
}

export function planAcceptance(
  held: readonly Held[],
  coachId: string,
  chosen: readonly Area[],
  replace: readonly Area[],
): AcceptPlan | null {
  const checks = checkAreas(held, coachId, chosen);
  const lose = new Map<string, Set<Area>>();
  for (const c of checks) {
    if (c.free) continue;
    if (!replace.includes(c.area)) return null;
    // Wgląd ma limit większy niż jeden: zamiana zwalnia miejsce po najstarszej współpracy.
    const victims = c.area === 'insight' ? c.holders.slice(0, c.holders.length - AREA_LIMIT.insight + 1) : c.holders;
    for (const v of victims) {
      if (!lose.has(v.id)) lose.set(v.id, new Set());
      lose.get(v.id)!.add(c.area);
    }
  }
  // Nowe zaproszenie od tego samego prowadzącego zastępuje dawną współpracę w całości: to samo ID
  // może mieć tylko jedną trwającą współpracę u jednego prowadzącego (indeks w bazie).
  const end: string[] = held.filter((h) => h.coachId === coachId).map((h) => h.id);
  const shrink: { id: string; areas: Area[] }[] = [];
  for (const [id, gone] of lose) {
    if (end.includes(id)) continue;
    const h = held.find((x) => x.id === id)!;
    const rest = h.areas.filter((a) => !gone.has(a));
    if (rest.length) shrink.push({ id, areas: [...rest] });
    else end.push(id);
  }
  return { areas: AREAS.filter((a) => chosen.includes(a)), end, shrink };
}
