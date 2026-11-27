"use server";
import { track } from "@/lib/analytics/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { requestMeta } from "@/lib/http/request";
import { rateLimit } from "@/lib/http/rate-limit";
import { sha256Hex } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCommissionCsv, mapCommissionRows } from "@/lib/economy/report";
const reason = z.string().trim().min(3).max(1000);
const imported = z.object({
  firm: z.uuid(),
  external: z.string().min(1),
  order: z.string().min(1),
  amount: z.string().min(1),
  reason,
});
export async function importReport(_prev: string, form: FormData) {
  const { user } = await requireStaff("finance");
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const parsed = imported.safeParse(Object.fromEntries(form));
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File) || file.size > 500000) return "invalid";
  const { firm, reason, ...mapping } = parsed.data;
  let rows;
  try {
    rows = mapCommissionRows(parseCommissionCsv(await file.text()), mapping);
  } catch {
    return "invalid";
  }
  const { error } = await createAdminClient().rpc("import_commissions", {
    p_firm: firm,
    p_actor: user.id,
    p_fingerprint: sha256Hex(JSON.stringify(rows)),
    p_mapping: mapping,
    p_rows: rows,
    p_reason: reason,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return "importError";
  revalidatePath("/admin/finance");
  return "imported";
}
export async function decideCommission(_prev: string, form: FormData) {
  const { user } = await requireStaff("finance");
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const parsed = z
    .object({ id: z.uuid(), decision: z.enum(["confirm", "reverse"]), reason })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const { id, decision, reason: note } = parsed.data;
  const params = {
    p_actor: user.id,
    p_id: id,
    p_reason: note,
    p_request_id: (await requestMeta()).requestId,
  };
  const db = createAdminClient();
  const res =
    decision === "confirm"
      ? await db.rpc("confirm_commission", {
          ...params,
          p_cap_reviewed: form.get("cap_reviewed") === "on",
        })
      : await db.rpc("reverse_commission", params);
  if (res.error) return res.error.message.includes("monthly cap") ? "capRequired" : "decisionError";
  if (decision === "confirm") await trackConfirmation(db, id);
  revalidatePath("/admin/finance");
  return "saved";
}

const paid = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  reference: z.string().trim().min(1).max(160),
  paid_on: z.iso.date(),
  reason,
});
/** Records that the firm paid the selected confirmed commissions (audited in the database). */
export async function markPaid(_prev: string, form: FormData) {
  const { user } = await requireStaff("finance");
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const parsed = paid.safeParse({
    ids: form.getAll("commission"),
    reference: form.get("reference"),
    paid_on: form.get("paid_on"),
    reason: form.get("reason"),
  });
  if (!parsed.success) return "paidInvalid";
  const { error } = await createAdminClient().rpc("mark_commissions_paid", {
    p_actor: user.id,
    p_ids: parsed.data.ids,
    p_reference: parsed.data.reference,
    p_paid_on: parsed.data.paid_on,
    p_reason: parsed.data.reason,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return "paidError";
  revalidatePath("/admin/finance");
  return "paidSaved";
}

/**
 * Staff confirmed a commission: the buyer's purchase is verified and, on a first purchase, the
 * referrer's invite converted. Sent with each member's stored consent, never the staff cookie.
 */
async function trackConfirmation(db: ReturnType<typeof createAdminClient>, commissionId: string) {
  const [claim, referral] = await Promise.all([
    db
      .from("commissions")
      .select("purchase_claims(user_id,program_id)")
      .eq("id", commissionId)
      .maybeSingle(),
    db
      .from("ledger_entries")
      .select("wallet_accounts(user_id)")
      .eq("ref_type", "commission")
      .eq("ref_id", commissionId)
      .eq("type", "referral")
      .limit(1)
      .maybeSingle(),
  ]);
  const buyer = claim.data?.purchase_claims;
  if (buyer?.user_id)
    await track("claim_confirmed", buyer.user_id, {
      consent: "profile",
      props: { program: buyer.program_id },
    });
  const referrer = referral.data?.wallet_accounts?.user_id;
  if (referrer) await track("referral_converted", referrer, { consent: "profile" });
}
