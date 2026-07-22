import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { integrationEnabled } from "@/lib/integration/config";
import { verifyInbound } from "@/lib/integration/integration-service";

/**
 * Veeey → YeldnIN `GET /staff` — the staff roster Veeey mirrors into its
 * departments. YeldnIN is the source of truth for who works here and on which
 * team; Veeey maps teams → departments on its side.
 *
 * INACTIVE AND ARCHIVED USERS ARE INCLUDED, flagged `active: false`. Omitting
 * them would be worse than useless: Veeey revokes by absence of entitlement, and
 * a leaver who simply vanished from the payload would look like "no change" and
 * keep their admin access.
 *
 * Returns no password material of any kind.
 *
 * Node runtime — Prisma + the node:sqlite adapter can't load on edge.
 */
export const runtime = "nodejs";

const err = (code: string, status: number) => Response.json({ error: { code, message: code } }, { status });

export async function GET(req: Request) {
  if (!(await integrationEnabled())) return new Response("not found", { status: 404 });

  const url = new URL(req.url);
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

  const users = await prisma.user.findMany({
    select: {
      name: true,
      email: true,
      username: true,
      primaryPhone: true,
      avatarUrl: true,
      active: true,
      archivedAt: true,
      teamMembers: { select: { team: { select: { key: true } } } },
    },
    orderBy: { id: "asc" },
  });

  return Response.json({
    staff: await Promise.all(users.map(async (u) => ({
      email: u.email,
      name: u.name,
      username: u.username,
      phone: u.primaryPhone,
      // Archived is a form of inactive — collapse both so the consumer has one
      // flag to reason about.
      active: u.active && u.archivedAt == null,
      teams: u.teamMembers.map((t) => t.team.key),
      // Owner 2026-07-22: staff carry their YeldnIN avatar into Veeey. Inlined
      // as base64 because the asset route is auth-gated (Veeey can't hotlink).
      avatar: await loadAvatar(u.avatarUrl),
    }))),
  });
}

/** Roster is hourly and small, so a modest inline cap keeps the payload sane. */
const AVATAR_MAX_BYTES = 400 * 1024;

/**
 * Inline a user's avatar as { mime, base64 }, or null when there is none, the
 * file is missing/oversized, or it isn't an image. Never throws — an avatar
 * problem must not break the roster (the sync auto-revokes on absence).
 */
async function loadAvatar(assetId: string | null): Promise<{ mime: string; base64: string } | null> {
  if (!assetId || /^https?:\/\//.test(assetId)) return null;
  try {
    const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { filename: true, mimeType: true, size: true } });
    if (!asset || !asset.mimeType.startsWith("image/") || asset.size > AVATAR_MAX_BYTES) return null;
    const buf = await fs.readFile(path.join(process.cwd(), "uploads", asset.filename));
    return { mime: asset.mimeType, base64: buf.toString("base64") };
  } catch {
    return null;
  }
}
