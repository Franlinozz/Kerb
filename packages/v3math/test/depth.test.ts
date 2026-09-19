import { describe, expect, it } from "vitest";
import { Decimal, dec, type DecString } from "@kerb/types";
import { aggregate, capacityAt, crosscheck, impactCurve, pathMidPrice, quotePath, venueDepth, type Leg } from "../src/index.js";
import { fixture, venue } from "./fixtures.js";

const kox = fixture("KOx/USDG");
const hk = fixture("HKEXCx/USDG");
const coinEth = fixture("COINx/xETH");
const ethUsdg = fixture("xETH/USDG");
const tokenOf = (f: typeof kox, sym: string): string => (f.symbol0 === sym ? f.snapshot.token0 : f.snapshot.token1);

const koxLeg: Leg = { venue: venue(kox), sellToken: tokenOf(kox, "wKOx"), symbols: ["wKOx", "USDG"] };
const hkLeg: Leg = { venue: venue(hk), sellToken: tokenOf(hk, "wHKEXCx"), symbols: ["wHKEXCx", "USDG"] };
const coinPath: Leg[] = [
  { venue: venue(coinEth), sellToken: tokenOf(coinEth, "wCOINx"), symbols: ["wCOINx", "xETH"] },
  { venue: venue(ethUsdg), sellToken: tokenOf(ethUsdg, "xETH"), symbols: ["xETH", "USDG"] },
];

describe("impact curve", () => {
  it.each([["KOx", [koxLeg]], ["HKEXCx", [hkLeg]], ["COINx via xETH", coinPath]] as const)("%s is non-decreasing and starts near the fee", (_n, legs) => {
    const c = impactCurve([...legs]);
    const filled = c.filter((q) => q.filled);
    expect(filled.length).toBeGreaterThan(0);
    for (let i = 1; i < filled.length; i++) expect(dec(filled[i]!.impact).gte(dec(filled[i - 1]!.impact))).toBe(true);
    let fee = new Decimal(0);
    for (const l of legs as readonly Leg[]) fee = fee.plus(new Decimal(l.venue.fee).div(1_000_000));
    expect(dec(c[0]!.impact).gte(fee.mul("0.99"))).toBe(true);
  });

  it("unfilled sales report impact 1, never a partial price", () => {
    const q = quotePath([koxLeg], "1000000000" as DecString);
    expect(q.filled).toBe(false);
    expect(q.impact).toBe("1");
  });
});

describe("C(i) by bisection", () => {
  it.each([["0.005"], ["0.01"], ["0.03"]])("KOx C(%s): impact(C) <= i < impact(C * 1.001)", (i) => {
    const c = capacityAt([koxLeg], i as DecString);
    if (c.censored) return;
    const at = quotePath([koxLeg], c.notional);
    expect(at.filled).toBe(true);
    expect(dec(at.impact).lte(dec(i))).toBe(true);
    const above = quotePath([koxLeg], dec(c.notional).mul("1.001").toFixed(6) as DecString);
    expect(!above.filled || dec(above.impact).gt(dec(i))).toBe(true);
  });

  it("C is monotone in the impact budget", () => {
    const a = dec(capacityAt([hkLeg], "0.005" as DecString).notional);
    const b = dec(capacityAt([hkLeg], "0.01" as DecString).notional);
    const c = dec(capacityAt([hkLeg], "0.03" as DecString).notional);
    expect(a.lte(b) && b.lte(c)).toBe(true);
  });

  it("an impact budget below the fee gives zero capacity", () => {
    expect(capacityAt([koxLeg], "0.0001" as DecString).notional).toBe("0");
  });
});

describe("multi-hop (KTS-0.1 5.2)", () => {
  it("path impact equals 1 - prod(1 - leg impact)", () => {
    const q = quotePath(coinPath, "5000" as DecString);
    expect(q.filled).toBe(true);
    expect(q.legImpacts).toHaveLength(2);
    const compounded = new Decimal(1).minus(q.legImpacts.reduce((a, x) => a.mul(new Decimal(1).minus(dec(x))), new Decimal(1)));
    expect(compounded.minus(dec(q.impact)).abs().lt("0.0000001")).toBe(true);
  });

  it("path mid price is the product of leg mids and the path is recorded", () => {
    const d = venueDepth(coinPath);
    expect(d.path).toEqual(["wCOINx", "xETH", "USDG"]);
    expect(d.pools).toHaveLength(2);
    expect(dec(d.midPrice).gt(0)).toBe(true);
    expect(pathMidPrice(coinPath).toFixed(6)).toBe(dec(d.midPrice).toFixed(6));
  });

  it("a second leg that cannot absorb the first leg's output leaves the sale unfilled", () => {
    const dry: Leg[] = [coinPath[0]!, { ...coinPath[1]!, venue: { ...coinPath[1]!.venue, liquidity: "0", ticks: [] } }];
    const q = quotePath(dry, "1000" as DecString);
    expect(q.filled).toBe(false);
    expect(q.exhaustedReason).toContain("xETH->USDG");
  });
});

describe("aggregation (KTS-0.1 5.3)", () => {
  it("sums venues and applies 0.8 fragmentation for more than one venue", () => {
    const a = venueDepth([koxLeg]);
    const b = venueDepth([hkLeg]);
    const one = aggregate([a]);
    expect(one.fragmentationFactor).toBe("1");
    expect(one.C_1).toBe(dec(a.C_1.notional).toFixed(6).replace(/\.?0+$/, ""));
    const two = aggregate([a, b], [{ path: ["x"], pools: ["0x0"], reason: "stale" }]);
    expect(two.fragmentationFactor).toBe("0.8");
    const expected = dec(a.C_1.notional).plus(dec(b.C_1.notional)).mul("0.8");
    expect(dec(two.C_1).minus(expected).abs().lte("0.000001")).toBe(true);
    expect(two.excluded).toHaveLength(1);
  });

  it("no eligible venues means zero depth", () => {
    expect(aggregate([]).C_1).toBe("0");
  });
});

describe("cross-check (KTS-0.1 5.4)", () => {
  it.each([
    ["10000", "10500", "0.1", false, "10000"],
    ["10000", "5000", "0.1", true, "5000"],
    ["5000", "10000", "0.1", true, "5000"],
    ["10000", "0", "0.1", true, "0"],
  ])("sim %s quote %s max %s -> flag %s used %s (never the maximum)", (s, q, m, flag, used) => {
    const r = crosscheck(s as DecString, q as DecString, m as DecString, "okx-dex");
    expect(r.flag).toBe(flag);
    expect(r.used).toBe(used);
    expect(dec(r.used).lte(Decimal.max(dec(s), dec(q)))).toBe(true);
  });
});
