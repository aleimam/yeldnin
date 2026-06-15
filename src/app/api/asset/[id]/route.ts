import { NextResponse } from "next/server";
import { readAsset } from "@/lib/assets/assets-service";
import { getAccess } from "@/lib/auth/access";
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
  }

  const asset = await readAsset(id);
  if (!asset) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(asset.buffer), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
