/**
 * The analytics events we send (13-seo-analytics.md). Anything not listed is refused, so no code
 * path can invent an event or attach free text. Properties are limited to small identifiers and
 * numbers: never emails, names, order references or journal content.
 */
export const EVENTS = [
  "signup",
  "checkin",
  "mission_completed",
  "outbound_click",
  "claim_submitted",
  "claim_confirmed",
  "coins_released",
  "redemption_requested",
  "redemption_fulfilled",
  "referral_converted",
] as const;
export type AnalyticsEvent = (typeof EVENTS)[number];

export type EventProps = Record<string, string | number | boolean | null>;

const SAFE_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const SAFE_TEXT = /^[A-Za-z0-9_.:-]{0,64}$/;

/** Keeps only short, safe identifier or numeric properties. */
export function cleanProps(props: EventProps = {}): EventProps {
  const out: EventProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (!SAFE_KEY.test(k)) continue;
    if (typeof v === "string" && !SAFE_TEXT.test(v)) continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}
