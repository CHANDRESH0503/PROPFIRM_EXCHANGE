import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "./types";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
const getUserById = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, auth: { admin: { getUserById } } }),
}));
const sendEmail = vi.fn();
vi.mock("@/lib/notifications/email", () => ({ sendEmail: (m: unknown) => sendEmail(m) }));
vi.mock("@/lib/public-env", () => ({ publicEnv: { siteUrl: "https://example.test" } }));
const events: CalendarEvent[] = [
  {
    id: "nfp",
    currency: "USD",
    title: "Sample jobs report",
    impact: "high",
    scheduledAt: "2026-11-23T13:30:00Z",
    forecast: "180K",
    previous: "150K",
    actual: null,
  },
];
vi.mock("./provider", () => ({
  calendarProvider: () => ({ name: "fixture", licensed: false, events: async () => events }),
}));

const { runCalendarDigests } = await import("./digest-job");

const member = (id: string, currencies: string[]) => ({
  user_id: id,
  local_day: "2026-11-23",
  timezone: "Europe/London",
  currencies,
});

describe("runCalendarDigests", () => {
  beforeEach(() => {
    rpc.mockReset();
    sendEmail.mockReset().mockResolvedValue({ ok: true });
    getUserById.mockReset().mockImplementation(async (id: string) => ({
      data: { user: { email: `${id}@example.test` } },
    }));
  });

  it("claims each day before sending, skips empty days and runs claimed by another worker", async () => {
    rpc.mockImplementation(async (name: string, args: { p_user?: string }) => {
      if (name === "due_calendar_digests")
        return {
          data: [member("a", ["USD"]), member("b", ["JPY"]), member("c", ["USD"])],
          error: null,
        };
      if (name === "mark_calendar_digest_sent") return { data: args.p_user !== "c", error: null }; // c was claimed elsewhere
      throw new Error("unexpected rpc " + name);
    });
    const result = await runCalendarDigests(new Date("2026-11-23T08:00:00Z"));
    expect(result).toEqual({ sent: 1, empty: 1, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0]![0] as Record<string, string>;
    expect(mail).toMatchObject({
      to: "a@example.test",
      template: "calendar_digest",
      idempotencyKey: "digest:a:2026-11-23",
    });
    expect(mail.text).toContain("13:30 · USD · Sample jobs report");
    expect(mail.text).toContain("fictional sample events");
    // Claim happens before the send.
    const claimOrder = rpc.mock.invocationCallOrder[1]!;
    expect(claimOrder).toBeLessThan(sendEmail.mock.invocationCallOrder[0]!);
  });

  it("does nothing when nobody is due, and reports failed sends", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await runCalendarDigests()).toEqual({ sent: 0, empty: 0, failed: 0 });

    rpc.mockImplementation(async (name: string) =>
      name === "due_calendar_digests"
        ? { data: [member("a", ["USD"])], error: null }
        : { data: true, error: null },
    );
    sendEmail.mockResolvedValue({ ok: false, reason: "provider_error" });
    expect(await runCalendarDigests(new Date("2026-11-23T08:00:00Z"))).toEqual({
      sent: 0,
      empty: 0,
      failed: 1,
    });
  });
});
