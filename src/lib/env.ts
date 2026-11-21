import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once on first use.
 * Optional integrations are optional here: the code that needs them checks and
 * degrades (for example, email falls back to the dev log transport outside production).
 */
const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  IP_HASH_SALT: z.string().min(16),
  TURNSTILE_SECRET_KEY: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  CRON_SECRET: optional,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${fields}. See .env.example.`);
  }
  if (parsed.data.APP_ENV === "production") {
    const missing = (["TURNSTILE_SECRET_KEY", "RESEND_API_KEY", "EMAIL_FROM", "CRON_SECRET"] as const).filter(
      (k) => !parsed.data[k],
    );
    if (missing.length) throw new Error(`Missing production environment: ${missing.join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}
