import "server-only";
import { WebPushError, sendNotification, setVapidDetails } from "web-push";
import { env } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";

/** Web push with VAPID. The subject is the site URL, so no personal address is sent to push services. */

let configured: boolean | null = null;

export function pushConfigured() {
  if (configured !== null) return configured;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = env();
  configured = Boolean(pub && priv);
  if (configured) setVapidDetails(publicEnv.siteUrl, pub!, priv!);
  return configured;
}

export function vapidPublicKey() {
  return env().VAPID_PUBLIC_KEY ?? null;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Sends one push. Returns "gone" when the browser has dropped the subscription. */
export async function sendPush(
  target: PushTarget,
  payload: { title: string; body: string; url: string },
) {
  if (!pushConfigured()) return "skipped" as const;
  try {
    await sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: "normal", timeout: 8_000 },
    );
    return "sent" as const;
  } catch (error) {
    const status = error instanceof WebPushError ? error.statusCode : 0;
    return status === 404 || status === 410 ? ("gone" as const) : ("failed" as const);
  }
}
