import { describe, expect, it } from "vitest";
import { parseRequestMeta } from "./request";

const h = (init: Record<string, string>) => new Headers(init);

describe("parseRequestMeta", () => {
  it("prefers Cloudflare's connecting IP over X-Forwarded-For", () => {
    const meta = parseRequestMeta(h({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1, 10.0.0.1" }));
    expect(meta.ip).toBe("203.0.113.9");
  });

  it("falls back to the first X-Forwarded-For hop and rejects garbage", () => {
    expect(parseRequestMeta(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })).ip).toBe("198.51.100.1");
    expect(parseRequestMeta(h({ "x-forwarded-for": "<script>" })).ip).toBeNull();
    expect(parseRequestMeta(h({ "cf-connecting-ip": "2001:db8::1" })).ip).toBe("2001:db8::1");
  });

  it("normalises the Cloudflare country and drops unknown and Tor", () => {
    expect(parseRequestMeta(h({ "cf-ipcountry": "in" })).ipCountry).toBe("IN");
    expect(parseRequestMeta(h({ "cf-ipcountry": "XX" })).ipCountry).toBeNull();
    expect(parseRequestMeta(h({ "cf-ipcountry": "T1" })).ipCountry).toBeNull();
    expect(parseRequestMeta(h({})).ipCountry).toBeNull();
  });

  it("keeps an incoming request id or makes one", () => {
    expect(parseRequestMeta(h({ "x-request-id": "abc" })).requestId).toBe("abc");
    expect(parseRequestMeta(h({})).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
