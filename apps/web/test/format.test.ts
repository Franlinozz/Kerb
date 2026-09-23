/**
 * The display layer does its arithmetic on strings. These tests exist because a rounding or
 * scaling slip here publishes a wrong number with a provenance marker beside it, which is worse
 * than publishing nothing.
 */
import { describe, expect, it } from "vitest";
import { cmpDecimal, compact, duration, group, round, scale, shift, shortHash } from "../src/lib/format";

describe("scale", () => {
  it("scales raw integers by their decimals", () => {
    expect(scale("86794584734656247558", 18)).toBe("86.794584734656247558");
    expect(scale("7803000000", 6)).toBe("7803.000000");
    expect(scale("1", 6)).toBe("0.000001");
    expect(scale("0", 18)).toBe("0.000000000000000000");
  });

  it("keeps the sign", () => {
    expect(scale("-1500000", 6)).toBe("-1.500000");
  });

  it("does not lose precision a float would lose", () => {
    // 2^53 + 1 survives as a string; Number() would round it away.
    expect(scale("9007199254740993", 0)).toBe("9007199254740993");
  });
});

describe("round", () => {
  it("rounds half up without floats", () => {
    expect(round("1.005", 2)).toBe("1.01");
    expect(round("1.004", 2)).toBe("1.00");
    expect(round("2.5", 0)).toBe("3");
  });

  it("carries across every nine", () => {
    expect(round("9.999", 2)).toBe("10.00");
    expect(round("0.999999", 2)).toBe("1.00");
    expect(round("99.995", 2)).toBe("100.00");
  });

  it("pads when there are fewer places than asked for", () => {
    expect(round("1.5", 4)).toBe("1.5000");
    expect(round("7803", 2)).toBe("7803.00");
  });

  it("keeps negatives on the correct side", () => {
    expect(round("-1.005", 2)).toBe("-1.01");
  });
});

describe("shift", () => {
  it("moves the point right, which is how a ratio becomes a percentage", () => {
    expect(shift("0.55", 2)).toBe("55");
    expect(shift("0.001005025399984069", 2)).toBe("0.1005025399984069");
    expect(shift("0.6", 2)).toBe("60");
  });

  it("pads when the point moves past the digits", () => {
    expect(shift("1", 3)).toBe("1000");
  });
});

describe("group and compact", () => {
  it("groups thousands", () => {
    expect(group("14868.693359")).toBe("14,868.693359");
    expect(group("999")).toBe("999");
    expect(group("-1234567.5")).toBe("-1,234,567.5");
  });

  it("compacts for tight columns", () => {
    expect(compact("14868.693359")).toBe("14.9k");
    expect(compact("999.4")).toBe("999.40");
    expect(compact("1500000")).toBe("1.5M");
  });

  it("returns null rather than a zero when the value is missing", () => {
    expect(compact(null)).toBeNull();
  });
});

describe("cmpDecimal", () => {
  it("orders by value, not by string length", () => {
    expect(cmpDecimal("9", "10")).toBe(-1);
    expect(cmpDecimal("1.10", "1.1")).toBe(0);
    expect(cmpDecimal("100.5", "100.45")).toBe(1);
  });

  it("orders negatives below positives", () => {
    expect(cmpDecimal("-1", "0.5")).toBe(-1);
    expect(cmpDecimal("-2", "-1")).toBe(-1);
  });
});

describe("shortHash", () => {
  it("elides the middle", () => {
    expect(shortHash(`0x${"ab".repeat(32)}`)).toBe("0xabab…abab");
  });

  it("handles a zero tail, where slice(-0) would return the whole string", () => {
    // This shipped once: the /proof page printed the full commit hash after its own prefix.
    expect(shortHash("e922ae23a670261c5b1044809447152480e23157", 7, 0)).toBe("e922ae2…");
  });

  it("leaves short strings alone", () => {
    expect(shortHash("0x1234", 6, 4)).toBe("0x1234");
  });
});

describe("duration", () => {
  it("reads in the largest two units", () => {
    expect(duration(90_000)).toBe("1m 30s");
    expect(duration(3_600_000 * 10.5)).toBe("10h 30m");
    expect(duration(86_400_000 * 2 + 3_600_000 * 3)).toBe("2d 3h");
  });

  it("says so rather than guessing when the input is not a duration", () => {
    expect(duration(Number.NaN)).toBe("Unknown");
    expect(duration(-1)).toBe("Refreshing");
  });
});

import { ltv, price, ratio, usd, usdFull } from "../src/lib/format";

describe("V2 number format standard", () => {
  it("formats USDG, LTVs, prices and ratios on strings", () => {
    expect(usd("12400.5")).toBe("$12.4K");
    expect(usd("8590.49")).toBe("$8,590");
    expect(usd("10000")).toBe("$10.0K");
    expect(usd("96875.707024")).toBe("$96.9K");
    expect(usd("1250000")).toBe("$1.3M");
    expect(usd(null)).toBeNull();
    expect(usdFull("5880")).toBe("$5,880.00");
    expect(ltv("0.556041938054855748")).toBe("55.6%");
    expect(ltv("0.65")).toBe("65.0%");
    expect(price("86.992360")).toBe("$86.99");
    expect(ratio("1.3333")).toBe("1.33×");
  });
});

import { shift } from "../src/lib/format";
describe("shift", () => {
  it("pads with zeros when shifting left past the first digit", () => {
    expect(shift("500", -4)).toBe("0.0500");
    expect(shift("5", -1)).toBe("0.5");
    expect(shift("123.45", -1)).toBe("12.345");
    expect(shift("0.55", 2)).toBe("55");
  });
});
