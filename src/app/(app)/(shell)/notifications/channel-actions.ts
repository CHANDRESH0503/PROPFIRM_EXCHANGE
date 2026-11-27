"use server";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { botUsername } from "@/lib/telegram/bot";
import { hashCode } from "@/lib/telegram/commands";
import { pullUpdates } from "@/lib/telegram/updates";

export type TelegramLink = {
  /** t.me deep link: opens the Telegram app where it is installed. */
  app: string;
  /** Telegram Web, for computers without the app (Safari cannot open tg:// links otherwise). */
  web: string;
  /** QR code of the app link, to finish on a phone. PNG data URL. */
  qr: string;
  /** What to send the bot by hand if no link opens. */
  command: string;
  bot: string;
};

export type ChannelResult =
  { ok: true; link?: TelegramLink } | { ok: false; code: "limited" | "failed" | "unavailable" };

/** Issues a one-time code and returns the t.me deep link that carries it to the bot. */
export async function connectTelegram(): Promise<ChannelResult> {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("channelWrite", user.id))) return { ok: false, code: "limited" };
  const username = await botUsername();
  if (!username) return { ok: false, code: "unavailable" };
  const code = randomBytes(24).toString("base64url");
  const { error } = await createAdminClient().rpc("telegram_issue_code", {
    p_user: user.id,
    p_hash: hashCode(code),
  });
  if (error) return { ok: false, code: "failed" };
  const app = `https://t.me/${username}?start=${code}`;
  const web = `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(`tg://resolve?domain=${username}&start=${code}`)}`;
  const qr = await QRCode.toDataURL(app, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { ok: true, link: { app, web, qr, command: `/start ${code}`, bot: username } };
}

export async function disconnectTelegram(): Promise<ChannelResult> {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("channelWrite", user.id))) return { ok: false, code: "limited" };
  const { error } = await createAdminClient().rpc("telegram_unlink", { p_user: user.id });
  if (error) return { ok: false, code: "failed" };
  revalidatePath("/notifications");
  return { ok: true };
}

const subscription = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(raw: unknown): Promise<ChannelResult> {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("channelWrite", user.id))) return { ok: false, code: "limited" };
  const parsed = subscription.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "failed" };
  const { error } = await createAdminClient().rpc("push_subscribe", {
    p_user: user.id,
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  return error ? { ok: false, code: "failed" } : { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ChannelResult> {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("channelWrite", user.id))) return { ok: false, code: "limited" };
  if (!z.url().max(1000).safeParse(endpoint).success) return { ok: false, code: "failed" };
  const { error } = await createAdminClient().rpc("push_unsubscribe", {
    p_user: user.id,
    p_endpoint: endpoint,
  });
  return error ? { ok: false, code: "failed" } : { ok: true };
}

/**
 * Polled by the page after "Connect Telegram": handles pending bot messages (when no webhook is
 * registered) and reports whether this member is now linked.
 */
export async function checkTelegramLink(): Promise<{ linked: boolean }> {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("telegramCheck", user.id))) return { linked: false };
  await pullUpdates();
  const { data } = await createAdminClient()
    .from("telegram_links")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data) revalidatePath("/notifications");
  return { linked: Boolean(data) };
}
