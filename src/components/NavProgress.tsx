"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin top progress bar shown during client-side navigations. It starts on an
 * internal `<a>`/`<Link>` click and clears when the pathname changes — purely
 * additive (the previous page stays visible underneath, Next's default), so it
 * gives feedback on slow loads without blanking the shell on every nav.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false); // navigation finished
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      try {
        const url = new URL(a.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.search === location.search) return;
      } catch {
        return;
      }
      setActive(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!active) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-brand/20" aria-hidden>
      <div className="h-full w-1/3 animate-[navprogress_1s_ease-in-out_infinite] bg-brand" />
    </div>
  );
}
