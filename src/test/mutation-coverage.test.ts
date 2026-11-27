import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every Server Action file and every mutating Route Handler must either apply a rate-limit
 * policy (or a staff gate that does) or be on this allowlist with a reason
 * (docs/SYSTEM_DESIGN.md §3, task B1). A new endpoint without one fails here.
 */
const ALLOWLIST: Record<string, string> = {
  "src/app/api/webhooks/resend/route.ts":
    "Provider signature and timestamp verified before idempotent suppression writes",
  "src/app/(auth)/auth/sign-out/route.ts":
    "ends the caller's own session; same-origin check; no state to abuse",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk("src/app").map((f) => f.split(path.sep).join("/"));

describe("mutation endpoints are rate-limited or allowlisted", () => {
  const actionFiles = files.filter(
    (f) => /\.(ts|tsx)$/.test(f) && readFileSync(f, "utf8").startsWith('"use server"'),
  );
  const mutatingRoutes = files.filter(
    (f) =>
      f.endsWith("route.ts") &&
      /export (async )?function (POST|PUT|PATCH|DELETE)/.test(readFileSync(f, "utf8")),
  );

  it("finds the endpoints", () => {
    expect(actionFiles.length).toBeGreaterThan(0);
  });

  it.each(actionFiles)("%s", (file) => {
    const src = readFileSync(file, "utf8");
    const exported = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]!);
    for (const name of exported) {
      if (ALLOWLIST[`${file}#${name}`]) continue;
      const body = src.slice(src.indexOf(`export async function ${name}`));
      const next = body.slice(1).search(/\nexport /);
      const fn = next === -1 ? body : body.slice(0, next + 1);
      expect(fn, `${file}#${name} has no rateLimit() call`).toMatch(/rateLimit\(/);
    }
  });

  it.each(mutatingRoutes.length ? mutatingRoutes : ["(none)"])("%s", (file) => {
    if (file === "(none)" || ALLOWLIST[file]) return;
    expect(readFileSync(file, "utf8"), `${file} has no rateLimit() call`).toMatch(/rateLimit\(/);
  });
});
