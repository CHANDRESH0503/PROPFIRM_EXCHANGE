import "server-only";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = "ok" | "failed" | "unavailable";

/**
 * Verifies a Cloudflare Turnstile token on the server.
 * Without a secret (local development only; production refuses to boot without it) it passes.
 * If Cloudflare cannot be reached we fail closed: the form asks the visitor to try again.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip: string | null,
  action: string,
): Promise<TurnstileResult> {
  const { TURNSTILE_SECRET_KEY: secret, APP_ENV } = env();
  if (!secret) {
    return APP_ENV === "production" ? "failed" : "ok";
  }
  if (!token || token.length > 2048) return "failed";

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) {
      log("warn", "turnstile.http_error", { status: res.status, action });
      return "unavailable";
    }
    const data = (await res.json()) as {
      success: boolean;
      action?: string;
      "error-codes"?: string[];
    };
    if (!data.success) {
      log("info", "turnstile.rejected", { action, codes: (data["error-codes"] ?? []).join(",") });
      return "failed";
    }
    if (data.action && data.action !== action) {
      log("warn", "turnstile.action_mismatch", { action, got: data.action });
      return "failed";
    }
    return "ok";
  } catch {
    log("warn", "turnstile.unreachable", { action });
    return "unavailable";
  }
}
