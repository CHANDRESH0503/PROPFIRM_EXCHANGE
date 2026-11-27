import { track } from "@/lib/analytics/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { COUNTRY_CODES } from "@/lib/geo/countries";
import { requestMeta } from "@/lib/http/request";
import { rateLimit } from "@/lib/http/rate-limit";
import { env } from "@/lib/env";
import { hashIp } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    (origin !== new URL(env().NEXT_PUBLIC_SITE_URL).origin &&
      !(env().APP_ENV === "local" && origin === request.nextUrl.origin))
  )
    return new Response(null, { status: 403 });
  const form = await request.formData();
  const program = z.uuid().safeParse(form.get("program"));
  const country = z
    .enum(COUNTRY_CODES)
    .optional()
    .safeParse(form.get("country") || undefined);
  if (!program.success || !country.success) return new Response(null, { status: 400 });
  const [user, meta] = await Promise.all([getSessionUser(), requestMeta()]);
  if (!(await rateLimit("outbound", user?.id ?? hashIp(meta.ip ?? "unknown", env().IP_HASH_SALT))))
    return new Response(null, { status: 429 });
  const { data, error } = await createAdminClient().rpc("record_outbound", {
    p_user: nullableArg(user?.id),
    p_program: program.data,
    p_declared_country: nullableArg(country.data),
    p_ip_country: nullableArg(meta.ipCountry),
    p_source: "catalogue",
  });
  const row = data?.[0];
  if (error || !row)
    return NextResponse.redirect(
      new URL("/firms?outbound=unavailable", request.nextUrl.origin),
      303,
    );
  const target = new URL(row.tracking_url.replaceAll("{click_id}", row.click_id));
  if (target.protocol !== "https:" || target.username || target.password)
    return new Response(null, { status: 422 });
  if (user)
    await track("outbound_click", user.id, {
      consent: "request",
      props: { program: program.data },
    });
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
