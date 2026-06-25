import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type Color } from "pdf-lib";
import { parse, HTMLElement, TextNode, type Node } from "node-html-parser";
import { contentBox, lineHeight, type MarginsMm, type ContentBox } from "./pdf-logic";

// Generated PDF for a DOC-kind document: the sanitized rich-text HTML is laid out
// onto an admin-uploaded letterhead PDF (page 0 used as a per-page background),
// inside the admin-configured margins. Latin (WinAnsi) only — Arabic documents are
// uploaded as PDFs, not generated. No external browser/headless engine.

const A4: [number, number] = [595.28, 841.89];

// ── text sanitizing (StandardFonts use WinAnsi; non-encodable chars throw) ──────
const ENTITY: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—",
  ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•",
};
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITY[body] ?? m;
  });
}
/** Normalize common Unicode punctuation to WinAnsi-safe glyphs, then drop anything
 *  a StandardFont can't encode (keeps ASCII + Latin-1 supplement, replaces rest). */
function toWinAnsi(text: string): string {
  const mapped = text
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/•/g, "·"); // bullet → middle dot (WinAnsi)
  let out = "";
  for (const ch of mapped) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x20 && c <= 0x7e) out += ch; // ASCII printable
    else if (c >= 0xa0 && c <= 0xff) out += ch; // Latin-1 supplement (WinAnsi-safe)
    else if (ch === "\t") out += "  ";
    else out += ""; // drop emoji / Arabic / unsupported
  }
  return out;
}

// ── inline run model ────────────────────────────────────────────────────────
interface Style { bold: boolean; italic: boolean; underline: boolean; mono: boolean; link: boolean }
const BASE: Style = { bold: false, italic: false, underline: false, mono: false, link: false };
interface Run { text: string; style: Style; br?: boolean }

function isEl(n: Node): n is HTMLElement {
  return n instanceof HTMLElement;
}
function tag(n: HTMLElement): string {
  return (n.rawTagName || n.tagName || "").toLowerCase();
}

function collectRuns(node: HTMLElement, style: Style, out: Run[]): void {
  for (const child of node.childNodes) {
    if (child instanceof TextNode) {
      const text = toWinAnsi(decodeEntities(child.rawText));
      if (text) out.push({ text, style });
      continue;
    }
    if (!isEl(child)) continue;
    const t = tag(child);
    if (t === "br") { out.push({ text: "", style, br: true }); continue; }
    const next: Style = { ...style };
    if (t === "strong" || t === "b") next.bold = true;
    else if (t === "em" || t === "i") next.italic = true;
    else if (t === "u") next.underline = true;
    else if (t === "code") next.mono = true;
    else if (t === "a") { next.link = true; next.underline = true; }
    // "s" (strikethrough) recurses with no distinct styling
    collectRuns(child, next, out);
  }
}

// ── fonts ─────────────────────────────────────────────────────────────────────
interface Fonts {
  reg: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont; mono: PDFFont; monoBold: PDFFont;
}
function pickFont(f: Fonts, s: Style): PDFFont {
  if (s.mono) return s.bold ? f.monoBold : f.mono;
  if (s.bold && s.italic) return f.boldItalic;
  if (s.bold) return f.bold;
  if (s.italic) return f.italic;
  return f.reg;
}

const INK = rgb(0.12, 0.13, 0.15);
const MUTED = rgb(0.45, 0.47, 0.5);
const LINK = rgb(0.13, 0.39, 0.92);
const RULE = rgb(0.82, 0.84, 0.86);
const HEADER_FILL = rgb(0.95, 0.96, 0.97);

// ── the renderer ────────────────────────────────────────────────────────────
class Renderer {
  private out!: PDFDocument;
  private fonts!: Fonts;
  private lhPage: Awaited<ReturnType<PDFDocument["embedPdf"]>>[number] | null = null;
  private pageW = A4[0];
  private pageH = A4[1];
  private box!: ContentBox;
  private page!: PDFPage;
  private y = 0;

  constructor(private title: string, private html: string, private letterhead: Buffer | null, private margins: MarginsMm) {}

  async render(): Promise<Uint8Array> {
    this.out = await PDFDocument.create();
    this.out.setTitle(this.title.slice(0, 200) || "Document");
    this.fonts = {
      reg: await this.out.embedFont(StandardFonts.Helvetica),
      bold: await this.out.embedFont(StandardFonts.HelveticaBold),
      italic: await this.out.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await this.out.embedFont(StandardFonts.HelveticaBoldOblique),
      mono: await this.out.embedFont(StandardFonts.Courier),
      monoBold: await this.out.embedFont(StandardFonts.CourierBold),
    };

    if (this.letterhead) {
      try {
        const [embedded] = await this.out.embedPdf(new Uint8Array(this.letterhead), [0]);
        if (embedded) {
          this.lhPage = embedded;
          this.pageW = embedded.width;
          this.pageH = embedded.height;
        }
      } catch {
        this.lhPage = null; // unreadable letterhead → plain pages
      }
    }
    this.box = contentBox(this.pageW, this.pageH, this.margins);
    this.newPage();

    // Document title (first page) + a rule.
    this.drawHeadingLine(this.title || "Document", 20);
    this.drawRule();
    this.y -= 4;

    const root = parse(this.html || "", { lowerCaseTagName: true });
    this.renderBlocks(root.childNodes, this.box.left);

    return this.out.save();
  }

  private newPage(): void {
    this.page = this.out.addPage([this.pageW, this.pageH]);
    if (this.lhPage) this.page.drawPage(this.lhPage, { x: 0, y: 0, width: this.pageW, height: this.pageH });
    this.y = this.box.top;
  }

  /** Ensure `need` points of vertical space remain; else start a new page. */
  private ensure(need: number): void {
    if (this.y - need < this.box.bottom) this.newPage();
  }

  private spaceWidth(size: number): number {
    return this.fonts.reg.widthOfTextAtSize(" ", size);
  }

  // ── block dispatch ──
  private renderBlocks(nodes: Node[], leftX: number): void {
    for (const node of nodes) {
      if (node instanceof TextNode) {
        const text = toWinAnsi(decodeEntities(node.rawText)).trim();
        if (text) this.drawParagraph([{ text, style: BASE }], leftX, 11, 6);
        continue;
      }
      if (!isEl(node)) continue;
      const t = tag(node);
      switch (t) {
        case "h1": this.block(node, leftX, 18); break;
        case "h2": this.block(node, leftX, 15.5); break;
        case "h3": this.block(node, leftX, 13.5); break;
        case "h4": this.block(node, leftX, 12); break;
        case "p": {
          const runs: Run[] = []; collectRuns(node, BASE, runs);
          this.drawParagraph(runs, leftX, 11, 6);
          break;
        }
        case "ul": case "ol": this.list(node, leftX, t === "ol"); break;
        case "blockquote": this.blockquote(node, leftX); break;
        case "hr": this.ensure(10); this.y -= 4; this.drawRule(); this.y -= 6; break;
        case "pre": this.pre(node, leftX); break;
        case "table": this.table(node); break;
        case "div": case "section": case "article": this.renderBlocks(node.childNodes, leftX); break;
        default: {
          // unknown wrapper holding inline content → treat as a paragraph
          const runs: Run[] = []; collectRuns(node, BASE, runs);
          if (runs.some((r) => r.text.trim() || r.br)) this.drawParagraph(runs, leftX, 11, 6);
        }
      }
    }
  }

  private block(node: HTMLElement, leftX: number, size: number): void {
    const runs: Run[] = []; collectRuns(node, { ...BASE, bold: true }, runs);
    this.y -= size * 0.5; // space before
    this.drawParagraph(runs, leftX, size, size * 0.3, true);
  }

  // ── paragraph / inline layout (page-aware) ──
  private drawParagraph(runs: Run[], leftX: number, size: number, gapAfter: number, bold = false): void {
    const maxWidth = this.box.right - leftX;
    const lh = lineHeight(size);
    const spaceW = this.spaceWidth(size);

    // Tokenize runs into placeable words carrying their own style + spaceBefore.
    interface Word { text: string; font: PDFFont; color: Color; underline: boolean; width: number; spaceBefore: boolean }
    const words: (Word | "break")[] = [];
    let pendingSpace = false;
    for (const run of runs) {
      if (run.br) { words.push("break"); pendingSpace = false; continue; }
      const font = pickFont(this.fonts, bold ? { ...run.style, bold: true } : run.style);
      const color = run.style.link ? LINK : INK;
      const parts = run.text.split(/(\s+)/);
      for (const part of parts) {
        if (part === "") continue;
        if (/^\s+$/.test(part)) { pendingSpace = true; continue; }
        words.push({ text: part, font, color, underline: run.style.underline, width: font.widthOfTextAtSize(part, size), spaceBefore: pendingSpace });
        pendingSpace = false;
      }
    }

    // Wrap into lines.
    type Placed = { word: Word; x: number };
    const lines: Placed[][] = [];
    let line: Placed[] = [];
    let cur = 0;
    const flush = () => { if (line.length) lines.push(line); line = []; cur = 0; };
    for (const w of words) {
      if (w === "break") { flush(); continue; }
      const gap = line.length && w.spaceBefore ? spaceW : 0;
      if (line.length && cur + gap + w.width > maxWidth) { flush(); }
      const x = (line.length ? cur + gap : 0);
      line.push({ word: w, x });
      cur = x + w.width;
    }
    flush();
    if (lines.length === 0) { this.y -= gapAfter; return; }

    for (const ln of lines) {
      this.ensure(lh);
      const baseline = this.y - size;
      for (const p of ln) {
        this.page.drawText(p.word.text, { x: leftX + p.x, y: baseline, size, font: p.word.font, color: p.word.color });
        if (p.word.underline) {
          this.page.drawLine({ start: { x: leftX + p.x, y: baseline - 1.5 }, end: { x: leftX + p.x + p.word.width, y: baseline - 1.5 }, thickness: 0.5, color: p.word.color });
        }
      }
      this.y -= lh;
    }
    this.y -= gapAfter;
  }

  private list(node: HTMLElement, leftX: number, ordered: boolean): void {
    const indent = 16;
    const items = node.childNodes.filter((c): c is HTMLElement => isEl(c) && tag(c) === "li");
    let i = 1;
    for (const li of items) {
      const marker = ordered ? `${i}.` : "·";
      const size = 11;
      const lh = lineHeight(size);
      this.ensure(lh);
      // marker on the first line
      this.page.drawText(marker, { x: leftX, y: this.y - size, size, font: this.fonts.reg, color: MUTED });
      // item content as inline runs, indented; nested lists recurse deeper
      const runs: Run[] = [];
      const nested: HTMLElement[] = [];
      for (const c of li.childNodes) {
        if (isEl(c) && (tag(c) === "ul" || tag(c) === "ol")) nested.push(c);
        else if (isEl(c)) collectRuns(c, BASE, runs);
        else if (c instanceof TextNode) { const tx = toWinAnsi(decodeEntities(c.rawText)); if (tx.trim()) runs.push({ text: tx, style: BASE }); }
      }
      this.drawParagraph(runs.length ? runs : [{ text: "", style: BASE }], leftX + indent, size, 2);
      for (const n of nested) this.list(n, leftX + indent, tag(n) === "ol");
      i += 1;
    }
    this.y -= 4;
  }

  private blockquote(node: HTMLElement, leftX: number): void {
    const indent = 14;
    const startY = this.y;
    const startPageRef = this.page;
    this.renderBlocks(node.childNodes, leftX + indent);
    // Draw the quote bar only if we stayed on the same page (keeps it simple).
    if (this.page === startPageRef) {
      this.page.drawLine({ start: { x: leftX + 3, y: startY - 2 }, end: { x: leftX + 3, y: this.y + 6 }, thickness: 2, color: RULE });
    }
  }

  private pre(node: HTMLElement, leftX: number): void {
    const size = 9.5;
    const lh = lineHeight(size, 1.3);
    const text = toWinAnsi(decodeEntities(node.rawText)).replace(/\r/g, "");
    const rawLines = text.split("\n");
    this.y -= 4;
    for (const raw of rawLines) {
      this.ensure(lh);
      this.page.drawText(raw || " ", { x: leftX + 4, y: this.y - size, size, font: this.fonts.mono, color: INK });
      this.y -= lh;
    }
    this.y -= 6;
  }

  private table(node: HTMLElement): void {
    // Flatten rows from thead/tbody/tr.
    const rows: HTMLElement[] = [];
    const walk = (n: HTMLElement) => {
      for (const c of n.childNodes) {
        if (!isEl(c)) continue;
        const t = tag(c);
        if (t === "tr") rows.push(c);
        else if (t === "thead" || t === "tbody" || t === "tfoot") walk(c);
      }
    };
    walk(node);
    if (!rows.length) return;

    const cellsOf = (tr: HTMLElement) => tr.childNodes.filter((c): c is HTMLElement => isEl(c) && (tag(c) === "td" || tag(c) === "th"));
    const ncols = Math.max(...rows.map((r) => cellsOf(r).length));
    if (ncols === 0) return;
    const colW = this.box.width / ncols;
    const size = 9.5;
    const lh = lineHeight(size, 1.25);
    const padX = 4, padY = 4;
    this.y -= 2;

    for (const tr of rows) {
      const cells = cellsOf(tr);
      const isHeader = cells.length > 0 && tag(cells[0]) === "th";
      const font = isHeader ? this.fonts.bold : this.fonts.reg;
      // Wrap each cell's text to its column width.
      const wrapped: string[][] = [];
      for (let c = 0; c < ncols; c++) {
        const cell = cells[c];
        const txt = cell ? toWinAnsi(decodeEntities(cell.text)).replace(/\s+/g, " ").trim() : "";
        wrapped.push(this.wrapPlain(txt, font, size, colW - padX * 2));
      }
      const rowLines = Math.max(1, ...wrapped.map((w) => w.length));
      const rowH = rowLines * lh + padY * 2;
      this.ensure(rowH);
      const top = this.y;
      for (let c = 0; c < ncols; c++) {
        const x = this.box.left + c * colW;
        this.page.drawRectangle({
          x, y: top - rowH, width: colW, height: rowH,
          borderColor: RULE, borderWidth: 0.5,
          color: isHeader ? HEADER_FILL : undefined,
        });
        const lines = wrapped[c];
        for (let li = 0; li < lines.length; li++) {
          this.page.drawText(lines[li], { x: x + padX, y: top - padY - size - li * lh, size, font, color: INK });
        }
      }
      this.y -= rowH;
    }
    this.y -= 8;
  }

  /** Plain (single-style) word wrap to a width, returning text lines. */
  private wrapPlain(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    if (!text) return [""];
    const words = text.split(" ");
    const spaceW = font.widthOfTextAtSize(" ", size);
    const lines: string[] = [];
    let line = "", w = 0;
    for (const word of words) {
      const ww = font.widthOfTextAtSize(word, size);
      if (!line) { line = word; w = ww; continue; }
      if (w + spaceW + ww > maxWidth) { lines.push(line); line = word; w = ww; }
      else { line += " " + word; w += spaceW + ww; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  private drawHeadingLine(text: string, size: number): void {
    this.ensure(lineHeight(size));
    const clean = toWinAnsi(text);
    const lines = this.wrapPlain(clean, this.fonts.bold, size, this.box.width);
    const lh = lineHeight(size);
    for (const ln of lines) {
      this.ensure(lh);
      this.page.drawText(ln, { x: this.box.left, y: this.y - size, size, font: this.fonts.bold, color: INK });
      this.y -= lh;
    }
    this.y -= 4;
  }

  private drawRule(): void {
    this.ensure(6);
    this.page.drawLine({ start: { x: this.box.left, y: this.y }, end: { x: this.box.right, y: this.y }, thickness: 0.75, color: RULE });
    this.y -= 6;
  }
}

export interface GenerateDocPdfInput {
  title: string;
  contentHtml: string | null | undefined;
  letterhead: Buffer | null;
  margins: MarginsMm;
}

/** Render a DOC-kind document to a stamped PDF. Returns the PDF bytes. */
export async function generateDocumentPdf(input: GenerateDocPdfInput): Promise<Uint8Array> {
  const renderer = new Renderer(input.title, input.contentHtml ?? "", input.letterhead, input.margins);
  return renderer.render();
}
