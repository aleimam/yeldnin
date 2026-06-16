"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { MODULES } from "@/lib/modules";
import { MODULE_SECTIONS, SETTINGS_GROUPS } from "@/lib/module-sections";

/** Sets the document title to "Section · Module · App" based on the route. */
export function TitleSetter({ appName }: { appName: string }) {
  const t = useT();
  const path = usePathname();

  useEffect(() => {
    const matched = MODULES.find((m) => path === m.route || path.startsWith(m.route + "/"));
    // A folded module (purchasing) shows under its parent's name + sidebar (logistics).
    const mod = matched?.foldedInto ? MODULES.find((m) => m.key === matched.foldedInto) ?? matched : matched;
    const moduleName = mod ? t(`module.${mod.key}.name`) : "";

    let sectionName = "";
    if (mod) {
      const items =
        mod.key === "settings"
          ? SETTINGS_GROUPS.flatMap((g) => g.items)
          : MODULE_SECTIONS[mod.key] ?? [];
      const best = items
        .filter((s) => path === s.href || path.startsWith(s.href + "/"))
        .sort((a, b) => b.href.length - a.href.length)[0];
      if (best) sectionName = t(best.labelKey);
    }

    document.title = [sectionName, moduleName, appName].filter(Boolean).join(" · ");
  }, [path, t, appName]);

  return null;
}
