import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "application/pdf": "pdf",
};
// NOTE: SVG is intentionally excluded — inline SVG can carry executable script
// (stored-XSS) when served from our origin.

export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024; // 32 MB
export const ALLOWED_MIME = new Set(Object.keys(EXT));

export function assetUrl(id: string | null | undefined): string | null {
  return id ? `/api/asset/${id}` : null;
}

/** Persist an uploaded File to disk + DB. Returns the Asset id. */
export async function saveUpload(file: File): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) throw new Error("Unsupported file type.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large (max 32 MB).");

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const asset = await prisma.asset.create({
    data: { filename: "pending", mimeType: file.type, size: buf.length },
  });
  const filename = `${asset.id}.${EXT[file.type] ?? "bin"}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buf);
  await prisma.asset.update({ where: { id: asset.id }, data: { filename } });
  return asset.id;
}

/** Delete an asset's DB row and its file on disk (best-effort). */
export async function deleteAsset(id: string): Promise<void> {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return;
  if (asset.filename && asset.filename !== "pending") {
    try {
      await fs.unlink(path.join(UPLOAD_DIR, asset.filename));
    } catch {
      // file already gone — ignore
    }
  }
  await prisma.asset.delete({ where: { id } }).catch(() => {});
}

/** Asset metadata (mime + size) without reading the file off disk. */
export async function getAssetMeta(id: string): Promise<{ mimeType: string; size: number } | null> {
  const asset = await prisma.asset.findUnique({ where: { id }, select: { mimeType: true, size: true } });
  return asset ?? null;
}

export async function readAsset(
  id: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.filename === "pending") return null;
  try {
    const buffer = await fs.readFile(path.join(UPLOAD_DIR, asset.filename));
    return { buffer, mimeType: asset.mimeType };
  } catch {
    return null;
  }
}
