import Link from "next/link";
import { TopBar } from "./TopBar";
import type { SessionUser } from "@/lib/auth/access";

/** Standard authenticated page chrome: top bar + a titled container. */
export function AppShell({
  user,
  title,
  backHref,
  actions,
  children,
}: {
  user: SessionUser;
  title?: string;
  backHref?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {(title || actions || backHref) && (
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {backHref && (
                <Link href={backHref} className="text-muted hover:text-ink" aria-label="Back">
                  ←
                </Link>
              )}
              {title && <h1 className="text-xl font-bold text-ink">{title}</h1>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
    </>
  );
}
