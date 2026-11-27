import { track } from "@/lib/analytics/server";
import "server-only";
import { brand } from "@/config/brand";
import { log } from "@/lib/log";
import { publicEnv } from "@/lib/public-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { TelegramError, sendMessage, telegramConfigured } from "@/lib/telegram/bot";
import { sendEmail } from "./email";
import { inboxMessage } from "./inbox";
import { noticeEmail } from "./templates";
import { pushConfigured, sendPush } from "./push";

/**
 * Copies new in-app notifications to the member's email, Telegram chat and push devices. The inbox
 * row already passed the member's per-type preference, so channels follow the same choice. The
 * database holds back members inside quiet hours and flags capped rows (`external` false).
 */
export async function dispatchNotifications(limit = 200) {
  const db = createAdminClient();
  const emails = new Map<string, string | null>();
  async function memberEmail(userId: string) {
    if (!emails.has(userId)) {
      const { data } = await db.auth.admin.getUserById(userId);
      emails.set(userId, data.user?.email ?? null);
    }
    return emails.get(userId) ?? null;
  }
  const { data: batch, error } = await db.rpc("claim_notification_batch", { p_limit: limit });
  if (error) throw new Error("dispatch_claim_failed");
  if (!batch.length) return { sent: 0, failed: 0 };
  const users = [...new Set(batch.map((n) => n.user_id))];
  const [links, subs] = await Promise.all([
    telegramConfigured()
      ? db.from("telegram_links").select("user_id,chat_id").in("user_id", users)
      : Promise.resolve({ data: [], error: null }),
    pushConfigured()
      ? db.from("push_subscriptions").select("user_id,endpoint,p256dh,auth").in("user_id", users)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (links.error || subs.error) throw new Error("dispatch_targets_failed");

  let sent = 0,
    failed = 0;
  for (const n of batch) {
    // Product analytics for outcomes that happen without the member present (stored consent).
    if (n.kind === "coins_released" && /^\d+$/.test(n.detail))
      await track("coins_released", n.user_id, {
        consent: "profile",
        props: { coins: Number(n.detail) },
      });
    if (n.kind === "redemption_status" && n.detail === "fulfilled")
      await track("redemption_fulfilled", n.user_id, { consent: "profile" });
    // Over the member's daily cap: it stays in the inbox only.
    if (!n.external) continue;
    const message = inboxMessage(n.kind, n.detail);
    if (!message) continue;
    const url = new URL(message.href, publicEnv.siteUrl).toString();
    // Email: every inbox notification passed the member's per-type preference already.
    const email = await memberEmail(n.user_id);
    if (email) {
      const result = await sendEmail({
        ...noticeEmail({
          subject: message.title.slice(0, 120),
          heading: message.title,
          paragraphs: [],
          action: { label: `Open ${brand.name}`, url },
        }),
        to: email,
        template: `notify_${n.kind}`,
        idempotencyKey: `notify:${n.id}`,
      });
      if (result.ok) sent += 1;
      else failed += 1;
    }
    for (const link of links.data.filter((l) => l.user_id === n.user_id)) {
      try {
        await sendMessage(link.chat_id, message.title, { label: `Open ${brand.name}`, url });
        sent += 1;
      } catch (e) {
        failed += 1;
        if (e instanceof TelegramError && e.gone)
          await db.rpc("telegram_unlink_chat", { p_chat: link.chat_id });
        else
          log("warn", "dispatch.telegram_failed", {
            status: e instanceof TelegramError ? e.status : 0,
          });
      }
    }
    for (const sub of subs.data.filter((s) => s.user_id === n.user_id)) {
      const result = await sendPush(sub, { title: brand.name, body: message.title, url });
      if (result === "sent") {
        sent += 1;
        await db.rpc("push_succeeded", { p_endpoint: sub.endpoint });
      } else if (result !== "skipped") {
        failed += 1;
        await db.rpc("push_failed", { p_endpoint: sub.endpoint, p_gone: result === "gone" });
      }
    }
  }
  return { sent, failed };
}
