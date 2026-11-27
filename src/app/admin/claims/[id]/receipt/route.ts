import { z } from "zod";
import { requireReviewer } from "@/lib/auth/reviewer";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(
  _request: Request,
  { params }: RouteContext<"/admin/claims/[id]/receipt">,
) {
  await requireReviewer();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response(null, { status: 404 });
  const db = createAdminClient();
  const row = await db
    .from("purchase_claims")
    .select("receipt_path")
    .eq("id", id.data)
    .maybeSingle();
  if (row.error) return new Response(null, { status: 503 });
  if (!row.data?.receipt_path) return new Response(null, { status: 404 });
  const link = await db.storage.from("receipts").createSignedUrl(row.data.receipt_path, 600);
  if (link.error) return new Response(null, { status: 503 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: link.data.signedUrl,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
