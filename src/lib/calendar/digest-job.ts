import "server-only";
import { log } from "@/lib/log";
import { sendEmail } from "@/lib/notifications/email";
import { calendarDigestEmail } from "@/lib/notifications/templates";
import { publicEnv } from "@/lib/public-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { digestEvents } from "./digest";
import { calendarProvider } from "./provider";

const DAY = 86_400_000;

/**
 * Sends today's digest to every member whose chosen hour has arrived. Each member's day is
 * recorded before sending, so a digest goes out at most once a day even if runs overlap; the
 * email idempotency key covers a retried send. A day with no matching events sends nothing.
 */
export async function runCalendarDigests(now = new Date()) {
  const db = createAdminClient();
  const due = await db.rpc("due_calendar_digests", { p_now: now.toISOString() });
  if (due.error) throw new Error("digest_due_failed:" + due.error.code);
  if (!due.data.length) return { sent: 0, empty: 0, failed: 0 };

  const provider = calendarProvider();
  // Two days either side covers every member's local "today".
  const events = await provider.events(
    new Date(now.getTime() - 2 * DAY),
    new Date(now.getTime() + 2 * DAY),
  );
  const calendarUrl = new URL("/economic-calendar", publicEnv.siteUrl).toString();
  let sent = 0,
    empty = 0,
    failed = 0;

  for (const member of due.data) {
    const claimed = await db.rpc("mark_calendar_digest_sent", {
      p_user: member.user_id,
      p_day: member.local_day,
    });
    if (claimed.error || !claimed.data) continue;
    const today = digestEvents(events, {
      currencies: member.currencies,
      localDay: member.local_day,
      timezone: member.timezone,
    });
    if (!today.length) {
      empty += 1;
      continue;
    }
    const { data } = await db.auth.admin.getUserById(member.user_id);
    const to = data.user?.email;
    if (!to) continue;
    const date = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${member.local_day}T12:00:00Z`));
    const result = await sendEmail({
      ...calendarDigestEmail({
        date,
        zone: member.timezone,
        currencies: member.currencies,
        licensed: provider.licensed,
        events: today,
        calendarUrl,
      }),
      to,
      template: "calendar_digest",
      idempotencyKey: `digest:${member.user_id}:${member.local_day}`,
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }
  if (failed) log("warn", "digest.send_failed", { failed });
  return { sent, empty, failed };
}
