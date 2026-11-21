import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestMeta } from "@/lib/http/request";
import { evaluateGeo, type AssetClass, type GeoDecision, type GeoRule } from "./evaluate";

export const GEO_RULES_TAG = "geo_rules";

/** All geo rules, cached on the server and invalidated by tag when admin edits them. */
export async function getGeoRules(): Promise<GeoRule[]> {
  "use cache";
  cacheTag(GEO_RULES_TAG);
  cacheLife("hours");
  const { data, error } = await createAdminClient()
    .from("geo_rules")
    .select("country_code, asset_class, action, reason");
  if (error) throw new Error(`geo_rules unavailable: ${error.code}`);
  return data;
}

/** Server-side geo check for the current request and (optionally) the signed-in user's country. */
export async function checkGeo(assetClasses: readonly AssetClass[], profileCountry: string | null): Promise<GeoDecision> {
  const [rules, meta] = await Promise.all([getGeoRules(), requestMeta()]);
  return evaluateGeo(rules, { profileCountry, ipCountry: meta.ipCountry }, assetClasses);
}
