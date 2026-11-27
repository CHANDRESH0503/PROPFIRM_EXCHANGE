import "server-only";
import { env } from "@/lib/env";
import { sha256Hex, waitlistToken } from "@/lib/crypto";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./email";
import { waitlistConfirmEmail } from "./templates";

export async function drainEmailOutbox(nonce?: string) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("lease_email", { p_limit: nonce ? 1 : 10, p_nonce: nonce });
  if (error) throw new Error("outbox_lease_failed");

  let failed = 0;
  for (const job of data) {
    let sent = false;
    try {
      const { IP_HASH_SALT, NEXT_PUBLIC_SITE_URL } = env();
      const token = waitlistToken(job.nonce, IP_HASH_SALT);
      if (sha256Hex(token) !== job.token_hash) throw new Error("outbox_key_changed");
      const url = new URL("/waitlist/open", NEXT_PUBLIC_SITE_URL);
      url.searchParams.set("token", token);
      const result = await sendEmail({
        ...waitlistConfirmEmail(url.toString()),
        to: job.email,
        template: "waitlist_confirm",
        idempotencyKey: "waitlist:" + job.nonce,
      });
      sent = result.ok;
    } catch {
      log("warn", "outbox.delivery_failed");
    }
    if (!sent) failed++;
    const ack = await db.rpc("finish_email", {
      p_nonce: job.nonce,
      p_lease: job.lease,
      p_sent: sent,
    });
    if (ack.error) throw new Error("outbox_ack_failed");
  }
  return { processed: data.length, failed };
}
