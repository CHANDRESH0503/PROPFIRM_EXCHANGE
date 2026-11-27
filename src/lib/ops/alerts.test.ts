import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/telegram/bot", () => ({ alertOwner: vi.fn() }));

const { describeAlert } = await import("./alerts");

describe("describeAlert", () => {
  it("states the figure and where to act", () => {
    expect(describeAlert("liability", { ratio: "1.0421" }, "opened")).toBe(
      "alert: Coin liability ratio is 1.042 (limit 1.0). Outstanding Coins exceed confirmed commission. See Finance.",
    );
    expect(
      describeAlert("low_stock", { name: "10K voucher", remaining: 2, threshold: 5 }, "opened"),
    ).toBe("alert: Low voucher stock for 10K voucher: 2 left (threshold 5). See Rewards.");
    expect(describeAlert("claims_waiting", { count: 3 }, "opened")).toContain("3 claim(s)");
  });

  it("reports recovery and tolerates malformed detail", () => {
    expect(describeAlert("redemption_overdue", null, "resolved")).toBe(
      "resolved: No queued redemption is past its target.",
    );
    expect(describeAlert("low_stock", "garbage", "opened")).toContain("a reward");
  });
});
