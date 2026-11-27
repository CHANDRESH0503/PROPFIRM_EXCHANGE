import { describe, expect, it } from "vitest";
import { consentCookie, parseConsent } from "./consent";
import { cleanProps } from "./events";

describe("cleanProps", () => {
  it("keeps identifiers and numbers, drops free text and unsafe keys", () => {
    expect(
      cleanProps({
        program: "6f1c2a4e-1b2c-4d5e-8f90-123456789abc",
        coins: 1350,
        mission: "calculator",
        email: "someone@example.com",
        note: "free text with spaces",
        "Bad-Key": "x",
        ratio: Number.NaN,
        sample: false,
      }),
    ).toEqual({
      program: "6f1c2a4e-1b2c-4d5e-8f90-123456789abc",
      coins: 1350,
      mission: "calculator",
      sample: false,
    });
  });
});

describe("consent cookie", () => {
  it("parses only the two known values", () => {
    expect(parseConsent("granted")).toBe("granted");
    expect(parseConsent("denied")).toBe("denied");
    expect(parseConsent("yes")).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });
  it("is first-party, a year long, Lax, and Secure on HTTPS", () => {
    expect(consentCookie("granted", true)).toBe(
      "analytics_consent=granted; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(consentCookie("denied", false)).not.toContain("Secure");
  });
});
