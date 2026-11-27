import { describe, expect, it } from "vitest";
import { authOrigin } from "./origin";

const SITE = "http://localhost:3000";

describe("authOrigin", () => {
  it("returns the request origin for localhost and private networks in local dev", () => {
    expect(authOrigin(SITE, "local", "172.20.10.3:3000", null)).toBe("http://172.20.10.3:3000");
    expect(authOrigin(SITE, "local", "192.168.1.20:3000", "http")).toBe("http://192.168.1.20:3000");
    expect(authOrigin(SITE, "local", "localhost:3100", null)).toBe("http://localhost:3100");
  });

  it("ignores public or forged hosts, and any host outside local dev", () => {
    expect(authOrigin(SITE, "local", "evil.example", null)).toBe(SITE);
    expect(authOrigin(SITE, "local", "8.8.8.8:3000", null)).toBe(SITE);
    expect(authOrigin(SITE, "local", "172.32.0.1", null)).toBe(SITE);
    expect(authOrigin("https://fundback.example", "production", "192.168.1.20", null)).toBe(
      "https://fundback.example",
    );
    expect(authOrigin("https://fundback.example", "staging", "evil.example", "https")).toBe(
      "https://fundback.example",
    );
  });
});

describe("isSameOrigin", () => {
  it("accepts the site's own origin and refuses others", async () => {
    const { isSameOrigin } = await import("./origin");
    const req = (headers: Record<string, string>) =>
      new Request("https://fundback.example/api/me/export", { method: "POST", headers });
    expect(isSameOrigin(req({ origin: "https://fundback.example" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});
