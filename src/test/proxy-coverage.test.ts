import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every signed-in route must refresh the session in the proxy. A route missing from the matcher
 * keeps a stale access token, and the member is sent to sign-in as if they had been signed out.
 */
const source = readFileSync("src/proxy.ts", "utf8");
const prefixes = [...source.matchAll(/^\s+"(\/[a-z-]+)",$/gm)].map((m) => m[1]!);
const matcher = [...source.matchAll(/"(\/[a-z-]+)\/:path\*"/g)].map((m) => m[1]!);

const routes = [
  ...readdirSync("src/app/(app)/(shell)", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `/${d.name}`),
  "/onboarding",
  "/admin",
];

describe("proxy covers every signed-in route", () => {
  it.each(routes)("%s", (route) => {
    expect(prefixes, `${route} missing from APP_PREFIXES`).toContain(route);
    expect(matcher, `${route} missing from the proxy matcher`).toContain(route);
  });
});
