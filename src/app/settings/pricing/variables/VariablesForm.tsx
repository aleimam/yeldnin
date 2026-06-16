"use client";
import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { SHAPES, PACKAGING, SIZES, type PricingConfig } from "@/lib/pricing/pricing-logic";
import { saveVariablesAction, type FormState } from "./actions";

const initial: FormState = {};

function Num({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
      <span className="text-ink">{label}</span>
      <input
        name={name}
        type="number"
        step="any"
        defaultValue={value}
        className="input w-28 text-end"
      />
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function VariablesForm({ config }: { config: PricingConfig }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveVariablesAction, initial);

  return (
    <form action={action} className="card space-y-6 p-6">
      {state.ok && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("pricer.var.saved")}
        </div>
      )}

      <Group title={t("pricer.var.fx")}>
        <Num name="fx" label="FX" value={config.fx} />
        <Num name="maleSupportMultiplier" label={t("pricer.f.maleSupport")} value={config.maleSupportMultiplier} />
      </Group>

      <Group title={`${t("pricer.var.multipliers")} — ${t("pricer.f.importedFrom")}`}>
        <Num name="country.USA" label="USA" value={config.country.USA} />
        <Num name="country.UK" label="UK" value={config.country.UK} />
        <Num name="country.EU" label="EU" value={config.country.EU} />
      </Group>

      <Group title={`${t("pricer.var.multipliers")} — ${t("pricer.f.shape")}`}>
        {SHAPES.map((s) => (
          <Num key={s} name={`shape.${s}`} label={s} value={config.shape[s]} />
        ))}
      </Group>

      <Group title={`${t("pricer.var.multipliers")} — ${t("pricer.f.packaging")}`}>
        {PACKAGING.map((p) => (
          <Num key={p} name={`packaging.${p}`} label={p} value={config.packaging[p]} />
        ))}
      </Group>

      <Group title={`${t("pricer.var.multipliers")} — ${t("pricer.f.size")}`}>
        {SIZES.map((z) => (
          <Num key={z} name={`size.${z}`} label={z} value={config.size[z]} />
        ))}
      </Group>

      <Group title={`${t("pricer.var.constants")} — ${t("pricer.supplements")}`}>
        <Num name="supplement.flatFee" label="Flat fee" value={config.supplement.flatFee} />
        <Num name="supplement.fxFeeCoef" label="FX fee coef" value={config.supplement.fxFeeCoef} />
        <Num name="supplement.innerMultiplier" label="Inner mult" value={config.supplement.innerMultiplier} />
        <Num name="supplement.weightFactor" label="Weight factor" value={config.supplement.weightFactor} />
        <Num name="supplement.dosageStep" label="Dosage step" value={config.supplement.dosageStep} />
        <Num name="supplement.margin" label="Margin" value={config.supplement.margin} />
        <Num name="supplement.roundStep" label="Round step" value={config.supplement.roundStep} />
        <Num name="supplement.injectionFee" label="Injection fee" value={config.supplement.injectionFee} />
        <Num name="supplement.markupFactor" label="Markup (×, round up)" value={config.supplement.markupFactor} />
      </Group>

      <Group title={`${t("pricer.var.constants")} — ${t("pricer.devices")}`}>
        <Num name="device.base" label="Base" value={config.device.base} />
        <Num name="device.inflation" label="Inflation" value={config.device.inflation} />
        <Num name="device.fxFactor" label="FX factor" value={config.device.fxFactor} />
        <Num name="device.perKg" label="Per kg" value={config.device.perKg} />
        <Num name="device.handling" label="Handling" value={config.device.handling} />
        <Num name="device.margin" label="Margin" value={config.device.margin} />
        <Num name="device.volumetricDivisor" label="Volumetric div" value={config.device.volumetricDivisor} />
        <Num name="device.maleSupportMultiplier" label={t("pricer.f.maleSupport")} value={config.device.maleSupportMultiplier} />
        <Num name="device.roundStep" label="Round step" value={config.device.roundStep} />
      </Group>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "…" : t("common.save")}
      </button>
    </form>
  );
}
