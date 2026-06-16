import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";

export default async function PurchasingPage() {
  await requireModule("purchasing", "VIEW");
  redirect("/purchasing/pool");
}
