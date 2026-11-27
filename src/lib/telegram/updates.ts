import "server-only";
import { z } from "zod";
import { rateLimit } from "@/lib/http/rate-limit";
import { log } from "@/lib/log";
import { telegramCall, telegramConfigured } from "./bot";
import { handleCommand } from "./commands";

/**
 * Telegram updates arrive two ways: a webhook (production, HTTPS) or, when no webhook is
 * registered, by pulling them with getUpdates. Pulling lets linking work locally and before the
 * webhook is set: the Notifications page and the minute job both call `pullUpdates`.
 */

export const updateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      chat: z.object({ id: z.number(), type: z.string() }),
      /** Unix seconds when the member sent it. */
      date: z.number().optional(),
      from: z.object({ username: z.string().max(64).optional() }).optional(),
      text: z.string().max(4096).optional(),
    })
    .optional(),
});
export type Update = z.infer<typeof updateSchema>;

/** The reply for one update, or null when it needs none (non-private chat, no text, rate-limited). */
export async function replyTo(update: Update): Promise<{ chatId: number; text: string } | null> {
  const message = update.message;
  if (!message?.text || message.chat.type !== "private") return null;
  if (!(await rateLimit("telegram", String(message.chat.id)))) return null;
  try {
    return {
      chatId: message.chat.id,
      text: await handleCommand(message.chat.id, message.from?.username ?? null, message.text),
    };
  } catch (error) {
    log("error", "telegram.command_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { chatId: message.chat.id, text: "Something went wrong. Try again in a minute." };
  }
}

const STALE_SECONDS = 10 * 60;

let webhookCheckedAt = 0;
let webhookSet = false;

async function usingWebhook() {
  if (Date.now() - webhookCheckedAt < 60_000) return webhookSet;
  const info = await telegramCall("getWebhookInfo", {});
  webhookSet = Boolean(
    info && typeof info === "object" && "url" in info && typeof info.url === "string" && info.url,
  );
  webhookCheckedAt = Date.now();
  return webhookSet;
}

// One pull at a time in this process; the server runs as a single instance (docs/SYSTEM_DESIGN.md).
let running: Promise<number> | null = null;

/** Processes pending updates when no webhook is registered. Returns how many were handled. */
export function pullUpdates(): Promise<number> {
  if (!telegramConfigured()) return Promise.resolve(0);
  running ??= (async () => {
    try {
      if (await usingWebhook()) return 0;
      const raw = await telegramCall("getUpdates", {
        timeout: 0,
        limit: 50,
        allowed_updates: ["message"],
      });
      const updates = z.array(z.unknown()).parse(raw);
      let last: number | null = null;
      for (const item of updates) {
        const parsed = updateSchema.safeParse(item);
        if (!parsed.success) continue;
        last = parsed.data.update_id;
        // Messages that waited longer than a link code lives get no reply: answering them now
        // would only confuse (for example "link expired" right before a fresh "Connected").
        const sent = parsed.data.message?.date;
        if (sent && Date.now() / 1000 - sent > STALE_SECONDS) continue;
        const reply = await replyTo(parsed.data);
        if (reply) {
          await telegramCall("sendMessage", {
            chat_id: reply.chatId,
            text: reply.text,
            link_preview_options: { is_disabled: true },
          }).catch((e: unknown) =>
            log("warn", "telegram.reply_failed", {
              reason: e instanceof Error ? e.message : "unknown",
            }),
          );
        }
      }
      // Confirm everything handled, so a restart never replays it.
      if (last !== null)
        await telegramCall("getUpdates", { offset: last + 1, limit: 1, timeout: 0 });
      return updates.length;
    } catch (error) {
      log("warn", "telegram.pull_failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      return 0;
    } finally {
      running = null;
    }
  })();
  return running;
}
