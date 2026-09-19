/**
 * ARCHITECTURE.md section 5. Observation tables are APPEND-ONLY: a database trigger
 * (migration 0001_append_only) rejects every UPDATE, DELETE and TRUNCATE on them.
 * Never delete. Roll forward.
 *
 * Numeric values are stored as NUMERIC and read back as strings, never floats.
 */
import { bigint, bigserial, customType, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Content-addressed raw payload store. cid = "keccak256:0x..." of the uncompressed bytes. */
export const blobs = pgTable("blobs", {
  cid: text("cid").primaryKey(),
  contentHash: text("content_hash").notNull(),
  mediaType: text("media_type").notNull(),
  encoding: text("encoding").notNull(),
  size: integer("size").notNull(),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const obsPoolState = pgTable(
  "obs_pool_state",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    chainId: integer("chain_id").notNull(),
    pool: text("pool").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockHash: text("block_hash").notNull(),
    blockTs: timestamp("block_ts", { withTimezone: true }).notNull(),
    sqrtPriceX96: numeric("sqrt_price_x96").notNull(),
    tick: integer("tick").notNull(),
    liquidity: numeric("liquidity").notNull(),
    tickSpacing: integer("tick_spacing").notNull(),
    fee: integer("fee").notNull(),
    ticksCount: integer("ticks_count").notNull(),
    ticksBlobCid: text("ticks_blob_cid").notNull(),
    source: text("source").notNull(),
    contentHash: text("content_hash").notNull(),
    mode: text("mode").notNull(),
  },
  (t) => [index("obs_pool_state_pool_ts").on(t.pool, t.ts), index("obs_pool_state_ts").on(t.ts)],
);

export const obsPrice = pgTable(
  "obs_price",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    /** keccak256(abi.encode(chainId, token)) of the asset, or null for FX / non-asset feeds. */
    assetId: text("asset_id"),
    symbol: text("symbol").notNull(),
    source: text("source").notNull(),
    value: numeric("value").notNull(),
    currency: text("currency").notNull(),
    /** Publish time reported by the source itself (e.g. Pyth publish_time), if any. */
    sourceTs: timestamp("source_ts", { withTimezone: true }),
    confidence: numeric("confidence"),
    rawBlobCid: text("raw_blob_cid").notNull(),
    contentHash: text("content_hash").notNull(),
    mode: text("mode").notNull(),
  },
  (t) => [index("obs_price_symbol_ts").on(t.symbol, t.ts), index("obs_price_source_ts").on(t.source, t.ts)],
);

export const obsMultiplier = pgTable(
  "obs_multiplier",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    assetId: text("asset_id").notNull(),
    symbol: text("symbol").notNull(),
    source: text("source").notNull(),
    multiplier: numeric("multiplier").notNull(),
    /** Scheduled next multiplier and activation (issuer schedule), when the source reports one. */
    pendingMultiplier: numeric("pending_multiplier"),
    pendingActivatesAt: timestamp("pending_activates_at", { withTimezone: true }),
    /** Wrapper convertToAssets(1e18)/1e18 at the same block, for onchain rows. */
    wrapperAssetsPerShare: numeric("wrapper_assets_per_share"),
    blockNumber: bigint("block_number", { mode: "bigint" }),
    halted: text("halted"),
    rawBlobCid: text("raw_blob_cid").notNull(),
    contentHash: text("content_hash").notNull(),
    mode: text("mode").notNull(),
  },
  (t) => [index("obs_multiplier_symbol_ts").on(t.symbol, t.ts)],
);

/** Aggregator sell quotes, populated from phase 1 (K-08 cross-check). */
export const obsQuote = pgTable("obs_quote", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  assetId: text("asset_id").notNull(),
  notional: numeric("notional").notNull(),
  quoteOut: numeric("quote_out").notNull(),
  source: text("source").notNull(),
  rawBlobCid: text("raw_blob_cid").notNull(),
  contentHash: text("content_hash").notNull(),
  mode: text("mode").notNull(),
});

/** A failed source says it failed (AGENTS.md 2.1). Every failed read is recorded, never hidden. */
export const obsSourceError = pgTable(
  "obs_source_error",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    loop: text("loop").notNull(),
    source: text("source").notNull(),
    subject: text("subject").notNull(),
    error: text("error").notNull(),
    httpStatus: integer("http_status"),
    rawBlobCid: text("raw_blob_cid"),
    mode: text("mode").notNull(),
  },
  (t) => [index("obs_source_error_ts").on(t.ts)],
);

/** One row per loop cycle, so gaps in the record are measurable (not inferred). */
export const collectorCycles = pgTable(
  "collector_cycles",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    loop: text("loop").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    ok: integer("ok").notNull(),
    failed: integer("failed").notNull(),
    mode: text("mode").notNull(),
    host: text("host").notNull(),
    detail: jsonb("detail"),
  },
  (t) => [index("collector_cycles_loop_started").on(t.loop, t.startedAt)],
);

export const inputBundles = pgTable(
  "input_bundles",
  {
    hash: text("hash").primaryKey(),
    cid: text("cid"),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    assetId: text("asset_id").notNull(),
    size: integer("size").notNull(),
  },
  (t) => [uniqueIndex("input_bundles_cid").on(t.cid)],
);
