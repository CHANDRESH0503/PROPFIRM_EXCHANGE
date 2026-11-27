import { brand } from "@/config/brand";
import { getSessionUser } from "@/lib/auth/session";
import { csvCell } from "@/lib/csv";
import { rateLimit } from "@/lib/http/rate-limit";
import { EXPORT_COLUMNS, EXPORT_SELECT, exportRow, type ExportTrade } from "@/lib/journal/export";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const PAGE = 1000;

/**
 * The member's whole journal as CSV. Reads through the member's own session, so row-level
 * security limits it to their trades. Pages by (closed_at, id) so no trade is skipped or
 * repeated however large the journal is.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  if (!(await rateLimit("journalExport", user.id))) return new Response(null, { status: 429 });
  const db = await createClient();
  const encoder = new TextEncoder();
  log("info", "journal.export", { userId: user.id });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("﻿" + EXPORT_COLUMNS.join(",") + "\r\n"));
      let cursor: { closed_at: string; id: string } | null = null;
      for (;;) {
        let q = db
          .from("journal_trades")
          .select(EXPORT_SELECT)
          .order("closed_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(PAGE);
        if (cursor)
          q = q.or(
            `closed_at.gt.${cursor.closed_at},and(closed_at.eq.${cursor.closed_at},id.gt.${cursor.id})`,
          );
        const { data, error } = await q;
        if (error) {
          log("error", "journal.export_failed", { code: error.code });
          controller.error(new Error("journal_export_failed"));
          return;
        }
        for (const trade of data as unknown as (ExportTrade & { id: string })[]) {
          const row = exportRow(trade);
          controller.enqueue(
            encoder.encode(EXPORT_COLUMNS.map((c) => csvCell(row[c])).join(",") + "\r\n"),
          );
        }
        if (data.length < PAGE) break;
        const last = data[data.length - 1]!;
        cursor = { closed_at: last.closed_at, id: last.id };
      }
      controller.close();
    },
  });

  const day = new Date().toISOString().slice(0, 10);
  const name = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}-journal-${day}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
