import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV === "development";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^https:/, "wss:");

/**
 * Full policy, sent report-only first (docs/SYSTEM_DESIGN.md §7, task B4). The directives that
 * cannot break the site (framing, plugins, base URI) are enforced from day one.
 */
const fullPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabase}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs} https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io`.trim(),
  "frame-src https://challenges.cloudflare.com",
  `form-action 'self' ${supabase} https://accounts.google.com`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

// upgrade-insecure-requests only works when enforced (browsers ignore it in report-only), and
// only makes sense when the site itself is served over HTTPS (not a local production build).
const httpsSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const enforcedPolicy = [
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  ...(httpsSite ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: enforcedPolicy },
  { key: "Content-Security-Policy-Report-Only", value: fullPolicy },
  // HSTS only for an HTTPS site: sent from http://localhost, Safari caches it and then
  // refuses plain HTTP on localhost for every project.
  ...(httpsSite ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  deploymentId: process.env.DEPLOYMENT_ID || undefined,
  // Dev server only: let a phone or another machine on the local network load the dev
  // scripts (Next blocks non-localhost origins by default, which shows a blank page).
  allowedDevOrigins: ["172.20.10.*", "192.168.*.*", "10.*.*.*"],
  experimental: {
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: supabase ? [{ protocol: "https", hostname: new URL(supabase).hostname }] : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
