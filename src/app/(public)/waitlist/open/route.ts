import { type NextRequest, NextResponse } from "next/server";
import { sha256Hex } from "@/lib/crypto";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { WAITLIST_COOKIE, waitlistCookieOptions } from "@/lib/waitlist";

/**
 * The link in the waitlist email. Opening it confirms the email (first time only), stores the
 * access token in an httpOnly cookie, and redirects to a clean URL so the token does not stay
 * in the address bar, history or Referer headers.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const target = new URL("/waitlist/me", request.nextUrl.origin);

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    target.pathname = "/";
    target.searchParams.set("link", "invalid");
    return NextResponse.redirect(target, 303);
  }

  const { data, error } = await createAdminClient().rpc("waitlist_open", {
    p_token_hash: sha256Hex(token),
  });
  if (error) {
    log("error", "waitlist.open_failed", { code: error.code });
    target.pathname = "/";
    target.searchParams.set("link", "unavailable");
    return NextResponse.redirect(target, 303);
  }
  if (!data?.signup_id) {
    target.pathname = "/";
    target.searchParams.set("link", "invalid");
    return NextResponse.redirect(target, 303);
  }

  const response = NextResponse.redirect(target, 303);
  response.cookies.set(WAITLIST_COOKIE, token, waitlistCookieOptions());
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
