import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readAsset } from "@/lib/assets/assets-service";
import { getAccess } from "@/lib/auth/access";
import { canManageEmployee, getEmployeeByUserId } from "@/lib/hr/hr-service";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { productScopes, type Scope } from "@/lib/products/products-logic";
import { requestScopes } from "@/lib/requests/request-logic";
import { issueVisibility, issueVisible } from "@/lib/issues/issues-logic";

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

    // Per-object gates: an asset is served only if the caller could open the
    // record that OWNS it.
    //
    // ⚠️ This route previously gated seven owner types and let every other asset
    // fall through to any signed-in user, on the reasoning that ids are
    // unguessable cuids and that Sales/XOONX lack the logistics modules. Both
    // halves were wrong. "Hard to discover" is obscurity, not access control —
    // the route never checked the module at all, so a leaked, reused or logged
    // id was enough. And Issues is a SHARED module with per-scope visibility, so
    // a XOONX operator could fetch a VEEEY issue's evidence photo. Every owner
    // that carries a scope or a module gate is now resolved and checked.
    //
    // Denials return 404, identical to a missing asset: a 403 would confirm that
    // the id exists, which is the same enumeration oracle the golden rule bans.
    const [
      expenseAtt, empPhoto, eventPhoto, chatAtt, inqAtt, productPhoto, requestPhoto,
      issuePhoto, travelerPhoto, tripMarkPhoto, hubPhoto, patchPhoto, transferPhoto,
      pricingPhoto, csPhoto,
    ] = await Promise.all([
      prisma.expenseAttachment.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.employeePhoto.findFirst({ where: { assetId: id }, select: { employeeId: true } }),
      prisma.employeeEventPhoto.findFirst({ where: { assetId: id }, select: { event: { select: { employeeId: true } } } }),
      prisma.chatAttachment.findFirst({ where: { assetId: id }, select: { message: { select: { conversation: { select: { userAId: true, userBId: true } } } } } }),
      prisma.inquiryAttachment.findFirst({ where: { assetId: id }, select: { message: { select: { inquiry: { select: { initiatorId: true, recipientUserId: true, initiatorTeamId: true, recipientTeamId: true } } } } } }),
      prisma.productPhoto.findFirst({ where: { assetId: id }, select: { product: { select: { scope: true } } } }),
      prisma.requestPhoto.findFirst({ where: { assetId: id }, select: { request: { select: { scope: true } } } }),
      prisma.issuePhoto.findFirst({ where: { assetId: id }, select: { issue: { select: { scope: true } } } }),
      prisma.travelerPhoto.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.tripMarkPhoto.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.hubPhoto.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.patchPhoto.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.transferPhoto.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.pricingPhoto.findFirst({ where: { assetId: id }, select: { id: true } }),
      prisma.csEvaluationPhoto.findFirst({ where: { assetId: id }, select: { id: true } }),
    ]);
    const deny = () => new NextResponse("Not found", { status: 404 });

    if (expenseAtt && !access.canModule("expenses", "VIEW")) return deny();

    // Issue evidence carries the VEEEY/XOONX scope and Issues is shared between
    // the lines, so use the same visibility the issue list/detail enforce.
    if (issuePhoto && !issueVisible(issueVisibility(access), issuePhoto.issue.scope)) return deny();

    // Logistics-domain photos: the owning module, plus the hard Trip/Traveler bar
    // that Sales is subject to.
    const logistics = access.canModule("logistics", "VIEW");
    const operations = access.canModule("operations", "VIEW");
    if (travelerPhoto && (!logistics || access.hidesTripTraveler)) return deny();
    if (tripMarkPhoto && ((!logistics && !operations) || access.hidesTripTraveler)) return deny();
    if (hubPhoto && !logistics) return deny();
    if (patchPhoto && !logistics && !access.canModule("purchasing", "VIEW")) return deny();
    if (transferPhoto && !logistics) return deny();

    if (pricingPhoto && !access.canModule("pricing", "VIEW")) return deny();
    if (csPhoto && !access.canModule("cs_quality", "VIEW")) return deny();
    const hrEmployeeId = empPhoto?.employeeId ?? eventPhoto?.event.employeeId ?? null;
    if (hrEmployeeId != null) {
      const own = (await getEmployeeByUserId(access.user.id))?.id === hrEmployeeId;
      const allowed = own || access.can("human_resources", "operate") || (await canManageEmployee(access, hrEmployeeId));
      if (!allowed) return deny();
    }

    // Chat photos: only the two participants of the conversation.
    if (chatAtt) {
      const c = chatAtt.message.conversation;
      if (c.userAId !== access.user.id && c.userBId !== access.user.id) {
        return deny();
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
      if (!ok) return deny();
    }

    // Product / request photos: only viewers whose scope covers the owning
    // record — the same gate as the product/request detail pages (golden rule).
    if (productPhoto && !productScopes(access, "VIEW").includes(productPhoto.product.scope as Scope)) {
      return deny();
    }
    if (requestPhoto && !requestScopes(access, "VIEW").includes(requestPhoto.request.scope as Scope)) {
      return deny();
    }

    // KNOWN GAP: an asset matching NO owner above is still served to any signed-in
    // user. A blanket default-deny is the stronger rule, but rich-text images
    // embedded in Documents are uploaded straight to /api/upload and referenced
    // inline in HTML (see RichTextEditor) — they have no owning row, so denying
    // ownerless assets would break every document image. Closing this properly
    // means giving editor uploads an owner record; until then the exposure is
    // limited to unscoped, non-module content (avatars, inline doc images).
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
