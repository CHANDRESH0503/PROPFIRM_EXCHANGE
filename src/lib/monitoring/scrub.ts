import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Strips personal data from every Sentry event before it leaves the process (browser or server).
 * We keep the user id only (18-data-and-operations.md §7). Emails, IPs, tokens, cookies, query
 * strings and request bodies never leave.
 */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TOKENISH = /\b(?:token|token_hash|code|ref|access_token|refresh_token)=[^&\s#]+/gi;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

export function scrubText(value: string): string {
  return value
    .replace(JWT, "[jwt]")
    .replace(EMAIL, "[email]")
    .replace(TOKENISH, (m) => `${m.split("=")[0]}=[redacted]`);
}

function stripQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined;

  if (event.request) {
    const { url, method } = event.request;
    event.request = { method, url: url ? stripQuery(url) : undefined };
  }

  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .filter((b) => b.category !== "ui.input" && b.category !== "console")
      .map((b) => ({
        ...b,
        message: b.message ? scrubText(b.message) : b.message,
        data: b.data?.url ? { ...b.data, url: stripQuery(String(b.data.url)) } : undefined,
      }));
  }

  delete event.extra;
  if (event.contexts) delete event.contexts.cookies;
  return event;
}
