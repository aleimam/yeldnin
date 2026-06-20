import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readAsset } from "@/lib/assets/assets-service";
import { getAccess } from "@/lib/auth/access";
import { canManageEmployee, getEmployeeByUserId } from "@/lib/hr/hr-service";
import { getPlatformSettings } from "@/lib/settings/settings-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Branding assets (logo / dark logo / favicon) are referenced on the public
  // login page, so they're served without auth. Everything else (expense
  // receipts, pricing photos) requires an authenticated session.
  const settings = await getPlatformSettings();
  const isBranding =
    id === settings.logoUrl ||
    id === settings.darkLogoUrl ||
    id === settings.faviconUrl;

  if (!isBranding) {
    const access = await getAccess();
    if (!access.user) return new NextResponse("Unauthorized", { status: 401 });

    // Per-object gate for the two sensitive asset types the audit flagged: expense
    // receipts (→ Expenses VIEW) and HR documents like national-ID scans (→ the
    // owning employee, their manager/HR, or admin). Asset ids are unguessable cuids;
    // other photos (product/CS/avatars) stay logged-in-only.
    const [expenseAtt, empPhoto, eventPhoto, chatAtt, inqAtt] = await Promise.all([
      prisma.expenseAttachment.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.employeePhoto.findFirst({ where: { assetId: id }, select: { employeeId: true } }),
      prisma.employeeEventPhoto.findFirst({ where: { assetId: id }, select: { event: { select: { employeeId: true } } } }),
      prisma.chatAttachment.findFirst({ where: { assetId: id }, select: { message: { select: { conversation: { select: { userAId: true, userBId: true } } } } } }),
      prisma.inquiryAttachment.findFirst({ where: { assetId: id }, select: { message: { select: { inquiry: { select: { initiatorId: true, recipientUserId: true, initiatorTeamId: true, recipientTeamId: true } } } } } }),
    ]);
    if (expenseAtt && !access.canModule("expenses", "VIEW")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const hrEmployeeId = empPhoto?.employeeId ?? eventPhoto?.event.employeeId ?? null;
    if (hrEmployeeId != null) {
      const own = (await getEmployeeByUserId(access.user.id))?.id === hrEmployeeId;
      const allowed = own || access.can("human_resources", "operate") || (await canManageEmployee(access, hrEmployeeId));
      if (!allowed) return new NextResponse("Forbidden", { status: 403 });
    }

    // Chat photos: only the two participants of the conversation.
    if (chatAtt) {
      const c = chatAtt.message.conversation;
      if (c.userAId !== access.user.id && c.userBId !== access.user.id) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    // Inquiry photos: only the two sides (initiator + recipient, and their teams).
    if (inqAtt) {
      const q = inqAtt.message.inquiry;
      let ok = q.initiatorId === access.user.id || q.recipientUserId === access.user.id;
      if (!ok) {
        const teams = [q.initiatorTeamId, q.recipientTeamId].filter((t): t is number => t != null);
        if (teams.length) {
          ok = !!(await prisma.teamMember.findFirst({ where: { userId: access.user.id, teamId: { in: teams } }, select: { id: true } }));
        }
      }
      if (!ok) return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const asset = await readAsset(id);
  if (!asset) return new NextResponse("Not found", { status: 404 });

  // Non-image attachments (e.g. uploaded PDFs) are still shown inline, but
  // sandboxed so an embedded script can't run in our origin if opened directly.
  const isImage = asset.mimeType.startsWith("image/");

  return new NextResponse(new Uint8Array(asset.buffer), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
      ...(isImage ? {} : { "Content-Security-Policy": "sandbox" }),
    },
  });
}
