import { describe, expect, it } from "vitest";
import { evaluateGeo, type GeoRule } from "./evaluate";

const INDIA_SEED: GeoRule[] = [
  { country_code: "IN", asset_class: "forex", action: "block", reason: "RBI alert" },
  { country_code: "IN", asset_class: "cfd", action: "block", reason: "RBI alert" },
];

describe("evaluateGeo", () => {
  it("blocks forex and CFD prop offers for India", () => {
    const decision = evaluateGeo(INDIA_SEED, { profileCountry: "IN", ipCountry: null }, ["forex"]);
    expect(decision).toMatchObject({ allowed: false, country: "IN", assetClasses: ["forex"] });
  });

  it("allows futures-only offers in India", () => {
    expect(evaluateGeo(INDIA_SEED, { profileCountry: "IN", ipCountry: "IN" }, ["futures"])).toEqual(
      { allowed: true },
    );
  });

  it("blocks a mixed offer when any of its asset classes is blocked", () => {
    const decision = evaluateGeo(INDIA_SEED, { profileCountry: "IN", ipCountry: null }, [
      "futures",
      "cfd",
    ]);
    expect(decision).toMatchObject({ allowed: false, assetClasses: ["cfd"] });
  });

  it("uses the stricter of declared and observed country", () => {
    expect(
      evaluateGeo(INDIA_SEED, { profileCountry: "GB", ipCountry: "IN" }, ["forex"]).allowed,
    ).toBe(false);
    expect(
      evaluateGeo(INDIA_SEED, { profileCountry: "IN", ipCountry: "GB" }, ["forex"]).allowed,
    ).toBe(false);
  });

  it("allows other countries and unknown location", () => {
    expect(
      evaluateGeo(INDIA_SEED, { profileCountry: "GB", ipCountry: "US" }, ["forex", "cfd"]),
    ).toEqual({ allowed: true });
    expect(evaluateGeo(INDIA_SEED, { profileCountry: null, ipCountry: null }, ["forex"])).toEqual({
      allowed: true,
    });
  });
});
