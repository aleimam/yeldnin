import type { ReactNode } from "react";
import { XoonxGlyph } from "./glyphs/XoonxGlyph";

// Per-module brand glyphs. A key listed here renders a custom SVG mark (drawn in
// `currentColor`, so it tracks the theme); every other module falls back to its
// emoji icon from the module registry.
const GLYPHS: Record<string, (className: string) => ReactNode> = {
  xoonx: (className) => <XoonxGlyph className={className} />,
};

export function ModuleGlyph({
  moduleKey,
  icon,
  className = "h-[1em] w-[1em]",
}: {
  moduleKey: string;
  icon: string;
  className?: string;
}) {
  const glyph = GLYPHS[moduleKey];
  return glyph ? glyph(className) : <>{icon}</>;
}
