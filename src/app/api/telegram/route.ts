import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/http/rate-limit";
import { replyTo, updateSchema } from "@/lib/telegram/updates";

/**
 * Telegram webhook. Telegram sends the secret registered with setWebhook in a header; anything
 * without it is refused. Replies go back in the response body (no extra API call).
 */
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: Request) {
  const secret = env().TELEGRAM_WEBHOOK_SECRET;
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !env().TELEGRAM_BOT_TOKEN || !timingSafeEqual(digest(given), digest(secret))) {
    return new Response(null, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  // Acknowledge anything we do not handle so Telegram does not retry it.
  if (!parsed.success) return new Response(null, { status: 200 });
  // Per-chat limits are applied in replyTo; this guards the endpoint as a whole.
  if (!(await rateLimit("telegramWebhook", "all"))) return new Response(null, { status: 429 });
  const reply = await replyTo(parsed.data);
  if (!reply) return new Response(null, { status: 200 });
  return Response.json({
    method: "sendMessage",
    chat_id: reply.chatId,
    text: reply.text,
    link_preview_options: { is_disabled: true },
  });
}
