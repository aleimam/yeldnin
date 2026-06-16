// Dependency-free, XSS-safe Markdown → HTML renderer for admin-authored content pages.
//
// Safety model: ALL text is HTML-escaped first, and only a fixed allowlist of tags is ever
// emitted (h1–h3, p, ul/ol/li, blockquote, pre/code, hr, strong/em, a, br). Link hrefs are
// restricted to http(s)/mailto/tel/relative and re-escaped. There is no path for author input to
// become an executable tag or attribute — safe to render with dangerouslySetInnerHTML.

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeHref = (url: string): string | null => {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return escapeHtml(u);
  if (/^[/#]/.test(u)) return escapeHtml(u); // site-relative ("/p/about", "#section")
  return null;
};

function renderInline(raw: string): string {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const href = safeHref(url);
    return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>` : text;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${c}</strong>`);
  s = s.replace(/\*([^*]+)\*/g, (_m, c) => `<em>${c}</em>`);
  s = s.replace(/_([^_]+)_/g, (_m, c) => `<em>${c}</em>`);
  return s;
}

export function renderMarkdown(src: string): string {
  const lines = (src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(renderInline).join("<br/>")}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\s*$/.test(line)) { flushPara(); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); out.push("<hr/>"); i++; continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { flushPara(); const lvl = h[1].length; out.push(`<h${lvl}>${renderInline(h[2])}</h${lvl}>`); i++; continue; }

    if (/^\s*>\s?/.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(`<blockquote>${quote.map(renderInline).join("<br/>")}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      out.push(`<ul>${items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      out.push(`<ol>${items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ol>`);
      continue;
    }

    para.push(line);
    i++;
  }
  flushPara();
  return out.join("\n");
}
