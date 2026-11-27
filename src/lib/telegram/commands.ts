import "server-only";
import { createHash } from "node:crypto";
import { brand } from "@/config/brand";
import { calendarFeed } from "@/lib/calendar/provider";
import { publicEnv } from "@/lib/public-env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Bot commands (16-trader-tools.md "Telegram bot"). Replies are plain text. Nothing here gives
 * trading advice: calendar replies list scheduled events only.
 */

export const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

const site = (path: string) => new URL(path, publicEnv.siteUrl).toString();

const HELP = [
  "/coins - Coin balance and pending Coins",
  "/streak - check-in and journal streaks",
  "/today - today's high-impact events",
  "/next - the next high-impact event",
  "/stop - disconnect this chat",
].join("\n");

async function linkedMember(chatId: number) {
  const db = createAdminClient();
  const { data } = await db
    .from("telegram_links")
    .select("user_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!data) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("timezone")
    .eq("id", data.user_id)
    .maybeSingle();
  return { id: data.user_id, zone: profile?.timezone ?? "UTC" };
}

function formatWhen(iso: string, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  }).format(new Date(iso));
}

function until(iso: string) {
  const minutes = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
  const d = Math.floor(minutes / 1440),
    h = Math.floor((minutes % 1440) / 60),
    m = minutes % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

async function highImpact() {
  const feed = await calendarFeed();
  const note = feed.licensed
    ? ""
    : "\n\nSample data: a licensed calendar feed is not connected yet, so these events are fictional.";
  return { events: feed.events.filter((e) => e.impact === "high"), note };
}

export async function handleCommand(
  chatId: number,
  username: string | null,
  text: string,
): Promise<string> {
  const [command = "", arg = ""] = text.trim().split(/\s+/, 2);
  const name = command.toLowerCase().replace(/@.*$/, "");
  const db = createAdminClient();

  // A pasted code on its own counts as "/start <code>".
  const bare = !command.startsWith("/") && /^[A-Za-z0-9_-]{16,64}$/.test(command) ? command : null;
  if ((name === "/start" && arg) || bare) {
    const code = bare ?? arg;
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(code))
      return "That link has expired. Open Notifications in the app and choose Connect Telegram again.";
    const { error } = await db.rpc("telegram_link", {
      p_hash: hashCode(code),
      p_chat: chatId,
      p_username: username ?? "",
    });
    if (error)
      return "That link has expired. Open Notifications in the app and choose Connect Telegram again.";
    return `Connected to ${brand.name}. Claim, reward and Coin updates will arrive here, following your notification settings.\n\n${HELP}`;
  }

  const member = await linkedMember(chatId);
  if (!member) {
    return `To use this bot, connect your ${brand.name} account: open ${site("/notifications")} and choose Connect Telegram.`;
  }

  switch (name) {
    case "/start":
    case "/help":
      return HELP;
    case "/stop": {
      await db.rpc("telegram_unlink_chat", { p_chat: chatId });
      return "Disconnected. You will not get any more messages here. Connect again from Notifications at any time.";
    }
    case "/coins": {
      // No member session in a webhook: read the balance view with the service role.
      const { data, error } = await db
        .from("wallet_balances")
        .select("available,pending")
        .eq("user_id", member.id)
        .maybeSingle();
      if (error) throw new Error("wallet_unavailable");
      const fmt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US");
      return `Available: ${fmt(data?.available)} Coins\nPending: ${fmt(data?.pending)} Coins\n\nCoins are rewards with no cash value.`;
    }
    case "/streak": {
      const [progress, journal] = await Promise.all([
        db.rpc("trader_progress", { p_user: member.id }).single(),
        db
          .from("journal_streaks")
          .select("current_streak,last_day")
          .eq("user_id", member.id)
          .maybeSingle(),
      ]);
      const checkIn = progress.data?.streak ?? 0;
      const done = progress.data?.checked_in ? "checked in today" : "not checked in yet today";
      return `Check-in streak: ${checkIn} ${checkIn === 1 ? "day" : "days"} (${done})\nJournal streak: ${journal.data?.current_streak ?? 0}`;
    }
    case "/today": {
      const { events, note } = await highImpact();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: member.zone }).format(new Date());
      const list = events.filter(
        (e) =>
          new Intl.DateTimeFormat("en-CA", { timeZone: member.zone }).format(
            new Date(e.scheduledAt),
          ) === today,
      );
      if (!list.length) return `No high-impact events today (${member.zone}).${note}`;
      return `High-impact events today (${member.zone}):\n${list.map((e) => `${formatWhen(e.scheduledAt, member.zone)}  ${e.currency}  ${e.title}`).join("\n")}${note}`;
    }
    case "/next": {
      const { events, note } = await highImpact();
      const next = events.find((e) => Date.parse(e.scheduledAt) > Date.now());
      if (!next) return `No high-impact events scheduled in the next two weeks.${note}`;
      return `Next high-impact event: ${next.currency} ${next.title}\n${formatWhen(next.scheduledAt, member.zone)} (in ${until(next.scheduledAt)})\n\nCheck your firm's news rules before trading around it.${note}`;
    }
    default:
      return `I don't know that command.\n\n${HELP}`;
  }
}
