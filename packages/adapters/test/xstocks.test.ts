import { describe, expect, it } from "vitest";
import { numericLiteralToDec, rawNumberField } from "../src/xstocks.js";
import { compress, tickDelta, wordOf } from "../src/v3pool.js";

describe("numeric literal recovery", () => {
  it.each([
    ["1.0225601246249238", "1.0225601246249238"],
    ["88.16", "88.16"],
    ["0", "0"],
    ["1e-7", "0.0000001"],
    ["1.5E3", "1500"],
    ["-2.50", "-2.5"],
  ])("%s -> %s", (i, o) => expect(numericLiteralToDec(i)).toBe(o));

  it("extracts the exact literal, not a float round trip", () => {
    const body = '{"currentMultiplier":1.0225601246249238,"newMultiplier":0,"activationDateTime":0,"reason":null}';
    expect(rawNumberField(body, "currentMultiplier")).toBe("1.0225601246249238");
    expect(rawNumberField(body, "newMultiplier")).toBe("0");
    expect(rawNumberField(body, "missing")).toBeNull();
  });
});

describe("tick helpers", () => {
  it("compresses negative ticks toward -infinity like Solidity", () => {
    expect(compress(-1, 10)).toBe(-1);
    expect(compress(-10, 10)).toBe(-1);
    expect(compress(-11, 10)).toBe(-2);
    expect(wordOf(-1, 1)).toBe(-1);
    expect(wordOf(255, 1)).toBe(0);
    expect(wordOf(256, 1)).toBe(1);
  });
  it("covers at least the requested move", () => {
    expect(tickDelta(0.2)).toBeGreaterThanOrEqual(2231);
    expect(() => tickDelta(1)).toThrow();
  });
});
