import { describe, expect, it } from "vitest";
import { fmtUnits, parseAmount, toInput } from "../src/lib/creditMath";

describe("toInput: MAX never asks for more than exists", () => {
  it("keeps every decimal of the balance the Day run could not withdraw", () => {
    const held = 48581127523286128453n;
    expect(fmtUnits(held, 18, 6)).toBe("48.581128"); // the display rounds up: fine to read, wrong to send
    expect(toInput(held, 18)).toBe("48.581127523286128453");
    expect(parseAmount(toInput(held, 18), 18)).toBe(held);
  });
  it("rounds down when places are limited", () => {
    expect(toInput(2634_599_999n, 6, 2)).toBe("2634.59");
    expect(parseAmount(toInput(2634_599_999n, 6, 2), 6) <= 2634_599_999n).toBe(true);
  });
  it("trims zeros and handles whole and zero amounts", () => {
    expect(toInput(10_000_000_000n, 6)).toBe("10000");
    expect(toInput(1_500_000n, 6)).toBe("1.5");
    expect(toInput(0n, 18)).toBe("0");
  });
  it("round-trips any amount exactly", () => {
    for (const v of [1n, 999n, 123456789012345678901n, 10n ** 18n - 1n]) expect(parseAmount(toInput(v, 18), 18)).toBe(v);
  });
});
