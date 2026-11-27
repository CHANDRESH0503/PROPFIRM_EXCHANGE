import { describe, expect, it } from "vitest";
import { hashIp, newToken, sha256Hex } from "./crypto";

describe("crypto helpers", () => {
  it("makes 43-character base64url tokens that do not repeat", () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
  });

  it("hashes IPs with a salt that rotates monthly", () => {
    const nov = new Date("2026-11-21T00:00:00Z");
    const dec = new Date("2026-12-01T00:00:00Z");
    expect(hashIp("203.0.113.9", "salt", nov)).toBe(hashIp("203.0.113.9", "salt", nov));
    expect(hashIp("203.0.113.9", "salt", nov)).not.toBe(hashIp("203.0.113.9", "salt", dec));
    expect(hashIp("203.0.113.9", "salt", nov)).not.toBe(hashIp("203.0.113.9", "other", nov));
    expect(hashIp("203.0.113.9", "salt", nov)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sha256Hex matches a known vector", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
