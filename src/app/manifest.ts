import type { MetadataRoute } from "next";
import { getPlatformSettings } from "@/lib/settings/settings-service";

// PWA manifest. Read the admin-set app name so the install title matches the
// running brand; icon + theme color are fixed (brand blue). Next auto-injects
// the <link rel="manifest"> because this file exists.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getPlatformSettings();
  const name = s.appName || "YeldnIN";
  return {
    name,
    short_name: name,
    description: "Yeldn internal operations platform.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
