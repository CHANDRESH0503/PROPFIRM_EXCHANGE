"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { tradeMetrics } from "@/lib/journal/compute";
import {
  fromLocalInput,
  quickSchema,
  readTradeForm,
  strategySchema,
  tagSchema,
} from "@/lib/journal/schema";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

export type JournalState =
  | null
  | { status: "error"; code: "invalid" | "limited" | "unavailable" | "notFound"; fields?: string[] }
  | { status: "saved" };

const ID = z.uuid();

function refresh() {
  revalidatePath("/accounts", "layout");
  revalidatePath("/today");
}

function failure(error: { code: string; message: string }): JournalState {
  if (error.code === "P0002") return { status: "error", code: "notFound" };
  if (error.code === "22023" || error.code === "23514") return { status: "error", code: "invalid" };
  log("error", "journal.write_failed", { code: error.code });
  return { status: "error", code: "unavailable" };
}

/** Creates (no id) or edits a trade. On success, goes to the trade page. */
export async function saveTrade(
  tradeId: string | null,
  _prev: JournalState,
  form: FormData,
): Promise<JournalState> {
  const { user, profile } = await requireOnboarded("/accounts");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  if (tradeId !== null && !ID.safeParse(tradeId).success)
    return { status: "error", code: "notFound" };
  const parsed = readTradeForm(form);
  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  }
  const v = parsed.data;
  const zone = profile.timezone ?? "UTC";
  const closedAt = fromLocalInput(v.closed, zone);
  const openedAt = v.opened ? fromLocalInput(v.opened, zone) : null;
  if (closedAt.getTime() > Date.now() + 5 * 60_000)
    return { status: "error", code: "invalid", fields: ["closed"] };
  const m = tradeMetrics({
    symbol: v.symbol,
    direction: v.direction,
    entry: v.entry,
    exit: v.exit,
    stopLoss: v.stopLoss,
    openedAt,
    closedAt,
  });
  const { data, error } = await createAdminClient().rpc("journal_save_trade", {
    p_user: user.id,
    p_id: nullableArg(tradeId),
    p_source: "manual",
    p_symbol: v.symbol,
    p_direction: v.direction,
    p_opened_at: nullableArg(openedAt?.toISOString()),
    p_closed_at: closedAt.toISOString(),
    p_lots: nullableArg(v.lots),
    p_entry: nullableArg(v.entry),
    p_exit: nullableArg(v.exit),
    p_stop_loss: nullableArg(v.stopLoss),
    p_take_profit: nullableArg(v.takeProfit),
    p_currency: v.currency,
    p_result_cents: v.result,
    p_commission_cents: v.commission ?? 0,
    p_swap_cents: v.swap ?? 0,
    p_pips: nullableArg(m.pips),
    p_r_multiple: nullableArg(m.r),
    p_session: m.session,
    p_strategy: nullableArg(v.strategy),
    p_emotion_before: nullableArg(v.emotionBefore),
    p_emotion_after: nullableArg(v.emotionAfter),
    p_confidence: nullableArg(v.confidence),
    p_notes: nullableArg(v.notes),
    p_tags: v.tags,
    p_rules_followed: v.followed,
    p_rules_broken: v.broken,
  });
  if (error || !data) return failure(error ?? { code: "XX000", message: "empty" });
  refresh();
  redirect(`/accounts/trades/${data}?saved=1`);
}

/** Quick log: symbol, direction, result and one tag. Details can be added later. */
export async function quickLog(_prev: JournalState, form: FormData): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  const parsed = quickSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  }
  const v = parsed.data;
  const now = new Date();
  const { error } = await createAdminClient().rpc("journal_save_trade", {
    p_user: user.id,
    p_id: nullableArg<string>(null),
    p_source: "quick",
    p_symbol: v.symbol,
    p_direction: v.direction,
    p_opened_at: nullableArg<string>(null),
    p_closed_at: now.toISOString(),
    p_lots: nullableArg<number>(null),
    p_entry: nullableArg<number>(null),
    p_exit: nullableArg<number>(null),
    p_stop_loss: nullableArg<number>(null),
    p_take_profit: nullableArg<number>(null),
    p_currency: v.currency,
    p_result_cents: v.result,
    p_commission_cents: 0,
    p_swap_cents: 0,
    p_pips: nullableArg<number>(null),
    p_r_multiple: nullableArg<number>(null),
    p_session: tradeMetrics({ symbol: v.symbol, direction: v.direction, closedAt: now }).session,
    p_strategy: nullableArg<string>(null),
    p_emotion_before: nullableArg<number>(null),
    p_emotion_after: nullableArg<number>(null),
    p_confidence: nullableArg<number>(null),
    p_notes: nullableArg<string>(null),
    p_tags: v.tag ? [v.tag] : [],
    p_rules_followed: [],
    p_rules_broken: [],
  });
  if (error) return failure(error);
  refresh();
  return { status: "saved" };
}

export async function noTradesToday(): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  const { error } = await createAdminClient().rpc("journal_no_trades", { p_user: user.id });
  if (error) return failure(error);
  refresh();
  return { status: "saved" };
}

export async function deleteTrade(tradeId: string): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  if (!ID.safeParse(tradeId).success) return { status: "error", code: "notFound" };
  const db = createAdminClient();
  const { data, error } = await db.rpc("journal_delete_trade", { p_user: user.id, p_id: tradeId });
  if (error) return failure(error);
  if (data.length) {
    const removed = await db.storage.from("journal").remove(data);
    // The rows are gone; an orphaned file is logged for cleanup rather than failing the delete.
    if (removed.error) log("warn", "journal.screenshot_orphaned", { count: data.length });
  }
  refresh();
  redirect("/accounts/trades");
}

const MAX_SHOT = 2 * 1024 * 1024;

function imageType(bytes: Buffer): readonly [string, string] | null {
  if (
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return ["webp", "image/webp"];
  if (bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return ["jpg", "image/jpeg"];
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    return ["png", "image/png"];
  return null;
}

/** Stores a screenshot the browser has already resized (≤ 2 MB, WebP, JPEG or PNG). */
export async function uploadScreenshot(tradeId: string, form: FormData): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts");
  if (!(await rateLimit("journalUpload", user.id))) return { status: "error", code: "limited" };
  if (!ID.safeParse(tradeId).success) return { status: "error", code: "notFound" };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_SHOT)
    return { status: "error", code: "invalid", fields: ["file"] };
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return { status: "error", code: "invalid", fields: ["file"] };
  const path = `${user.id}/${tradeId}/${randomUUID()}.${type[0]}`;
  const db = createAdminClient();
  const bucket = db.storage.from("journal");
  const uploaded = await bucket.upload(path, bytes, { contentType: type[1], upsert: false });
  if (uploaded.error) return { status: "error", code: "unavailable" };
  const { error } = await db.rpc("journal_add_screenshot", {
    p_user: user.id,
    p_trade: tradeId,
    p_path: path,
    p_bytes: bytes.length,
  });
  if (error) {
    await bucket.remove([path]);
    return failure(error);
  }
  revalidatePath(`/accounts/trades/${tradeId}`);
  revalidatePath("/accounts");
  return { status: "saved" };
}

export async function removeScreenshot(tradeId: string, shotId: string): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  if (!ID.safeParse(shotId).success || !ID.safeParse(tradeId).success)
    return { status: "error", code: "notFound" };
  const db = createAdminClient();
  const { data, error } = await db.rpc("journal_remove_screenshot", {
    p_user: user.id,
    p_id: shotId,
  });
  if (error) return failure(error);
  const removed = await db.storage.from("journal").remove([data]);
  if (removed.error) log("warn", "journal.screenshot_orphaned", { count: 1 });
  revalidatePath(`/accounts/trades/${tradeId}`);
  revalidatePath("/accounts");
  return { status: "saved" };
}

export async function saveStrategy(
  strategyId: string | null,
  _prev: JournalState,
  form: FormData,
): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts/strategies");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  if (strategyId !== null && !ID.safeParse(strategyId).success)
    return { status: "error", code: "notFound" };
  const rules = String(form.get("rules") ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  const parsed = strategySchema.safeParse({
    name: form.get("name") ?? "",
    description: form.get("description") ?? "",
    rules,
  });
  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  }
  const { error } = await createAdminClient().rpc("journal_save_strategy", {
    p_user: user.id,
    p_id: nullableArg(strategyId),
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_rules: parsed.data.rules,
  });
  if (error)
    return error.code === "23505"
      ? { status: "error", code: "invalid", fields: ["name"] }
      : failure(error);
  refresh();
  return { status: "saved" };
}

export async function archiveStrategy(strategyId: string): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts/strategies");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  if (!ID.safeParse(strategyId).success) return { status: "error", code: "notFound" };
  const { error } = await createAdminClient().rpc("journal_archive_strategy", {
    p_user: user.id,
    p_id: strategyId,
  });
  if (error) return failure(error);
  refresh();
  return { status: "saved" };
}

export async function createTag(_prev: JournalState, form: FormData): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts/strategies");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  const parsed = tagSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", code: "invalid", fields: ["name"] };
  const { error } = await createAdminClient().rpc("journal_create_tag", {
    p_user: user.id,
    p_kind: parsed.data.kind,
    p_name: parsed.data.name,
  });
  if (error) return failure(error);
  refresh();
  return { status: "saved" };
}

export async function deleteTag(tagId: string): Promise<JournalState> {
  const { user } = await requireOnboarded("/accounts/strategies");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  if (!ID.safeParse(tagId).success) return { status: "error", code: "notFound" };
  const { error } = await createAdminClient().rpc("journal_delete_tag", {
    p_user: user.id,
    p_id: tagId,
  });
  if (error) return failure(error);
  refresh();
  return { status: "saved" };
}
