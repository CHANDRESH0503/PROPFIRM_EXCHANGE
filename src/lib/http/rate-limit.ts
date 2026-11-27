import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

/**
 * Named, durable rate-limit policies (Postgres `rate_limit_hit`, fixed windows).
 * Every mutating route or action uses one of these or is on the tested allowlist
 * (docs/SYSTEM_DESIGN.md §3).
 */
export const POLICIES = {
  waitlistJoinIp: { windowSeconds: 3600, max: 10 },
  waitlistJoinEmail: { windowSeconds: 86_400, max: 3 },
  signInIp: { windowSeconds: 3600, max: 20 },
  signInEmail: { windowSeconds: 3600, max: 5 },
  onboarding: { windowSeconds: 3600, max: 20 },
  checkin: { windowSeconds: 60, max: 12 },
  mission: { windowSeconds: 60, max: 30 },
  inboxWrite: { windowSeconds: 60, max: 45 },
  rewardWrite: { windowSeconds: 60, max: 20 },
  outbound: { windowSeconds: 60, max: 30 },
  journalWrite: { windowSeconds: 60, max: 60 },
  journalUpload: { windowSeconds: 3600, max: 60 },
  journalExport: { windowSeconds: 3600, max: 20 },
  telegram: { windowSeconds: 60, max: 20 },
  telegramWebhook: { windowSeconds: 60, max: 600 },
  telegramCheck: { windowSeconds: 60, max: 30 },
  channelWrite: { windowSeconds: 60, max: 20 },
  supportWrite: { windowSeconds: 3600, max: 30 },
  dataRequest: { windowSeconds: 86_400, max: 5 },
  spin: { windowSeconds: 60, max: 10 },
  memberSupport: { windowSeconds: 60, max: 12 },
  drawEntry: { windowSeconds: 60, max: 10 },
  claimSubmit: { windowSeconds: 3600, max: 12 },
  outboxJob: { windowSeconds: 60, max: 3 },
  dailyJob: { windowSeconds: 3600, max: 3 },
  adminWrite: { windowSeconds: 60, max: 60 },
} as const;

export type Policy = keyof typeof POLICIES;

/**
 * Returns true when allowed. Fails closed: if the limiter cannot be reached, the action is
 * refused, because every limited action is one an attacker would like to repeat.
 */
export async function rateLimit(policy: Policy, subject: string): Promise<boolean> {
  const { windowSeconds, max } = POLICIES[policy];
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: `${policy}:${subject}`.slice(0, 200),
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    log("error", "rate_limit.unavailable", { policy, code: error.code });
    return false;
  }
  return data === true;
}
