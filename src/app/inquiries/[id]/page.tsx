import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getInquiry, listDispositions } from "@/lib/inquiry/inquiry-service";
import { InquiryThread } from "@/components/inquiry/InquiryThread";

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireUser();
  const [t, detail, dispositions] = await Promise.all([
    getT(),
    getInquiry(access.user.id, Number(id), access.isAdmin),
    listDispositions(),
  ]);
  if (!detail) notFound();

  return (
    <AppShell access={access} moduleKey="inquiries" pageTitle={t("inq.title")} backHref="/inquiries">
      <InquiryThread detail={detail} meId={access.user.id} dispositions={dispositions} />
    </AppShell>
  );
}
