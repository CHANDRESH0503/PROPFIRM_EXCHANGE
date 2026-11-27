import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

/** Only production is indexable; staging and local builds ask crawlers to stay out. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/go",
        "/today",
        "/rewards",
        "/accounts",
        "/wallet",
        "/claims",
        "/notifications",
        "/support",
        "/profile",
        "/onboarding",
        "/account",
      ],
    },
    sitemap: new URL("/sitemap.xml", publicEnv.siteUrl).toString(),
  };
}
