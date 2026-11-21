import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

/**
 * Finishes every sign-in:
 *  - `code`: PKCE flow (Google, and magic links opened in the same browser).
 *  - `token_hash` + `type`: magic links opened on any device. Needs the Supabase email
 *    template to link here (docs/runbooks/supabase-setup.md).
 * Then sends new users to onboarding and everyone else to `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const fail = (reason: string) => {
    const url = new URL("/sign-in", request.nextUrl.origin);
    url.searchParams.set("error", reason);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  };

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      log("info", "auth.code_exchange_failed", { code: error.code });
      return fail("link");
    }
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      log("info", "auth.verify_otp_failed", { code: error.code });
      return fail("link");
    }
  } else if (params.get("error")) {
    return fail("oauth");
  } else {
    return fail("link");
  }

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return fail("link");

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", userId).maybeSingle();
  const destination = profile?.onboarded_at ? next : `/onboarding?next=${encodeURIComponent(next)}`;
  const response = NextResponse.redirect(new URL(destination, request.nextUrl.origin), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
