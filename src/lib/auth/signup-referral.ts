import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const INVITE_COOKIE = "fundback_google_invite";
export const RETRY_COOKIE = "fundback_signup_invite";
export const INVITE_SECONDS = 3600;
export const RETRY_SECONDS = 7 * 86400;

const intentSchema = z.object({
  referrer: z.uuid(),
  started: z.number().int().positive(),
  recipient: z.uuid().nullable(),
});
type Intent = z.infer<typeof intentSchema>;

function signature(body: string) {
  return createHmac("sha256", env().IP_HASH_SALT)
    .update("signup-invite/v1:" + body)
    .digest();
}
export function sealInvite(intent: Intent) {
  const body = Buffer.from(JSON.stringify(intent)).toString("base64url");
  return body + "." + signature(body).toString("base64url");
}
export function readInvite(value: string | undefined, now = Date.now()): Intent | null {
  if (!value || value.length > 600) return null;
  const [body, tag, extra] = value.split(".");
  if (!body || !tag || extra !== undefined) return null;
  const supplied = Buffer.from(tag, "base64url");
  const expected = signature(body);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = intentSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString()));
    if (!parsed.success) return null;
    const age = now - parsed.data.started;
    const ttl = parsed.data.recipient ? RETRY_SECONDS : INVITE_SECONDS;
    return age >= 0 && age <= ttl * 1000 ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function findReferrer(code: string) {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  if (error) throw new Error("referral_lookup_failed");
  return data?.id ?? null;
}

export function bindGoogleInvite(
  value: string | undefined,
  user: { id: string; created_at: string; app_metadata: { provider?: string } },
) {
  const intent = readInvite(value);
  if (
    !intent ||
    intent.recipient ||
    user.app_metadata.provider !== "google" ||
    !(Date.parse(user.created_at) >= intent.started) ||
    intent.referrer === user.id
  )
    return null;
  return { ...intent, recipient: user.id };
}

export async function applySignupInvite(intent: Intent, userId: string) {
  if (intent.recipient !== userId || intent.referrer === userId) return;
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ referred_by: intent.referrer })
    .eq("id", userId)
    .is("referred_by", null)
    .is("onboarded_at", null)
    .gte("created_at", new Date(intent.started).toISOString());
  // The inviting account could have been deleted while the trader was at Google.
  if (error && error.code !== "23503") throw new Error("referral_write_failed");
}
