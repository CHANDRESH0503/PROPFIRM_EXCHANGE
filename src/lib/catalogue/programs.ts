import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";
import type { Database } from "@/lib/supabase/database.types";

export type Program = Database["public"]["Functions"]["catalogue_programs"]["Returns"][number];
export type Search = Record<string, string | string[] | undefined>;
const optionalText = z.string().trim().max(100).catch("");
const filters = z.object({
  asset: z
    .enum(["forex", "cfd", "futures", "crypto", "stocks", "options"])
    .optional()
    .catch(undefined),
  size: z.coerce.number().int().positive().max(2147483647).optional().catch(undefined),
  steps: z.coerce.number().int().min(0).max(8).optional().catch(undefined),
  max: z.coerce.number().positive().max(21474836).optional().catch(undefined),
  drawdown: z.enum(["static", "trailing", "end_of_day"]).optional().catch(undefined),
  payout: optionalText,
  platform: optionalText,
  sort: z.enum(["name", "net", "list", "newest", "ends"]).catch("name"),
  page: z.coerce.number().int().positive().max(10000).catch(1),
});
export function parseFilters(search: Search) {
  return filters.parse(
    Object.fromEntries(Object.entries(search).filter(([, v]) => v !== "" && typeof v === "string")),
  );
}
const geoArgs = cache(async () => {
  const [meta, profile, user] = await Promise.all([requestMeta(), getProfile(), getSessionUser()]);
  if (user && !profile) throw new Error("catalogue_profile_unavailable");
  return {
    p_profile_country: nullableArg(profile?.country_code),
    p_ip_country: nullableArg(meta.ipCountry),
  };
});
export async function findPrograms(
  search: Search = {},
  scope: { slug?: string; deals?: boolean; ids?: string[] } = {},
) {
  const f = parseFilters(search);
  let q = createAdminClient().rpc("catalogue_programs", await geoArgs(), { count: "exact" });
  if (scope.slug) q = q.eq("slug", scope.slug);
  if (scope.deals) q = q.not("offer_id", "is", null);
  if (scope.ids) q = q.in("program_id", scope.ids);
  if (f.asset) q = q.contains("asset_classes", [f.asset]);
  if (f.platform) q = q.contains("platforms", [f.platform]);
  if (f.size) q = q.eq("account_size", f.size);
  if (f.steps !== undefined) q = q.eq("steps", f.steps);
  if (f.max) q = q.lte("list_price_cents", Math.round(f.max * 100));
  if (f.drawdown) q = q.eq("drawdown_type", f.drawdown);
  if (f.payout) q = q.eq("payout_frequency", f.payout);
  if (f.sort === "net" || f.sort === "list")
    q = q.order("currency").order(f.sort === "net" ? "net_cents" : "list_price_cents");
  if (f.sort === "newest") q = q.order("created_at", { ascending: false });
  if (scope.deals) q = q.order("ends_at");
  const pageSize = 24;
  const { data, error, count } = await q
    .order("firm_name")
    .order("program_id")
    .range((f.page - 1) * pageSize, f.page * pageSize - 1);
  if (error) throw new Error("catalogue_unavailable:" + error.code);
  return { programs: data ?? [], count: count ?? 0, page: f.page, pageSize };
}
export function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
