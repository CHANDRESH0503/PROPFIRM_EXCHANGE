import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { StatTrade } from "./stats";

/**
 * Journal reads run as the member (RLS: owner only). Only signed screenshot URLs use the service
 * role, after the member's own query has returned the paths.
 */

export type Tag = { id: string; kind: "setup" | "mistake" | "emotion"; name: string; own: boolean };
export type Strategy = {
  id: string;
  name: string;
  description: string | null;
  rules: { id: string; position: number; body: string }[];
};

const KINDS = ["setup", "mistake", "emotion"] as const;
const isKind = (k: string): k is Tag["kind"] => KINDS.some((x) => x === k);

export async function journalTags(): Promise<Tag[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_tags")
    .select("id,kind,name,user_id")
    .order("kind")
    .order("name");
  if (error) throw new Error("journal_tags_unavailable");
  return data.flatMap((t) =>
    isKind(t.kind) ? [{ id: t.id, kind: t.kind, name: t.name, own: t.user_id !== null }] : [],
  );
}

export async function journalStrategies(): Promise<Strategy[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_strategies")
    .select("id,name,description,journal_strategy_rules(id,position,body)")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("journal_strategies_unavailable");
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    rules: [...s.journal_strategy_rules].sort((a, b) => a.position - b.position),
  }));
}

const TRADE_COLUMNS =
  "id,closed_at,opened_at,local_day,symbol,direction,session,strategy_id,net_cents,result_cents,commission_cents,swap_cents,r_multiple,pips,lots,currency,source,notes,journal_trade_tags(journal_tags(id,kind,name)),journal_screenshots(id)";

export type TradeRow = StatTrade & {
  opened_at: string | null;
  result_cents: number;
  commission_cents: number;
  swap_cents: number;
  pips: number | null;
  lots: number | null;
  currency: string;
  source: string;
  notes: string | null;
  screenshots: number;
};

export async function journalTrades(opts: {
  from?: string;
  to?: string;
  limit?: number;
  before?: string;
  currency?: string;
}) {
  const db = await createClient();
  let q = db
    .from("journal_trades")
    .select(TRADE_COLUMNS)
    .order("closed_at", { ascending: false })
    .order("id");
  if (opts.from) q = q.gte("local_day", opts.from);
  if (opts.to) q = q.lte("local_day", opts.to);
  if (opts.before) q = q.lt("closed_at", opts.before);
  if (opts.currency) q = q.eq("currency", opts.currency);
  const { data, error } = await q.limit(opts.limit ?? 2000);
  if (error) throw new Error("journal_trades_unavailable");
  return data.map((t): TradeRow => ({
    id: t.id,
    closed_at: t.closed_at,
    opened_at: t.opened_at,
    local_day: t.local_day,
    symbol: t.symbol,
    direction: t.direction,
    session: t.session,
    strategy_id: t.strategy_id,
    net_cents: t.net_cents ?? t.result_cents + t.commission_cents + t.swap_cents,
    result_cents: t.result_cents,
    commission_cents: t.commission_cents,
    swap_cents: t.swap_cents,
    r_multiple: t.r_multiple,
    pips: t.pips,
    lots: t.lots,
    currency: t.currency,
    source: t.source,
    notes: t.notes,
    tags: t.journal_trade_tags.flatMap((x) => (x.journal_tags ? [x.journal_tags] : [])),
    screenshots: t.journal_screenshots.length,
  }));
}

export async function journalTrade(id: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_trades")
    .select(
      "*,journal_trade_tags(tag_id),journal_trade_rule_checks(rule_id,followed),journal_screenshots(id,path,created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("journal_trade_unavailable");
  return data;
}

/** Short-lived signed URLs for the member's own screenshots. */
export async function signedShots(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data, error } = await createAdminClient()
    .storage.from("journal")
    .createSignedUrls(paths, 600);
  if (error) throw new Error("journal_screenshots_unavailable");
  return new Map(
    data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
  );
}

export async function journalStreak() {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_streaks")
    .select("current_streak,longest,last_day")
    .maybeSingle();
  if (error) throw new Error("journal_streak_unavailable");
  return data;
}

export async function journalDay(day: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_days")
    .select("reason")
    .eq("local_day", day)
    .maybeSingle();
  if (error) throw new Error("journal_day_unavailable");
  return data?.reason ?? null;
}

/** Recent screenshots for the chart gallery. */
export async function galleryShots(limit = 12) {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_screenshots")
    .select("id,path,trade_id,created_at,journal_trades(symbol,net_cents,currency,strategy_id)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("journal_gallery_unavailable");
  const urls = await signedShots(data.map((s) => s.path));
  return data.flatMap((s) => {
    const url = urls.get(s.path);
    return url && s.journal_trades
      ? [{ id: s.id, tradeId: s.trade_id, url, ...s.journal_trades }]
      : [];
  });
}

export async function dailyStats(from: string, to: string, currency: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_daily_stats")
    .select("local_day,net_cents,trades,wins,losses")
    .eq("currency", currency)
    .gte("local_day", from)
    .lte("local_day", to)
    .order("local_day");
  if (error) throw new Error("journal_stats_unavailable");
  return data.map((d) => ({
    day: d.local_day,
    net: d.net_cents,
    trades: d.trades,
    wins: d.wins,
    losses: d.losses,
  }));
}

/** Currencies the member has journaled in, most-used first. */
export async function journalCurrencies() {
  const db = await createClient();
  const { data, error } = await db.from("journal_daily_stats").select("currency,trades");
  if (error) throw new Error("journal_stats_unavailable");
  const totals = new Map<string, number>();
  for (const d of data) totals.set(d.currency, (totals.get(d.currency) ?? 0) + d.trades);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/** Share of checked rules that were followed, per strategy. */
export async function ruleFollowRates() {
  const db = await createClient();
  const { data, error } = await db
    .from("journal_trade_rule_checks")
    .select("followed,journal_strategy_rules(strategy_id)");
  if (error) throw new Error("journal_rules_unavailable");
  const rates = new Map<string, { followed: number; total: number }>();
  for (const c of data) {
    const id = c.journal_strategy_rules?.strategy_id;
    if (!id) continue;
    const r = rates.get(id) ?? { followed: 0, total: 0 };
    r.total += 1;
    if (c.followed) r.followed += 1;
    rates.set(id, r);
  }
  return rates;
}
