/**
 * Result of a staff (or member) action that calls a database function. Database refusals carry
 * our own messages; they are mapped to translated keys here, never shown raw.
 */
export type ActionResult = { ok: true; key?: string } | { ok: false; key: ResultKey };

export const RESULT_KEYS = [
  "invalid",
  "limited",
  "forbidden",
  "stale",
  "unavailable",
  "notFound",
  "capReached",
  "needsConfirm",
  "budgetClosed",
  "overBalance",
  "differentReviewer",
  "windowClosed",
  "alreadyDone",
  "notOpen",
  "notEnded",
  "oddsTotal",
  "frozen",
  "tooMany",
] as const;
export type ResultKey = (typeof RESULT_KEYS)[number];

const PATTERNS: [RegExp, ResultKey][] = [
  [/cap reached|cap below/i, "capReached"],
  [/needs confirmation/i, "needsConfirm"],
  [/budget not open/i, "budgetClosed"],
  [/available balance/i, "overBalance"],
  [/different reviewer/i, "differentReviewer"],
  [/window closed/i, "windowClosed"],
  [/already/i, "alreadyDone"],
  [/not open|not pending|only scheduled/i, "notOpen"],
  [/not ended/i, "notEnded"],
  [/add up to 100/i, "oddsTotal"],
  [/frozen/i, "frozen"],
  [/too many/i, "tooMany"],
  [/not found|invalid or expired/i, "notFound"],
];

export function fromDbError(error: { code?: string; message?: string }): ActionResult {
  const message = error.message ?? "";
  for (const [pattern, key] of PATTERNS) if (pattern.test(message)) return { ok: false, key };
  if (error.code === "42501") return { ok: false, key: "forbidden" };
  if (error.code === "40001") return { ok: false, key: "stale" };
  if (error.code === "P0002") return { ok: false, key: "notFound" };
  if (error.code === "22023" || error.code === "23514" || error.code === "23505")
    return { ok: false, key: "invalid" };
  return { ok: false, key: "unavailable" };
}

/** Idempotency key sent by every form (one per form mount; renewed after success). */
export function requestKey(form: FormData) {
  const v = form.get("requestId");
  return typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : null;
}
