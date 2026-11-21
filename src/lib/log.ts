import "server-only";

/**
 * One structured logger. JSON lines on stdout, collected by Docker on the VPS.
 * Rule: log ids and fixed reason codes only. Never emails, IPs, tokens, receipts, journal
 * content or request bodies (docs/SYSTEM_DESIGN.md §7).
 */
type Level = "debug" | "info" | "warn" | "error";
type Field = string | number | boolean | null | undefined;

const SECRET_KEYS = /email|token|password|secret|^ip$|ip_?hash|cookie|authorization/i;

export function log(level: Level, code: string, fields: Record<string, Field> = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const safe: Record<string, Field> = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = SECRET_KEYS.test(key) ? "[redacted]" : value;
  }
  // `event` is written last so a field can never overwrite it (fields often carry a DB `code`).
  const line = JSON.stringify({ t: new Date().toISOString(), level, ...safe, event: code });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

/** Reduce an unknown error to a safe, loggable shape (no message text from user input). */
export function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; name?: unknown };
    if (typeof e.code === "string") return e.code;
    if (typeof e.name === "string") return e.name;
  }
  return "unknown";
}
