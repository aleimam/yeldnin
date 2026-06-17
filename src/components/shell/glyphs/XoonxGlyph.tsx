/**
 * XOONX brand mark — the shopping-bag-handle arc over a broken "X".
 *
 * Recreated as an inline SVG from the brand logo so it scales crisply and uses
 * `currentColor` (tracks the theme: dark on light, light on dark). To use the
 * exact official vector instead, replace the paths below with its contents
 * (keep `fill`/`stroke` as `currentColor` so theming still works).
 */
export function XoonxGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" role="img" aria-label="XOONX">
      <path d="M176 196 A 80 80 0 0 1 336 196" stroke="currentColor" strokeWidth="34" strokeLinecap="round" />
      <path d="M180 214 L332 388" stroke="currentColor" strokeWidth="58" strokeLinecap="round" />
      <path d="M286 206 L388 206 L388 314 Z" fill="currentColor" />
      <path d="M124 286 L124 394 L226 394 Z" fill="currentColor" />
    </svg>
  );
}
