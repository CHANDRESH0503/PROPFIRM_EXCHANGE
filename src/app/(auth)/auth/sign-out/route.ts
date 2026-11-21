import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST only, so a link or prefetch can never sign someone out. Same-origin check guards CSRF. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: request.nextUrl.searchParams.get("scope") === "global" ? "global" : "local" });
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
