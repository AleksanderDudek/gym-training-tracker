#!/usr/bin/env node
// Lists text that is still Polish outside a translation catalog: string literals, template
// literals and JSX text with Polish letters (or a few common Polish words without them) that are
// not inside the `pl` half of a catalog (`text({ pl, en })`) or the first argument of `say()`.
//
//   node scripts/i18n-scan.mjs [paths…]        (default: src)
//   node scripts/i18n-scan.mjs --count src     (only the totals per file)
//
// A literal that is data, not text (a stored value, an id, a Polish product name) is marked on its
// line, or the line above, with the comment `i18n-ignore` and a reason.
// Tests (*.test.*), fixtures and JSON data are skipped.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
const countOnly = args.includes('--count');
const roots = args.filter((a) => !a.startsWith('--'));
if (!roots.length) roots.push('src');

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
// Frequent Polish UI words without Polish letters - a hint, not proof.
const WORDS =
  /\b(Zapisz|Dodaj|Wpisz|Pokaż|Ukryj|Dalej|Zamknij|Anuluj|Kroki|kroki|Trening|Treningi|treningi|Jedzenie|Waga|Teraz|dzisiaj|wczoraj|jutro|minut|sekund|serii|seria|Przepisy|Produkty|Sklepy|Ustawienia|brak|razem|albo|oraz|tylko|jeszcze|ponad|przez)\b/;

function* files(path) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const f of readdirSync(path)) {
      if (f === 'node_modules' || f === 'test' || f.startsWith('.')) continue;
      yield* files(join(path, f));
    }
  } else if (/\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path) && !/\.d\.ts$/.test(path)) {
    yield path;
  }
}

const isCatalogHalf = (node) => {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n) && n.name && ts.isIdentifier(n.name) && n.name.text === 'pl') return true;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'say' && n.arguments[0]) {
      const a = n.arguments[0];
      if (node.pos >= a.pos && node.end <= a.end) return true;
    }
  }
  return false;
};

const ignored = (sf, node, lines) => {
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
  return /i18n-ignore/.test(lines[line] ?? '') || /i18n-ignore/.test(lines[line - 1] ?? '');
};

const found = [];
for (const root of roots) {
  for (const file of files(root)) {
    const src = readFileSync(file, 'utf8');
    if (!POLISH.test(src) && !WORDS.test(src)) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const lines = src.split('\n');
    const visit = (node) => {
      let textOf = null;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) textOf = node.text;
      else if (ts.isTemplateExpression(node)) textOf = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join('…');
      else if (ts.isJsxText(node)) textOf = node.text.trim();
      if (textOf && (POLISH.test(textOf) || WORDS.test(textOf))) {
        // Module specifiers and keys of imports are not text.
        const p = node.parent;
        const isImport = p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p));
        if (!isImport && !isCatalogHalf(node) && !ignored(sf, node, lines)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          found.push({ file: relative(process.cwd(), file), line: line + 1, text: textOf.replace(/\s+/g, ' ').slice(0, 90) });
        }
        if (ts.isTemplateExpression(node)) return; // spans already covered
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

if (countOnly) {
  const per = new Map();
  for (const f of found) per.set(f.file, (per.get(f.file) ?? 0) + 1);
  [...per].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`${String(n).padStart(5)}  ${f}`));
} else {
  for (const f of found) console.log(`${f.file}:${f.line}  ${f.text}`);
}
console.log(`\n${found.length} Polish text(s) outside catalogs.`);
process.exitCode = 0;
