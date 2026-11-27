import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const { safeNext, hasRole } = await import("./session");

describe("safeNext (open-redirect guard)", () => {
  it.each(["/today", "/admin/waitlist?q=a", "/profile#x"])("keeps same-site path %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "today",
  ])("falls back for %s", (p) => {
    expect(safeNext(p)).toBe("/today");
  });
});

describe("hasRole", () => {
  it("treats owner as every role", () => {
    expect(hasRole(["owner"], "finance")).toBe(true);
  });
  it("checks a specific role, or any staff role when none is given", () => {
    expect(hasRole(["support"], "finance")).toBe(false);
    expect(hasRole(["support"], "support")).toBe(true);
    expect(hasRole(["content"])).toBe(true);
    expect(hasRole([])).toBe(false);
  });
});
