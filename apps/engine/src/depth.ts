/**
 * Depth assembly for KTS-0.1 section 5. Pure: config, snapshots and the report time are
 * inputs; no clock reads, no network, no randomness.
 */
import type { AssetConfig, AssetsFile, PoolRef } from "@kerb/adapters";
import { aggregate, venueDepth, type AggregateDepth, type Exclusion, type Leg, type VenueSnapshot } from "@kerb/v3math";
import { dec, type DecString } from "@kerb/types";

export interface DepthParams {
  ladder: DecString[];
  fragmentationFactorMulti: DecString;
  stalenessMaxSec: number;
  crosscheckMax: DecString;
  /** Venues whose own C(1%) is below this are excluded as dust, so they cannot trigger fragmentation. */
  minVenueC1: DecString;
}

/** A recorded pool snapshot (the collector's blob) with the time it was observed. */
export interface ObservedSnapshot {
  observedAtMs: number;
  contentHash: string;
  snapshot: {
    pool: string; token0: string; token1: string; sqrtPriceX96: string; tick: number; liquidity: string; fee: number; tickSpacing: number;
    ticks: { tick: number; liquidityNet: string }[]; bitmapWords: { lower: number; upper: number };
  };
}

export interface DepthResult extends AggregateDepth {
  asset: string;
  loanAsset: string;
  inputs: { pool: string; observedAt: string; contentHash: string }[];
  crosscheck: { source: "okx-dex"; status: "unavailable"; reason: string; rung: 2 } | { source: "okx-dex"; status: "applied"; rung: 1 };
}

function decimalsOf(cfg: AssetsFile, a: AssetConfig, addr: string): number {
  const x = addr.toLowerCase();
  if (a.wrapper && a.wrapper.address.toLowerCase() === x) return a.wrapper.decimals;
  if (a.token.address.toLowerCase() === x) return a.token.decimals;
  for (const q of Object.values(cfg.quoteTokens)) if (q.address.toLowerCase() === x) return q.decimals;
  throw new Error(`unknown decimals for ${addr}`);
}

function toVenue(cfg: AssetsFile, a: AssetConfig, o: ObservedSnapshot): VenueSnapshot {
  const s = o.snapshot;
  return {
    pool: s.pool, token0: s.token0, token1: s.token1, decimals0: decimalsOf(cfg, a, s.token0), decimals1: decimalsOf(cfg, a, s.token1),
    sqrtPriceX96: s.sqrtPriceX96, tick: s.tick, liquidity: s.liquidity, fee: s.fee, tickSpacing: s.tickSpacing, ticks: s.ticks, bitmapWords: s.bitmapWords,
  };
}

export function assetDepth(
  cfg: AssetsFile, a: AssetConfig, snaps: Map<string, ObservedSnapshot>, atMs: number, p: DepthParams,
  crosscheckUnavailableReason = "OKX DEX quote API credentials not configured",
): DepthResult {
  const sellSym = a.poolToken === "wrapper" && a.wrapper ? a.wrapper.symbol : a.token.symbol;
  const sellAddr = a.poolToken === "wrapper" && a.wrapper ? a.wrapper.address : a.token.address;
  const venues = [];
  const excluded: Exclusion[] = [];
  const inputs: DepthResult["inputs"] = [];

  const fresh = (pool: PoolRef, path: string[]): ObservedSnapshot | null => {
    const o = snaps.get(pool.address.toLowerCase());
    if (!o) { excluded.push({ path, pools: [pool.address], reason: "no observation" }); return null; }
    const age = (atMs - o.observedAtMs) / 1000;
    if (age > p.stalenessMaxSec || age < 0) { excluded.push({ path, pools: [pool.address], reason: `stale: observed ${Math.round(age)}s before report` }); return null; }
    return o;
  };

  for (const v of a.venues) {
    const path = [sellSym, v.quote];
    const legs: Leg[] = [];
    const o1 = fresh(v, path);
    if (!o1) continue;
    legs.push({ venue: toVenue(cfg, a, o1), sellToken: sellAddr, symbols: [sellSym, v.quote] });
    const used = [o1];
    if (v.quote !== cfg.loanAsset) {
      const route = cfg.routes.find((r) => r.from === v.quote && r.to === cfg.loanAsset);
      path.push(cfg.loanAsset);
      if (!route) { excluded.push({ path, pools: [v.address], reason: `no ${v.quote}->${cfg.loanAsset} route` }); continue; }
      const o2 = fresh(route.pool, path);
      if (!o2) continue;
      const quote = cfg.quoteTokens[v.quote];
      if (!quote) { excluded.push({ path, pools: [v.address], reason: `unknown quote ${v.quote}` }); continue; }
      legs.push({ venue: toVenue(cfg, a, o2), sellToken: quote.address, symbols: [v.quote, cfg.loanAsset] });
      used.push(o2);
    }
    try {
      const vd = venueDepth(legs, p.ladder);
      if (dec(vd.C_1.notional).lt(dec(p.minVenueC1))) {
        excluded.push({ path, pools: legs.map((l) => l.venue.pool), reason: `dust: C(1%) ${vd.C_1.notional} below minVenueC1 ${p.minVenueC1}` });
        continue;
      }
      venues.push(vd);
      for (const u of used) inputs.push({ pool: u.snapshot.pool, observedAt: new Date(u.observedAtMs).toISOString(), contentHash: u.contentHash });
    } catch (e) {
      excluded.push({ path, pools: legs.map((l) => l.venue.pool), reason: `simulation failed: ${(e as Error).message}` });
    }
  }
  const agg = aggregate(venues, excluded, { fragmentationMulti: p.fragmentationFactorMulti });
  return { ...agg, asset: a.symbol, loanAsset: cfg.loanAsset, inputs, crosscheck: { source: "okx-dex", status: "unavailable", reason: crosscheckUnavailableReason, rung: 2 } };
}
