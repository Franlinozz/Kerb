import { describe, expect, it } from "vitest";
import {
  Regime, assetId, canonicalJson, dec, decMedian, fromUnits, isDecString, regimeName,
  toDecString, toUnitsCeil, toUnitsFloor,
} from "../src/index.js";

describe("decimal helpers", () => {
  it.each([
    ["68.42", "68.42"],
    ["1.500", "1.5"],
    ["0.000", "0"],
    ["-0", "0"],
    ["100", "100"],
    ["0.0000000000000000000001", "0.0000000000000000000001"],
  ])("canonicalises %s -> %s", (i, o) => {
    expect(toDecString(dec(i))).toBe(o);
  });

  it("rejects floats, exponents and junk", () => {
    expect(() => dec("1e5")).toThrow();
    expect(() => dec("abc")).toThrow();
    expect(() => dec(".5")).toThrow();
    expect(isDecString("01")).toBe(false);
  });

  it("does not suffer float error", () => {
    expect(toDecString(dec("0.1").plus(dec("0.2")))).toBe("0.3");
  });

  it("scales units both ways and rounds against the user", () => {
    expect(fromUnits(1500000n, 6)).toBe("1.5");
    expect(toUnitsFloor("1.0000009", 6)).toBe(1000000n);
    expect(toUnitsCeil("1.0000001", 6)).toBe(1000001n);
  });

  it("medians", () => {
    expect(toDecString(decMedian([dec("3"), dec("1"), dec("2")]))).toBe("2");
    expect(toDecString(decMedian([dec("4"), dec("1"), dec("2"), dec("3")]))).toBe("2.5");
    expect(() => decMedian([])).toThrow();
  });
});

describe("regime", () => {
  it("matches the Solidity enum order", () => {
    expect(Regime.DEEP).toBe(0);
    expect(Regime.RECOVERY).toBe(8);
    expect(regimeName(Regime.PRE_TRANSITION)).toBe("PRE_TRANSITION");
  });
});

describe("assetId", () => {
  it("is keccak256(abi.encode(chainId, token)) and case-insensitive", () => {
    const a = assetId(196, "0xdcc1a2699441079da889b1f49e12b69cc791129b");
    const b = assetId(196, "0xDCC1A2699441079DA889B1F49E12B69CC791129B");
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(assetId(1952, "0xdcc1a2699441079da889b1f49e12b69cc791129b")).not.toBe(a);
  });
});

describe("canonicalJson", () => {
  it("sorts keys deeply and serialises bigint", () => {
    expect(canonicalJson({ b: 1, a: { d: 2n, c: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[3,{"y":2,"z":1}],"d":"2"},"b":1}');
  });
  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ a: Infinity })).toThrow();
  });
});
