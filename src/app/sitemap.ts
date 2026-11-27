import type { MetadataRoute } from "next";
import { LEGAL_PAGES, TRUST_PAGES } from "@/config/nav";
import { publicEnv } from "@/lib/public-env";
import { createAnonClient } from "@/lib/supabase/anon";
import { CALCULATORS } from "@/lib/tools/calculators";

/** Public, indexable pages only. Firms and help articles come from the database (published rows). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, publicEnv.siteUrl).toString();
  const db = createAnonClient();
  const [firms, articles] = await Promise.all([
    db
      .from("firms")
      .select("slug,published_at")
      .eq("is_sample", false)
      .not("published_at", "is", null),
    db.from("help_articles").select("slug,updated_at"),
  ]);
  const fixed = [
    "/",
    "/firms",
    "/compare",
    "/deals",
    "/tools",
    "/tools/market-sessions",
    "/economic-calendar",
    "/journal",
    "/help",
    "/changelog",
    ...CALCULATORS.map((k) => `/tools/${k}`),
    ...TRUST_PAGES.map((s) => `/${s}`),
    ...LEGAL_PAGES.map((s) => `/${s}`),
  ];
  return [
    ...fixed.map((p) => ({
      url: url(p),
      changeFrequency: "weekly" as const,
      priority: p === "/" ? 1 : 0.6,
    })),
    ...(firms.data ?? []).map((f) => ({
      url: url(`/firms/${f.slug}`),
      lastModified: f.published_at ?? undefined,
      priority: 0.8,
    })),
    ...(articles.data ?? []).map((a) => ({
      url: url(`/help/${a.slug}`),
      lastModified: a.updated_at,
      priority: 0.4,
    })),
  ];
}
