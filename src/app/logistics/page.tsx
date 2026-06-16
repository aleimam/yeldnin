import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";

// Merged Logistics landing. Purchasing folds in here, but the permissions stay
// separate — so route to the first section the user can actually reach.
export default async function LogisticsPage() {
  const access = await requireUser();
  if (access.canModule("purchasing", "VIEW")) redirect("/purchasing/pool");
  if (access.canModule("logistics", "VIEW")) redirect("/patches");
  redirect("/");
}
