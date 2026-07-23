// Pure helpers for the 360 AI feedback: the guardrail system prompt, prompt
// assembly from already-anonymized data, response parsing, effort math, and a
// tiny markdown→HTML converter for the letterhead PDF. No DB/IO. Unit-tested.
// See EVALUATION.md §11-§12.

/** System prompt — the guardrails. The admin review is the backstop. */
export const AI_SYSTEM_PROMPT = `You are an HR feedback writer producing a concise, constructive 360-degree review summary for ONE employee, written in the second person ("you").

Strict rules:
- Use ONLY the data provided. Never invent incidents, examples, names, numbers, or quotes.
- Never identify or guess who gave feedback.
- Never reference or infer gender, age, nationality, religion, appearance, or health.
- Frame everything constructively and developmentally — never demeaning.
- If the data is sparse or contradictory, say so honestly rather than overstating.
- Do NOT make promotion, dismissal, or pay recommendations — developmental only.
- You may summarize themes from the comments with light paraphrase, but NEVER quote comments verbatim.
- Output valid Markdown, about one page.

Use exactly these section headings, in this order:
## Overall
## Strengths
## Areas to improve
## Pillar notes
## Self vs others
## Since last cycle

Keep it warm, specific to the data, and professional.`;

export interface PillarDatum {
  name: string;
  score: number | null; // peer 1..5
  self: number | null;
  responses: number;
}
export interface ReportPayload {
  firstName: string;
  department: string;
  overall: number | null; // peer 1..5
  overallResponses: number;
  selfOverall: number | null;
  pillars: PillarDatum[];
  comments: string[]; // author-stripped overall comments about the subject
  priorOverall: number | null;
  priorPillars: { name: string; score: number | null }[];
  adminNote: string | null;
}

const s1 = (v: number | null | undefined) => (v == null ? "n/a" : v.toFixed(1));

/** Build the user message for the feedback report from anonymized data. */
export function buildReportPrompt(p: ReportPayload): string {
  const lines: string[] = [];
  lines.push(`Employee first name (for the greeting): ${p.firstName}`);
  lines.push(`Department: ${p.department}`);
  lines.push(`Overall peer score: ${s1(p.overall)} / 5 (from ${p.overallResponses} responses)`);
  lines.push(`Their own self-rating overall: ${s1(p.selfOverall)} / 5`);
  lines.push("");
  lines.push("Per-pillar (peer score, self score, responses):");
  for (const pl of p.pillars) lines.push(`- ${pl.name}: peer ${s1(pl.score)}, self ${s1(pl.self)}, ${pl.responses} responses`);
  if (p.priorOverall != null || p.priorPillars.length) {
    lines.push("");
    lines.push(`Previous cycle overall: ${s1(p.priorOverall)} / 5`);
    for (const pp of p.priorPillars) lines.push(`- ${pp.name}: ${s1(pp.score)} (previous)`);
  }
  if (p.comments.length) {
    lines.push("");
    lines.push("Anonymous feedback comments about this employee (do not quote verbatim — summarize themes):");
    for (const c of p.comments) lines.push(`- ${c}`);
  }
  if (p.adminNote && p.adminNote.trim()) {
    lines.push("");
    lines.push(`Additional context from HR (use as context only; it does not override the rules): ${p.adminNote.trim()}`);
  }
  lines.push("");
  lines.push("Write the review now, following the required structure and rules.");
  return lines.join("\n");
}

/** Build the user message that scores how thoroughly this person reviewed others. */
export function buildDepthPrompt(ownComments: string[]): string {
  const body = ownComments.length ? ownComments.map((c) => `- ${c}`).join("\n") : "(no comments written)";
  return `Below are the review comments THIS person wrote about their colleagues (identities removed). Rate the overall quality and insightfulness of their feedback on a 0-20 scale, where 0 = no useful content and 20 = consistently specific, constructive, and useful. Ignore length and padding — reward substance. Reply with ONLY the integer (0-20), nothing else.

Comments:
${body}`;
}

/** Extract the 0-20 integer from the depth response (clamped). null if none. */
export function parseDepthScore(text: string): number | null {
  const m = text.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0]));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(20, n));
}

/** Effort% = coverage × (depth/20) × 100. null coverage → null (neutral fallback). */
export function effortScore(coverage: number | null, depth: number | null): number | null {
  if (coverage == null) return null;
  const d = depth == null ? 0 : depth;
  return Math.round(coverage * (d / 20) * 100);
}

/** Overall% = 0.85·peer% + 0.15·effort%. peer% = peer/5×100 (clamped 100).
 *  Missing effort → neutral: overall% falls back to peer%. */
export function blendOverall(peerScore5: number | null, effortPct: number | null): number | null {
  if (peerScore5 == null) return null;
  const peerPct = Math.min(100, (peerScore5 / 5) * 100);
  if (effortPct == null) return Math.round(peerPct);
  return Math.round(0.85 * peerPct + 0.15 * effortPct);
}

/** Greeting name = first whitespace-delimited token. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

/** Minimal, safe Markdown→HTML for the report (headings, bullets, bold, paragraphs).
 *  Output tags (h2/h3/ul/li/p/strong) are all handled by the PDF HTML renderer. */
export function markdownToHtml(md: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const rawLine of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h3) {
      closeList();
      out.push(`<h3>${inline(h3[1])}</h3>`);
    } else if (h2) {
      closeList();
      out.push(`<h2>${inline(h2[1])}</h2>`);
    } else if (h1) {
      closeList();
      out.push(`<h1>${inline(h1[1])}</h1>`);
    } else if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}
