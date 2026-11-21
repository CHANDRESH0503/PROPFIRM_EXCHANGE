/**
 * Public configuration. NEXT_PUBLIC_* values are inlined at build time, so each
 * environment (staging, production) gets its own image build (docs/SYSTEM_DESIGN.md §7).
 * Reference each variable literally so the bundler can inline it.
 */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
} as const;
