# Brief: add a Tiptap v3 rich-text editor

Paste this into Claude Code in another project to add the same editor.

**Goal:** a WYSIWYG editor that takes an HTML string and emits sanitized HTML.
Features: bold/italic/underline/strike, H1–H3, **font size**, **alignment**
(left/center/right/justify), **text colour + highlight**, bullet/numbered lists,
blockquote, links, **inline images**, **tables** (insert + add/remove rows & cols,
header-row toggle, delete), clear formatting, undo/redo, sticky toolbar, empty
placeholder. Built on **Tiptap v3 + React**. Output is sanitized **server-side**
because it's later rendered with `dangerouslySetInnerHTML`.

## Install

```
npm i @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-table \
  @tiptap/extension-text-align @tiptap/extension-text-style \
  @tiptap/extension-highlight @tiptap/extension-image @tiptap/extension-placeholder \
  sanitize-html
```

> Notes:
> - **StarterKit v3 already bundles** bold/italic/underline/strike/headings/lists/
>   blockquote/code/link/hr/history — do **not** re-add them.
> - **`Color` and `FontSize` come from `@tiptap/extension-text-style`** (not separate
>   packages); there is no separate `@tiptap/extension-color` needed.
> - Styling below uses Tailwind utility classes — swap for your own system if needed.

---

## 1. The editor component (`RichTextEditor.tsx`)

```tsx
"use client"; // Next.js App Router; remove if plain React
import { useMemo, useState, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";

export interface RichTextEditorProps {
  value: string;                                 // initial HTML (seeds once)
  onChange: (html: string) => void;              // fires on every edit with editor.getHTML()
  placeholder?: string;
  uploadImage?: (file: File) => Promise<string>; // return the image src/URL; omit to hide image button
}

function Btn({ active, disabled, onClick, title, children }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}
      className={`h-8 min-w-8 rounded px-2 text-sm disabled:opacity-40 ${active ? "bg-blue-600 text-white" : "text-gray-800 hover:bg-gray-100"}`}>
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1 h-5 w-px bg-gray-300" />;

function AlignIcon({ dir }: { dir: "left" | "center" | "right" | "justify" }) {
  const short = dir === "justify" ? 14 : 9;
  const x = dir === "right" ? 14 - short : dir === "center" ? (14 - short) / 2 : 0;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="stroke-current" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <line x1="0" y1="2" x2="14" y2="2" /><line x1={x} y1="5.3" x2={x + short} y2="5.3" />
      <line x1="0" y1="8.6" x2="14" y2="8.6" /><line x1={x} y1="11.9" x2={x + short} y2="11.9" />
    </svg>
  );
}
const FONT_SIZES = ["13px", "16px", "20px", "26px", "34px"];

function Toolbar({ editor, uploadImage }: { editor: Editor; uploadImage?: (f: File) => Promise<string> }) {
  const [busy, setBusy] = useState(false);
  const inTable = editor.isActive("table");
  const textColor = (editor.getAttributes("textStyle").color as string) || "#1f2937";
  const hlColor = (editor.getAttributes("highlight").color as string) || "#fff3a3";
  const fontSize = (editor.getAttributes("textStyle").fontSize as string) || "";

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    url === "" ? editor.chain().focus().unsetLink().run() : editor.chain().focus().toggleLink({ href: url }).run();
  };
  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !uploadImage) return;
    setBusy(true);
    try { const src = await uploadImage(file); if (src) editor.chain().focus().setImage({ src }).run(); }
    finally { setBusy(false); }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white p-1.5">
      <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
      <Sep />
      <Btn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
      <Btn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      <select title="Font size" value={fontSize} className="h-8 rounded bg-transparent px-1 text-sm hover:bg-gray-100"
        onChange={(e) => { const v = e.target.value; v ? editor.chain().focus().setFontSize(v).run() : editor.chain().focus().unsetFontSize().run(); }}>
        <option value="">Size</option>{FONT_SIZES.map((s) => <option key={s} value={s}>{parseInt(s)}</option>)}
      </select>
      <Sep />
      {(["left", "center", "right", "justify"] as const).map((d) => (
        <Btn key={d} title={`Align ${d}`} active={editor.isActive({ textAlign: d })} onClick={() => editor.chain().focus().setTextAlign(d).run()}><AlignIcon dir={d} /></Btn>
      ))}
      <Sep />
      <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded hover:bg-gray-100" title="Text colour">
        <span className="text-sm font-semibold" style={{ borderBottom: `3px solid ${textColor}` }}>A</span>
        <input type="color" value={textColor} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
      </label>
      <Btn title="Clear colour" onClick={() => editor.chain().focus().unsetColor().run()}>A×</Btn>
      <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded hover:bg-gray-100" title="Highlight">
        <span className="rounded px-1 text-sm font-semibold" style={{ backgroundColor: hlColor }}>H</span>
        <input type="color" value={hlColor} onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
      </label>
      <Btn title="Clear highlight" onClick={() => editor.chain().focus().unsetHighlight().run()}>H×</Btn>
      <Sep />
      <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
      <Btn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Btn>
      <Btn title="Link" active={editor.isActive("link")} onClick={setLink}>🔗</Btn>
      {uploadImage && (
        <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded text-sm hover:bg-gray-100" title="Insert image">
          {busy ? "…" : "🖼"}
          <input type="file" accept="image/*" disabled={busy} onChange={onImage} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
        </label>
      )}
      <Btn title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</Btn>
      {inTable && (<>
        <Sep />
        <Btn title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>+▕</Btn>
        <Btn title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>−▕</Btn>
        <Btn title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>+▁</Btn>
        <Btn title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>−▁</Btn>
        <Btn title="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>⤒</Btn>
        <Btn title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>⊟</Btn>
      </>)}
      <Sep />
      <Btn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>⌫</Btn>
      <Btn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
      <Btn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder = "Start writing…", uploadImage }: RichTextEditorProps) {
  const extensions = useMemo(() => [
    StarterKit, TableKit,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TextStyle, Color, FontSize,
    Highlight.configure({ multicolor: true }),
    Image.configure({ inline: false }),
    Placeholder.configure({ placeholder }),
  ], [placeholder]);

  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false, // REQUIRED for Next SSR; harmless in plain React
    editorProps: { attributes: { class: "doc-content min-h-[320px] px-4 py-3 focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="rounded-lg border p-4 text-sm text-gray-500">Loading…</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <Toolbar editor={editor} uploadImage={uploadImage} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

**The editor is uncontrolled** — `value` only seeds it once. To reseed
programmatically (e.g. after a file import), pass a React `key` and bump it to
remount the component.

---

## 2. Server-side sanitizer (run before storing AND before rendering)

```ts
import sanitizeHtml from "sanitize-html";

const COLOR = [/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, /^rgb\([\d\s,]+\)$/, /^rgba\([\d\s,.]+\)$/];
// Adapt this to YOUR image URL convention (only allow your own uploads):
const ALLOWED_IMG = /^https?:\/\/[^/]*yourcdn\.com\/|^\/uploads\//;

const OPTS: sanitizeHtml.IOptions = {
  allowedTags: ["p","br","h1","h2","h3","h4","strong","b","em","i","u","s","span","mark",
                "ul","ol","li","blockquote","a","code","pre","hr","img",
                "table","thead","tbody","tr","td","th"],
  allowedAttributes: {
    "*": ["style"],                  // ← REQUIRED, or allowedStyles is silently ignored
    a: ["href","target","rel"], img: ["src","alt"], td: ["colspan","rowspan"], th: ["colspan","rowspan"],
  },
  allowedStyles: { "*": {
    "text-align": [/^(left|right|center|justify)$/],
    color: COLOR, "background-color": COLOR, "font-size": [/^\d{1,3}(?:px|pt)$/],
  }},
  allowedSchemes: ["http","https","mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    img: (t, a) => { const ok = ALLOWED_IMG.test(a.src || "");
      return { tagName: ok ? "img" : "span", attribs: ok ? { src: a.src, alt: (a.alt || "").slice(0, 200) } : {} }; },
  },
};
export const sanitize = (html?: string) => sanitizeHtml(html ?? "", OPTS);
```

---

## 3. Read-only view + CSS

```tsx
export function RichTextView({ html }: { html: string }) {
  return <div className="doc-content" dangerouslySetInnerHTML={{ __html: html /* already sanitized */ }} />;
}
```

Style `.doc-content` explicitly (no typography plugin). Minimum:

```css
.doc-content { color: #1f2430; line-height: 1.7; }
.doc-content > :first-child { margin-top: 0; }
.doc-content h1 { font-size: 1.6rem; font-weight: 700; margin: 1rem 0 .5rem; }
.doc-content h2 { font-size: 1.35rem; font-weight: 700; margin: .9rem 0 .45rem; }
.doc-content h3 { font-size: 1.15rem; font-weight: 600; margin: .8rem 0 .4rem; }
.doc-content p  { margin: .5rem 0; }
.doc-content ul { list-style: disc; padding-inline-start: 1.5rem; margin: .5rem 0; }
.doc-content ol { list-style: decimal; padding-inline-start: 1.5rem; margin: .5rem 0; }
.doc-content a  { color: #2563eb; text-decoration: underline; }
.doc-content mark { color: inherit; padding: 0 .1em; border-radius: .15rem; }
.doc-content img  { max-width: 100%; height: auto; border-radius: .375rem; margin: .5rem 0; }
.doc-content blockquote { border-inline-start: 3px solid #d1d5db; padding-inline-start: .75rem; color: #6b7280; }
.doc-content pre  { background: #f3f4f6; padding: .75rem; border-radius: .5rem; overflow-x: auto; }
.doc-content code { background: #f3f4f6; padding: .1rem .3rem; border-radius: .25rem; }
.doc-content hr   { border: 0; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
.doc-content table { border-collapse: collapse; width: 100%; margin: .6rem 0; }
.doc-content th, .doc-content td { border: 1px solid #e5e7eb; padding: .4rem .6rem; text-align: start; position: relative; }
.doc-content th { background: #f3f4f6; font-weight: 600; }

/* Editor-only chrome (the editor root also carries .doc-content): */
.doc-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9ca3af; float: inline-start; height: 0; pointer-events: none; }
.doc-content .selectedCell::after { content: ""; position: absolute; inset: 0; background: rgba(37,99,235,.12); pointer-events: none; }
.doc-content .column-resize-handle { position: absolute; inset-inline-end: -1px; top: 0; bottom: -1px; width: 2px; background: #2563eb; pointer-events: none; }
.doc-content .tableWrapper { overflow-x: auto; }
.doc-content img.ProseMirror-selectednode { outline: 2px solid #2563eb; outline-offset: 1px; }
```

---

## 4. Wire up in the target project (adapt these)

1. **Image upload** — implement `uploadImage(file) => Promise<srcUrl>`: POST the file
   to your upload endpoint, return the served URL. Omit the prop to disable images.
2. **Sanitizer image rule** — change `ALLOWED_IMG` to match the URL your uploads are
   served from. Keep it strict so documents can't embed external/tracking images.
3. **Sanitize at the boundary** — call `sanitize()` in the server action/route before
   saving, and again before rendering (you render with `dangerouslySetInnerHTML`).
4. **Styling** — replace the Tailwind classes if you don't use Tailwind; keep the
   `.doc-content` class on both the editor and the read-only view.
5. **SSR** — keep `immediatelyRender: false` on Next.js; remove `"use client"` for
   plain React.

---

## 5. Gotchas

- You **must** list `style` in `allowedAttributes` or alignment/colour/size never
  persist (a common silent failure — `allowedStyles` alone does nothing).
- Don't double-register link/underline (StarterKit v3 has them). `Color`/`FontSize`
  come from `extension-text-style`.
- A native `<input type="color">` overlaid at `opacity-0` is the simplest colour
  picker (no extra UI library).
- Show the table row/column buttons only when `editor.isActive("table")`.
- The editor and the read-only view share the `.doc-content` class so inline styles
  (colour/size/alignment) render identically in both.

---

## 6. Optional: HTML → PDF export

If you also need a server-side PDF that matches the editor, render the sanitized HTML
with **`pdf-lib`** + **`node-html-parser`** (+ **`sharp`** to convert webp/gif images
to PNG). Key design choices that make it robust:

- Parse the HTML into blocks (headings, paragraphs with inline runs, lists,
  blockquote, hr, code, tables, images) and lay them out manually with `pdf-lib`.
- Honour per-block `text-align` and per-run `color`/`background-color`/`font-size`.
- **StandardFonts are WinAnsi/Latin only** — strip characters they can't encode
  (Arabic/emoji) so it never throws.
- **Inject the image loader** (`loadAsset(id) => Promise<{buffer, mimeType}>`) instead
  of importing your DB layer into the renderer — keeps it unit-testable and free of
  server-only import chains. Pre-embed all images before the (sync) layout pass.
- Embed `pdf-lib` PNG/JPG directly; convert other formats with `sharp` first.

This is a few hundred lines; ask Claude Code to build it as a separate
`pdf-service.ts` only if PDF export is actually required.
