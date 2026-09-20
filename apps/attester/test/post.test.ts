import { describe, expect, it } from "vitest";
import type { Report } from "@kerb/engine";
import type { DecString } from "@kerb/types";
import { isLoosening, prepareTerms, regimeIndex, withinEpsilon, type OnchainGuardrails } from "../src/post.js";
import type { TermsStruct } from "../src/sign.js";

const g: OnchainGuardrails = {
  ltvMin: 50_000_000_000_000_000n, // 0.05
  ltvMax: 650_000_000_000_000_000n, // 0.65
  ceilingMin: 0n,
  ceilingMax: 250_000_000_000n, // 250,000 at 6 decimals
  maxLoosenStepBps: 200n,
  loosenCooldownSec: 1800,
  maxReportAgeSec: 900,
  LT: 650_000_000_000_000_000n,
  exists: true,
};

const report = (over: Partial<Report["capacity"]> = {}, regime = "NORMAL"): Report => ({
  observedAt: "2026-09-21T15:00:00.000Z",
  regime,
  engineVersion: "kerb-engine@0.1.0",
  inputsHash: `0x${"11".repeat(32)}`,
  mark: { creditMark: "88.25" as DecString },
  depth: { C_1: "14917.02" as DecString },
  capacity: {
    carryLTV: "0.5" as DecString, sessionMaxLTV: "0.6" as DecString, debtCeiling: "11187.63" as DecString,
    maxPositionDebt: "3729.21" as DecString, ...over,
  },
} as unknown as Report);

describe("prepareTerms", () => {
  it("scales decimals exactly, with no float error", () => {
    const { terms } = prepareTerms(report({ debtCeiling: "250000" as DecString }), g, null, 6);
    expect(terms.debtCeiling).toBe(250_000_000_000n);
    expect(terms.carryLTV).toBe(500_000_000_000_000_000n);
    expect(terms.creditMark).toBe(88_250_000_000_000_000_000n);
    expect(terms.observedAt).toBe(1790002800n); // 2026-09-21T15:00:00Z
    expect(terms.regime).toBe(regimeIndex("NORMAL"));
  });

  it("clamps into the guardrails and records what was clamped", () => {
    const { terms, clamped } = prepareTerms(report({ carryLTV: "0.9" as DecString, sessionMaxLTV: "0.95" as DecString }), g, null, 6);
    expect(terms.carryLTV).toBe(g.ltvMax);
    expect(terms.sessionMaxLTV).toBe(g.ltvMax);
    expect(clamped.map((c) => c.field)).toContain("carryLTV");
  });

  it("never lets sessionMax fall below carry or exceed LT", () => {
    const { terms } = prepareTerms(report({ carryLTV: "0.6" as DecString, sessionMaxLTV: "0.1" as DecString }), g, null, 6);
    expect(terms.sessionMaxLTV).toBeGreaterThanOrEqual(terms.carryLTV);
    expect(terms.sessionMaxLTV).toBeLessThanOrEqual(g.LT);
  });

  it("caps loosening to maxLoosenStepBps against the posted values", () => {
    const prev: TermsStruct = { ...prepareTerms(report(), g, null, 6).terms, carryLTV: 300_000_000_000_000_000n };
    const { terms, clamped } = prepareTerms(report({ carryLTV: "0.6" as DecString }), g, prev, 6);
    expect(terms.carryLTV).toBe(306_000_000_000_000_000n); // +2%
    expect(clamped.some((c) => c.field.includes("loosen step"))).toBe(true);
  });

  it("holds increases entirely while the loosen cooldown is running", () => {
    const prev: TermsStruct = { ...prepareTerms(report(), g, null, 6).terms, carryLTV: 300_000_000_000_000_000n };
    const { terms, clamped } = prepareTerms(report({ carryLTV: "0.6" as DecString }), g, prev, 6, false);
    expect(terms.carryLTV).toBe(prev.carryLTV);
    expect(clamped.some((c) => c.field.includes("loosen cooldown"))).toBe(true);
  });

  it("still tightens during the loosen cooldown", () => {
    const prev: TermsStruct = { ...prepareTerms(report(), g, null, 6).terms, carryLTV: 600_000_000_000_000_000n };
    const { terms } = prepareTerms(report({ carryLTV: "0.2" as DecString }), g, prev, 6, false);
    expect(terms.carryLTV).toBe(200_000_000_000_000_000n);
  });

  it("does not cap tightening", () => {
    const prev: TermsStruct = { ...prepareTerms(report(), g, null, 6).terms, carryLTV: 600_000_000_000_000_000n };
    const { terms } = prepareTerms(report({ carryLTV: "0.1" as DecString }), g, prev, 6);
    expect(terms.carryLTV).toBe(100_000_000_000_000_000n);
  });
});

describe("posting policy", () => {
  const base = prepareTerms(report(), g, null, 6).terms;

  it("skips when nothing moved beyond epsilon", () => {
    expect(withinEpsilon(base, { ...base }, 25n)).toBe(true);
    expect(withinEpsilon(null, base, 25n)).toBe(false);
  });

  it("never skips a regime change", () => {
    expect(withinEpsilon(base, { ...base, regime: 4 }, 25n)).toBe(false);
  });

  it("posts when a value moves beyond epsilon", () => {
    expect(withinEpsilon(base, { ...base, creditMark: base.creditMark / 2n }, 25n)).toBe(false);
    expect(withinEpsilon(base, { ...base, debtCeiling: base.debtCeiling + base.debtCeiling / 100n }, 25n)).toBe(false);
  });

  it("detects loosening in any dimension", () => {
    expect(isLoosening(base, { ...base, carryLTV: base.carryLTV + 1n })).toBe(true);
    expect(isLoosening(base, { ...base, debtCeiling: base.debtCeiling + 1n })).toBe(true);
    expect(isLoosening(base, { ...base, carryLTV: base.carryLTV - 1n })).toBe(false);
    expect(isLoosening(null, base)).toBe(false);
  });

  it("rejects an unknown regime rather than guessing an index", () => {
    expect(() => regimeIndex("NONSENSE")).toThrow();
  });
});
