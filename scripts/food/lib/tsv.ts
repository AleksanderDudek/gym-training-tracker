// The Open Food Facts dump is tab-separated with no quoting: a field never
// contains a tab or a newline, so a plain split is correct (and checked: a row
// whose field count differs from the header is rejected, not guessed at).

export function splitLine(line: string): string[] {
  return line.split('\t');
}

export function toRow(header: string[], fields: string[]): Record<string, string> | null {
  if (fields.length !== header.length) return null;
  const row: Record<string, string> = {};
  // Same length, checked above: every name has its field.
  for (const [i, name] of header.entries()) row[name] = fields[i] ?? '';
  return row;
}
