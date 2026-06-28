import Link from "next/link";

/** Tab bar for the Requests section: Requests · Requested products · Request Pool. */
export function RequestsTabs({ active, m, t }: { active: "list" | "products" | "pool"; m: string; t: (k: string) => string }) {
  const q = m ? `?m=${m}` : "";
  const cls = (on: boolean) =>
    `-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${on ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`;
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      <Link href={`/requests${q}`} className={cls(active === "list")}>{t("requests.title")}</Link>
      <Link href={`/requests/products${q}`} className={cls(active === "products")}>{t("requests.products")}</Link>
      <Link href={`/requests/pool${q}`} className={cls(active === "pool")}>{t("requests.pool")}</Link>
    </div>
  );
}
