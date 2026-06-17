import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";

// XOONX landing → its first section (the shared, scope-filtered Requests page).
export default async function XoonxPage() {
  await requireModule("xoonx", "VIEW");
  redirect("/requests?m=xoonx"); // land in the XOONX shell (its own sidebar + scope)
}
