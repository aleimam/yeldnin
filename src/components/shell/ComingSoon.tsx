import { getT } from "@/i18n/server";

export async function ComingSoon({ moduleKey }: { moduleKey: string }) {
  const t = await getT();
  return (
    <div className="card grid place-items-center p-16 text-center">
      <div className="text-5xl">🚧</div>
      <h2 className="mt-4 text-lg font-semibold text-ink">
        {t(`module.${moduleKey}.name`)}
      </h2>
      <p className="mt-1 text-muted">{t(`module.${moduleKey}.desc`)}</p>
      <p className="mt-4 max-w-sm text-sm text-muted">
        This module isn’t built yet. It’s coming in a later phase.
      </p>
    </div>
  );
}
