import { describe, expect, it } from "vitest";
import { loadAssets, HttpError, type PoolSnapshot } from "@kerb/adapters";
import { allPools, multipliersCycle, poolsCycle, pricesCycle } from "../src/loops.js";
import { fixtureKey } from "../src/providers/fixture.js";
import type { Providers } from "../src/providers/types.js";
import type { Db } from "../src/db/client.js";

/** Minimal Drizzle stand-in: records every insert, supports onConflictDoNothing. */
function fakeDb() {
  const rows: { table: string; values: Record<string, unknown> }[] = [];
  const db = {
    insert: (t: unknown) => ({
      values: (v: Record<string, unknown>) => {
        const name = (t as Record<symbol, string>)[Symbol.for("drizzle:Name")] ?? "unknown";
        rows.push({ table: name, values: v });
        const p = Promise.resolve();
        return Object.assign(p, { onConflictDoNothing: () => Promise.resolve() });
      },
    }),
  };
  return { db: db as unknown as Db, rows };
}

const cfg = loadAssets();

function snapshot(pool: `0x${string}`): PoolSnapshot {
  return {
    kind: "uniswap-v3-pool-snapshot", version: 1, chainId: 196, pool, blockNumber: "1", blockHash: "0x01", blockTimestamp: "1789790000",
    token0: pool, token1: pool, fee: 500, tickSpacing: 10, sqrtPriceX96: "79228162514264337593543950336", tick: 0, liquidity: "0",
    observationCardinality: 1, twap: { windowSec: 900, error: "OLD" }, coveredTicks: { lower: -2560, upper: 2559 },
    bitmapWords: { lower: -1, upper: 0 }, ticks: [],
  };
}

const raw = (body: string, status = 200) => ({ url: "u", status, fetchedAt: new Date().toISOString(), body, latencyMs: 1 });

function providers(over: Partial<Providers> = {}): Providers {
  return {
    mode: "fixture",
    pythEnabled: false,
    blockNumber: async () => 1n,
    poolSnapshot: async (p) => snapshot(p.address),
    xstocksPrice: async () => ({ raw: raw('{"quote":88.16}'), quote: "88.16" as never }),
    xstocksMultiplier: async () => ({ raw: raw("{}"), current: "1.02" as never, next: "0" as never, activationDateTime: "0", reason: null }),
    xstocksAsset: async () => ({ raw: raw("{}"), halted: false }),
    pyth: async () => { throw new Error("disabled"); },
    yahoo: async () => ({ raw: raw("{}"), price: "88.25" as never, currency: "USD", marketTime: 1789761603 }),
    onchainMultiplier: async () => ({ blockNumber: "1", blockHash: "0x01", multiplier: "1.02" as never, wrapperAssetsPerShare: "1.02" as never, paused: false, raw: "{}" }),
    ...over,
  };
}

describe("allPools", () => {
  it("covers every venue and route exactly once", () => {
    const pools = allPools(cfg);
    const addrs = pools.map((p) => p.pool.address);
    expect(new Set(addrs).size).toBe(addrs.length);
    for (const a of cfg.assets) for (const v of a.venues) expect(addrs).toContain(v.address);
    for (const r of cfg.routes) expect(addrs).toContain(r.pool.address);
  });
});

describe("cycles", () => {
  it("writes one pool row per pool and tags fixture sources", async () => {
    const { db, rows } = fakeDb();
    const r = await poolsCycle({ db, p: providers(), cfg });
    expect(r.failed).toBe(0);
    const obs = rows.filter((x) => x.table === "obs_pool_state");
    expect(obs.length).toBe(allPools(cfg).length);
    expect(obs.every((o) => String(o.values["source"]).startsWith("fixture:"))).toBe(true);
    expect(obs.every((o) => String(o.values["ticksBlobCid"]).startsWith("keccak256:0x"))).toBe(true);
  });

  it("records a source error instead of a row when a source fails", async () => {
    const { db, rows } = fakeDb();
    const r = await pricesCycle({
      db, cfg,
      p: providers({ xstocksPrice: async () => { throw new HttpError(raw('{"quote":null}', 503)); } }),
    });
    expect(r.failed).toBe(cfg.assets.length);
    const errs = rows.filter((x) => x.table === "obs_source_error");
    expect(errs.length).toBe(cfg.assets.length);
    expect(errs[0]?.values["httpStatus"]).toBe(503);
    expect(rows.some((x) => x.table === "obs_price" && String(x.values["source"]).includes("xstocks"))).toBe(false);
  });

  it("keeps going when one pool fails", async () => {
    const { db, rows } = fakeDb();
    const first = allPools(cfg)[0]?.pool.address;
    const r = await poolsCycle({ db, cfg, p: providers({ poolSnapshot: async (p) => { if (p.address === first) throw new Error("rpc down"); return snapshot(p.address); } }) });
    expect(r.failed).toBe(1);
    expect(r.ok).toBe(allPools(cfg).length - 1);
    expect(rows.filter((x) => x.table === "obs_source_error").length).toBe(1);
  });

  it("records issuer and onchain multipliers per asset", async () => {
    const { db, rows } = fakeDb();
    const r = await multipliersCycle({ db, cfg, p: providers() });
    expect(r.ok).toBe(cfg.assets.length * 2);
    expect(rows.filter((x) => x.table === "obs_multiplier").length).toBe(cfg.assets.length * 2);
  });
});

describe("fixtureKey", () => {
  it("is filesystem safe and stable", () => {
    expect(fixtureKey("https://api.xstocks.fi/api/v2/public/assets/BRK.Bx/price-data")).toBe("api.xstocks.fi_api_v2_public_assets_BRK.Bx_price-data");
  });
});
