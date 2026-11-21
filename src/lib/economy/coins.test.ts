import { describe, expect, it } from "vitest";
import { coinsForShare, commissionCents, splitGiveback } from "./coins";

// docs/spec/05-economy.md worked examples: commission = 15% of a $150.00 challenge.
const COMMISSION = commissionCents(15_000, 1_500);
const CAP = 9_500;

describe("economy worked examples", () => {
  it("commission on a $150 challenge at 15% is 2,250 cents", () => {
    expect(COMMISSION).toBe(2_250);
  });

  it("Founding Season: 90% → 2,025 Coins; referral clipped to 5% → 112 Coins", () => {
    const split = splitGiveback({ commissionCents: COMMISSION, baseShareBps: 9_000, seasonOverride: true, referralBps: 1_000, maxTotalBps: CAP });
    expect(split.userCoins).toBe(2_025);
    expect(split.referralShareBps).toBe(500);
    expect(split.referralCoins).toBe(112);
  });

  it("Gold, no booster: 68% → 1,530 Coins; referral 10% → 225 Coins", () => {
    const split = splitGiveback({ commissionCents: COMMISSION, baseShareBps: 6_800, referralBps: 1_000, maxTotalBps: CAP });
    expect(split.userCoins).toBe(1_530);
    expect(split.referralCoins).toBe(225);
  });

  it("Gold with a +5% booster: 73% → 1,642 Coins", () => {
    expect(splitGiveback({ commissionCents: COMMISSION, baseShareBps: 6_800, boosterBps: 500, maxTotalBps: CAP }).userCoins).toBe(1_642);
  });

  it("ignores boosters during a season override", () => {
    expect(
      splitGiveback({ commissionCents: COMMISSION, baseShareBps: 9_000, boosterBps: 500, seasonOverride: true, maxTotalBps: CAP }).userShareBps,
    ).toBe(9_000);
  });

  it("never exceeds the cap, clipping referral before creator", () => {
    const split = splitGiveback({ commissionCents: COMMISSION, baseShareBps: 9_000, seasonOverride: true, referralBps: 1_000, creatorBps: 1_000, maxTotalBps: CAP });
    expect(split.userShareBps + split.referralShareBps + split.creatorShareBps).toBeLessThanOrEqual(CAP);
    expect(split.creatorShareBps).toBe(0);
  });

  it("rejects floats and negatives", () => {
    expect(() => coinsForShare(22.5, 9_000)).toThrow(RangeError);
    expect(() => commissionCents(-1, 1_500)).toThrow(RangeError);
  });
});
