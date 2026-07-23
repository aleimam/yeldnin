import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { readAsset } from "@/lib/assets/assets-service";
import { generateDocumentPdf } from "@/lib/documents/pdf-service";
import { markdownToHtml } from "@/lib/evaluation/eval-ai-logic";
import { myEmployeeId } from "@/lib/evaluation/eval-evaluate-service";

const f1 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(_req: Request, { params }: { params: Promise<{ cycle: string; emp: string }> }) {
  const access = await getAccess();
  if (!access.user) return new NextResponse("Unauthorized", { status: 401 });
  const { cycle, emp } = await params;
  const cycleId = Number(cycle);
  const empId = Number(emp);
  if (!Number.isInteger(cycleId) || !Number.isInteger(empId)) return new NextResponse("Bad request", { status: 400 });

  const fb = await prisma.evalFeedback.findUnique({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId: empId } } });
  if (!fb || !(fb.editedMd || fb.draftMd)) return new NextResponse("Not found", { status: 404 });

  // Admins (manage) see any; an employee sees only their own RELEASED report.
  const isAdmin = access.can("evaluation", "manage");
  if (!isAdmin) {
    const mine = await myEmployeeId(access.user.id);
    if (mine !== empId || fb.status !== "RELEASED") return new NextResponse("Forbidden", { status: 403 });
  }

  const [cycleRow, empRow, pillarRows, criteria] = await Promise.all([
    prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { name: true } }),
    prisma.employee.findUnique({ where: { id: empId }, select: { user: { select: { name: true } } } }),
    prisma.evalResult.findMany({ where: { cycleId, subjectEmpId: empId, scope: { in: ["OVERALL", "PILLAR"] } } }),
    prisma.evalCycleCriterion.findMany({ where: { cycleId }, select: { pillarId: true, pillarName: true, pillarOrder: true } }),
  ]);
  const pName = new Map<number, { name: string; order: number }>();
  for (const c of criteria) if (!pName.has(c.pillarId)) pName.set(c.pillarId, { name: c.pillarName, order: c.pillarOrder });
  const overall = pillarRows.find((r) => r.scope === "OVERALL");
  const pillars = pillarRows
    .filter((r) => r.scope === "PILLAR" && r.pillarId != null)
    .sort((a, b) => (pName.get(a.pillarId!)?.order ?? 0) - (pName.get(b.pillarId!)?.order ?? 0));

  const tableRows = pillars
    .map((r) => `<tr><td>${esc(pName.get(r.pillarId!)?.name ?? "")}</td><td>${f1(r.score)}</td><td>${f1(r.selfScore)}</td><td>${r.responses}</td></tr>`)
    .join("");
  const scoresHtml = `
    <h1>${esc(empRow?.user.name ?? "")}</h1>
    <p>360 Reviews — ${esc(cycleRow?.name ?? "")}</p>
    <table>
      <thead><tr><th>Pillar</th><th>Others</th><th>Self</th><th>Responses</th></tr></thead>
      <tbody>
        <tr><td><strong>Overall</strong></td><td><strong>${f1(overall?.score)}</strong></td><td>${f1(overall?.selfScore)}</td><td>${overall?.responses ?? 0}</td></tr>
        ${tableRows}
      </tbody>
    </table>`;
  const contentHtml = scoresHtml + markdownToHtml(fb.editedMd ?? fb.draftMd ?? "");

  const settings = await getPlatformSettings();
  let letterhead: Buffer | null = null;
  if (settings.docLetterheadAssetId) {
    const asset = await readAsset(settings.docLetterheadAssetId);
    if (asset && asset.mimeType === "application/pdf") letterhead = asset.buffer;
  }

  const bytes = await generateDocumentPdf({
    title: `360 Feedback — ${empRow?.user.name ?? ""}`,
    contentHtml,
    letterhead,
    margins: {
      top: settings.docMarginTopMm,
      bottom: settings.docMarginBottomMm,
      left: settings.docMarginLeftMm,
      right: settings.docMarginRightMm,
    },
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="360-feedback-${empId}.pdf"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
