import { describe, it, expect } from "vitest";
import { parseDepthScore, effortScore, blendOverall, firstName, markdownToHtml, buildReportPrompt, AI_SYSTEM_PROMPT } from "./eval-ai-logic";

describe("parseDepthScore", () => {
  it("extracts and clamps the integer 0..20", () => {
    expect(parseDepthScore("14")).toBe(14);
    expect(parseDepthScore("Score: 18/20")).toBe(18);
    expect(parseDepthScore("25")).toBe(20);
    expect(parseDepthScore("-3")).toBe(0);
    expect(parseDepthScore("no number")).toBeNull();
  });
});

describe("effortScore", () => {
  it("is coverage × depth/20 × 100, null coverage → null", () => {
    expect(effortScore(1, 20)).toBe(100);
    expect(effortScore(0.5, 10)).toBe(25); // 0.5 * 0.5 * 100
    expect(effortScore(0.8, null)).toBe(0);
    expect(effortScore(null, 15)).toBeNull();
  });
});

describe("blendOverall", () => {
  it("blends 85% peer + 15% effort", () => {
    // peer 4/5 = 80%, effort 100% → 0.85*80 + 0.15*100 = 83
    expect(blendOverall(4, 100)).toBe(83);
  });
  it("falls back to peer% when effort is null", () => {
    expect(blendOverall(4, null)).toBe(80);
  });
  it("clamps peer% at 100 and returns null with no peer data", () => {
    expect(blendOverall(5, null)).toBe(100);
    expect(blendOverall(null, 50)).toBeNull();
  });
});

describe("firstName", () => {
  it("takes the first token", () => {
    expect(firstName("Aya Mohamed Ali")).toBe("Aya");
    expect(firstName("  Sam ")).toBe("Sam");
  });
});

describe("markdownToHtml", () => {
  it("converts headings, bullets, bold, paragraphs and escapes html", () => {
    const html = markdownToHtml("## Overall\nYou did **well**.\n\n- point one\n- point two");
    expect(html).toContain("<h2>Overall</h2>");
    expect(html).toContain("<strong>well</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>point one</li>");
    expect(html).toContain("</ul>");
  });
  it("escapes angle brackets to prevent tag injection", () => {
    expect(markdownToHtml("<script>x</script>")).toContain("&lt;script&gt;");
  });
});

describe("buildReportPrompt", () => {
  it("includes pillars + comments but is driven only by given data", () => {
    const prompt = buildReportPrompt({
      firstName: "Aya",
      department: "Sales",
      overall: 4.2,
      overallResponses: 6,
      selfOverall: 4.5,
      pillars: [{ name: "Communication", score: 4.3, self: 4, responses: 6 }],
      comments: ["Very helpful in team situations"],
      priorOverall: 4.0,
      priorPillars: [{ name: "Communication", score: 3.9 }],
      adminNote: null,
    });
    expect(prompt).toContain("Aya");
    expect(prompt).toContain("Communication");
    expect(prompt).toContain("Previous cycle overall");
    expect(prompt).toContain("do not quote verbatim");
  });
});

describe("AI_SYSTEM_PROMPT", () => {
  it("carries the core guardrails", () => {
    expect(AI_SYSTEM_PROMPT).toMatch(/never/i);
    expect(AI_SYSTEM_PROMPT).toMatch(/gender/i);
    expect(AI_SYSTEM_PROMPT).toMatch(/promotion, dismissal, or pay/i);
  });
});
