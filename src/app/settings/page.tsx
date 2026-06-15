import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { ComingSoon } from "@/components/shell/ComingSoon";

const KEY = "settings";

export default async function Page() {
  const a = await requireModule(KEY, "VIEW");
  return (
    <AppShell user={a.user} backHref="/">
      <ComingSoon moduleKey={KEY} />
    </AppShell>
  );
}
