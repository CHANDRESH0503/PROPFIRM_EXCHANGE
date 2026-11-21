import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/lib/public-env";

/**
 * Refreshes the Supabase session cookie on every matched request so Server Components
 * always see a valid token. Returns the response to send and whether a user is signed in.
 * This is an optimistic check only; pages and actions verify again (requireUser).
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return { response, signedIn: false };
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims verifies the JWT (locally with asymmetric signing keys) and refreshes if needed.
  const { data } = await supabase.auth.getClaims();
  return { response, signedIn: Boolean(data?.claims?.sub) };
}
