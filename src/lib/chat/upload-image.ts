"use client";
import { compressImage } from "./compress";

/** Compress an image client-side (WebP) and upload via the auth-only chat/inquiry
 *  endpoint. Returns the saved asset id + url, or null on failure. Shared by the
 *  chat composer and the inquiry composer. */
export async function uploadImage(
  file: File,
): Promise<{ assetId: string; url: string; width: number; height: number } | null> {
  const { blob, width, height } = await compressImage(file);
  const fd = new FormData();
  fd.append("file", new File([blob], "photo.webp", { type: blob.type || "image/webp" }));
  const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const j = (await res.json()) as { id: string; url: string };
  return { assetId: j.id, url: j.url, width, height };
}
