import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Service-role client for test setup only (never imported by the app). */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("e2e needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const e2eEmail = (tag: string) =>
  `e2e+${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/**
 * Signs in through the exact fallback shape shown in Supabase emails: the service role issues
 * a magic-link token hash, the browser opens it at `/`, and the proxy forwards it to the real
 * callback route for verification.
 */
export async function signIn(page: Page, email: string, next = "/today") {
  const admin = adminClient();
  // Create the account first (as the first magic link would), then issue a sign-in link for it.
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(`createUser failed: ${created.error.message}`);
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token)
    throw new Error(`generateLink failed: ${error?.message}`);
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "email",
    next,
  });
  await page.goto(`/?${params}`);
  return data.user.id;
}

/** Grants the owner role directly in the database, the way `pnpm admin:grant` bootstraps one. */
export async function grantOwner(email: string) {
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
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

export async function enrollMfa(page: Page) {
  // Complete real TOTP enrolment for this disposable staging account.
  const key = await page.locator("details code").textContent();
  if (!key) throw new Error("Missing enrolment key");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...key.replaceAll("=", "").toUpperCase()]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", bytes).update(counter).digest();
  const offset = digest[19]! & 15;
  const otp = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
  await page.getByLabel("6-digit code").fill(otp);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
}

/**
 * Ends the hold period for one confirmed commission (test only). The app can never do this:
 * commissions are written only by database functions. Moving `release_at` for a single test
 * commission lets the real release job run without changing the global hold setting.
 */
export async function endHold(claimId: string) {
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query(
      "update public.commissions set release_at = now() - interval '1 second' where claim_id = $1 and status = 'confirmed'",
      [claimId],
    );
    if (result.rowCount !== 1) throw new Error("endHold: no confirmed commission for claim");
  } finally {
    await client.end();
  }
}
