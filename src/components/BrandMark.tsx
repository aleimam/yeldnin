// The YELDN brand mark — the same vector used as the app icon (public/icon.svg).
// Shown as the default logo in the header and on the sign-in page whenever no
// custom logo has been uploaded in Appearance settings. Decorative: the app
// name sits next to it, so it's aria-hidden.
export function BrandMark({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="" aria-hidden className={`rounded-md object-contain ${className}`} />;
}
