"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Toggles the `table-cards` class on every `table[data-cards]` according to
 * whether it actually overflows its horizontal container — wide tables collapse
 * to a card stack, tables that already fit stay as tables. Re-measures on route
 * change, after layout/fonts settle (borderline tables can overflow by only a
 * few px once everything renders), and whenever the viewport *width* changes.
 * Measuring removes the class first (synchronously) so the natural table width
 * is read, then re-applies it — no visible flicker. The width guard avoids a
 * feedback loop (collapsing a table changes page height, not width).
 */
export function AutoCards() {
  const pathname = usePathname();
  useEffect(() => {
    const measure = () => {
      document.querySelectorAll<HTMLTableElement>("table[data-cards]").forEach((table) => {
        const container = table.closest<HTMLElement>(".overflow-x-auto") ?? table.parentElement;
        if (!container) return;
        table.classList.remove("table-cards");
        if (container.scrollWidth > container.clientWidth + 1) table.classList.add("table-cards");
      });
    };
    // Measure now and again as layout/fonts settle — borderline tables can tip
    // over by a few px after first paint.
    measure();
    const raf = requestAnimationFrame(measure);
    const timers = [setTimeout(measure, 120), setTimeout(measure, 500)];
    document.fonts?.ready?.then(measure).catch(() => {});

    let lastWidth = window.innerWidth;
    const onWidthMaybeChanged = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      measure();
    };
    const ro = new ResizeObserver(onWidthMaybeChanged);
    ro.observe(document.documentElement);
    window.addEventListener("resize", onWidthMaybeChanged);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", onWidthMaybeChanged);
    };
  }, [pathname]);
  return null;
}
