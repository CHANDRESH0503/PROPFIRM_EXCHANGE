import { describe, expect, it } from "vitest";
import { rarityFor, sizeLabel } from "./rarity";

describe("rarity", () => {
  it("is fixed by account size bands", () => {
    expect([10_000, 25_000, 50_000, 100_000, 200_000].map(rarityFor)).toEqual([
      "common",
      "common",
      "rare",
      "epic",
      "legendary",
    ]);
    expect(rarityFor(25_001)).toBe("rare");
  });
  it("labels sizes compactly", () => {
    expect([5_000, 50_000, 12_500, 1_000_000, 900].map(sizeLabel)).toEqual([
      "5K",
      "50K",
      "12.5K",
      "1M",
      "900",
    ]);
  });
});
