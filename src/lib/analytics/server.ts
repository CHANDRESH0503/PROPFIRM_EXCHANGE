import "server-only";
import { cookies } from "next/headers";
import { PostHog } from "posthog-node";
import { log } from "@/lib/log";
import { publicEnv } from "@/lib/public-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_COOKIE, parseConsent } from "./consent";
import { cleanProps, EVENTS, type AnalyticsEvent, type EventProps } from "./events";

let client: PostHog | null = null;
function posthog() {
  if (!publicEnv.posthogKey) return null;
  client ??= new PostHog(publicEnv.posthogKey, {
    host: publicEnv.posthogHost,
    flushAt: 20,
    flushInterval: 5_000,
  });
  return client;
}

/**
 * Sends one event for a member who agreed to analytics. Never throws and never blocks the
 * action it describes: analytics failing must not fail a check-in or a claim.
 *
 * `consent: "request"` reads the visitor's cookie (the member is making this request);
 * `consent: "profile"` reads the stored choice (staff or a job acted for the member).
 */
export async function track(
  event: AnalyticsEvent,
  userId: string,
  opts: { consent: "request" | "profile"; props?: EventProps },
) {
  const ph = posthog();
  if (!ph || !EVENTS.includes(event)) return;
  try {
    const allowed =
      opts.consent === "request"
        ? parseConsent((await cookies()).get(CONSENT_COOKIE)?.value) === "granted"
        : await profileConsent(userId);
    if (!allowed) return;
    ph.capture({ distinctId: userId, event, properties: cleanProps(opts.props) });
  } catch (error) {
    log("warn", "analytics.track_failed", { event, reason: (error as Error).name });
  }
}

async function profileConsent(userId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("analytics_consent")
    .eq("id", userId)
    .maybeSingle();
  return data?.analytics_consent === true;
}

/** Flushes queued events (call at the end of a job; the server process also flushes on a timer). */
export async function flushAnalytics() {
  try {
    await client?.flush();
  } catch {
    // Dropped analytics are acceptable; never fail the caller.
  }
}
