/**
 * KTS-0.2 horizon-bound margins (docs/v2/KTS-0.2.md section 7.1). The gap tables and vol scalers
 * are the real ones pinned in committed KOx, HKEXCx and COINx bundles, not invented numbers.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dec, type DecString } from "@kerb/types";
import { computeCapacityV02, gapForHours, type CapacityConfig, type CapacityV02Input, type GapTable, type Guardrails } from "../src/capacity.js";
import type { InputBundle } from "../src/bundle.js";

const dir = resolve(__dirname, "../../../data/fixtures/kts");
const index = JSON.parse(readFileSync(resolve(dir, "index.json"), "utf8")) as { symbol: string; bundle: string }[];
function stressOf(symbol: string): { gaps: GapTable; v: DecString } {
  const row = index.find((r) => r.symbol === symbol);
  if (!row) throw new Error(`no fixture for ${symbol}`);
  const b = JSON.parse(readFileSync(resolve(dir, row.bundle), "utf8")) as InputBundle;
  return { gaps: b.stress.gapQuantileBySessions, v: b.stress.volScaler.value };
}
const KOx = stressOf("KOx");
const HK = stressOf("HKEXCx");
const COIN = stressOf("COINx");

const cfg: CapacityV02Input["cfg"] = {
  k: "0.75" as DecString, buffer: "0.02" as DecString, liquidationBonus: "0.07" as DecString,
  carryMargin: "0.10" as DecString, sessionMargin: "0.05" as DecString,
  positionCapAbs: "25000" as DecString, positionCapShare: "0.25" as DecString, referenceLiquidationSize: "10000" as DecString,
  stressMultiplier: "2.5" as DecString, minCarryMargin: "0.05" as DecString, minSessionMargin: "0.03" as DecString,
} satisfies CapacityConfig;
const rails = (LT: string): Guardrails => ({ ltvMin: "0.05" as DecString, ltvMax: LT as DecString, ceilingMin: "0" as DecString, ceilingMax: "250000" as DecString, LT: LT as DecString });

function run(s: { gaps: GapTable; v: DecString }, LT: string, hWeak: string, hCure: string, exit = "0.005") {
  const stress = { gapQuantile: "0.05" as DecString, volScaler: s.v, impactAtReferenceSize: exit as DecString };
  return computeCapacityV02({
    gaps: s.gaps, volScaler: s.v, impactAtReferenceSize: exit as DecString,
    weak: { hours: hWeak as DecString, endsAt: "2026-09-28T13:30:00.000Z" },
    cure: { hours: hCure as DecString, endsAt: "2026-09-25T19:00:00.000Z" },
    c1: "10000" as DecString, cfg, guardrails: rails(LT), stressWeak: stress, stressCure: stress,
  });
}
const r4 = (x: string) => dec(x).toDecimalPlaces(4).toFixed(4);

describe("gapForHours", () => {
  const t: GapTable = { "1": { value: "0.04" as DecString }, "2": { value: "0.06" as DecString }, "3": { value: "0.07" as DecString }, "5": { value: "0.09" as DecString } };
  it("scales the one-session gap by the square root of the day fraction under a day", () => {
    expect(gapForHours(t, "24" as DecString)).toBe("0.04");
    expect(gapForHours(t, "6" as DecString)).toBe("0.02");
    expect(gapForHours(t, "0" as DecString)).toBe("0");
  });
  it("uses the whole-session gap on a whole number of days, and interpolates variance between", () => {
    expect(gapForHours(t, "48" as DecString)).toBe("0.06");
    // sqrt(0.06^2 + 0.5 * (0.07^2 - 0.06^2)) = sqrt(0.00425)
    expect(r4(gapForHours(t, "60" as DecString))).toBe("0.0652");
  });
  it("takes the next larger bucket when a session count is missing, never a smaller one", () => {
    expect(gapForHours(t, "96" as DecString)).toBe("0.09");
  });
  it("never falls as the horizon grows", () => {
    let prev = dec("0");
    for (let h = 0; h <= 200; h += 0.5) {
      const g = dec(gapForHours(KOx.gaps, String(h) as DecString));
      expect(g.gte(prev)).toBe(true);
      prev = g;
    }
  });
});

describe("computeCapacityV02 (KTS-0.2 section 2)", () => {
  // name, asset, LT, H_weak, H_cure, exit cost, expected carry, expected session max
  const cases: [string, { gaps: GapTable; v: DecString }, string, string, string, string, string, string][] = [
    ["HKEX lunch break: afternoon open 1.5 h away, Last Call 0.5 h away", HK, "0.60", "1.5", "0.5", "0.005", "0.5500", "0.5700"],
    ["US overnight: next open 17 h away, Last Call 5 h away", KOx, "0.65", "17", "5", "0.005", "0.5622", "0.6001"],
    ["Friday afternoon: Monday open 67.5 h away, Last Call 1 h away", KOx, "0.65", "67.5", "1", "0.005", "0.4732", "0.6200"],
    ["Holiday bridge: Tuesday open 91.5 h away", KOx, "0.65", "91.5", "1", "0.005", "0.4527", "0.6200"],
    ["Tiny gaps: both floors bind", KOx, "0.65", "0.25", "0", "0.001", "0.6000", "0.6200"],
    ["Thin depth: a 4% exit cost widens both margins", KOx, "0.65", "17", "5", "0.04", "0.5272", "0.5651"],
  ];
  it.each(cases)("%s", (_name, s, LT, hw, hc, exit, carry, session) => {
    const c = run(s, LT, hw, hc, exit);
    expect(r4(c.carryLTV)).toBe(carry);
    expect(r4(c.sessionMaxLTV)).toBe(session);
    // carry <= session <= LT, and both inside the guardrails
    expect(dec(c.carryLTV).lte(dec(c.sessionMaxLTV))).toBe(true);
    expect(dec(c.sessionMaxLTV).lte(dec(LT))).toBe(true);
    expect(dec(c.carryLTV).gte(dec("0.05"))).toBe(true);
    // the margins block explains the numbers it produced
    expect(dec(LT).minus(dec(c.margins.carry.used)).toFixed(18)).toBe(dec(c.carryLTV).toFixed(18));
    expect(c.margins.kts).toBe("0.2");
  });

  it("before a weekend Carry tightens while Session Max stays near its floor, so the gap between them widens", () => {
    const tue = run(KOx, "0.65", "17", "5");
    const fri = run(KOx, "0.65", "67.5", "1");
    expect(dec(fri.carryLTV).lt(dec(tue.carryLTV))).toBe(true);
    expect(dec(fri.sessionMaxLTV).minus(dec(fri.carryLTV)).gt(dec(tue.sessionMaxLTV).minus(dec(tue.carryLTV)))).toBe(true);
  });

  it("a volatile asset is clamped to the guardrail floor and the clamp is recorded", () => {
    const c = run(COIN, "0.50", "17", "5");
    expect(c.carryLTV).toBe("0.05");
    expect(c.clamped.some((x) => x.field === "carryLTV" && x.reason === "guardrail bounds")).toBe(true);
    expect(dec(c.sessionMaxLTV).gte(dec(c.carryLTV))).toBe(true);
  });

  it("Session Max is lifted to Carry when the cure horizon is the longer one (a closed market)", () => {
    const c = run(KOx, "0.65", "40", "70");
    expect(c.sessionMaxLTV).toBe(c.carryLTV);
    expect(c.clamped.some((x) => x.reason === "sessionMaxLTV may not be below carryLTV")).toBe(true);
  });

  it("holds the invariants over a sweep of horizons and exit costs", () => {
    for (const s of [KOx, HK, COIN]) {
      for (const hw of ["0", "3", "12", "24", "36", "66", "90", "150"]) {
        for (const hc of ["0", "1", "6", "30"]) {
          for (const exit of ["0", "0.01", "0.08", "1"]) {
            const c = run(s, "0.60", hw, hc, exit);
            expect(dec(c.carryLTV).lte(dec(c.sessionMaxLTV))).toBe(true);
            expect(dec(c.sessionMaxLTV).lte(dec("0.60"))).toBe(true);
            expect(dec(c.carryLTV).gte(dec("0.05"))).toBe(true);
          }
        }
      }
    }
  });
});
