import { describe, expect, it } from "vitest";
import { Regime, dec, type DecString } from "@kerb/types";
import { WrapperNotSupported, assertSupportedWrapper, collateralValue, computeMark, type MarkConfig, type MarkInput } from "../src/mark.js";

const cfg: MarkConfig = {
  stalenessMaxSec: 300,
  dispersionMax: "0.02" as DecString,
  hDispersion: "0.5" as DecString,
  bandRegime: "0.01" as DecString,
  twapWindowSec: 900,
  regimeHaircut: { DEEP: "0", NORMAL: "0.0025", THIN: "0.0075", REFERENCE_CLOSED: "0.015", DEFAULT: "0.0075" } as unknown as Record<string, DecString>,
};

const base = (over: Partial<MarkInput> = {}): MarkInput => ({
  references: [
    { source: "xstocks:price-data", value: "100" as DecString, currency: "USD", observedAt: "t", ageSec: 10, contentHash: "0x1" },
    { source: "yahoo:chart:KO", value: "102" as DecString, currency: "USD", observedAt: "t", ageSec: 20, contentHash: "0x2" },
  ],
  fx: [],
  pool: { pool: "0xpool", spot: "101" as DecString, twap: null, quoteToken: "USDG", ageSec: 30, contentHash: "0x3" },
  wrapper: { address: "0xw", version: "v2", assetsPerShare: "1" as DecString, contentHash: "0x4" },
  regime: Regime.NORMAL,
  regimeName: "NORMAL",
  cfg,
  ...over,
});

describe("Credit Mark (KTS-0.1 section 6)", () => {
  it("takes the median reference and the conservative min(reference, pool)", () => {
    const m = computeMark(base());
    expect(m.reference.value).toBe("101");
    expect(m.pool.value).toBe("101");
    expect(dec(m.creditMark).lte(dec("101"))).toBe(true);
  });

  it("uses the pool price when it is below the reference", () => {
    const m = computeMark(base({ pool: { pool: "0xpool", spot: "90" as DecString, twap: null, quoteToken: "USDG", ageSec: 5, contentHash: "0x3" } }));
    // dispersion = |101-90|/101 = 0.1089 > 0.02, so the guard fires and the base is the pool price.
    expect(m.dispersionBreach).toBe(true);
    expect(dec(m.band[1])).toEqual(dec("90"));
  });

  it("prefers the TWAP over spot when the pool has one", () => {
    const m = computeMark(base({ pool: { pool: "0xp", spot: "101" as DecString, twap: { windowSec: 900, price: "100.5" as DecString }, quoteToken: "USDG", ageSec: 5, contentHash: "0x3" } }));
    expect(m.pool.basis).toBe("twap");
    expect(m.pool.value).toBe("100.5");
    expect(m.pool.twapWindowSec).toBe(900);
  });

  it("divides the pool price by the wrapper exchange rate to price the asset token", () => {
    const m = computeMark(base({ wrapper: { address: "0xw", version: "v2", assetsPerShare: "1.02" as DecString, contentHash: "0x4" } }));
    expect(dec(m.pool.value).toDecimalPlaces(6).toString()).toBe(dec("101").div(dec("1.02")).toDecimalPlaces(6).toString());
  });

  it("excludes stale references and says why", () => {
    const m = computeMark(base({
      references: [
        { source: "fresh", value: "100" as DecString, currency: "USD", observedAt: "t", ageSec: 10, contentHash: "0x1" },
        { source: "old", value: "1" as DecString, currency: "USD", observedAt: "t", ageSec: 9_999, contentHash: "0x2" },
      ],
    }));
    expect(m.reference.value).toBe("100");
    expect(m.reference.excluded[0]).toMatchObject({ source: "old" });
    expect(m.reference.excluded[0]?.reason).toMatch(/^stale/);
  });

  it("converts a non-USD reference with a fresh FX observation", () => {
    const m = computeMark(base({
      references: [{ source: "yahoo:chart:0388.HK", value: "390" as DecString, currency: "HKD", observedAt: "t", ageSec: 10, contentHash: "0x1" }],
      fx: [{ source: "yahoo:chart:HKD=X", perUsd: "7.8" as DecString, currency: "HKD", ageSec: 10, contentHash: "0x5" }],
      pool: { pool: "0xp", spot: "50" as DecString, twap: null, quoteToken: "USDG", ageSec: 5, contentHash: "0x3" },
    }));
    expect(m.reference.value).toBe("50");
    expect(m.reference.sources).toContain("yahoo:chart:HKD=X");
  });

  it("excludes a non-USD reference when FX is missing or stale, rather than guessing a rate", () => {
    const input = base({
      references: [
        { source: "hk", value: "390" as DecString, currency: "HKD", observedAt: "t", ageSec: 10, contentHash: "0x1" },
        { source: "usd", value: "50" as DecString, currency: "USD", observedAt: "t", ageSec: 10, contentHash: "0x9" },
      ],
      fx: [{ source: "old-fx", perUsd: "7.8" as DecString, currency: "HKD", ageSec: 9_999, contentHash: "0x5" }],
      pool: { pool: "0xp", spot: "50" as DecString, twap: null, quoteToken: "USDG", ageSec: 5, contentHash: "0x3" },
    });
    const m = computeMark(input);
    expect(m.reference.value).toBe("50");
    expect(m.reference.excluded[0]?.reason).toBe("no fresh FX for HKD");
  });

  it("fails loudly when no reference is fresh", () => {
    expect(() => computeMark(base({ references: [{ source: "old", value: "100" as DecString, currency: "USD", observedAt: "t", ageSec: 9_999, contentHash: "0x1" }] }))).toThrow(/no fresh reference/);
  });

  it("applies a bigger haircut in a weaker regime", () => {
    const deep = computeMark(base({ regimeName: "DEEP" }));
    const closed = computeMark(base({ regimeName: "REFERENCE_CLOSED" }));
    expect(dec(closed.haircut).gt(dec(deep.haircut))).toBe(true);
    expect(dec(closed.creditMark).lt(dec(deep.creditMark))).toBe(true);
  });

  it("labels every component and records the quote assumption", () => {
    const m = computeMark(base());
    expect(m.reference.label).toBe("Observed");
    expect(m.pool.label).toBe("Observed");
    expect(m.quoteAssumption).toContain("USDG");
  });
});

describe("wrapper handling", () => {
  it("values collateral as convertToAssets(shares) * CreditMark", () => {
    expect(collateralValue("10" as DecString, { address: "0xw", version: "v2", assetsPerShare: "1.02" as DecString }, "100" as DecString)).toBe("1020");
  });

  it("rejects a legacy v1 wrapper", () => {
    expect(() => assertSupportedWrapper({ address: "0xold", version: "v1" })).toThrow(WrapperNotSupported);
    expect(() => collateralValue("1" as DecString, { address: "0xold", version: "v1", assetsPerShare: "1" as DecString }, "100" as DecString)).toThrow(/only v2 is supported/);
  });

  it("rejects a non-positive wrapper exchange rate instead of dividing by it", () => {
    expect(() => computeMark(base({ wrapper: { address: "0xw", version: "v2", assetsPerShare: "0" as DecString, contentHash: "0x4" } }))).toThrow(/wrapper exchange rate/);
  });
});
