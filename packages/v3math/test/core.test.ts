import { describe, expect, it } from "vitest";
import { MAX_SQRT_RATIO, MAX_TICK, MIN_SQRT_RATIO, MIN_TICK, mulDiv, mulDivRoundingUp, sqrtRatioAtTick, tickAtSqrtRatio } from "../src/core.js";
import { nextInitializedTickWithinOneWord } from "../src/swap.js";

describe("TickMath", () => {
  it.each([
    [MIN_TICK, MIN_SQRT_RATIO],
    [MAX_TICK, MAX_SQRT_RATIO],
    [0, 79228162514264337593543950336n],
  ])("sqrtRatioAtTick(%i)", (t, v) => expect(sqrtRatioAtTick(t)).toBe(v));

  it("round trips through tickAtSqrtRatio", () => {
    for (const t of [MIN_TICK, -500000, -276325, -1, 0, 1, 69080, 276324, MAX_TICK - 1]) {
      expect(tickAtSqrtRatio(sqrtRatioAtTick(t))).toBe(t);
      if (t < MAX_TICK - 1) expect(tickAtSqrtRatio(sqrtRatioAtTick(t + 1) - 1n)).toBe(t);
    }
  });

  it("rejects out-of-range ticks", () => {
    expect(() => sqrtRatioAtTick(MAX_TICK + 1)).toThrow();
    expect(() => sqrtRatioAtTick(0.5)).toThrow();
  });
});

describe("FullMath", () => {
  it("rounds up only when there is a remainder", () => {
    expect(mulDiv(7n, 3n, 2n)).toBe(10n);
    expect(mulDivRoundingUp(7n, 3n, 2n)).toBe(11n);
    expect(mulDivRoundingUp(8n, 3n, 2n)).toBe(12n);
    expect(() => mulDiv(1n, 1n, 0n)).toThrow();
  });
});

describe("nextInitializedTickWithinOneWord", () => {
  const ticks = [-20, -10, 10, 700].map((t) => t / 10); // compressed, spacing 10
  it.each([
    [0, true, 0, false],
    [1, true, 0, false],
    [-10, true, -10, true],
    [-11, true, -20, true],
    [0, false, 10, true],
    [10, false, 700, true],
    [700, false, 2550, false],
    [-25, true, -2560, false],
  ])("tick %i lte=%s -> %i initialized=%s", (tick, lte, next, init) => {
    const r = nextInitializedTickWithinOneWord(ticks, tick, 10, lte);
    expect(r.next).toBe(next);
    expect(r.initialized).toBe(init);
  });
});
