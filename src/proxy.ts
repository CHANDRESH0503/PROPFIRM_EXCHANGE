import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * Runs only on signed-in and auth routes (see matcher), so public pages stay cacheable:
 * no cookies are read or set on them. Every signed-in route must be listed in both
 * APP_PREFIXES and the matcher, or its session cookie is never refreshed and members look
 * signed out once the access token expires (checked by src/test/proxy-coverage.test.ts).
 *  - Attaches a request id used by logs and the audit trail.
 *  - Refreshes the Supabase session cookie.
 *  - Optimistically redirects signed-out visitors away from the app. Every page and action
 *    still verifies the session itself; this only saves a render.
 */
const APP_PREFIXES = [
  "/today",
  "/rewards",
  "/accounts",
  "/wallet",
  "/claims",
  "/support",
  "/draws",
  "/notifications",
  "/support",
  "/profile",
  "/onboarding",
  "/admin",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Supabase falls back to its configured Site URL when a callback URL has not yet been
  // allow-listed. For local HTTPS that can leave a one-time `code` at `/`, as in the email
  // link, rather than at the callback route which exchanges it. Keep the recovery narrow so
  // the public homepage remains cacheable for ordinary requests.
  if (
    pathname === "/" &&
    ["code", "token_hash", "error"].some((key) => request.nextUrl.searchParams.has(key))
  ) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback, 303);
  }

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const { response, signedIn } = await updateSession(request, headers);
  const { search } = request.nextUrl;

  if (!signedIn && APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/today/:path*",
    "/deals/:path*",
    "/rewards/:path*",
    "/accounts/:path*",
    "/wallet/:path*",
    "/claims/:path*",
    "/support/:path*",
    "/draws/:path*",
    "/notifications/:path*",
    "/support/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/sign-in",
    "/auth/:path*",
    { source: "/", has: [{ type: "query", key: "code" }] },
    { source: "/", has: [{ type: "query", key: "token_hash" }] },
    { source: "/", has: [{ type: "query", key: "error" }] },
  ],
};
