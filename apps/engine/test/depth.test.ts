import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAssets, type AssetsFile } from "@kerb/adapters";
import { dec, type DecString } from "@kerb/types";
import { assetDepth, type DepthParams, type ObservedSnapshot } from "../src/depth.js";

const cfg = loadAssets();
const params: DepthParams = {
  ladder: ["1000", "10000"] as DecString[], fragmentationFactorMulti: "0.8" as DecString, stalenessMaxSec: 300,
  crosscheckMax: "0.25" as DecString, minVenueC1: "100" as DecString,
};
const dir = resolve(__dirname, "../../../data/fixtures/v3math");
const AT = Date.parse("2026-09-19T07:00:00Z");

/** Real captured snapshots, all stamped as observed 60s before the report. */
function snaps(ageSec = 60): Map<string, ObservedSnapshot> {
  const m = new Map<string, ObservedSnapshot>();
  for (const f of readdirSync(dir)) {
    const x = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as { snapshot: ObservedSnapshot["snapshot"] };
    m.set(x.snapshot.pool.toLowerCase(), { observedAtMs: AT - ageSec * 1000, contentHash: `0x${f}`, snapshot: x.snapshot });
  }
  return m;
}
const asset = (sym: string) => cfg.assets.find((a) => a.symbol === sym)!;

describe("assetDepth", () => {
  it("single-venue USDG asset: one venue, factor 1, provenance of inputs recorded", () => {
    const d = assetDepth(cfg, asset("KOx"), snaps(), AT, params);
    expect(d.venues).toHaveLength(1);
    expect(d.fragmentationFactor).toBe("1");
    expect(dec(d.C_1).gt(0)).toBe(true);
    expect(d.inputs[0]?.pool).toBe(asset("KOx").pool?.address);
    expect(d.crosscheck).toMatchObject({ status: "unavailable", rung: 2 });
  });

  it("xETH-quoted asset routes through xETH/USDG and records the path", () => {
    const d = assetDepth(cfg, asset("COINx"), snaps(), AT, params);
    const eth = d.venues.find((v) => v.path.includes("xETH"))!;
    expect(eth.path).toEqual(["wCOINx", "xETH", "USDG"]);
    expect(eth.pools).toHaveLength(2);
    expect(d.inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("dust venues are excluded with a reason, so they cannot lower depth via fragmentation", () => {
    const d = assetDepth(cfg, asset("BMNRx"), snaps(), AT, params);
    expect(d.excluded.some((x) => x.reason.startsWith("dust"))).toBe(true);
    expect(d.fragmentationFactor).toBe("1");
    expect(dec(d.C_1).gte(dec(d.venues[0]!.C_1.notional))).toBe(true);
  });

  it("stale observations are excluded; with none eligible depth is zero", () => {
    const d = assetDepth(cfg, asset("KOx"), snaps(600), AT, params);
    expect(d.venues).toHaveLength(0);
    expect(d.C_1).toBe("0");
    expect(d.excluded[0]?.reason).toMatch(/^stale/);
  });

  it("a missing observation is recorded, not guessed", () => {
    const m = snaps();
    m.delete(asset("HKEXCx").pool!.address.toLowerCase());
    const d = assetDepth(cfg, asset("HKEXCx"), m, AT, params);
    expect(d.excluded[0]?.reason).toBe("no observation");
  });

  it("a path without a leg-two route is excluded", () => {
    const noRoutes: AssetsFile = { ...cfg, routes: [] };
    const d = assetDepth(noRoutes, asset("SLVx"), snaps(), AT, params);
    expect(d.venues).toHaveLength(0);
    expect(d.excluded[0]?.reason).toBe("no USDC->USDG route");
  });

  it("a stale second leg excludes the whole path", () => {
    const m = snaps();
    const route = cfg.routes.find((r) => r.from === "xETH")!;
    const o = m.get(route.pool.address.toLowerCase())!;
    m.set(route.pool.address.toLowerCase(), { ...o, observedAtMs: AT - 3_600_000 });
    const d = assetDepth(cfg, asset("COINx"), m, AT, params);
    expect(d.venues.some((v) => v.path.includes("xETH"))).toBe(false);
    expect(d.excluded.some((x) => x.path.includes("xETH") && x.reason.startsWith("stale"))).toBe(true);
  });

  it("is deterministic", () => {
    expect(assetDepth(cfg, asset("KOx"), snaps(), AT, params)).toEqual(assetDepth(cfg, asset("KOx"), snaps(), AT, params));
  });
});
