import "server-only";
import { strToU8, zipSync } from "fflate";
import { toCsv } from "@/lib/csv";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Everything we hold about a member, as a ZIP (18-data-and-operations.md §9): profile, Coin
 * ledger, XP, claims, redemptions, journal, support requests and notifications.
 */
export async function buildExport(userId: string, email: string | null) {
  const db = createAdminClient();
  const wallet = await db.from("wallet_accounts").select("id").eq("user_id", userId).maybeSingle();
  const [profile, ledger, xp, claims, redemptions, trades, tickets, notifications, journalDays] =
    await Promise.all([
      db
        .from("profiles")
        .select("id,display_name,country_code,timezone,referral_code,created_at,onboarded_at")
        .eq("id", userId)
        .single(),
      wallet.data
        ? db
            .from("ledger_entries")
            .select("id,amount,bucket,type,created_at")
            .eq("wallet_id", wallet.data.id)
            .order("id")
        : Promise.resolve({ data: [], error: null }),
      db.from("xp_events").select("amount,source,created_at").eq("user_id", userId).order("id"),
      db
        .from("purchase_claims")
        .select(
          "id,order_ref,status,amount_paid_cents,currency,purchased_on,created_at,review_note",
        )
        .eq("user_id", userId)
        .order("created_at"),
      wallet.data
        ? db
            .from("redemptions")
            .select("id,reward_name,cost_coins,status,created_at,fulfilled_at")
            .eq("wallet_id", wallet.data.id)
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
      db
        .from("journal_trades")
        .select(
          "symbol,direction,opened_at,closed_at,lots,entry,exit,stop_loss,take_profit,currency,result_cents,commission_cents,swap_cents,net_cents,pips,r_multiple,session,notes,source",
        )
        .eq("user_id", userId)
        .order("closed_at"),
      db
        .from("support_tickets")
        .select(
          "id,topic,subject,status,created_at,support_messages(from_staff,internal,body,created_at)",
        )
        .eq("user_id", userId),
      db
        .from("notifications")
        .select("kind,detail,created_at,read_at")
        .eq("user_id", userId)
        .order("id"),
      db.from("journal_days").select("local_day,reason").eq("user_id", userId).order("local_day"),
    ]);
  for (const r of [
    profile,
    ledger,
    xp,
    claims,
    redemptions,
    trades,
    tickets,
    notifications,
    journalDays,
  ]) {
    if (r.error) throw new Error("export_failed");
  }
  const files: Record<string, Uint8Array> = {
    "README.txt": strToU8(
      "Your data export. CSV files open in any spreadsheet. Amounts ending _cents are in minor units (divide by 100).\r\n",
    ),
    "profile.json": strToU8(JSON.stringify({ ...profile.data, email }, null, 2)),
    "coin-ledger.csv": strToU8(
      toCsv(ledger.data ?? [], ["id", "amount", "bucket", "type", "created_at"]),
    ),
    "xp.csv": strToU8(toCsv(xp.data ?? [], ["amount", "source", "created_at"])),
    "claims.csv": strToU8(
      toCsv(claims.data ?? [], [
        "id",
        "order_ref",
        "status",
        "amount_paid_cents",
        "currency",
        "purchased_on",
        "created_at",
        "review_note",
      ]),
    ),
    "redemptions.csv": strToU8(
      toCsv(redemptions.data ?? [], [
        "id",
        "reward_name",
        "cost_coins",
        "status",
        "created_at",
        "fulfilled_at",
      ]),
    ),
    "journal-trades.csv": strToU8(
      toCsv(trades.data ?? [], [
        "symbol",
        "direction",
        "opened_at",
        "closed_at",
        "lots",
        "entry",
        "exit",
        "stop_loss",
        "take_profit",
        "currency",
        "result_cents",
        "commission_cents",
        "swap_cents",
        "net_cents",
        "pips",
        "r_multiple",
        "session",
        "notes",
        "source",
      ]),
    ),
    "journal-days.csv": strToU8(toCsv(journalDays.data ?? [], ["local_day", "reason"])),
    // Internal staff notes are not part of the member's messages.
    "support.json": strToU8(
      JSON.stringify(
        (tickets.data ?? []).map((t) => ({
          ...t,
          support_messages: t.support_messages
            .filter((m) => !m.internal)
            .map((m) => ({ from_staff: m.from_staff, body: m.body, created_at: m.created_at })),
        })),
        null,
        2,
      ),
    ),
    "notifications.csv": strToU8(
      toCsv(notifications.data ?? [], ["kind", "detail", "created_at", "read_at"]),
    ),
  };
  return zipSync(files, { level: 6 });
}
