"use client";
import { useMemo, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useT } from "@/i18n/client";

// StarterKit v3 bundles bold/italic/underline/strike/headings/lists/blockquote/
// code/link/hr/history; on top: tables, alignment, colour, highlight, font size,
// and images. Stored HTML is sanitized server-side (the allowlist mirrors this).

function ToolBtn({ active, disabled, onClick, children, title }: { active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`h-8 min-w-8 rounded px-2 text-sm ${active ? "bg-brand text-brand-fg" : "text-ink hover:bg-canvas"} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-line" />;

function AlignIcon({ dir }: { dir: "left" | "center" | "right" | "justify" }) {
  const short = dir === "justify" ? 14 : 9;
  const x = dir === "right" ? 14 - short : dir === "center" ? (14 - short) / 2 : 0;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="stroke-current" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <line x1="0" y1="2" x2="14" y2="2" />
      <line x1={x} y1="5.3" x2={x + short} y2="5.3" />
      <line x1="0" y1="8.6" x2="14" y2="8.6" />
      <line x1={x} y1="11.9" x2={x + short} y2="11.9" />
    </svg>
  );
}

const FONT_SIZES = ["13px", "16px", "20px", "26px", "34px"];
function FontSizeControl({ editor }: { editor: Editor }) {
  const t = useT();
  const cur = (editor.getAttributes("textStyle").fontSize as string) || "";
  return (
    <select
      title={t("docs.editor.fontSize")}
      value={cur}
      onChange={(e) => { const v = e.target.value; v ? editor.chain().focus().setFontSize(v).run() : editor.chain().focus().unsetFontSize().run(); }}
      className="h-8 cursor-pointer rounded bg-transparent px-1 text-sm text-ink hover:bg-canvas focus:outline-none"
    >
      <option value="">{t("docs.editor.fontDefault")}</option>
      {FONT_SIZES.map((s) => <option key={s} value={s}>{parseInt(s, 10)}</option>)}
    </select>
  );
}

function ColorControls({ editor }: { editor: Editor }) {
  const t = useT();
  const textColor = (editor.getAttributes("textStyle").color as string) || "#1f2430";
  const hlColor = (editor.getAttributes("highlight").color as string) || "#fff3a3";
  return (
    <>
      <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded text-ink hover:bg-canvas" title={t("docs.editor.textColor")}>
        <span className="text-sm font-semibold leading-none" style={{ borderBottom: `3px solid ${textColor}`, paddingBottom: 1 }}>A</span>
        <input type="color" value={textColor} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
      </label>
      <ToolBtn title={t("docs.editor.clearColor")} onClick={() => editor.chain().focus().unsetColor().run()}>A×</ToolBtn>
      <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded text-ink hover:bg-canvas" title={t("docs.editor.highlight")}>
        <span className="rounded px-1 text-sm font-semibold leading-none" style={{ backgroundColor: hlColor }}>H</span>
        <input type="color" value={hlColor} onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
      </label>
      <ToolBtn title={t("docs.editor.clearHighlight")} onClick={() => editor.chain().focus().unsetHighlight().run()}>H×</ToolBtn>
    </>
  );
}

function ImageButton({ editor }: { editor: Editor }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.id) editor.chain().focus().setImage({ src: `/api/asset/${j.id}` }).run();
    } finally {
      setBusy(false);
    }
  }
  return (
    <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded text-sm text-ink hover:bg-canvas" title={t("docs.editor.image")}>
      {busy ? "…" : "🖼"}
      <input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" disabled={busy} onChange={onPick} tabIndex={-1} />
    </label>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useT();
  const link = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("docs.editor.linkUrl"), prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().toggleLink({ href: url }).run();
  };
  const inTable = editor.isActive("table");
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-surface p-1.5">
      <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolBtn>
      <ToolBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolBtn>
      <ToolBtn title="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolBtn>
      <Divider />
      <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
      <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
      <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>
      <FontSizeControl editor={editor} />
      <Divider />
      <ToolBtn title={t("docs.editor.alignLeft")} active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignIcon dir="left" /></ToolBtn>
      <ToolBtn title={t("docs.editor.alignCenter")} active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignIcon dir="center" /></ToolBtn>
      <ToolBtn title={t("docs.editor.alignRight")} active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignIcon dir="right" /></ToolBtn>
      <ToolBtn title={t("docs.editor.alignJustify")} active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignIcon dir="justify" /></ToolBtn>
      <Divider />
      <ColorControls editor={editor} />
      <Divider />
      <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolBtn>
      <ToolBtn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolBtn>
      <ToolBtn title="Link" active={editor.isActive("link")} onClick={link}>🔗</ToolBtn>
      <ImageButton editor={editor} />
      <ToolBtn title={t("docs.editor.table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</ToolBtn>
      {inTable && (
        <>
          <Divider />
          <ToolBtn title={t("docs.editor.tableAddCol")} onClick={() => editor.chain().focus().addColumnAfter().run()}>+▕</ToolBtn>
          <ToolBtn title={t("docs.editor.tableDelCol")} onClick={() => editor.chain().focus().deleteColumn().run()}>−▕</ToolBtn>
          <ToolBtn title={t("docs.editor.tableAddRow")} onClick={() => editor.chain().focus().addRowAfter().run()}>+▁</ToolBtn>
          <ToolBtn title={t("docs.editor.tableDelRow")} onClick={() => editor.chain().focus().deleteRow().run()}>−▁</ToolBtn>
          <ToolBtn title={t("docs.editor.tableHeader")} active={editor.isActive("tableHeader")} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>⤒</ToolBtn>
          <ToolBtn title={t("docs.editor.tableDelete")} onClick={() => editor.chain().focus().deleteTable().run()}>⊟</ToolBtn>
        </>
      )}
      <Divider />
      <ToolBtn title={t("docs.editor.clear")} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>⌫</ToolBtn>
      <ToolBtn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</ToolBtn>
      <ToolBtn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</ToolBtn>
    </div>
  );
}

/** Tiptap rich-text editor. Uncontrolled (seeded once from `value`); emits HTML
 *  on every change. Paste from Word keeps basic formatting. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const t = useT();
  const extensions = useMemo(
    () => [
      StarterKit,
      TableKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: t("docs.editor.placeholder") }),
    ],
    [t],
  );
  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false, // required under SSR (Next) to avoid hydration mismatch
    editorProps: { attributes: { class: "doc-content min-h-[320px] px-4 py-3 focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="rounded-lg border border-line p-4 text-sm text-muted">{t("common.loading")}</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
