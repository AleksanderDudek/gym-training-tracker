/**
 * A PDF's text layer as rows. Lab portals (Diagnostyka among them) give text PDFs: every word is
 * a text item with a position, and a table row is the items at one height, left to right. pdf.js
 * and its worker load only here, from the app's own server, the first time someone opens a PDF.
 *
 * A scanned PDF has no text layer; its pages come back as images for OCR instead.
 */

/** A text item as pdf.js gives it: the string, its transform ([a, b, c, d, x, y]) and size. */
export interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** Items of one page → rows: same height (within half a line), left to right, words spaced by their gaps. */
export function rowsOf(items: readonly TextItem[]): string[] {
  const words = items
    .filter((i) => i.str.trim() !== '')
    .map((i) => ({ str: i.str, x: i.transform[4]!, y: i.transform[5]!, w: i.width, h: Math.abs(i.height || i.transform[3]! || 10) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: (typeof words)[] = [];
  for (const word of words) {
    const row = rows[rows.length - 1];
    const ref = row?.[0];
    if (row && ref && Math.abs(ref.y - word.y) <= Math.max(2, Math.min(ref.h, word.h) * 0.5)) row.push(word);
    else rows.push([word]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let out = '';
    let end: number | null = null;
    for (const w of row) {
      // Glyph runs of one word come as separate items ("1", "2", ",", "5"): join them without a space.
      const gap = end === null ? 0 : w.x - end;
      if (end !== null && gap > w.h * 0.2 && !out.endsWith(' ') && !w.str.startsWith(' ')) out += ' ';
      out += w.str;
      end = w.x + w.w;
    }
    return out.replace(/\s+/g, ' ').trim();
  });
}

const MAX_PAGES = 20;

export interface PdfRead {
  lines: string[];
  /** Pages without text (a scan), rendered for OCR. */
  scans: Blob[];
}

export async function readPdf(file: Blob, onProgress?: (share: number) => void): Promise<PdfRead> {
  const [pdfjs, { default: workerSrc }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true }).promise;
  try {
    const pages = Math.min(doc.numPages, MAX_PAGES);
    const lines: string[] = [];
    const scans: Blob[] = [];
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const rows = rowsOf(content.items.flatMap((i) => ('str' in i ? [i] : [])));
      if (rows.join('').length >= 40) lines.push(...rows);
      else {
        const scan = await renderPage(page);
        if (scan) scans.push(scan);
      }
      onProgress?.(n / pages);
    }
    return { lines, scans };
  } finally {
    void doc.destroy();
  }
}

/** A page at about 2000 px wide: enough for OCR of small print, small enough for a phone. */
async function renderPage(page: import('pdfjs-dist').PDFPageProxy): Promise<Blob | null> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, 2000 / base.width) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
