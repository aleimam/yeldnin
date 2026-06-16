import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getCalculation } from "@/lib/pricing/pricing-service";
import { assetUrl } from "@/lib/assets/assets-service";

export default async function CalculationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireModule("pricing", "VIEW");
  const { id } = await params;
  const [calc, t] = await Promise.all([getCalculation(Number(id)), getT()]);
  const isAdmin = access.canModule("pricing", "MANAGE") || access.isAdmin;
  // Non-admins never see soft-deleted records.
  if (!calc || (calc.deletedAt && !isAdmin)) notFound();

  const input = JSON.parse(calc.inputJson) as Record<string, unknown>;
  const yesNo = (v: unknown) => (v ? t("common.yes") : t("common.no"));
  const val = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : String(v));

  const rows: { label: string; value: ReactNode }[] = [
    { label: t("pricer.f.importedFrom"), value: val(input.importedFrom) },
    { label: t("pricer.f.purchasePrice"), value: val(input.purchasePrice) },
  ];
  if (calc.section === "SUPPLEMENT") {
    rows.push(
      { label: t("pricer.f.count"), value: val(input.count) },
      { label: t("pricer.f.dailyDose"), value: val(input.dailyDose) },
      { label: t("pricer.f.weight"), value: val(input.weight) },
      { label: t("pricer.f.shape"), value: val(input.shape) },
      { label: t("pricer.f.packaging"), value: val(input.packaging) },
      { label: t("pricer.f.size"), value: val(input.size) },
      { label: t("pricer.f.maleSupport"), value: yesNo(input.maleSupport) },
    );
  } else {
    rows.push(
      { label: t("pricer.f.length"), value: val(input.lengthCm) },
      { label: t("pricer.f.width"), value: val(input.widthCm) },
      { label: t("pricer.f.height"), value: val(input.heightCm) },
      { label: t("pricer.f.weightKg"), value: val(input.weightKg) },
      { label: t("pricer.f.maleSupport"), value: yesNo(input.maleSupport) },
    );
  }
  if (calc.supplierName) rows.push({ label: t("pricer.f.supplier"), value: calc.supplierName });

  return (
    <AppShell access={access} moduleKey="pricing" pageTitle={t("pricer.details")} backHref="/pricing/history">
      <div className="max-w-2xl space-y-6">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">{calc.productName || "—"}</h2>
              <p className="text-sm text-muted">
                {calc.section === "SUPPLEMENT" ? t("pricer.supplements") : t("pricer.devices")}
                {calc.deletedAt && (
                  <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
                    {t("pricer.hist.deletedBadge")}
                  </span>
                )}
              </p>
            </div>
            <div className="text-end">
              <div className="text-xs text-muted">{t("pricer.detail.price")}</div>
              <div className="text-2xl font-bold text-ink">{calc.price.toLocaleString()} EGP</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="mb-3 font-semibold text-ink">{t("pricer.detail.inputs")}</h3>
          <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 border-b border-line/60 py-1.5">
                <dt className="text-muted">{r.label}</dt>
                <dd className="text-end font-medium text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
          {calc.notes && (
            <div className="mt-4">
              <div className="label">{t("pricer.f.notes")}</div>
              <p className="whitespace-pre-wrap text-sm text-ink">{calc.notes}</p>
            </div>
          )}
        </div>

        {calc.photos.length > 0 && (
          <div className="card p-6">
            <h3 className="mb-3 font-semibold text-ink">{t("pricer.f.photos")}</h3>
            <div className="flex flex-wrap gap-2">
              {calc.photos.map((p) => (
                <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetUrl(p.assetId)!} alt="" className="h-24 w-24 rounded-lg border border-line object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted">
          {calc.user.name} · {new Date(calc.createdAt).toLocaleString()}
        </p>
      </div>
    </AppShell>
  );
}
