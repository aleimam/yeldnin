import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { getDocumentForUser } from "@/lib/documents/documents-service";
import { generateDocumentPdf } from "@/lib/documents/pdf-service";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { readAsset } from "@/lib/assets/assets-service";

// Generate a polished PDF for a DOC-kind document, stamped onto the global
// letterhead within the admin-set margins. Generated on demand (always current),
// gated by the same per-document ACL as the detail page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccess();
  if (!access.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) return new NextResponse("Not found", { status: 404 });

  const result = await getDocumentForUser(docId, {
    isAdmin: access.isAdmin,
    userId: access.user.id,
    userTeamKeys: access.user.teamKeys,
  });
  if (!result) return new NextResponse("Not found", { status: 404 });
  const { doc } = result;
  if (doc.kind !== "DOC") {
    return new NextResponse("Only document-type (rich-text) documents can be generated as PDF.", { status: 400 });
  }

  const settings = await getPlatformSettings();
  let letterhead: Buffer | null = null;
  if (settings.docLetterheadAssetId) {
    const asset = await readAsset(settings.docLetterheadAssetId);
    if (asset && asset.mimeType === "application/pdf") letterhead = asset.buffer;
  }

  const bytes = await generateDocumentPdf({
    title: doc.title,
    contentHtml: doc.contentHtml,
    letterhead,
    margins: {
      top: settings.docMarginTopMm,
      bottom: settings.docMarginBottomMm,
      left: settings.docMarginLeftMm,
      right: settings.docMarginRightMm,
    },
    loadAsset: readAsset, // embed any inline images (same-origin /api/asset only)
  });

  const filename = `${doc.uid ?? `document-${doc.id}`}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
