"use server";
import { requireUser } from "@/lib/auth/access";
import { globalSearch, type SearchGroup } from "./search-service";

/** Header type-ahead: a few hits per type, permission/scope-filtered. */
export async function searchAction(q: string): Promise<SearchGroup[]> {
  const access = await requireUser();
  return globalSearch(access, q, 6);
}
