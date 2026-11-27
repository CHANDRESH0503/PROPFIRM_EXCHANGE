"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { env } from "@/lib/env";
import { hashIp, waitlistToken, sha256Hex } from "@/lib/crypto";
import { isEnabled } from "@/lib/flags";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { verifyTurnstile } from "@/lib/http/turnstile";
import { log } from "@/lib/log";
import { drainEmailOutbox } from "@/lib/notifications/outbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";
import { waitlistJoinSchema } from "@/lib/validation/schemas";

export type WaitlistState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | {
      status: "error";
      code: "invalid_email" | "closed" | "rate_limited" | "captcha" | "unavailable";
    };

/**
 * Join the waitlist. The response is the same whether the email is new or already listed,
 * so the form cannot be used to discover who has signed up.
 */
export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = waitlistJoinSchema.safeParse({
    email: formData.get("email"),
    ref: formData.get("ref") || undefined,
    source: formData.get("source") || undefined,
    turnstileToken: formData.get("cf-turnstile-response") || undefined,
  });
  if (!parsed.success) return { status: "error", code: "invalid_email" };
  const { email, ref, source, turnstileToken } = parsed.data;

  if (!(await isEnabled("waitlist_open"))) return { status: "error", code: "closed" };

  const meta = await requestMeta();
  const { IP_HASH_SALT } = env();
  const ipHash = meta.ip ? hashIp(meta.ip, IP_HASH_SALT) : null;

  const [ipOk, emailOk] = await Promise.all([
    rateLimit("waitlistJoinIp", ipHash ?? "unknown"),
    rateLimit("waitlistJoinEmail", sha256Hex(email)),
  ]);
  if (!ipOk || !emailOk) return { status: "error", code: "rate_limited" };

  const captcha = await verifyTurnstile(turnstileToken, meta.ip, "waitlist");
  if (captcha !== "ok")
    return { status: "error", code: captcha === "failed" ? "captcha" : "unavailable" };

  const nonce = randomUUID();
  const token = waitlistToken(nonce, IP_HASH_SALT);
  const { data, error } = await createAdminClient().rpc("waitlist_enqueue", {
    p_nonce: nonce,
    p_email: email,
    p_referral_code: nullableArg(ref),
    p_token_hash: sha256Hex(token),
    p_ip_hash: nullableArg(ipHash),
    p_country: nullableArg(meta.ipCountry),
    p_source: nullableArg(source),
  });
  if (error || !data?.[0]) {
    log("error", "waitlist.join_failed", { requestId: meta.requestId, code: error?.code });
    return { status: "error", code: "unavailable" };
  }
  const signup = data[0];
  log("info", "waitlist.joined", {
    requestId: meta.requestId,
    signupId: signup.signup_id,
    isNew: signup.is_new,
  });

  // Best-effort fast delivery. The host timer picks up the durable intent after a crash.
  after(async () => {
    await drainEmailOutbox(nonce);
  });

  return { status: "sent", email };
}
