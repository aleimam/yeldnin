import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { ComingSoon } from "@/components/shell/ComingSoon";

const KEY = "issues";

export default async function Page() {
  const a = await requireModule(KEY, "VIEW");
  return (
    <AppShell access={a} moduleKey={KEY}>
      <ComingSoon moduleKey={KEY} />
    </AppShell>
  );
}
