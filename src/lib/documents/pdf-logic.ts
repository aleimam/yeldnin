// Pure layout math for the generated-document PDF renderer. No pdf-lib / DOM here
// so it can be unit-tested in isolation; the service supplies real text measurers.

const PT_PER_MM = 72 / 25.4; // 1mm in PostScript points

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

/** Coerce a user-entered margin (mm) to a sane non-negative integer. */
export function sanitizeMarginMm(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.round(n), 120); // 120mm is already most of a page edge
}

export interface MarginsMm {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ContentBox {
  left: number; // x of the left content edge (pt)
  right: number; // x of the right content edge (pt)
  top: number; // y of the first baseline-top (pt, PDF origin = bottom-left)
  bottom: number; // y below which content must not go (pt)
  width: number; // usable width (pt)
}

/** The drawable region inside the page margins, in PDF coordinates (origin bottom-left). */
export function contentBox(pageWidth: number, pageHeight: number, m: MarginsMm): ContentBox {
  const left = mmToPt(m.left);
  const right = pageWidth - mmToPt(m.right);
  const top = pageHeight - mmToPt(m.top);
  const bottom = mmToPt(m.bottom);
  return { left, right, top, bottom, width: Math.max(0, right - left) };
}

export interface MeasuredWord {
  text: string;
  width: number;
}

/**
 * Greedy word-wrap. Returns lines, each a list of words to place with a single
 * space between them. A word wider than maxWidth gets its own line (we never
 * break inside a word). Empty input → one empty line is NOT returned (returns []).
 */
export function wrapWords(words: MeasuredWord[], maxWidth: number, spaceWidth: number): MeasuredWord[][] {
  const lines: MeasuredWord[][] = [];
  let line: MeasuredWord[] = [];
  let w = 0;
  for (const word of words) {
    if (line.length === 0) {
      line = [word];
      w = word.width;
      continue;
    }
    const next = w + spaceWidth + word.width;
    if (next > maxWidth) {
      lines.push(line);
      line = [word];
      w = word.width;
    } else {
      line.push(word);
      w = next;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Equal column widths that sum (within rounding) to the usable width. */
export function equalColumns(usableWidth: number, count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => usableWidth / count);
}

/** Line advance for a given font size. */
export function lineHeight(size: number, factor = 1.34): number {
  return size * factor;
}
