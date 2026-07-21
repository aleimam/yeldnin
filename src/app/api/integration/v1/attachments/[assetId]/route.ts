import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readAsset } from "@/lib/assets/assets-service";
import { integrationEnabled } from "@/lib/integration/config";
import { verifyInbound } from "@/lib/integration/integration-service";

/**
 * Veeey → YeldnIN `GET /attachments/{assetId}` (contract v2 §4.8).
 *
 * Veeey's Sales review a shipment's entered expiry dates against the photos Ops
 * attached, but those photos live here and YeldnIN asset ids are not publicly
 * fetchable — so `shipment.received` ships asset IDS and this is where the bytes
 * come from.
 *
 * **Only ShipmentPhoto assets are reachable.** Every other asset id 404s, so
 * this endpoint can never become a general read hole into HR photos, expense
 * receipts or chat attachments. A denial is indistinguishable from a missing
 * asset — a 403 would confirm the id exists, which is the enumeration oracle the
 * asset route's golden rule bans.
 *
 * Node runtime — Prisma + the node:sqlite adapter can't load on edge.
 */
export const runtime = "nodejs";

const err = (code: string, status: number) => Response.json({ error: { code, message: code } }, { status });

export async function GET(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  if (!(await integrationEnabled())) return new NextResponse("not found", { status: 404 });

  const url = new URL(req.url);
  // GET has no body; the signature covers method + path, which is what makes a
  // captured URL useless on its own.
  const v = await verifyInbound({
    method: "GET",
    path: url.pathname,
    rawBody: "",
    headers: {
      clientId: req.headers.get("x-client-id"),
      timestamp: req.headers.get("x-timestamp"),
      nonce: req.headers.get("x-nonce"),
      signature: req.headers.get("x-signature"),
    },
    nowMs: Date.now(),
  });
  if (!v.ok) return err(v.code, 401);

  const { assetId } = await params;
  const owned = await prisma.shipmentPhoto.findFirst({ where: { assetId }, select: { id: true } });
  if (!owned) return new NextResponse("not found", { status: 404 });

  const asset = await readAsset(assetId);
  if (!asset) return new NextResponse("not found", { status: 404 });

  return new NextResponse(new Uint8Array(asset.buffer), {
    headers: {
      "Content-Type": asset.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
