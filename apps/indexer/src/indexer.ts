/**
 * Chain events into Postgres. Idempotent by (chain, tx, logIndex), reorg-aware by block
 * hash, and restartable from a stored cursor. Postgres is a rebuildable view of the chain:
 * if it is lost, re-running from the deployment block reconstructs it exactly.
 */
import { getAddress, type Address, type Hex, type Log, type PublicClient } from "viem";
import { sql as raw } from "drizzle-orm";
import { chainEvents, indexerCursor, regimeEvents, termsReports } from "@kerb/collector/schema";
import type { Db, Sql } from "@kerb/collector/db";
import { GUARDRAILS_UPDATED, HALT_SET, TERMS_POSTED, ASSET_MARKET_SET } from "./events.js";

/** The public RPC caps eth_getLogs at 100 blocks. */
export const MAX_RANGE = 100n;
/** Blocks behind the head that are treated as settled; anything newer may still reorg. */
export const CONFIRMATIONS = 3n;

export interface IndexerConfig {
  chainId: number;
  name: string;
  terms: Address;
  clock: Address;
  fromBlock: bigint;
  symbols: Map<string, string>;
}

export interface Cursor {
  lastBlock: bigint;
  lastBlockHash: Hex;
}

export async function readCursor(sql: Sql, chainId: number, name: string): Promise<Cursor | null> {
  const [row] = await sql<{ last_block: string; last_block_hash: string }[]>`
    SELECT last_block, last_block_hash FROM indexer_cursor WHERE chain_id = ${chainId} AND name = ${name}`;
  return row ? { lastBlock: BigInt(row.last_block), lastBlockHash: row.last_block_hash as Hex } : null;
}

export async function writeCursor(db: Db, chainId: number, name: string, c: Cursor): Promise<void> {
  await db
    .insert(indexerCursor)
    .values({ chainId, name, lastBlock: c.lastBlock, lastBlockHash: c.lastBlockHash, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [indexerCursor.chainId, indexerCursor.name],
      set: { lastBlock: c.lastBlock, lastBlockHash: c.lastBlockHash, updatedAt: new Date() },
    });
}

/** Unwind everything at or after `fromBlock`: derived tables only, never an observation. */
export async function rollback(sql: Sql, chainId: number, fromBlock: bigint): Promise<number> {
  const r = await sql`DELETE FROM chain_events WHERE chain_id = ${chainId} AND block_number >= ${fromBlock.toString()}`;
  await sql`DELETE FROM terms_reports WHERE chain_id = ${chainId} AND block_number >= ${fromBlock.toString()}`;
  await sql`DELETE FROM regime_events WHERE chain_id = ${chainId} AND block_number >= ${fromBlock.toString()}`;
  return r.count ?? 0;
}

function eventName(log: Log): string {
  return (log as unknown as { eventName?: string }).eventName ?? "unknown";
}

function jsonArgs(args: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as Record<string, unknown>;
}

export interface IndexResult {
  fromBlock: bigint;
  toBlock: bigint;
  events: number;
  inserted: number;
  reorgFrom: bigint | null;
}

/**
 * Index one window. Returns what it did so a caller can log it and a test can assert it.
 * Re-indexing the same window inserts nothing new.
 */
export async function indexOnce(client: PublicClient, db: Db, sql: Sql, cfg: IndexerConfig): Promise<IndexResult> {
  const head = await client.getBlockNumber();
  const safeHead = head > CONFIRMATIONS ? head - CONFIRMATIONS : 0n;
  const cursor = await readCursor(sql, cfg.chainId, cfg.name);
  let reorgFrom: bigint | null = null;
  let start = cfg.fromBlock;

  if (cursor) {
    // A reorg shows up as the stored block hash no longer matching the chain.
    const block = await client.getBlock({ blockNumber: cursor.lastBlock }).catch(() => null);
    if (!block || block.hash !== cursor.lastBlockHash) {
      reorgFrom = cursor.lastBlock > 20n ? cursor.lastBlock - 20n : cfg.fromBlock;
      await rollback(sql, cfg.chainId, reorgFrom);
      start = reorgFrom;
    } else {
      start = cursor.lastBlock + 1n;
    }
  }
  if (start > safeHead) return { fromBlock: start, toBlock: safeHead, events: 0, inserted: 0, reorgFrom };

  let events = 0;
  let inserted = 0;
  let lastBlock = start > 0n ? start - 1n : 0n;
  let lastHash: Hex = cursor?.lastBlockHash ?? ("0x" as Hex);

  for (let from = start; from <= safeHead; from += MAX_RANGE) {
    const to = from + MAX_RANGE - 1n > safeHead ? safeHead : from + MAX_RANGE - 1n;
    const logs = await client.getLogs({
      address: [cfg.terms, cfg.clock],
      events: [TERMS_POSTED, GUARDRAILS_UPDATED, HALT_SET, ASSET_MARKET_SET],
      fromBlock: from,
      toBlock: to,
    });
    const blockTs = new Map<bigint, Date>();
    for (const log of logs) {
      events++;
      if (!blockTs.has(log.blockNumber)) {
        const b = await client.getBlock({ blockNumber: log.blockNumber });
        blockTs.set(log.blockNumber, new Date(Number(b.timestamp) * 1000));
      }
      const ts = blockTs.get(log.blockNumber) as Date;
      const args = (log as unknown as { args: Record<string, unknown> }).args;
      const assetId = typeof args["assetId"] === "string" ? (args["assetId"] as string) : null;
      const name = eventName(log);

      const ins = await db.insert(chainEvents).values({
        chainId: cfg.chainId, address: getAddress(log.address), event: name,
        blockNumber: log.blockNumber, blockHash: log.blockHash as string, blockTs: ts,
        txHash: log.transactionHash as string, logIndex: log.logIndex ?? 0, assetId, args: jsonArgs(args),
      }).onConflictDoNothing();
      inserted += ins.count ?? 0;

      if (name === "TermsPosted" && assetId) {
        const symbol = cfg.symbols.get(assetId.toLowerCase()) ?? null;
        const observedAt = new Date(Number(args["observedAt"]) * 1000);
        const regime = Number(args["regime"]);
        await db.insert(termsReports).values({
          chainId: cfg.chainId, assetId, symbol, observedAt, regime,
          creditMark: String(args["creditMark"]), carryLtv: String(args["carryLTV"]), sessionMaxLtv: String(args["sessionMaxLTV"]),
          debtCeiling: String(args["debtCeiling"]), executableDepth1: String(args["executableDepth1"]),
          inputsHash: String(args["inputsHash"]), attester: getAddress(String(args["attester"])),
          txHash: log.transactionHash as string, blockNumber: log.blockNumber, blockHash: log.blockHash as string,
        }).onConflictDoNothing();

        // A regime event is the difference between this report and the previous one.
        const [prev] = await sql<{ regime: number }[]>`
          SELECT regime FROM terms_reports WHERE chain_id = ${cfg.chainId} AND asset_id = ${assetId}
            AND (observed_at < ${observedAt.toISOString()} OR (observed_at = ${observedAt.toISOString()} AND tx_hash <> ${log.transactionHash}))
          ORDER BY observed_at DESC LIMIT 1`;
        if (!prev || prev.regime !== regime) {
          await db.insert(regimeEvents).values({
            chainId: cfg.chainId, assetId, symbol, fromRegime: prev?.regime ?? null, toRegime: regime,
            observedAt, txHash: log.transactionHash as string, blockNumber: log.blockNumber,
          }).onConflictDoNothing();
        }
      }
    }
    const endBlock = await client.getBlock({ blockNumber: to });
    lastBlock = to;
    lastHash = endBlock.hash;
    await writeCursor(db, cfg.chainId, cfg.name, { lastBlock, lastBlockHash: lastHash });
  }
  void raw;
  return { fromBlock: start, toBlock: lastBlock, events, inserted, reorgFrom };
}
