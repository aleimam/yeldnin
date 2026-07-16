import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readAsset } from "@/lib/assets/assets-service";
import { getAccess } from "@/lib/auth/access";
import { canManageEmployee, getEmployeeByUserId } from "@/lib/hr/hr-service";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { productScopes, type Scope } from "@/lib/products/products-logic";
import { requestScopes } from "@/lib/requests/request-logic";

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

    // Per-object gates. Expense receipts (→ Expenses VIEW) and HR documents like
    // national-ID scans (→ the owning employee, their manager/HR, or admin) are
    // gated by object. Product & request photos carry the EGV/XOONX scope, so they
    // follow the golden rule — gated by the same scope check as their detail pages,
    // since Sales/XOONX hold those modules and could otherwise cross-fetch with a
    // leaked id. Asset ids are unguessable cuids; other photos (pricing/CS/avatars,
    // which aren't EGV/XOONX-scoped, and logistics-domain photos whose modules
    // Sales/XOONX lack) stay logged-in-only.
    const [expenseAtt, empPhoto, eventPhoto, chatAtt, inqAtt, productPhoto, requestPhoto] = await Promise.all([
      prisma.expenseAttachment.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.employeePhoto.findFirst({ where: { assetId: id }, select: { employeeId: true } }),
      prisma.employeeEventPhoto.findFirst({ where: { assetId: id }, select: { event: { select: { employeeId: true } } } }),
      prisma.chatAttachment.findFirst({ where: { assetId: id }, select: { message: { select: { conversation: { select: { userAId: true, userBId: true } } } } } }),
      prisma.inquiryAttachment.findFirst({ where: { assetId: id }, select: { message: { select: { inquiry: { select: { initiatorId: true, recipientUserId: true, initiatorTeamId: true, recipientTeamId: true } } } } } }),
      prisma.productPhoto.findFirst({ where: { assetId: id }, select: { product: { select: { scope: true } } } }),
      prisma.requestPhoto.findFirst({ where: { assetId: id }, select: { request: { select: { scope: true } } } }),
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

    // Product / request photos: only viewers whose scope covers the owning
    // record — the same gate as the product/request detail pages (golden rule).
    if (productPhoto && !productScopes(access, "VIEW").includes(productPhoto.product.scope as Scope)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (requestPhoto && !requestScopes(access, "VIEW").includes(requestPhoto.request.scope as Scope)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const asset = await readAsset(id);
  if (!asset) return new NextResponse("Not found", { status: 404 });

  // Images and PDFs are rendered by the browser in their own isolated viewer
  // (with Content-Type + nosniff they can't be reinterpreted as HTML, and a PDF's
  // scripts run in the PDF sandbox, not our origin), so they're shown inline. A
  // bare `Content-Security-Policy: sandbox` would BREAK the PDF viewer, so it's
  // only applied to any other (currently impossible) upload type as defence.
  const isImage = asset.mimeType.startsWith("image/");
  const isPdf = asset.mimeType === "application/pdf";

  return new NextResponse(new Uint8Array(asset.buffer), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
      ...(isImage || isPdf ? {} : { "Content-Security-Policy": "sandbox" }),
    },
  });
}
