import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";

// Sales landing → its first section (the shared, scope-filtered Requests page).
export default async function SalesPage() {
  await requireModule("order_requests", "VIEW");
  redirect("/requests");
}
