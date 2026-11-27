"use server";

import type { Route } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/auth/session";
import { hashIp, sha256Hex } from "@/lib/crypto";
import { isEnabled } from "@/lib/flags";
import { rateLimit } from "@/lib/http/rate-limit";
import { authOrigin } from "@/lib/http/origin";
import { requestMeta } from "@/lib/http/request";
import { verifyTurnstile } from "@/lib/http/turnstile";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import {
  findReferrer,
  sealInvite,
  INVITE_COOKIE,
  INVITE_SECONDS,
} from "@/lib/auth/signup-referral";
import { referralCodeSchema, signInSchema } from "@/lib/validation/schemas";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | {
      status: "error";
      code:
        | "invalid_email"
        | "invalid_ref"
        | "oauth"
        | "rate_limited"
        | "captcha"
        | "signups_closed"
        | "unavailable";
    };

async function callbackUrl(next: string) {
  const { NEXT_PUBLIC_SITE_URL, APP_ENV } = env();
  const h = await headers();
  const origin = authOrigin(
    NEXT_PUBLIC_SITE_URL,
    APP_ENV,
    h.get("host"),
    h.get("x-forwarded-proto"),
  );
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Both sign-in methods use the same optional member invite. */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const google = formData.get("provider") === "google";
  const rawRef = formData.get("ref");
  const ref = typeof rawRef === "string" ? rawRef.trim().toUpperCase() : "";
  if (ref && !referralCodeSchema.safeParse(ref).success)
    return { status: "error", code: "invalid_ref" };
  const next = safeNext(String(formData.get("next") ?? ""));
  const meta = await requestMeta();
  const ipHash = meta.ip ? hashIp(meta.ip, env().IP_HASH_SALT) : "unknown";
  if (!(await rateLimit("signInIp", ipHash))) return { status: "error", code: "rate_limited" };

  let referrer: string | null = null;
  if (ref) {
    try {
      referrer = await findReferrer(ref);
    } catch {
      return { status: "error", code: "unavailable" };
    }
    if (!referrer) return { status: "error", code: "invalid_ref" };
  }
  if (google) {
    const url = await callbackUrl(next);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: url },
    });
    if (error || !data.url) return { status: "error", code: "oauth" };
    const jar = await cookies();
    jar.set(
      INVITE_COOKIE,
      referrer ? sealInvite({ referrer, started: Date.now(), recipient: null }) : "",
      {
        path: "/auth/callback",
        httpOnly: true,
        secure: new URL(url).protocol === "https:",
        sameSite: "lax",
        maxAge: referrer ? INVITE_SECONDS : 0,
      },
    );
    redirect(data.url as Route);
  }
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    turnstileToken: formData.get("cf-turnstile-response") || undefined,
  });
  if (!parsed.success) return { status: "error", code: "invalid_email" };
  const { email, turnstileToken } = parsed.data;
  if (!(await rateLimit("signInEmail", sha256Hex(email))))
    return { status: "error", code: "rate_limited" };

  const captcha = await verifyTurnstile(turnstileToken, meta.ip, "sign_in");
  if (captcha !== "ok")
    return { status: "error", code: captcha === "failed" ? "captcha" : "unavailable" };

  const signupsOpen = await isEnabled("signups_open");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: signupsOpen,
      emailRedirectTo: await callbackUrl(next),
      data: ref ? { ref } : undefined,
    },
  });

  if (error) {
    // With sign-ups closed, Supabase refuses unknown emails; anything else is our problem.
    if (!signupsOpen && (error.code === "otp_disabled" || error.status === 422)) {
      return { status: "error", code: "signups_closed" };
    }
    if (error.status === 429) return { status: "error", code: "rate_limited" };
    log("error", "auth.otp_failed", {
      requestId: meta.requestId,
      code: error.code ?? String(error.status),
    });
    return { status: "error", code: "unavailable" };
  }
  return { status: "sent", email };
}
