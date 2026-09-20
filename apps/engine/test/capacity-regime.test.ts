import { describe, expect, it } from "vitest";
import { Regime, dec, type DecString } from "@kerb/types";
import { computeCapacity, stressLTV, type CapacityConfig, type Guardrails } from "../src/capacity.js";
import { applyAsymmetry, resolveRegime, type AsymmetryConfig, type RegimeConfig, type RegimeInput } from "../src/regime.js";
import { empiricalQuantile, gapQuantile, realisedVol, universeGapQuantile, volScaler, volScalerWithFallback, DEFAULT_STRESS, type DailyBar } from "../src/stress.js";

const cap: CapacityConfig = {
  k: "0.75" as DecString, buffer: "0.02" as DecString, liquidationBonus: "0.07" as DecString,
  carryMargin: "0.10" as DecString, sessionMargin: "0.05" as DecString,
  positionCapAbs: "25000" as DecString, positionCapShare: "0.25" as DecString, referenceLiquidationSize: "10000" as DecString,
};
const rails: Guardrails = { ltvMin: "0.05" as DecString, ltvMax: "0.75" as DecString, ceilingMin: "0" as DecString, ceilingMax: "250000" as DecString, LT: "0.65" as DecString };

describe("capacity (KTS-0.1 section 7)", () => {
  it("stressLTV follows the formula and floors at zero", () => {
    expect(stressLTV({ gapQuantile: "0.061" as DecString, volScaler: "1.18" as DecString, impactAtReferenceSize: "0.007" as DecString }, cap)).toBe("0.83102");
    expect(stressLTV({ gapQuantile: "0.9" as DecString, volScaler: "2" as DecString, impactAtReferenceSize: "0.05" as DecString }, cap)).toBe("0");
  });

  it("debtCeiling = k * C(1%), and coverage is C(1%) / ceiling", () => {
    const c = computeCapacity({
      stressWeak: { gapQuantile: "0.05" as DecString, volScaler: "1" as DecString, impactAtReferenceSize: "0.01" as DecString },
      stressCure: { gapQuantile: "0.02" as DecString, volScaler: "1" as DecString, impactAtReferenceSize: "0.01" as DecString },
      c1: "10000" as DecString, cfg: cap, guardrails: rails,
    });
    expect(c.debtCeiling).toBe("7500");
    expect(c.coverageRatioAtCeiling).toBe("1.333333");
    expect(c.maxPositionDebt).toBe("2500");
  });

  it("carryLTV <= sessionMaxLTV <= LT always", () => {
    for (const g of ["0.01", "0.05", "0.2", "0.4"]) {
      const c = computeCapacity({
        stressWeak: { gapQuantile: g as DecString, volScaler: "1.5" as DecString, impactAtReferenceSize: "0.01" as DecString },
        stressCure: { gapQuantile: "0.005" as DecString, volScaler: "1.5" as DecString, impactAtReferenceSize: "0.01" as DecString },
        c1: "10000" as DecString, cfg: cap, guardrails: rails,
      });
      expect(dec(c.carryLTV).lte(dec(c.sessionMaxLTV))).toBe(true);
      expect(dec(c.sessionMaxLTV).lte(dec(c.LT))).toBe(true);
    }
  });

  it("a longer weak horizon lowers carry capacity", () => {
    const mk = (g: string) => computeCapacity({
      stressWeak: { gapQuantile: g as DecString, volScaler: "1.5" as DecString, impactAtReferenceSize: "0.01" as DecString },
      stressCure: { gapQuantile: "0.01" as DecString, volScaler: "1.5" as DecString, impactAtReferenceSize: "0.01" as DecString },
      c1: "10000" as DecString, cfg: cap, guardrails: { ...rails, LT: "0.9" as DecString, ltvMax: "0.9" as DecString },
    });
    expect(dec(mk("0.3").carryLTV).lt(dec(mk("0.05").carryLTV))).toBe(true);
  });

  it("records every clamp", () => {
    const c = computeCapacity({
      stressWeak: { gapQuantile: "0.001" as DecString, volScaler: "0.75" as DecString, impactAtReferenceSize: "0" as DecString },
      stressCure: { gapQuantile: "0.001" as DecString, volScaler: "0.75" as DecString, impactAtReferenceSize: "0" as DecString },
      c1: "1000000" as DecString, cfg: cap, guardrails: rails,
    });
    expect(c.debtCeiling).toBe("250000");
    expect(c.clamped.some((x) => x.field === "debtCeiling")).toBe(true);
  });
});

describe("regime machine (KTS-0.1 section 4.2)", () => {
  const cfg: RegimeConfig = {
    stalenessMaxSec: 300, dispersionMax: "0.02" as DecString, actionCooldownSec: 3600, recoveryCooldownSec: 1800,
    thinThreshold: "5000" as DecString, deepThreshold: "20000" as DecString, spreadMax: "0.01" as DecString, cureWindowSec: 3600,
  };
  const now = Date.parse("2026-09-21T15:00:00Z");
  const base = (over: Partial<RegimeInput> = {}): RegimeInput => ({
    atMs: now,
    halted: { adapter: false, underlying: false },
    sourceMaxAgeSec: 30,
    dispersion: "0.001" as DecString,
    action: { windowStartMs: null, windowEndMs: null, multiplierChangedAtMs: null },
    clock: { inMainSession: true, referenceClosed: false, nextWeakeningAtMs: now + 5 * 3_600_000, lastMainOpenMs: now - 5 * 3_600_000 },
    depth: { c1: "25000" as DecString, spread: null, available: true },
    cfg,
    ...over,
  });

  it.each([
    ["HALTED beats everything", { halted: { adapter: true, underlying: false }, sourceMaxAgeSec: 99999 }, Regime.HALTED, 1],
    ["STALE on source age", { sourceMaxAgeSec: 600 }, Regime.STALE, 2],
    ["STALE on dispersion", { dispersion: "0.05" as DecString }, Regime.STALE, 2],
    ["ACTION in the window", { action: { windowStartMs: now - 1000, windowEndMs: now + 1000, multiplierChangedAtMs: null } }, Regime.ACTION, 3],
    ["PRE_TRANSITION inside the cure window", { clock: { inMainSession: true, referenceClosed: false, nextWeakeningAtMs: now + 600_000, lastMainOpenMs: now - 9_999_999 } }, Regime.PRE_TRANSITION, 4],
    ["RECOVERY after reopen", { clock: { inMainSession: true, referenceClosed: false, nextWeakeningAtMs: now + 5 * 3_600_000, lastMainOpenMs: now - 60_000 } }, Regime.RECOVERY, 5],
    ["REFERENCE_CLOSED when no session", { clock: { inMainSession: false, referenceClosed: true, nextWeakeningAtMs: now + 5 * 3_600_000, lastMainOpenMs: now - 9_999_999 } }, Regime.REFERENCE_CLOSED, 6],
    ["THIN on shallow depth", { depth: { c1: "100" as DecString, spread: null, available: true } }, Regime.THIN, 7],
    ["THIN when depth is unavailable", { depth: { c1: "0" as DecString, spread: null, available: false } }, Regime.THIN, 7],
    ["DEEP in session with deep books", {}, Regime.DEEP, 8],
    ["NORMAL otherwise", { depth: { c1: "10000" as DecString, spread: null, available: true } }, Regime.NORMAL, 9],
  ] as const)("%s", (_n, over, regime, rule) => {
    const r = resolveRegime(base(over as Partial<RegimeInput>));
    expect(r.regime).toBe(regime);
    expect(r.rule).toBe(rule);
  });

  it("resolution order is strict: an earlier rule wins over a later one", () => {
    const r = resolveRegime(base({ sourceMaxAgeSec: 600, depth: { c1: "1" as DecString, spread: null, available: true } }));
    expect(r.regime).toBe(Regime.STALE);
  });
});

describe("tighten fast, loosen slow (KTS-0.1 section 4.3)", () => {
  const cfg: AsymmetryConfig = { recoveryCooldownSec: 1800, nConfirm: 3, maxLoosenStep: "0.02" as DecString };
  const now = Date.parse("2026-09-21T15:00:00Z");
  const prev = { observedAtMs: now - 60_000, regime: Regime.NORMAL, carryLTV: "0.5" as DecString, sessionMaxLTV: "0.6" as DecString, debtCeiling: "1000" as DecString, loosenConfirmations: 5, lastLoosenAtMs: now - 3_600_000 };

  it("tightening applies immediately", () => {
    const r = applyAsymmetry("0.4" as DecString, "0.5" as DecString, now, prev, cfg);
    expect(r).toMatchObject({ value: "0.4", applied: "tightened" });
  });
  it("loosening is capped by maxLoosenStep", () => {
    const r = applyAsymmetry("0.9" as DecString, "0.5" as DecString, now, prev, cfg);
    expect(r.value).toBe("0.52");
    expect(r.applied).toBe("loosened");
  });
  it("loosening waits for the cooldown", () => {
    const r = applyAsymmetry("0.51" as DecString, "0.5" as DecString, now, { ...prev, lastLoosenAtMs: now - 60_000 }, cfg);
    expect(r).toMatchObject({ value: "0.5", applied: "held" });
    expect(r.reason).toMatch(/cooldown/);
  });
  it("loosening waits for confirmations", () => {
    const r = applyAsymmetry("0.51" as DecString, "0.5" as DecString, now, { ...prev, loosenConfirmations: 0 }, cfg);
    expect(r).toMatchObject({ value: "0.5", applied: "held" });
    expect(r.reason).toMatch(/confirmations/);
  });
  it("the first report has nothing to compare against", () => {
    expect(applyAsymmetry("0.5" as DecString, null, now, null, cfg)).toMatchObject({ value: "0.5", applied: "held" });
  });
});

describe("stress statistics (KTS-0.1 section 7.1)", () => {
  const bars = (closes: number[]): DailyBar[] => closes.map((c, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, open: String(c) as DecString, close: String(c) as DecString }));
  const walk = (n: number): DailyBar[] => bars(Array.from({ length: n }, (_, i) => 100 * (1 + 0.01 * Math.sin(i))));

  it("empirical quantile returns an observed value by nearest rank", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => dec(String(n)));
    expect(empiricalQuantile(xs, "0.99" as DecString).toString()).toBe("10");
    expect(empiricalQuantile(xs, "0.5" as DecString).toString()).toBe("5");
    expect(() => empiricalQuantile([], "0.99" as DecString)).toThrow();
  });

  it("longer horizons give larger gap quantiles on a trending series", () => {
    const trend = bars(Array.from({ length: 1500 }, (_, i) => 100 * (1 + i / 1000)));
    const one = dec(gapQuantile(trend, 1, DEFAULT_STRESS).value);
    const five = dec(gapQuantile(trend, 5, DEFAULT_STRESS).value);
    expect(five.gt(one)).toBe(true);
  });

  it("an asset with short history takes the universe fallback when it is more conservative", () => {
    const short = walk(30);
    const long = bars(Array.from({ length: 1400 }, (_, i) => 100 * (1 + 0.2 * Math.sin(i / 3))));
    const fallback = universeGapQuantile([{ bars: long }], 1, DEFAULT_STRESS);
    const g = gapQuantile(short, 1, DEFAULT_STRESS, fallback);
    expect(g.historySufficient).toBe(false);
    expect(g.source).toBe("universe-fallback");
    expect(dec(g.value)).toEqual(dec(fallback));
  });

  it("never lowers an asset's own quantile using the fallback", () => {
    const wild = bars(Array.from({ length: 200 }, (_, i) => 100 * (1 + 0.5 * Math.sin(i))));
    const calm = bars(Array.from({ length: 1400 }, (_, i) => 100 + i / 1000));
    const g = gapQuantile(wild, 1, DEFAULT_STRESS, universeGapQuantile([{ bars: calm }], 1, DEFAULT_STRESS));
    expect(dec(g.value).gt(dec("0.1"))).toBe(true);
  });

  it("volScaler is clamped into [volMin, volMax]", () => {
    // Quiet but never flat (a flat series has zero median volatility and is rejected), then violent.
    const quiet = Array.from({ length: 200 }, (_, i) => 100 + (i % 2 === 0 ? 0.05 : -0.05));
    const spiky = bars([...quiet, ...[100, 150, 80, 160, 70, 180, 60, 200, 50, 220, 40, 260, 30, 300, 20, 350, 10, 400, 5, 500, 3, 600]]);
    const v = volScaler(spiky, DEFAULT_STRESS);
    expect(v.value).toBe("2");
    expect(v.clamped).toBe(true);
  });

  it("an asset too short even for a volatility window takes the most conservative universe scaler", () => {
    const v = volScalerWithFallback(walk(5), [{ bars: walk(1300) }], DEFAULT_STRESS);
    expect(v.source).toBe("universe-fallback");
  });

  it("realisedVol needs at least two returns", () => {
    expect(() => realisedVol(bars([100]), 20)).toThrow();
  });

  it("rejects a flat series rather than dividing by a zero median volatility", () => {
    expect(() => volScaler(bars(Array.from({ length: 200 }, () => 100)), DEFAULT_STRESS)).toThrow(/median realised volatility is zero/);
  });
});
