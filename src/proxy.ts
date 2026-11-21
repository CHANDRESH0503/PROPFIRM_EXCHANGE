import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * Runs only on signed-in and auth routes (see matcher), so public pages stay cacheable:
 * no cookies are read or set on them.
 *  - Attaches a request id used by logs and the audit trail.
 *  - Refreshes the Supabase session cookie.
 *  - Optimistically redirects signed-out visitors away from the app. Every page and action
 *    still verifies the session itself; this only saves a render.
 */
const APP_PREFIXES = ["/today", "/deals", "/rewards", "/accounts", "/profile", "/onboarding", "/admin"];

export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const { response, signedIn } = await updateSession(request, headers);
  const { pathname, search } = request.nextUrl;

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
    "/profile/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/sign-in",
    "/auth/:path*",
  ],
};
