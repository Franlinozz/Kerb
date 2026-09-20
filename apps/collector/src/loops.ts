import { hostname } from "node:os";
import { assetId, dec, fromUnits, toDecString, toUnitsFloor, type DecString } from "@kerb/types";
import { HttpError, pythValue, resolvedAssets, type AssetConfig, type AssetsFile, type PoolRef } from "@kerb/adapters";
import { canonicalJson } from "@kerb/types";
import type { Db, Sql } from "./db/client.js";
import { collectorCycles, obsMultiplier, obsPoolState, obsPrice, obsQuote, obsSourceError } from "./db/schema.js";
import { putBlob } from "./store.js";
import type { Providers } from "./providers/types.js";

export type LoopName = "pools" | "prices" | "multipliers" | "quotes";

/** Sale sizes (loan-asset units) quoted for the cross-check, and the spacing between calls. */
export const QUOTE_LADDER: DecString[] = ["1000", "5000", "10000", "25000"] as DecString[];
const QUOTE_SPACING_MS = 1_200;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface LoopResult {
  ok: number;
  failed: number;
  detail: Record<string, unknown>;
}

interface Ctx {
  db: Db;
  sql: Sql;
  p: Providers;
  cfg: AssetsFile;
}

const src = (ctx: Ctx, s: string): string => (ctx.p.mode === "fixture" ? `fixture:${s}` : s);

async function recordError(ctx: Ctx, loop: LoopName, source: string, subject: string, e: unknown): Promise<void> {
  let httpStatus: number | null = null;
  let rawBlobCid: string | null = null;
  if (e instanceof HttpError) {
    httpStatus = e.raw.status;
    rawBlobCid = (await putBlob(ctx.db, e.raw.body, "text/plain")).cid;
  }
  const msg = (e instanceof Error ? e.message : String(e)).split("\n")[0]?.slice(0, 500) ?? "error";
  await ctx.db.insert(obsSourceError).values({
    ts: new Date(), loop, source: src(ctx, source), subject, error: msg, httpStatus, rawBlobCid, mode: ctx.p.mode,
  });
  console.warn(`[${loop}] ${source} ${subject} FAILED: ${msg}`);
}

/** Every unique pool: asset venues plus leg-two routes. */
export function allPools(cfg: AssetsFile): { label: string; pool: PoolRef }[] {
  const seen = new Map<string, { label: string; pool: PoolRef }>();
  for (const a of resolvedAssets(cfg)) {
    for (const v of a.venues) if (!seen.has(v.address)) seen.set(v.address, { label: `${a.symbol}/${v.quote}`, pool: v });
  }
  for (const r of cfg.routes) if (!seen.has(r.pool.address)) seen.set(r.pool.address, { label: `${r.from}/${r.to}`, pool: r.pool });
  return [...seen.values()];
}

export async function poolsCycle(ctx: Ctx): Promise<LoopResult> {
  const block = await ctx.p.blockNumber();
  const pools = allPools(ctx.cfg);
  let ok = 0;
  let failed = 0;
  await Promise.all(
    pools.map(async ({ label, pool }) => {
      try {
        const snap = await ctx.p.poolSnapshot(pool, block);
        const blob = await putBlob(ctx.db, canonicalJson(snap), "application/json");
        await ctx.db.insert(obsPoolState).values({
          ts: new Date(), chainId: snap.chainId, pool: snap.pool, blockNumber: BigInt(snap.blockNumber), blockHash: snap.blockHash,
          blockTs: new Date(Number(snap.blockTimestamp) * 1000), sqrtPriceX96: snap.sqrtPriceX96, tick: snap.tick,
          liquidity: snap.liquidity, tickSpacing: snap.tickSpacing, fee: snap.fee, ticksCount: snap.ticks.length,
          ticksBlobCid: blob.cid, source: src(ctx, "xlayer:uniswap-v3"), contentHash: blob.contentHash, mode: ctx.p.mode,
        });
        ok++;
      } catch (e) {
        failed++;
        await recordError(ctx, "pools", "xlayer:uniswap-v3", `${label}:${pool.address}`, e);
      }
    }),
  );
  return { ok, failed, detail: { block: block.toString(), pools: pools.length } };
}

export async function pricesCycle(ctx: Ctx): Promise<LoopResult> {
  const assets = resolvedAssets(ctx.cfg);
  let ok = 0;
  let failed = 0;

  // xStocks issuer price, one request per asset.
  await Promise.all(
    assets.map(async (a) => {
      try {
        const { raw, quote } = await ctx.p.xstocksPrice(a.symbol);
        const blob = await putBlob(ctx.db, raw.body, "application/json");
        await ctx.db.insert(obsPrice).values({
          ts: new Date(raw.fetchedAt), assetId: assetId(196, a.token.address), symbol: a.symbol, source: src(ctx, "xstocks:price-data"),
          value: quote, currency: "USD", sourceTs: null, confidence: null, rawBlobCid: blob.cid, contentHash: blob.contentHash, mode: ctx.p.mode,
        });
        ok++;
      } catch (e) {
        failed++;
        await recordError(ctx, "prices", "xstocks:price-data", a.symbol, e);
      }
    }),
  );

  // Yahoo chart: independent third-party reference per underlying, plus FX for non-USD underlyings.
  const ySubjects: { symbol: string; aid: string | null; id: string; label: string }[] = [];
  for (const a of assets) for (const r of a.references) if (r.source === "yahoo") ySubjects.push({ symbol: a.symbol, aid: assetId(196, a.token.address), id: r.id, label: a.symbol });
  for (const f of ctx.cfg.fx) if (f.source === "yahoo") ySubjects.push({ symbol: f.symbol, aid: null, id: f.id, label: f.symbol });
  await Promise.all(
    ySubjects.map(async (y) => {
      try {
        const q = await ctx.p.yahoo(y.id);
        const blob = await putBlob(ctx.db, q.raw.body, "application/json");
        await ctx.db.insert(obsPrice).values({
          ts: new Date(q.raw.fetchedAt), assetId: y.aid, symbol: y.label, source: src(ctx, `yahoo:chart:${y.id}`),
          value: q.price, currency: q.currency, sourceTs: new Date(q.marketTime * 1000), confidence: null,
          rawBlobCid: blob.cid, contentHash: blob.contentHash, mode: ctx.p.mode,
        });
        ok++;
      } catch (e) {
        failed++;
        await recordError(ctx, "prices", `yahoo:chart`, `${y.label}:${y.id}`, e);
      }
    }),
  );

  // Pyth Hermes: one batched request for every asset feed plus FX. Requires PYTH_API_KEY since Sep 2026.
  const feeds: { symbol: string; aid: string | null; feed: { id: string; symbol: string; currency: string } }[] = [];
  for (const a of assets) for (const r of a.references) if (r.source === "pyth") feeds.push({ symbol: a.symbol, aid: assetId(196, a.token.address), feed: r });
  for (const f of ctx.cfg.fx) if (f.source === "pyth") feeds.push({ symbol: f.symbol, aid: null, feed: f });
  if (feeds.length > 0 && ctx.p.pythEnabled) {
    try {
      const res = await ctx.p.pyth(feeds.map((f) => f.feed.id));
      const blob = await putBlob(ctx.db, res.raw.body, "application/json");
      const byId = new Map(res.parsed.map((p) => [`0x${p.id.replace(/^0x/, "")}`, p]));
      for (const f of feeds) {
        const p = byId.get(f.feed.id);
        if (!p) {
          failed++;
          await recordError(ctx, "prices", "pyth:hermes", `${f.symbol}:${f.feed.symbol}`, new Error("feed missing from response"));
          continue;
        }
        await ctx.db.insert(obsPrice).values({
          ts: new Date(res.raw.fetchedAt), assetId: f.aid, symbol: f.aid ? f.symbol : f.feed.symbol, source: src(ctx, `pyth:hermes:${f.feed.symbol}`),
          value: pythValue(p.price), currency: f.feed.currency, sourceTs: new Date(p.price.publish_time * 1000),
          confidence: pythValue({ price: p.price.conf, expo: p.price.expo }), rawBlobCid: blob.cid, contentHash: blob.contentHash, mode: ctx.p.mode,
        });
        ok++;
      }
    } catch (e) {
      failed += feeds.length;
      await recordError(ctx, "prices", "pyth:hermes", "batch", e);
    }
  }
  return { ok, failed, detail: { assets: assets.length, yahoo: ySubjects.length, pyth: ctx.p.pythEnabled ? feeds.length : "disabled: no PYTH_API_KEY" } };
}

export async function multipliersCycle(ctx: Ctx): Promise<LoopResult> {
  const assets = resolvedAssets(ctx.cfg);
  const block = await ctx.p.blockNumber();
  let ok = 0;
  let failed = 0;
  await Promise.all(
    assets.map(async (a: AssetConfig) => {
      const aid = assetId(196, a.token.address);
      // Issuer: multiplier plus scheduled activation (corporate action schedule, rung 1 partial).
      try {
        const [m, info] = await Promise.all([ctx.p.xstocksMultiplier(a.symbol), ctx.p.xstocksAsset(a.symbol)]);
        const blob = await putBlob(ctx.db, m.raw.body, "application/json");
        await putBlob(ctx.db, info.raw.body, "application/json");
        const act = Number(m.activationDateTime);
        const pending = act > 0 && m.next !== "0";
        await ctx.db.insert(obsMultiplier).values({
          ts: new Date(m.raw.fetchedAt), assetId: aid, symbol: a.symbol, source: src(ctx, "xstocks:multiplier"),
          multiplier: m.current, pendingMultiplier: pending ? m.next : null,
          pendingActivatesAt: pending ? new Date(act < 1e12 ? act * 1000 : act) : null,
          wrapperAssetsPerShare: null, blockNumber: null, halted: String(info.halted),
          rawBlobCid: blob.cid, contentHash: blob.contentHash, mode: ctx.p.mode,
        });
        ok++;
      } catch (e) {
        failed++;
        await recordError(ctx, "multipliers", "xstocks:multiplier", a.symbol, e);
      }
      // Chain: token multiplier(), paused(), wrapper convertToAssets at a pinned block (rung 2 detection).
      try {
        const oc = await ctx.p.onchainMultiplier(a, block);
        const blob = await putBlob(ctx.db, oc.raw, "application/json");
        await ctx.db.insert(obsMultiplier).values({
          ts: new Date(), assetId: aid, symbol: a.symbol, source: src(ctx, "xlayer:token-multiplier"),
          multiplier: oc.multiplier as DecString, pendingMultiplier: null, pendingActivatesAt: null,
          wrapperAssetsPerShare: oc.wrapperAssetsPerShare, blockNumber: BigInt(oc.blockNumber),
          halted: oc.paused === null ? null : String(oc.paused), rawBlobCid: blob.cid, contentHash: blob.contentHash, mode: ctx.p.mode,
        });
        ok++;
      } catch (e) {
        failed++;
        await recordError(ctx, "multipliers", "xlayer:token-multiplier", a.symbol, e);
      }
    }),
  );
  return { ok, failed, detail: { block: block.toString(), assets: assets.length } };
}

export const CYCLES: Record<LoopName, { everyMs: number; timeoutMs: number; run: (ctx: Ctx) => Promise<LoopResult> }> = {
  pools: { everyMs: 60_000, timeoutMs: 55_000, run: poolsCycle },
  prices: { everyMs: 30_000, timeoutMs: 29_000, run: pricesCycle },
  multipliers: { everyMs: 600_000, timeoutMs: 120_000, run: multipliersCycle },
  quotes: { everyMs: 300_000, timeoutMs: 280_000, run: quotesCycle },
};

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e: unknown) => { clearTimeout(t); reject(e instanceof Error ? e : new Error(String(e))); });
  });
}

/** Independent schedule per loop. The next start is aligned to the interval; an overrun never overlaps. */
export function startLoop(ctx: Ctx, name: LoopName, onCycle: (name: LoopName, r: LoopResult | Error) => void): () => void {
  const { everyMs, timeoutMs, run } = CYCLES[name];
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    const startedAt = new Date();
    let res: LoopResult | Error;
    try {
      res = await withTimeout(run(ctx), timeoutMs, `${name} cycle`);
    } catch (e) {
      res = e instanceof Error ? e : new Error(String(e));
      await recordError(ctx, name, `collector:${name}`, "cycle", res).catch(() => {});
    }
    const finishedAt = new Date();
    await ctx.db
      .insert(collectorCycles)
      .values({
        loop: name, startedAt, finishedAt, ok: res instanceof Error ? 0 : res.ok, failed: res instanceof Error ? 1 : res.failed,
        mode: ctx.p.mode, host: hostname(), detail: res instanceof Error ? { error: res.message } : res.detail,
      })
      .catch((e: unknown) => console.error(`[${name}] could not record cycle`, e));
    onCycle(name, res);
    const next = Math.max(1_000, everyMs - (finishedAt.getTime() - startedAt.getTime()));
    if (!stopped) timer = setTimeout(() => void tick(), next);
  };
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * KTS-0.1 section 5.4: independent sell quotes from the OKX DEX aggregator at the notional
 * ladder, so the tick-walk simulation can be cross-checked. Runs only when credentials are
 * configured; otherwise depth stays on rung 2 and the report says so.
 */
export async function quotesCycle(ctx: Ctx): Promise<LoopResult> {
  if (!ctx.p.okxQuote) return { ok: 0, failed: 0, detail: { skipped: "no OKX DEX credentials: depth cross-check on rung 2" } };
  const assets = resolvedAssets(ctx.cfg);
  const loan = ctx.cfg.quoteTokens[ctx.cfg.loanAsset];
  if (!loan) throw new Error("loan asset missing from quoteTokens");
  const ladder = QUOTE_LADDER;
  let ok = 0;
  let failed = 0;

  for (const a of assets) {
    const sell = a.poolToken === "wrapper" && a.wrapper ? a.wrapper : a.token;
    // Convert a loan-asset notional into a token amount using the freshest reference price
    // and the wrapper exchange rate. Both are observations, both are recorded.
    const [ref] = await ctx.sql<{ value: string }[]>`
      SELECT value FROM obs_price WHERE mode = ${ctx.p.mode} AND symbol = ${a.symbol} AND currency = 'USD'
      ORDER BY ts DESC LIMIT 1`;
    const [mult] = await ctx.sql<{ wrapper_assets_per_share: string | null }[]>`
      SELECT wrapper_assets_per_share FROM obs_multiplier
      WHERE mode = ${ctx.p.mode} AND symbol = ${a.symbol} AND wrapper_assets_per_share IS NOT NULL
      ORDER BY ts DESC LIMIT 1`;
    if (!ref || dec(ref.value).lte(0)) {
      failed++;
      await recordError(ctx, "quotes", "okx-dex", a.symbol, new Error("no fresh USD reference price to size the quote"));
      continue;
    }
    const perShare = mult?.wrapper_assets_per_share ? dec(mult.wrapper_assets_per_share) : dec("1");
    const unitPrice = dec(ref.value).mul(perShare);

    for (const notional of ladder) {
      try {
        const amountIn = dec(notional).div(unitPrice);
        const amountInRaw = toUnitsFloor(toDecString(amountIn, sell.decimals), sell.decimals);
        if (amountInRaw <= 0n) continue;
        const q = await ctx.p.okxQuote({ sellToken: sell.address, buyToken: loan.address, amountInRaw });
        const blob = await putBlob(ctx.db, q.raw.body, "application/json");
        await ctx.db.insert(obsQuote).values({
          ts: new Date(q.raw.fetchedAt), assetId: assetId(196, a.token.address), symbol: a.symbol, notional,
          sellToken: sell.address, buyToken: loan.address,
          amountIn: fromUnits(amountInRaw, sell.decimals),
          quoteOut: fromUnits(q.toTokenAmountRaw, loan.decimals),
          priceImpactPct: q.priceImpactPercent, router: q.router,
          source: src(ctx, "okx-dex:v6-quote"), rawBlobCid: blob.cid, contentHash: blob.contentHash, mode: ctx.p.mode,
        });
        ok++;
      } catch (e) {
        failed++;
        await recordError(ctx, "quotes", "okx-dex", `${a.symbol}:${notional}`, e);
      }
      await sleep(QUOTE_SPACING_MS);
    }
  }
  return { ok, failed, detail: { assets: assets.length, ladder: ladder.length } };
}
