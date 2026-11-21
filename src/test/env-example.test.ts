import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * .env.example is committed, so it must only ever hold placeholders. This caught real keys
 * once (21 Nov 2026, blocked by GitHub push protection before leaving the machine).
 */
const ALLOWED: Record<string, string> = {
  APP_ENV: "local",
  NEXT_PUBLIC_APP_ENV: "local",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  CALENDAR_PROVIDER: "fixture",
};

describe(".env.example", () => {
  const lines = readFileSync(".env.example", "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l));

  it.each(lines.map((l) => [l.split("=")[0]!, l]))("%s has no real value", (key, line) => {
    const value = line.slice(line.indexOf("=") + 1).replace(/\s+#.*$/, "").trim();
    expect(value, `${key} must be empty in .env.example`).toBe(ALLOWED[key] ?? "");
  });

  it("contains nothing that looks like a credential", () => {
    const text = readFileSync(".env.example", "utf8");
    expect(text).not.toMatch(/eyJ[\w-]{10,}|GOCSPX-|apps\.googleusercontent\.com|postgres(ql)?:\/\/[^\s]*@|re_[A-Za-z0-9]{16,}|sk_live_/);
  });
});
