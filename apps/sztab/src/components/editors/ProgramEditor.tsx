import type { LibraryItem, ProgramBody } from '../../lib/data';

/**
 * Kreator programu: oś dni, na której leżą elementy biblioteki („dzień 0, 7:00 → trening A”).
 * Zaczep rdzenia — pełny kreator dokłada część „Harmonogram i programy” (spec 2026-11-25).
 */

export const emptyProgram = (): ProgramBody => ({ kind: 'program', steps: [], note: '' });

export function ProgramForm({ value, onChange, items }: { value: ProgramBody; onChange: (v: ProgramBody) => void; items: LibraryItem[] }) {
  void value;
  void onChange;
  void items;
  return null;
}
