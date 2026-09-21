/**
 * The impure shell: read observations from the append-only store and assemble an input
 * bundle. Everything after this point is pure (computeReport).
 */
import { gunzipSync } from "node:zlib";
import { loadAssets, type AssetsFile, type PoolSnapshot } from "@kerb/adapters";
import { MARKETS } from "@kerb/calendar";
import { canonicalJson, keccakText, type DecString, type MarketCode } from "@kerb/types";
import type { Sql } from "@kerb/collector/db";
import type { BundleVenue, InputBundle } from "./bundle.js";
import { DEFAULT_STRESS, gapQuantile, seriesDigest, universeGapQuantile, volScalerWithFallback, type DailyBar, type StressConfig } from "./stress.js";
import type { ParamsFile } from "./params.js";

export const ENGINE_VERSION = "kerb-engine@0.1.0";
/** Session counts a horizon can span; the bundle pins a quantile for each. */
export const SESSION_BUCKETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20] as const;

export interface BuildOptions {
  /** Report time. Defaults to the freshest observation, never "now" inside the engine. */
  atMs?: number;
  mode?: "live" | "fixture";
}

async function latestPoolSnapshots(sql: Sql, atMs: number, mode: string): Promise<Map<string, { observedAtMs: number; contentHash: string; snapshot: PoolSnapshot }>> {
  const rows = await sql<{ pool: string; ts: Date; content_hash: string; bytes: Buffer }[]>`
    SELECT DISTINCT ON (p.pool) p.pool, p.ts, p.content_hash, b.bytes
    FROM obs_pool_state p JOIN blobs b ON b.cid = p.ticks_blob_cid
    WHERE p.mode = ${mode} AND p.ts <= ${new Date(atMs).toISOString()} ORDER BY p.pool, p.ts DESC`;
  const m = new Map<string, { observedAtMs: number; contentHash: string; snapshot: PoolSnapshot }>();
  for (const r of rows) {
    m.set(r.pool.toLowerCase(), { observedAtMs: new Date(r.ts).getTime(), contentHash: r.content_hash, snapshot: JSON.parse(gunzipSync(r.bytes).toString("utf8")) as PoolSnapshot });
  }
  return m;
}

/** Bars are immutable history: cache per process so repeated bundles reuse the log cache too. */
const barCache = new Map<string, DailyBar[]>();

async function bars(sql: Sql, underlying: string): Promise<DailyBar[]> {
  const hit = barCache.get(underlying);
  if (hit) return hit;
  const rows = await sql<{ date: string; open: string; close: string }[]>`
    SELECT date, open, close FROM ref_daily_bars WHERE underlying = ${underlying} ORDER BY date ASC`;
  const out = rows.map((r) => ({ date: r.date, open: r.open as DecString, close: r.close as DecString }));
  barCache.set(underlying, out);
  return out;
}

/** Universe quantiles depend only on the (immutable) series, so they are cached per horizon. */
const universeCache = new Map<number, DecString>();

export async function buildBundle(sql: Sql, symbol: string, params: ParamsFile, opts: BuildOptions = {}): Promise<InputBundle> {
  const cfg: AssetsFile = loadAssets();
  const asset = cfg.assets.find((a) => a.symbol === symbol);
  if (!asset || asset.status !== "resolved" || !asset.pool) throw new Error(`asset ${symbol} is not resolved in config/assets.json`);
  const mode = opts.mode ?? "live";
  const stress: StressConfig = params.stress ?? DEFAULT_STRESS;

  const maxRow = (await sql<{ maxTs: Date | null }[]>`SELECT max(ts) AS "maxTs" FROM obs_pool_state WHERE mode = ${mode}`)[0];
  if (opts.atMs === undefined && !maxRow?.maxTs) throw new Error(`no ${mode} pool observations to build a bundle from`);
  const atMs = opts.atMs ?? new Date(maxRow?.maxTs as Date).getTime();
  const snaps = await latestPoolSnapshots(sql, atMs, mode);

  // Venues: the asset's own pools plus the leg-two route for non-loan quotes.
  const sellSym = asset.poolToken === "wrapper" && asset.wrapper ? asset.wrapper.symbol : asset.token.symbol;
  const sellAddr = asset.poolToken === "wrapper" && asset.wrapper ? asset.wrapper.address : asset.token.address;
  const venues: BundleVenue[] = [];
  const decimalsOf = (addr: string): number => {
    const x = addr.toLowerCase();
    if (asset.wrapper && asset.wrapper.address.toLowerCase() === x) return asset.wrapper.decimals;
    if (asset.token.address.toLowerCase() === x) return asset.token.decimals;
    for (const q of Object.values(cfg.quoteTokens)) if (q.address.toLowerCase() === x) return q.decimals;
    throw new Error(`unknown decimals for ${addr}`);
  };
  for (const v of asset.venues) {
    const o = snaps.get(v.address.toLowerCase());
    if (!o) continue;
    venues.push({
      pool: v.address, quote: v.quote, path: [sellSym, v.quote], sellToken: sellAddr, legIndex: 0, pathId: v.address,
      observedAtMs: o.observedAtMs, contentHash: o.contentHash, snapshot: o.snapshot,
      decimals0: decimalsOf(o.snapshot.token0), decimals1: decimalsOf(o.snapshot.token1),
    });
    if (v.quote !== cfg.loanAsset) {
      const route = cfg.routes.find((r) => r.from === v.quote && r.to === cfg.loanAsset);
      const q = cfg.quoteTokens[v.quote];
      const o2 = route ? snaps.get(route.pool.address.toLowerCase()) : undefined;
      if (!route || !q || !o2) continue;
      venues.push({
        pool: route.pool.address, quote: cfg.loanAsset, path: [v.quote, cfg.loanAsset], sellToken: q.address, legIndex: 1, pathId: v.address,
        observedAtMs: o2.observedAtMs, contentHash: o2.contentHash, snapshot: o2.snapshot,
        decimals0: decimalsOf(o2.snapshot.token0), decimals1: decimalsOf(o2.snapshot.token1),
      });
    }
  }
  const refRows = await sql<{ source: string; value: string; currency: string; ts: Date; content_hash: string }[]>`
    SELECT DISTINCT ON (source) source, value, currency, ts, content_hash FROM obs_price
    WHERE mode = ${mode} AND symbol = ${symbol} AND ts <= ${new Date(atMs).toISOString()} ORDER BY source, ts DESC`;
  const fxRows = await sql<{ source: string; value: string; currency: string; ts: Date; content_hash: string }[]>`
    SELECT DISTINCT ON (source) source, value, currency, ts, content_hash FROM obs_price
    WHERE mode = ${mode} AND asset_id IS NULL AND ts <= ${new Date(atMs).toISOString()} ORDER BY source, ts DESC`;
  const multRows = await sql<{ source: string; multiplier: string; wrapper_assets_per_share: string | null; halted: string | null; pending_multiplier: string | null; pending_activates_at: Date | null; ts: Date }[]>`
    SELECT DISTINCT ON (source) source, multiplier, wrapper_assets_per_share, halted, pending_multiplier, pending_activates_at, ts
    FROM obs_multiplier WHERE mode = ${mode} AND symbol = ${symbol} AND ts <= ${new Date(atMs).toISOString()} ORDER BY source, ts DESC`;

  const onchain = multRows.find((r) => r.source.includes("token-multiplier"));
  const issuer = multRows.find((r) => r.source.includes("xstocks:multiplier"));
  if (!onchain) throw new Error(`${symbol}: no onchain multiplier observation`);

  // Latest quote per notional, within the staleness window, for the depth cross-check.
  const quoteRows = await sql<{ source: string; notional: string; amount_in: string | null; quote_out: string; router: string | null; ts: Date; content_hash: string }[]>`
    SELECT DISTINCT ON (notional) source, notional, amount_in, quote_out, router, ts, content_hash
    FROM obs_quote WHERE mode = ${mode} AND symbol = ${symbol} AND ts <= ${new Date(atMs).toISOString()}
      AND ts > ${new Date(atMs - params.depth.stalenessMaxSec * 1000).toISOString()}
    ORDER BY notional, ts DESC`;

  const series = await bars(sql, asset.underlying.symbol);
  const universe: { bars: DailyBar[] }[] = [];
  for (const a of cfg.assets.filter((x) => x.status === "resolved")) universe.push({ bars: await bars(sql, a.underlying.symbol) });

  const gapTable: InputBundle["stress"]["gapQuantileBySessions"] = {};
  for (const k of SESSION_BUCKETS) {
    let fallback = universeCache.get(k);
    if (fallback === undefined) {
      fallback = universeGapQuantile(universe, k, stress);
      universeCache.set(k, fallback);
    }
    const g = gapQuantile(series, k, stress, fallback);
    gapTable[String(k)] = { value: g.value, sampleSize: g.sampleSize, source: g.source };
  }
  const vs = volScalerWithFallback(series, universe, stress);

  const market = asset.underlying.market as MarketCode;
  const pendingMs = issuer?.pending_activates_at ? new Date(issuer.pending_activates_at).getTime() : null;

  return {
    kts: params.kts,
    bundleVersion: 1,
    engineVersion: ENGINE_VERSION,
    paramsVersion: params.paramsVersion,
    calendarVersion: MARKETS[market].sourceNote.slice(0, 0) + "kerb-calendar@0.1.0",
    observedAtMs: atMs,
    asset: {
      chainId: cfg.chainId, symbol: asset.symbol, token: asset.token.address, decimals: asset.token.decimals,
      wrapper: asset.wrapper ? { address: asset.wrapper.address, version: asset.wrapper.version, symbol: asset.wrapper.symbol, decimals: asset.wrapper.decimals, assetsPerShare: (onchain.wrapper_assets_per_share ?? "1") as DecString } : null,
      poolToken: asset.poolToken,
      underlying: { symbol: asset.underlying.symbol, isin: asset.underlying.isin, currency: asset.underlying.currency, listingCountry: asset.underlying.listingCountry, market },
      corporateActionMethod: "multiplier",
      multiplier: {
        onchain: onchain.multiplier as DecString,
        issuer: (issuer?.multiplier ?? null) as DecString | null,
        pending: issuer?.pending_multiplier && pendingMs ? { value: issuer.pending_multiplier as DecString, activatesAtMs: pendingMs } : null,
      },
      halted: { adapter: (issuer?.halted ?? "false") === "true", underlying: (onchain.halted ?? "false") === "true" },
    },
    market: { code: market, cureWindowSec: MARKETS[market].defaultCureWindowSec },
    references: refRows.map((r) => ({ source: r.source, value: r.value as DecString, currency: r.currency, observedAtMs: new Date(r.ts).getTime(), contentHash: r.content_hash })),
    fx: fxRows.map((r) => ({ source: r.source, currency: r.currency, perUsd: r.value as DecString, observedAtMs: new Date(r.ts).getTime(), contentHash: r.content_hash })),
    venues,
    routes: cfg.routes.map((r) => ({ from: r.from, to: r.to, pool: r.pool.address })),
    quotes: quoteRows
      .filter((q) => q.amount_in !== null && Number(q.amount_in) > 0)
      .map((q) => ({
        source: q.source, notional: q.notional as DecString, amountIn: q.amount_in as DecString,
        quoteOut: q.quote_out as DecString, router: q.router, observedAtMs: new Date(q.ts).getTime(), contentHash: q.content_hash,
      }))
      .sort((a, b) => Number(a.notional) - Number(b.notional)),
    stress: {
      seriesDigest: seriesDigest(asset.underlying.symbol, series),
      source: "yahoo:chart (not redistributed; see data/SOURCES.md)",
      bars: series.length,
      firstDate: series[0]?.date ?? null,
      lastDate: series[series.length - 1]?.date ?? null,
      historySufficient: series.length >= stress.minBarsForSufficientHistory,
      gapQuantileBySessions: gapTable,
      volScaler: vs,
    },
    previous: null,
    config: {
      stressQuantile: stress.quantile,
      depth: params.depth,
      mark: params.mark,
      regime: params.regime,
      asymmetry: params.asymmetry,
      capacity: params.capacityDefaults,
      guardrails: params.guardrails.assets[symbol] ?? params.guardrails.default,
      stress,
    },
  };
}

export function bundleDigest(b: InputBundle): string {
  return keccakText(canonicalJson(b));
}
