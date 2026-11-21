import { type NextRequest } from "next/server";
import { getRoles, getSessionUser, hasRole } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * CSV export of the waitlist (support role, MFA session). Streams in pages of 1,000 so it
 * never hits the Data API row cap. Cells are guarded against spreadsheet formula injection.
 */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  if (!hasRole(await getRoles(), "support") || user.aal !== "aal2") return new Response(null, { status: 403 });

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase().slice(0, 100) ?? "";
  const db = createAdminClient();
  const encoder = new TextEncoder();
  log("info", "admin.waitlist_export", { userId: user.id });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("seq,email,status,confirmed_referrals,source,country,created_at,confirmed_at\n"));
      let before: number | null = null;
      for (;;) {
        let query = db
          .from("waitlist_signups")
          .select("seq, email, status, confirmed_referrals, source, country_code, created_at, confirmed_at")
          .order("seq", { ascending: false })
          .limit(1000);
        if (q) query = query.ilike("email", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
        if (before !== null) query = query.lt("seq", before);
        const { data, error } = await query;
        if (error) {
          controller.error(new Error(error.code));
          return;
        }
        for (const r of data) {
          controller.enqueue(
            encoder.encode(
              [r.seq, r.email, r.status, r.confirmed_referrals, r.source, r.country_code, r.created_at, r.confirmed_at].map(cell).join(",") + "\n",
            ),
          );
        }
        if (data.length < 1000) break;
        before = data.at(-1)!.seq;
      }
      controller.close();
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="waitlist-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
