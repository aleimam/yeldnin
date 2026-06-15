// Appearance themes. A theme overrides the --brand color; light/dark neutrals
// are handled by the `.dark` class. Static CSS for each lives in globals.css.

export interface ThemeDef {
  key: string;
  name: string; // i18n: theme.<key>
  swatch: string; // CSS color for the picker dot
}

export const THEMES: ThemeDef[] = [
  { key: "default", name: "Blue", swatch: "rgb(37 99 235)" },
  { key: "emerald", name: "Emerald", swatch: "rgb(16 185 129)" },
  { key: "violet", name: "Violet", swatch: "rgb(124 58 237)" },
  { key: "rose", name: "Rose", swatch: "rgb(225 29 72)" },
  { key: "amber", name: "Amber", swatch: "rgb(217 119 6)" },
  { key: "slate", name: "Slate", swatch: "rgb(71 85 105)" },
];

export const DEFAULT_THEME = "default";

export function isThemeKey(k: string | undefined | null): boolean {
  return !!k && THEMES.some((t) => t.key === k);
}

export type ColorMode = "light" | "dark" | "system";
export const COLOR_MODES: ColorMode[] = ["light", "dark", "system"];
export function isColorMode(m: string | undefined | null): m is ColorMode {
  return m === "light" || m === "dark" || m === "system";
}

export const THEME_COOKIE = "yeldnin_theme";
export const MODE_COOKIE = "yeldnin_mode";
