import { existsSync } from "node:fs";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Service-role client for test setup only (never imported by the app). */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("e2e needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const e2eEmail = (tag: string) => `e2e+${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/**
 * Signs in through the real callback route: the service role issues a magic-link token hash
 * (what the email template would carry) and the browser opens /auth/callback with it.
 */
export async function signIn(page: Page, email: string, next = "/today") {
  const admin = adminClient();
  // Create the account first (as the first magic link would), then issue a sign-in link for it.
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(`createUser failed: ${created.error.message}`);
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`);
  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "email", next });
  await page.goto(`/auth/callback?${params}`);
  return data.user.id;
}

/** Grants the owner role directly in the database, the way `pnpm admin:grant` bootstraps one. */
export async function grantOwner(email: string) {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("select private.bootstrap_owner($1)", [email]);
  } finally {
    await client.end();
  }
}

/** Removes test users so staging does not fill up. Profiles and roles cascade. */
export async function deleteUser(id: string) {
  await adminClient().auth.admin.deleteUser(id);
}
