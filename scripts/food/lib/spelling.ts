/**
 * Picks a display name per key from the spellings seen in the data: the most
 * frequent one, ties to the first seen. "Piątnica" written 23 times beats
 * "Piatnica" written twice, whichever row happened to come first.
 */
export class SpellingCounter {
  private readonly counts = new Map<string, Map<string, number>>();

  add(key: string, label: string): void {
    let labels = this.counts.get(key);
    if (!labels) {
      labels = new Map();
      this.counts.set(key, labels);
    }
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }

  best(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, labels] of this.counts) {
      let bestLabel = '';
      let bestCount = 0;
      // Map iteration is insertion order, so a strict ">" keeps the first on a tie.
      for (const [label, count] of labels) {
        if (count > bestCount) {
          bestLabel = label;
          bestCount = count;
        }
      }
      out[key] = bestLabel;
    }
    return out;
  }
}
