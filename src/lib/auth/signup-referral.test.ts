import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { applySignupInvite, bindGoogleInvite, readInvite, sealInvite } from "./signup-referral";

const { from, table } = vi.hoisted(() => ({
  from: vi.fn(),
  table: { update: vi.fn(), eq: vi.fn(), is: vi.fn(), gte: vi.fn() },
}));
vi.mock("@/lib/env", () => ({ env: () => ({ IP_HASH_SALT: "test signing key" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
const started = Date.now() - 1000;
const raw = { referrer: randomUUID(), recipient: null, started };
const account = {
  id: randomUUID(),
  created_at: new Date(started + 500).toISOString(),
  app_metadata: { provider: "google" },
};
beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue(table);
  table.update.mockReturnValue(table);
  table.eq.mockReturnValue(table);
  table.is.mockReturnValue(table);
  table.gte.mockResolvedValue({ error: null });
});
it("binds a signed invite only to a new Google account", () => {
  const value = sealInvite(raw);
  expect(bindGoogleInvite(value, account)).toEqual({ ...raw, recipient: account.id });
  expect(
    bindGoogleInvite(value, { ...account, created_at: new Date(started - 1).toISOString() }),
  ).toBeNull();
  expect(bindGoogleInvite(value, { ...account, app_metadata: { provider: "email" } })).toBeNull();
  expect(bindGoogleInvite(value, { ...account, id: raw.referrer })).toBeNull();
  expect(bindGoogleInvite(sealInvite({ ...raw, recipient: account.id }), account)).toBeNull();
  expect(readInvite(value, started + 3600001)).toBeNull();
  const tampered =
    Buffer.from(JSON.stringify({ ...raw, started: started - 1000000 })).toString("base64url") +
    "." +
    value.split(".")[1];
  expect(bindGoogleInvite(tampered, account)).toBeNull();
});
it("restricts assignment to an unassigned, unonboarded recipient and allows safe retries", async () => {
  const bound = bindGoogleInvite(sealInvite(raw), account)!;
  await applySignupInvite(bound, randomUUID());
  expect(from).not.toHaveBeenCalled();
  await applySignupInvite(bound, account.id);
  expect(table.update).toHaveBeenCalledWith({ referred_by: raw.referrer });
  expect(table.eq).toHaveBeenCalledWith("id", account.id);
  expect(table.is.mock.calls).toEqual([
    ["referred_by", null],
    ["onboarded_at", null],
  ]);
  expect(table.gte).toHaveBeenCalledWith("created_at", new Date(started).toISOString());
});
