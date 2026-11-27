import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertOwner } from "@/lib/telegram/bot";

export type OpsAlertKind = "liability" | "claims_waiting" | "redemption_overdue" | "low_stock";

const detail = z
  .object({
    ratio: z.coerce.number().optional(),
    count: z.coerce.number().optional(),
    name: z.string().optional(),
    remaining: z.coerce.number().optional(),
    threshold: z.coerce.number().optional(),
  })
  .catch({});

/** One line for the owner's chat. Plain text: names come from staff input. */
export function describeAlert(kind: string, raw: unknown, transition: "opened" | "resolved") {
  const d = detail.parse(raw);
  if (transition === "resolved") {
    const what = {
      liability: "Coin liability ratio is back at or below 1.0",
      claims_waiting: "No claim has waited longer than 24 hours",
      redemption_overdue: "No queued redemption is past its target",
      low_stock: `Voucher stock recovered for ${d.name ?? "a reward"}`,
    }[kind as OpsAlertKind];
    return `resolved: ${what ?? kind}.`;
  }
  const what = {
    liability: `Coin liability ratio is ${d.ratio?.toFixed(3) ?? "above 1.0"} (limit 1.0). Outstanding Coins exceed confirmed commission. See Finance.`,
    claims_waiting: `${d.count ?? "Some"} claim(s) have waited more than 24 hours. See Claims.`,
    redemption_overdue: `${d.count ?? "Some"} queued redemption(s) passed the 48-hour target. See Rewards.`,
    low_stock: `Low voucher stock for ${d.name ?? "a reward"}: ${d.remaining ?? 0} left (threshold ${d.threshold ?? 0}). See Rewards.`,
  }[kind as OpsAlertKind];
  return `alert: ${what ?? kind}`;
}

/**
 * Applies current operational conditions and messages the owner about each change. The
 * database reports each opening and resolution exactly once, so repeated runs stay quiet.
 */
export async function runOpsAlerts() {
  const { data, error } = await createAdminClient().rpc("sync_ops_alerts");
  if (error) throw new Error("ops_alerts_failed:" + error.code);
  for (const row of data ?? []) {
    const transition = row.transition === "resolved" ? "resolved" : "opened";
    await alertOwner(describeAlert(row.kind, row.detail, transition));
  }
  return data?.length ?? 0;
}

/** Open alerts for the admin dashboard, oldest first. */
export async function openOpsAlerts() {
  const { data, error } = await createAdminClient()
    .from("ops_alerts")
    .select("key,kind,detail,opened_at")
    .eq("active", true)
    .order("opened_at");
  if (error) throw new Error("ops_alerts_unavailable");
  return data;
}
