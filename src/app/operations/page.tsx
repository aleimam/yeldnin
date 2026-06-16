import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";

export default async function OperationsPage() {
  await requireModule("operations", "VIEW");
  redirect("/shipments");
}
