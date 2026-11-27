import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
export async function currentEconomy() {
  "use cache";
  cacheTag("economy_config");
  cacheLife("minutes");
  const { data, error } = await createAdminClient()
    .from("economy_config")
    .select("*")
    .lte("effective_at", new Date().toISOString())
    .order("effective_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error("economy_config_unavailable");
  return data;
}
