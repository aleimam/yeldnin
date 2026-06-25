// Read-only renderer for a document's stored HTML. The content is sanitized on
// the server when saved (see documents-service), so rendering it is safe.
export function RichTextView({ html }: { html: string }) {
  if (!html?.trim()) return null;
  return <div className="doc-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
