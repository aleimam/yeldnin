import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { generateDocumentPdf } from "./pdf-service";

const HTML = `
  <h1>Heading One</h1>
  <p>A paragraph with <strong>bold</strong>, <em>italic</em>, <u>underline</u>, a
     <a href="https://example.com">link</a> and a smart quote: “hello” — em dash, café.</p>
  <h2>Subheading</h2>
  <ul><li>First bullet</li><li>Second with <strong>bold</strong><ul><li>Nested</li></ul></li></ul>
  <ol><li>One</li><li>Two</li></ol>
  <blockquote><p>A quoted line that should be indented with a bar.</p></blockquote>
  <hr/>
  <pre><code>const x = 1;\nconsole.log(x);</code></pre>
  <table><thead><tr><th>Col A</th><th>Col B</th></tr></thead>
  <tbody><tr><td>cell one with some longer text to wrap</td><td>cell two</td></tr></tbody></table>
  <p>أهلا 😀 emoji and arabic get dropped safely.</p>
  <p style="text-align:center">A centered line with <span style="color:#cc0000">red text</span>.</p>
  <p style="text-align:right">Right-aligned with a <mark style="background-color:#fdfaa0">highlighted phrase</mark>.</p>
  <p>Mixed sizes: <span style="font-size:26px">big</span> and <span style="font-size:13px">small</span> words.</p>
  <p><img src="/api/asset/nonexistent" alt="skipped (no loader in test)" /></p>
`;

describe("generateDocumentPdf", () => {
  it("produces a valid PDF from rich HTML without a letterhead", async () => {
    const bytes = await generateDocumentPdf({
      title: "Smoke Test Document",
      contentHtml: HTML,
      letterhead: null,
      margins: { top: 45, bottom: 30, left: 22, right: 22 },
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // "%PDF" magic header
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF");
  });

  it("handles empty content", async () => {
    const bytes = await generateDocumentPdf({
      title: "Empty",
      contentHtml: "",
      letterhead: null,
      margins: { top: 45, bottom: 30, left: 22, right: 22 },
    });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
