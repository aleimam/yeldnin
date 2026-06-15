"use client";
import { useSidebar } from "./SidebarContext";

/** Hamburger that opens the mobile sidebar drawer. Hidden on desktop. */
export function MobileMenuButton() {
  const { openDrawer } = useSidebar();
  return (
    <button
      type="button"
      onClick={openDrawer}
      className="text-muted hover:text-ink md:hidden"
      aria-label="Open menu"
    >
      ☰
    </button>
  );
}
