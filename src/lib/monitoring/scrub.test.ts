import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubEvent, scrubText } from "./scrub";

describe("Sentry scrubbing", () => {
  it("removes emails, JWTs and tokens from text", () => {
    const out = scrubText("fail for a.b@ex.com token=abc123&x=1 bearer eyJhbGciOi.eyJzdWIi.sig_-x");
    expect(out).not.toMatch(/a\.b@ex\.com|abc123|eyJhbGciOi/);
    expect(out).toContain("[email]");
    expect(out).toContain("token=[redacted]");
    expect(out).toContain("[jwt]");
  });

  it("keeps only the user id, the path and method, and drops bodies, cookies, extras and input crumbs", () => {
    const event = {
      user: { id: "u1", email: "x@y.co", ip_address: "1.2.3.4" },
      request: {
        url: "https://fundback.example/waitlist/open?token=secret",
        method: "GET",
        cookies: { sb: "x" },
        data: { email: "x@y.co" },
        headers: { cookie: "sb=x" },
        query_string: "token=secret",
      },
      message: "boom for x@y.co",
      exception: { values: [{ type: "Error", value: "join failed for z@w.io" }] },
      breadcrumbs: [
        { category: "ui.input", message: "typed x@y.co" },
        { category: "fetch", data: { url: "/api/x?code=abc" } },
      ],
      extra: { body: "secret" },
      contexts: { cookies: { a: 1 } },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event)!;
    expect(out.user).toEqual({ id: "u1" });
    expect(out.request).toEqual({ method: "GET", url: "https://fundback.example/waitlist/open" });
    expect(out.message).toBe("boom for [email]");
    expect(out.exception?.values?.[0]?.value).toBe("join failed for [email]");
    expect(out.breadcrumbs).toHaveLength(1);
    expect(out.breadcrumbs?.[0]?.data).toEqual({ url: "/api/x" });
    expect(out.extra).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(/x@y\.co|secret|1\.2\.3\.4|abc/);
  });
});
