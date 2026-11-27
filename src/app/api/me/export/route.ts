import { getSessionUser } from "@/lib/auth/session";
import { buildExport } from "@/lib/data-rights/export";
import { isSameOrigin } from "@/lib/http/origin";
import { rateLimit } from "@/lib/http/rate-limit";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/** Data export download (POST from the Your data page, same origin only). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  if (!(await rateLimit("dataRequest", user.id)))
    return new Response("Too many exports today.", { status: 429 });
  try {
    const zip = await buildExport(user.id, user.email);
    await createAdminClient().rpc("record_export", { p_user: user.id });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="my-data-${date}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    log("error", "data.export_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Export failed. Try again later.", { status: 503 });
  }
}
