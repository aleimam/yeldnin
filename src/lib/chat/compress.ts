// Client-side image compression. Re-encodes to WebP at a capped dimension so chat
// photos upload small — and so we avoid native image libraries (sharp etc.) that
// don't build on this arm64-Windows dev box. Browser-only (uses canvas).

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Downscale to fit `maxDim` on the longest edge and re-encode as WebP. Non-images
 *  pass through unchanged. Falls back to the original blob if the canvas/encode is
 *  unavailable. */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.8,
): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) return { blob: file, width: 0, height: 0 };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, width: 0, height: 0 };
  }

  let { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { blob: file, width, height };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality),
  );
  return blob ? { blob, width, height } : { blob: file, width, height };
}
