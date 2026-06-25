"use client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { useT } from "@/i18n/client";

// StarterKit v3 already bundles bold/italic/underline/strike/headings/lists/
// blockquote/code/link/hr/history; we only add tables on top.
const EXTENSIONS = [StarterKit, TableKit];

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

function Toolbar({ editor }: { editor: Editor }) {
  const t = useT();
  const link = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("docs.editor.linkUrl"), prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().toggleLink({ href: url }).run();
  };
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-canvas/60 p-1.5">
      <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolBtn>
      <ToolBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolBtn>
      <ToolBtn title="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolBtn>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
      <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
      <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolBtn>
      <ToolBtn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolBtn>
      <ToolBtn title="Link" active={editor.isActive("link")} onClick={link}>🔗</ToolBtn>
      <ToolBtn title={t("docs.editor.table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</ToolBtn>
      <span className="mx-1 h-5 w-px bg-line" />
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
  const editor = useEditor({
    extensions: EXTENSIONS,
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
