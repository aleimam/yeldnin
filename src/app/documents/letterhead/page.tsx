import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { LetterheadEditor } from "./LetterheadEditor";

export default async function LetterheadPage() {
  const access = await requireUser();
  if (!access.isAdmin) redirect("/documents");
  const [t, s] = await Promise.all([getT(), getPlatformSettings()]);

  return (
    <AppShell access={access} moduleKey="documents" pageTitle={t("docs.letterhead.title")} backHref="/documents">
      <p className="mb-4 max-w-2xl text-sm text-muted">{t("docs.letterhead.intro")}</p>
      <LetterheadEditor
        current={{
          letterheadUrl: assetUrl(s.docLetterheadAssetId),
          hasLetterhead: !!s.docLetterheadAssetId,
          marginTopMm: s.docMarginTopMm,
          marginBottomMm: s.docMarginBottomMm,
          marginLeftMm: s.docMarginLeftMm,
          marginRightMm: s.docMarginRightMm,
        }}
      />
    </AppShell>
  );
}
