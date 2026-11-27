import type { Enums } from "@/lib/supabase/database.types";

export type AssetClass = Enums<"asset_class">;

export interface GeoRule {
  country_code: string;
  asset_class: AssetClass;
  action: "block";
  reason: string;
}

export interface GeoContext {
  /** Country the user declared at onboarding. */
  profileCountry: string | null;
  /** Country Cloudflare sees the request coming from. */
  ipCountry: string | null;
}

export type GeoDecision =
  | { allowed: true }
  | { allowed: false; country: string; assetClasses: AssetClass[]; reasons: string[] };

/**
 * Decides whether an offer covering `assetClasses` may be shown or linked.
 * The stricter of the declared and observed countries wins: an offer is blocked if either
 * country blocks any of its asset classes (CLAUDE.md §2.10). With no country known at all,
 * nothing is blocked here; callers that need a country (outbound links) require onboarding.
 */
export function evaluateGeo(
  rules: readonly GeoRule[],
  ctx: GeoContext,
  assetClasses: readonly AssetClass[],
): GeoDecision {
  const countries = [
    ...new Set([ctx.profileCountry, ctx.ipCountry].filter((c): c is string => Boolean(c))),
  ];
  for (const country of countries) {
    const hits = rules.filter(
      (r) =>
        r.country_code === country && r.action === "block" && assetClasses.includes(r.asset_class),
    );
    if (hits.length > 0) {
      return {
        allowed: false,
        country,
        assetClasses: [...new Set(hits.map((h) => h.asset_class))],
        reasons: hits.map((h) => h.reason),
      };
    }
  }
  return { allowed: true };
}
