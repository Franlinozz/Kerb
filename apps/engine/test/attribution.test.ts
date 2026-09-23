import { describe, expect, it } from "vitest";
import { attribute, explainNow, type PostSide, type Report } from "../src/index.js";
import { dec, type DecString } from "@kerb/types";

/** A synthetic KTS-0.2 side: margins from k, v, g, s and floors, the engine value LT - used. */
function side(o: { at?: string; g?: string; v?: string; s?: string; floor?: string; H?: string; c1?: string; posted?: Partial<PostSide["posted"]>; kts?: string; clamps?: PostSide["attesterClamps"]; regime?: string }): PostSide {
  const k = dec("2.5"), v = dec(o.v ?? "0.9"), g = dec(o.g ?? "0.04"), s = dec(o.s ?? "0.01"), floor = dec(o.floor ?? "0.05");
  const raw = k.mul(v).mul(g).plus(s);
  const used = raw.gt(floor) ? raw : floor;
  const LT = dec("0.6");
  const carry = LT.minus(used).toString() as DecString;
  const sRaw = k.mul(v).mul(dec("0.02")).plus(s), sUsed = sRaw.gt(dec("0.03")) ? sRaw : dec("0.03");
  const session = LT.minus(sUsed).toString() as DecString;
  const c1 = (o.c1 ?? "10000") as DecString;
  const ceiling = dec("0.75").mul(dec(c1)).toString() as DecString;
  const m = (gg: string, uu: string, rr: string, fl: string, h: string) => ({ gap: gg, volScaler: v.toString(), exitCost: s.toString(), raw: rr, floor: fl, used: uu, horizonHours: h, horizonEndsAt: "2026-09-23T13:30:00.000Z" });
  const report = {
    kts: "0.2", observedAt: o.at ?? "2026-09-21T20:00:00Z",
    capacity: { LT: "0.6", carryLTV: carry, sessionMaxLTV: session, debtCeiling: ceiling, maxPositionDebt: "2500", clamped: [], margins: { kts: "0.2", stressMultiplier: "2.5", gapMethod: "", carry: m(g.toString(), used.toString(), raw.toString(), floor.toString(), o.H ?? "17.5"), session: m("0.02", sUsed.toString(), sRaw.toString(), "0.03", "5") } },
    depth: { C_1: c1, venues: [{ pools: ["0x1234567890abcdef1234567890abcdef12345678"] }] },
    regimeInputs: { rule: 9, reason: "underlying open with adequate depth" },
  } as unknown as Report;
  return {
    at: o.at ?? "2026-09-21T20:00:00Z", tx: `0x${Math.random().toString(16).slice(2)}`, inputsHash: "0x01", kts: o.kts ?? "0.2",
    posted: { carryLTV: carry, sessionMaxLTV: session, debtCeiling: ceiling, regime: o.regime ?? "NORMAL", ...o.posted },
    report, attesterClamps: o.clamps ?? [], ceilingK: "0.75" as DecString, referenceSize: "10000" as DecString,
  };
}
const sum = (c: { contribution: string }[]): number => c.reduce((a, x) => a + Number(x.contribution), 0);

describe("term attribution (V3-04)", () => {
  it("a longer horizon: HORIZON explains the Carry step, and the parts sum to the move exactly", () => {
    const [c] = attribute(side({ g: "0.036" }), side({ g: "0.054", H: "41.4" })).filter((x) => x.field === "carryLTV");
    expect(c?.causes[0]?.kind).toBe("HORIZON");
    expect(Math.abs(sum(c!.causes) - Number(c!.delta))).toBeLessThan(0.01);
    expect(c?.residual).toBeNull();
    expect(c?.headline).toMatch(/41h 24m/);
  });
  it("horizon, volatility and exit cost at once: an exact additive split", () => {
    const [c] = attribute(side({ g: "0.03", v: "0.8", s: "0.01" }), side({ g: "0.05", v: "1.1", s: "0.02" })).filter((x) => x.field === "carryLTV");
    expect(c!.causes.map((x) => x.kind).sort()).toEqual(["EXIT_COST", "HORIZON", "VOLATILITY"]);
    expect(Math.abs(sum(c!.causes) - Number(c!.delta))).toBeLessThan(1e-9);
  });
  it("floors: entering and leaving", () => {
    const enter = attribute(side({ g: "0.04" }), side({ g: "0.001", s: "0.001" })).find((x) => x.field === "carryLTV");
    expect(enter?.causes[0]?.kind).toBe("FLOOR_ENTER");
    const exit = attribute(side({ g: "0.001", s: "0.001" }), side({ g: "0.04" })).find((x) => x.field === "carryLTV");
    expect(exit?.causes[0]?.kind).toBe("FLOOR_EXIT");
  });
  it("a loosening held by the attester is named, with the engine's value", () => {
    const P = side({ g: "0.06" });
    const N = side({ g: "0.03", clamps: [{ field: "carryLTV (loosen cooldown)", from: "0", to: "0" }] });
    N.posted.carryLTV = dec(P.posted.carryLTV).plus(dec("0.001")).toString() as DecString;
    const c = attribute(P, N).find((x) => x.field === "carryLTV");
    expect(c?.causes.map((x) => x.kind)).toContain("LOOSEN_CAP");
    expect(Math.abs(sum(c!.causes) - Number(c!.delta))).toBeLessThan(0.01);
  });
  it("posted tighter than the engine without a loosen record is an attester clamp", () => {
    const P = side({}), N = side({ s: "0.011" });
    N.posted.carryLTV = dec(N.posted.carryLTV).minus(dec("0.01")).toString() as DecString;
    expect(attribute(P, N).find((x) => x.field === "carryLTV")?.causes.map((x) => x.kind)).toContain("ATTESTER_CLAMP");
  });
  it("KTS version switch stops the decomposition", () => {
    const c = attribute(side({ kts: "0.1" }), side({ g: "0.02" })).find((x) => x.field === "carryLTV");
    expect(c?.causes).toEqual([expect.objectContaining({ kind: "KTS_VERSION" })]);
  });
  it("debt ceiling follows depth", () => {
    const c = attribute(side({ c1: "10000" }), side({ c1: "8000" })).find((x) => x.field === "debtCeiling");
    expect(c?.causes[0]?.kind).toBe("DEPTH");
    expect(Number(c?.delta)).toBe(-1500);
    expect(c?.headline).toMatch(/\$7,500 to \$6,000|\$7,500 to \$6,000/);
  });
  it("small moves are not changes; a missing bundle says so instead of guessing", () => {
    expect(attribute(side({}), side({ g: "0.04001" }))).toEqual([]);
    const P = side({}), N = side({ g: "0.06" });
    N.report = null;
    expect(attribute(P, N).find((x) => x.field === "carryLTV")?.causes[0]?.kind).toBe("UNAVAILABLE");
  });
  it("regime changes carry the rule, and a stale regime pauses borrowing", () => {
    const c = attribute(side({ regime: "NORMAL" }), side({ regime: "STALE" })).find((x) => x.field === "regime");
    expect(c?.headline).toMatch(/Normal to Stale\. Rule 9/);
    expect(c?.causes.map((x) => x.kind)).toEqual(["REGIME", "USABLE"]);
  });
  it("now sentences have numbers and no placeholders", () => {
    const s = explainNow(side({}));
    expect(s.map((x) => x.field)).toEqual(["carryLTV", "sessionMaxLTV", "debtCeiling"]);
    for (const x of s) expect(x.sentence).not.toMatch(/[{}]|undefined|NaN/);
    expect(s[0]?.sentence).toMatch(/points below the fixed 60\.00% line/);
    expect(explainNow(side({ g: "0.001", s: "0.001" }))[0]?.sentence).toMatch(/floor/);
  });
});
