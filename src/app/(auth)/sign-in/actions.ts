"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/auth/session";
import { hashIp, sha256Hex } from "@/lib/crypto";
import { isEnabled } from "@/lib/flags";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { verifyTurnstile } from "@/lib/http/turnstile";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation/schemas";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; code: "invalid_email" | "rate_limited" | "captcha" | "signups_closed" | "unavailable" };

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", env().NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Email magic link. Creates the account on first use when sign-ups are open. */
export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") || undefined,
    ref: formData.get("ref") || undefined,
    turnstileToken: formData.get("cf-turnstile-response") || undefined,
  });
  if (!parsed.success) return { status: "error", code: "invalid_email" };
  const { email, ref, turnstileToken } = parsed.data;
  const next = safeNext(parsed.data.next);

  const meta = await requestMeta();
  const ipHash = meta.ip ? hashIp(meta.ip, env().IP_HASH_SALT) : "unknown";
  const [ipOk, emailOk] = await Promise.all([
    rateLimit("signInIp", ipHash),
    rateLimit("signInEmail", sha256Hex(email)),
  ]);
  if (!ipOk || !emailOk) return { status: "error", code: "rate_limited" };

  const captcha = await verifyTurnstile(turnstileToken, meta.ip, "sign_in");
  if (captcha !== "ok") return { status: "error", code: captcha === "failed" ? "captcha" : "unavailable" };

  const signupsOpen = await isEnabled("signups_open");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: signupsOpen,
      emailRedirectTo: callbackUrl(next),
      data: ref ? { ref } : undefined,
    },
  });

  if (error) {
    // With sign-ups closed, Supabase refuses unknown emails; anything else is our problem.
    if (!signupsOpen && (error.code === "otp_disabled" || error.status === 422)) {
      return { status: "error", code: "signups_closed" };
    }
    if (error.status === 429) return { status: "error", code: "rate_limited" };
    log("error", "auth.otp_failed", { requestId: meta.requestId, code: error.code ?? String(error.status) });
    return { status: "error", code: "unavailable" };
  }
  return { status: "sent", email };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) {
    log("error", "auth.oauth_failed", { code: error?.code });
    redirect(`/sign-in?error=oauth&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url as Route); // Google's consent page, from Supabase
}
