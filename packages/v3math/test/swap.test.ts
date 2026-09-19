import { describe, expect, it } from "vitest";
import { Decimal } from "@kerb/types";
import { swapExactIn, type PoolState } from "../src/swap.js";
import { sqrtRatioAtTick } from "../src/core.js";
import { loadFixtures, venue } from "./fixtures.js";

const fixtures = loadFixtures();
const cases = fixtures.flatMap((f) => f.quoterV2.filter((q) => !q.error).map((q) => ({ f, q })));

function state(f: (typeof fixtures)[number]): PoolState {
  const v = venue(f);
  return {
    sqrtPriceX96: BigInt(v.sqrtPriceX96), tick: v.tick, liquidity: BigInt(v.liquidity), fee: v.fee, tickSpacing: v.tickSpacing,
    ticks: v.ticks.map((t) => ({ tick: t.tick, liquidityNet: BigInt(t.liquidityNet) })), words: v.bitmapWords,
  };
}

describe("swapExactIn reproduces QuoterV2 at the captured block", () => {
  it("has at least two real pool fixtures and many quotes", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(2);
    expect(cases.length).toBeGreaterThanOrEqual(100);
  });

  it.each(cases.map(({ f, q }) => [f.label, q.zeroForOne ? `${f.symbol0}->${f.symbol1}` : `${f.symbol1}->${f.symbol0}`, q.amountIn, f, q] as const))(
    "%s %s amountIn=%s",
    (_label, _dir, _amt, f, q) => {
      const r = swapExactIn(state(f), q.zeroForOne, BigInt(q.amountIn));
      if (r.exhausted) {
        // The quoter walked beyond our observed words; the sim must say so rather than guess.
        expect(r.exhaustedReason).toBe("observed_range_end");
        return;
      }
      const expected = BigInt(q.amountOut);
      // Acceptance: within 1 basis point. In practice the integer port matches to the wei.
      const diff = r.amountOut > expected ? r.amountOut - expected : expected - r.amountOut;
      if (expected > 0n) expect(new Decimal(diff.toString()).div(expected.toString()).lte("0.0001")).toBe(true);
      expect(r.amountOut).toBe(expected);
      expect(r.sqrtPriceX96After.toString()).toBe(q.sqrtPriceX96After);
    },
  );
});

describe("edge pools (synthetic states derived from real fixtures)", () => {
  const base = state(fixtures.find((f) => f.label === "KOx/USDG")!);

  it("zero-liquidity pool: nothing fills, exhausted at the observed range", () => {
    const empty: PoolState = { ...base, liquidity: 0n, ticks: [] };
    const r = swapExactIn(empty, true, 10n ** 18n);
    expect(r.amountOut).toBe(0n);
    expect(r.exhausted).toBe(true);
    expect(r.exhaustedReason).toBe("observed_range_end");
  });

  it("single initialised tick: liquidity ends at that tick and the rest does not fill", () => {
    // One position: active liquidity L from the current price down to a single initialised tick below.
    const spacing = base.tickSpacing;
    const lower = Math.floor(base.tick / spacing) * spacing - 5 * spacing;
    const L = 10n ** 18n;
    const single: PoolState = { ...base, liquidity: L, ticks: [{ tick: lower, liquidityNet: L }] };
    // token0 is USDG (6 decimals) in this pool: sell 1 USDG, then an absurd amount.
    const small = swapExactIn(single, true, 10n ** 6n);
    expect(small.exhausted).toBe(false);
    expect(small.amountOut > 0n).toBe(true);
    const huge = swapExactIn(single, true, 10n ** 30n);
    expect(huge.exhausted).toBe(true);
    expect(huge.ticksCrossed).toBe(1);
    expect(huge.sqrtPriceX96After <= sqrtRatioAtTick(lower)).toBe(true);
    // Output is bounded by the liquidity in the single range.
    expect(huge.amountOut).toBeGreaterThan(small.amountOut);
  });

  it("zero input yields zero output", () => {
    expect(swapExactIn(base, true, 0n).amountOut).toBe(0n);
  });

  it("negative input is rejected", () => {
    expect(() => swapExactIn(base, true, -1n)).toThrow();
  });
});
