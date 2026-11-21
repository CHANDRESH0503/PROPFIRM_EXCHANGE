"use server";

import { after } from "next/server";
import { env } from "@/lib/env";
import { hashIp, newToken, sha256Hex } from "@/lib/crypto";
import { isEnabled } from "@/lib/flags";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { verifyTurnstile } from "@/lib/http/turnstile";
import { log } from "@/lib/log";
import { sendEmail } from "@/lib/notifications/email";
import { waitlistConfirmEmail } from "@/lib/notifications/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";
import { waitlistJoinSchema } from "@/lib/validation/schemas";

export type WaitlistState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; code: "invalid_email" | "closed" | "rate_limited" | "captcha" | "unavailable" };

/**
 * Join the waitlist. The response is the same whether the email is new or already listed,
 * so the form cannot be used to discover who has signed up.
 */
export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
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
  const { IP_HASH_SALT, NEXT_PUBLIC_SITE_URL } = env();
  const ipHash = meta.ip ? hashIp(meta.ip, IP_HASH_SALT) : null;

  const [ipOk, emailOk] = await Promise.all([
    rateLimit("waitlistJoinIp", ipHash ?? "unknown"),
    rateLimit("waitlistJoinEmail", sha256Hex(email)),
  ]);
  if (!ipOk || !emailOk) return { status: "error", code: "rate_limited" };

  const captcha = await verifyTurnstile(turnstileToken, meta.ip, "waitlist");
  if (captcha !== "ok") return { status: "error", code: captcha === "failed" ? "captcha" : "unavailable" };

  const token = newToken();
  const { data, error } = await createAdminClient().rpc("waitlist_join", {
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
  log("info", "waitlist.joined", { requestId: meta.requestId, signupId: signup.signup_id, isNew: signup.is_new });

  const url = new URL("/waitlist/open", NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("token", token);
  const message = waitlistConfirmEmail(url.toString());

  // Send after the response so the form answers fast; the member can resubmit to get a new link.
  after(async () => {
    await sendEmail({
      to: email,
      ...message,
      template: "waitlist_confirm",
      idempotencyKey: `waitlist:${signup.signup_id}:${sha256Hex(token).slice(0, 16)}`,
    });
  });

  return { status: "sent", email };
}
