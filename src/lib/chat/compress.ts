// Client-side image compression. Re-encodes to WebP at a capped dimension so chat
// photos upload small — and so we avoid native image libraries (sharp etc.) that
// don't build on this arm64-Windows dev box. Browser-only (uses canvas).

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Decode via <img> as a fallback when createImageBitmap can't (some browsers/
 *  formats, e.g. HEIC on Safari). Resolves null if the format is undecodable. */
function decodeViaImg(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** Downscale to fit `maxDim` on the longest edge and re-encode as WebP. Non-images
 *  pass through unchanged. Tries createImageBitmap then an <img> decode; falls back
 *  to the original blob only if both fail or the canvas/encode is unavailable. */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.8,
): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) return { blob: file, width: 0, height: 0 };

  // Decode: prefer createImageBitmap (fast, off-thread), fall back to <img>.
  let source: ImageBitmap | HTMLImageElement | null = null;
  let srcW = 0;
  let srcH = 0;
  try {
    const bmp = await createImageBitmap(file);
    source = bmp;
    srcW = bmp.width;
    srcH = bmp.height;
  } catch {
    const img = await decodeViaImg(file);
    if (img) {
      source = img;
      srcW = img.naturalWidth;
      srcH = img.naturalHeight;
    }
  }
  if (!source || !srcW || !srcH) return { blob: file, width: 0, height: 0 };

  let width = srcW;
  let height = srcH;
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
    if (source instanceof ImageBitmap) source.close();
    return { blob: file, width, height };
  }
  ctx.drawImage(source, 0, 0, width, height);
  if (source instanceof ImageBitmap) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality),
  );
  return blob ? { blob, width, height } : { blob: file, width, height };
}
