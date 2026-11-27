import "server-only";
import { cacheLife } from "next/cache";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * Telegram Bot API client. The token never leaves the server and is never logged. Messages are
 * plain text (no parse mode), so member data can never inject formatting or links.
 */

export class TelegramError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
  /** The member blocked the bot or deleted the chat: unlink instead of retrying. */
  get gone() {
    return this.status === 403 || (this.status === 400 && /chat not found/i.test(this.message));
  }
}

export function telegramConfigured() {
  return Boolean(env().TELEGRAM_BOT_TOKEN);
}

async function call(method: string, payload: Record<string, unknown>): Promise<unknown> {
  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError(0, "not_configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("ok" in body))
    throw new TelegramError(res.status, "bad_response");
  if (body.ok !== true) {
    const code =
      "error_code" in body && typeof body.error_code === "number" ? body.error_code : res.status;
    const text =
      "description" in body && typeof body.description === "string" ? body.description : "error";
    throw new TelegramError(code, text);
  }
  return "result" in body ? body.result : null;
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  link?: { label: string; url: string },
) {
  await call("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    link_preview_options: { is_disabled: true },
    ...(link ? { reply_markup: { inline_keyboard: [[{ text: link.label, url: link.url }]] } } : {}),
  });
}

/** The bot's @username, for the "Connect Telegram" link. Cached for a day once known. */
export async function botUsername(): Promise<string | null> {
  "use cache";
  if (!env().TELEGRAM_BOT_TOKEN) {
    cacheLife("minutes");
    return null;
  }
  try {
    const me = await call("getMe", {});
    const name =
      me && typeof me === "object" && "username" in me && typeof me.username === "string"
        ? me.username
        : null;
    if (name) cacheLife("days");
    else cacheLife("minutes");
    return name;
  } catch (error) {
    // Retried within minutes, so a brief outage never disables linking for a day.
    cacheLife("minutes");
    log("warn", "telegram.getme_failed", {
      status: error instanceof TelegramError ? error.status : 0,
    });
    return null;
  }
}

/** Raw Bot API call, for the update puller. */
export function telegramCall(method: string, payload: Record<string, unknown>) {
  return call(method, payload);
}

/** Operational alert to the owner's chat (job failures). Never throws. */
export async function alertOwner(text: string) {
  const chat = env().OWNER_TELEGRAM_CHAT_ID;
  if (!chat || !env().TELEGRAM_BOT_TOKEN) return;
  try {
    await sendMessage(chat, `Fundback ${env().APP_ENV}: ${text}`);
  } catch (error) {
    log("error", "telegram.owner_alert_failed", {
      status: error instanceof TelegramError ? error.status : 0,
    });
  }
}
