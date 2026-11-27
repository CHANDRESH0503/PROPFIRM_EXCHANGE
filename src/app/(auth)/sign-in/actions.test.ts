import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { signIn } from "./actions";
import { bindGoogleInvite, INVITE_COOKIE } from "@/lib/auth/signup-referral";

const mocks = vi.hoisted(() => ({
  otp: vi.fn(),
  oauth: vi.fn(),
  lookup: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }) }),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { signInWithOtp: mocks.otp, signInWithOAuth: mocks.oauth } }),
}));
vi.mock("@/lib/http/request", () => ({ requestMeta: async () => ({ ip: null }) }));
vi.mock("@/lib/http/rate-limit", () => ({ rateLimit: async () => true }));
vi.mock("@/lib/http/turnstile", () => ({ verifyTurnstile: async () => "ok" }));
vi.mock("@/lib/env", () => ({
  env: () => ({
    IP_HASH_SALT: "test secret",
    NEXT_PUBLIC_SITE_URL: "https://example.test",
    APP_ENV: "staging",
  }),
}));
vi.mock("@/lib/flags", () => ({ isEnabled: async () => true }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: mocks.cookie }),
}));

const inviter = randomUUID();
function submit(code: string, google = false) {
  const form = new FormData();
  form.set("email", "trader@example.test");
  form.set("ref", code);
  if (google) form.set("provider", "google");
  return signIn({ status: "idle" }, form);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue({ data: { id: inviter }, error: null });
  mocks.otp.mockResolvedValue({ error: null });
  mocks.oauth.mockResolvedValue({ data: { url: "https://accounts.example.test" }, error: null });
});
it("passes the normalized member code to new email accounts and accepts a blank code", async () => {
  expect((await submit(" abc123 ")).status).toBe("sent");
  expect(mocks.otp.mock.calls[0]![0].options.data).toEqual({ ref: "ABC123" });
  expect((await submit("")).status).toBe("sent");
  expect(mocks.otp.mock.calls[1]![0].options.data).toBeUndefined();
});
it.each([false, true])(
  "identifies unknown codes before starting authentication (Google %s)",
  async (google) => {
    mocks.lookup.mockResolvedValue({ data: null, error: null });
    expect(await submit("UNKNOWN9", google)).toEqual({ status: "error", code: "invalid_ref" });
    expect(mocks.otp).not.toHaveBeenCalled();
    expect(mocks.oauth).not.toHaveBeenCalled();
  },
);
it("starts Google with a signed invite, and clears any previous invite for a blank code", async () => {
  await expect(submit("ABC123", true)).rejects.toThrow(/NEXT_REDIRECT/);
  const [name, token, options] = mocks.cookie.mock.calls[0]!;
  expect(name).toBe(INVITE_COOKIE);
  expect(options).toMatchObject({
    path: "/auth/callback",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  expect(
    bindGoogleInvite(token, {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      app_metadata: { provider: "google" },
    })?.referrer,
  ).toBe(inviter);
  await expect(submit("", true)).rejects.toThrow(/NEXT_REDIRECT/);
  expect(mocks.cookie.mock.calls[1]!.slice(0, 2)).toEqual([INVITE_COOKIE, ""]);
});
