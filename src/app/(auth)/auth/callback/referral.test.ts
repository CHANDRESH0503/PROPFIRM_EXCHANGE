import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { INVITE_COOKIE, RETRY_COOKIE, readInvite, sealInvite } from "@/lib/auth/signup-referral";
import { GET } from "./route";

const db = vi.hoisted(() => ({
  exchange: vi.fn(),
  claims: vi.fn(),
  profile: vi.fn(),
  table: { update: vi.fn(), eq: vi.fn(), is: vi.fn(), gte: vi.fn() },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => db.table }) }));
vi.mock("@/lib/env", () => ({ env: () => ({ IP_HASH_SALT: "test signing secret" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: db.exchange, getClaims: db.claims },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: db.profile }) }) }),
  }),
}));
const id = randomUUID(),
  inviter = randomUUID();
const started = Date.now() - 5000;
const account = {
  id,
  created_at: new Date(started + 1000).toISOString(),
  app_metadata: { provider: "google" },
};
function callback() {
  const token = sealInvite({ referrer: inviter, started, recipient: null });
  return GET(
    new NextRequest("https://example.test/auth/callback?code=fixture&next=/wallet", {
      headers: { cookie: INVITE_COOKIE + "=" + token },
    }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  db.exchange.mockResolvedValue({ data: { user: account }, error: null });
  db.claims.mockResolvedValue({ data: { claims: { sub: id } } });
  db.profile.mockResolvedValue({ data: { onboarded_at: null }, error: null });
  db.table.update.mockReturnValue(db.table);
  db.table.eq.mockReturnValue(db.table);
  db.table.is.mockReturnValue(db.table);
  db.table.gte.mockResolvedValue({ error: null });
});
it("attributes only after the verified Google exchange and clears the invite", async () => {
  const response = await callback();
  expect(response.headers.get("location")).toBe("https://example.test/onboarding?next=%2Fwallet");
  expect(db.table.update).toHaveBeenCalledWith({ referred_by: inviter });
  expect(response.cookies.get(INVITE_COOKIE)?.value).toBe("");
  expect(response.cookies.has(RETRY_COOKIE)).toBe(false);
});
it("preserves a recipient-bound retry if the profile write is temporarily unavailable", async () => {
  db.table.gte.mockResolvedValue({ error: { code: "503" } });
  const response = await callback();
  expect(readInvite(response.cookies.get(RETRY_COOKIE)?.value)).toEqual({
    referrer: inviter,
    started,
    recipient: id,
  });
});
it("leaves the referrer unchanged on a returning Google account", async () => {
  db.exchange.mockResolvedValue({
    data: { user: { ...account, created_at: new Date(started - 1000).toISOString() } },
    error: null,
  });
  await callback();
  expect(db.table.update).not.toHaveBeenCalled();
});
