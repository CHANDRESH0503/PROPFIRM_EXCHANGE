import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const FLAGS_TAG = "feature_flags";

export type FlagKey = "signups_open" | "waitlist_open" | "spins" | "draws" | "maintenance_mode";

export interface Flag {
  key: string;
  enabled: boolean;
  excluded_countries: string[];
}

/** Feature flags from the database, cached and invalidated by tag on admin edits. */
export async function getFlags(): Promise<Record<string, Flag>> {
  "use cache";
  cacheTag(FLAGS_TAG);
  cacheLife("minutes");
  const { data, error } = await createAdminClient()
    .from("feature_flags")
    .select("key, enabled, excluded_countries");
  if (error) throw new Error(`feature_flags unavailable: ${error.code}`);
  return Object.fromEntries(data.map((f) => [f.key, f]));
}

/**
 * A missing flag is off. A flag is also off for countries on its exclusion list, which is how
 * chance-based features respect regional rules (CLAUDE.md §2.9).
 */
export async function isEnabled(key: FlagKey, country?: string | null): Promise<boolean> {
  const flag = (await getFlags())[key];
  if (!flag?.enabled) return false;
  return !(country && flag.excluded_countries.includes(country));
}
