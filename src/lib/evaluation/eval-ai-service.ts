import "server-only";
import { prisma } from "@/lib/db";
import {
  AI_SYSTEM_PROMPT,
  buildReportPrompt,
  buildDepthPrompt,
  parseDepthScore,
  effortScore,
  firstName,
  type ReportPayload,
  type PillarDatum,
} from "./eval-ai-logic";
import { getAiKeyAndModel, recordAiTest } from "./eval-ai-config-service";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** One Claude Messages API call. Throws on a non-OK response. */
async function callClaude(key: string, model: string, system: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: "user", content: userPrompt }] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
  if (!text) throw new Error("Claude returned an empty response.");
  return text;
}

/** Lightweight connectivity/key check for the Settings page. */
export async function testAiConfig(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getAiKeyAndModel();
  if (!cfg) {
    await recordAiTest(false, "No API key set.");
    return { ok: false, message: "No API key set." };
  }
  try {
    await callClaude(cfg.key, cfg.model, "Reply with the single word OK.", "Say OK.", 16);
    await recordAiTest(true, `OK (${cfg.model})`);
    return { ok: true, message: `OK (${cfg.model})` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Test failed.";
    await recordAiTest(false, msg);
    return { ok: false, message: msg };
  }
}

/** Frozen pillar id → name for a cycle. */
async function pillarNames(cycleId: number): Promise<Map<number, string>> {
  const rows = await prisma.evalCycleCriterion.findMany({ where: { cycleId }, select: { pillarId: true, pillarName: true } });
  const m = new Map<number, string>();
  for (const r of rows) if (!m.has(r.pillarId)) m.set(r.pillarId, r.pillarName);
  return m;
}

/** Prior closed cycle's overall + per-pillar peer scores for a subject. */
async function priorScores(cycleId: number, subjectEmpId: number): Promise<{ overall: number | null; pillars: { pillarId: number; score: number }[] }> {
  const startedRow = await prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { startedAt: true } });
  if (!startedRow) return { overall: null, pillars: [] };
  const prevCycle = await prisma.evalCycle.findFirst({
    where: { status: "CLOSED", startedAt: { lt: startedRow.startedAt } },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!prevCycle) return { overall: null, pillars: [] };
  const rows = await prisma.evalResult.findMany({ where: { cycleId: prevCycle.id, subjectEmpId, scope: { in: ["OVERALL", "PILLAR"] } } });
  return {
    overall: rows.find((r) => r.scope === "OVERALL")?.score ?? null,
    pillars: rows.filter((r) => r.scope === "PILLAR" && r.pillarId != null).map((r) => ({ pillarId: r.pillarId!, score: r.score })),
  };
}

/** Assemble the fully-anonymized report input for one subject. */
async function assembleReportPayload(cycleId: number, subjectEmpId: number): Promise<ReportPayload | null> {
  const [results, names, prior, fb, emp, comments] = await Promise.all([
    prisma.evalResult.findMany({ where: { cycleId, subjectEmpId } }),
    pillarNames(cycleId),
    priorScores(cycleId, subjectEmpId),
    prisma.evalFeedback.findUnique({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } } }),
    prisma.employee.findUnique({ where: { id: subjectEmpId }, select: { user: { select: { name: true, teamMembers: { select: { team: { select: { name: true } } } } } } } }),
    prisma.evaluation.findMany({
      where: { cycleId, subjectEmpId, isSelf: false, status: "SUBMITTED", overallComment: { not: null } },
      select: { overallComment: true },
    }),
  ]);
  const overall = results.find((r) => r.scope === "OVERALL");
  if (!overall) return null; // no peer data → nothing to write about
  const priorByPillar = new Map(prior.pillars.map((p) => [p.pillarId, p.score]));
  const pillars: PillarDatum[] = results
    .filter((r) => r.scope === "PILLAR" && r.pillarId != null)
    .map((r) => ({ name: names.get(r.pillarId!) ?? `#${r.pillarId}`, score: r.score, self: r.selfScore, responses: r.responses }));

  return {
    firstName: firstName(emp?.user.name ?? "Colleague"),
    department: emp?.user.teamMembers.map((m) => m.team.name).join(", ") || "—",
    overall: overall.score,
    overallResponses: overall.responses,
    selfOverall: overall.selfScore,
    pillars,
    comments: comments.map((c) => (c.overallComment ?? "").trim()).filter(Boolean),
    priorOverall: prior.overall,
    priorPillars: results
      .filter((r) => r.scope === "PILLAR" && r.pillarId != null && priorByPillar.has(r.pillarId!))
      .map((r) => ({ name: names.get(r.pillarId!) ?? `#${r.pillarId}`, score: priorByPillar.get(r.pillarId!) ?? null })),
    adminNote: fb?.adminNote ?? null,
  };
}

/** The comments this subject WROTE as an evaluator (identities are not included). */
async function ownComments(cycleId: number, subjectEmpId: number): Promise<string[]> {
  const rows = await prisma.evaluation.findMany({
    where: { cycleId, evaluatorEmpId: subjectEmpId, isSelf: false, overallComment: { not: null } },
    select: { overallComment: true },
  });
  return rows.map((r) => (r.overallComment ?? "").trim()).filter(Boolean);
}

/** Generate the draft report + effort depth for one subject. Best-effort:
 *  flips status and records `error` on failure so the row is retryable. */
export async function generateForEmployee(cycleId: number, subjectEmpId: number, key: string, model: string): Promise<boolean> {
  const payload = await assembleReportPayload(cycleId, subjectEmpId);
  await prisma.evalFeedback.update({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, data: { status: "GENERATING", error: null } }).catch(() => {});
  if (!payload) {
    await prisma.evalFeedback.update({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, data: { status: "FAILED", error: "No peer data to summarize." } }).catch(() => {});
    return false;
  }
  try {
    const draftMd = await callClaude(key, model, AI_SYSTEM_PROMPT, buildReportPrompt(payload), 1200);
    const depthText = await callClaude(key, model, "You output only a single integer 0-20.", buildDepthPrompt(await ownComments(cycleId, subjectEmpId)), 16);
    const depth = parseDepthScore(depthText);
    const fb = await prisma.evalFeedback.findUnique({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, select: { effortCoverage: true } });
    await prisma.evalFeedback.update({
      where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } },
      data: { status: "GENERATED", draftMd, effortDepth: depth, effortScore: effortScore(fb?.effortCoverage ?? null, depth), model, generatedAt: new Date(), error: null },
    });
    return true;
  } catch (e) {
    await prisma.evalFeedback
      .update({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, data: { status: "FAILED", error: (e instanceof Error ? e.message : "Generation failed.").slice(0, 300) } })
      .catch(() => {});
    return false;
  }
}

/** Throttled sequential batch over a cycle's participants (those with peer data).
 *  Returns immediately-awaitable; callers fire-and-forget. */
export async function generateBatch(cycleId: number, options?: { onlyEmpId?: number }): Promise<{ generated: number; failed: number }> {
  const cfg = await getAiKeyAndModel();
  if (!cfg) throw new Error("Claude API key is not configured.");
  const ids = options?.onlyEmpId
    ? [options.onlyEmpId]
    : (await prisma.evalResult.findMany({ where: { cycleId, scope: "OVERALL" }, select: { subjectEmpId: true } })).map((r) => r.subjectEmpId);
  let generated = 0;
  let failed = 0;
  for (const empId of ids) {
    const ok = await generateForEmployee(cycleId, empId, cfg.key, cfg.model);
    ok ? generated++ : failed++;
  }
  return { generated, failed };
}
