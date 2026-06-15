"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { SIDEBAR_COOKIE } from "@/lib/module-sections";

interface SidebarState {
  collapsed: boolean; // desktop rail collapsed (icons only)
  toggleCollapsed: () => void;
  drawerOpen: boolean; // mobile off-canvas drawer
  openDrawer: () => void;
  closeDrawer: () => void;
}

const Ctx = createContext<SidebarState | null>(null);

export function SidebarProvider({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=${60 * 60 * 24 * 365}`;
      return next;
    });
  }, []);

  return (
    <Ctx.Provider
      value={{
        collapsed,
        toggleCollapsed,
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar(): SidebarState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
