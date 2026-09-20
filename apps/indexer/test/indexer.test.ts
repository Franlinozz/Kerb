/**
 * Restart, duplicate delivery and reorg behaviour, exercised against a fake chain so the
 * test is deterministic and offline.
 */
import { describe, expect, it, beforeEach } from "vitest";
import type { Address, Hex, PublicClient } from "viem";
import { indexOnce, type IndexerConfig } from "../src/indexer.js";
import type { Db, Sql } from "@kerb/collector/db";

const TERMS = "0x000000000000000000000000000000000000dEaD" as Address;
const CLOCK = "0x000000000000000000000000000000000000bEEF" as Address;
const ASSET = `0x${"11".repeat(32)}` as Hex;

interface FakeLog {
  blockNumber: bigint; blockHash: Hex; transactionHash: Hex; logIndex: number; address: Address;
  eventName: string; args: Record<string, unknown>;
}

/** An in-memory chain and store: enough to prove idempotency, restart and reorg handling. */
function fakeWorld() {
  let head = 10n;
  const blockHashes = new Map<bigint, Hex>();
  for (let b = 0n; b <= 50n; b++) blockHashes.set(b, `0x${b.toString(16).padStart(64, "a")}` as Hex);
  let logs: FakeLog[] = [];

  const rows = { chain_events: [] as Record<string, unknown>[], terms_reports: [] as Record<string, unknown>[], regime_events: [] as Record<string, unknown>[] };
  let cursor: { last_block: string; last_block_hash: string } | null = null;

  const client = {
    getBlockNumber: async () => head,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({
      hash: blockHashes.get(blockNumber) ?? null, timestamp: 1_790_000_000n + blockNumber,
    }),
    getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      logs.filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock),
  } as unknown as PublicClient;

  const key = (t: string, v: Record<string, unknown>): string =>
    t === "chain_events" ? `${String(v["txHash"])}:${String(v["logIndex"])}` : `${String(v["txHash"])}:${String(v["assetId"])}`;

  const db = {
    insert: (table: unknown) => {
      const name = (table as Record<symbol, string>)[Symbol.for("drizzle:Name")] as keyof typeof rows | "indexer_cursor";
      return {
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: async () => {
            if (name === "indexer_cursor") return { count: 1 };
            const bucket = rows[name as keyof typeof rows];
            if (bucket.some((r) => key(name, r) === key(name, v))) return { count: 0 };
            bucket.push(v);
            return { count: 1 };
          },
          onConflictDoUpdate: async () => {
            cursor = { last_block: String(v["lastBlock"]), last_block_hash: String(v["lastBlockHash"]) };
            return { count: 1 };
          },
        }),
      };
    },
  } as unknown as Db;

  // Tagged-template sql that answers the three queries the indexer makes.
  const sql = (async (strings: TemplateStringsArray, ...vals: unknown[]) => {
    const q = strings.join("?").replace(/\s+/g, " ");
    if (q.includes("FROM indexer_cursor")) return cursor ? [cursor] : [];
    if (q.startsWith(" DELETE FROM chain_events") || q.includes("DELETE FROM chain_events")) {
      const from = BigInt(String(vals[1]));
      const before = rows.chain_events.length;
      rows.chain_events = rows.chain_events.filter((r) => BigInt(String(r["blockNumber"])) < from);
      return { count: before - rows.chain_events.length };
    }
    if (q.includes("DELETE FROM terms_reports")) {
      const from = BigInt(String(vals[1]));
      rows.terms_reports = rows.terms_reports.filter((r) => BigInt(String(r["blockNumber"])) < from);
      return { count: 0 };
    }
    if (q.includes("DELETE FROM regime_events")) {
      const from = BigInt(String(vals[1]));
      rows.regime_events = rows.regime_events.filter((r) => BigInt(String(r["blockNumber"])) < from);
      return { count: 0 };
    }
    if (q.includes("SELECT regime FROM terms_reports")) {
      const prior = rows.terms_reports
        .filter((r) => String(r["assetId"]) === String(vals[1]) && String(r["txHash"]) !== String(vals[4]))
        .sort((a, b) => Number(b["blockNumber"]) - Number(a["blockNumber"]));
      return prior.length ? [{ regime: Number(prior[0]!["regime"]) }] : [];
    }
    return [];
  }) as unknown as Sql;

  const post = (block: bigint, tx: string, regime: number): void => {
    logs.push({
      blockNumber: block, blockHash: blockHashes.get(block) as Hex, transactionHash: tx as Hex, logIndex: 0, address: TERMS,
      eventName: "TermsPosted",
      args: {
        assetId: ASSET, attester: "0x000000000000000000000000000000000000AaAa", observedAt: 1_790_000_000n + block,
        regime: BigInt(regime), creditMark: 1n, carryLTV: 2n, sessionMaxLTV: 3n, debtCeiling: 4n, executableDepth1: 5n,
        inputsHash: `0x${"22".repeat(32)}`,
      },
    });
  };

  return {
    client, db, sql, rows,
    post,
    advance: (n: bigint) => { head += n; },
    forkFrom: (block: bigint) => {
      for (let b = block; b <= 50n; b++) blockHashes.set(b, `0x${b.toString(16).padStart(64, "f")}` as Hex);
      logs = logs.filter((l) => l.blockNumber < block);
    },
    cursor: () => cursor,
  };
}

const cfg: IndexerConfig = { chainId: 196, name: "kerb", terms: TERMS, clock: CLOCK, fromBlock: 0n, symbols: new Map([[ASSET.toLowerCase(), "KOx"]]) };

describe("indexer", () => {
  let w: ReturnType<typeof fakeWorld>;
  beforeEach(() => { w = fakeWorld(); });

  it("indexes events and records a cursor", async () => {
    w.post(2n, "0xaa", 1);
    const r = await indexOnce(w.client, w.db, w.sql, cfg);
    expect(r.events).toBe(1);
    expect(r.inserted).toBe(1);
    expect(w.rows.chain_events).toHaveLength(1);
    expect(w.rows.terms_reports).toHaveLength(1);
    expect(w.cursor()).not.toBeNull();
  });

  it("is idempotent: a duplicate delivery inserts nothing", async () => {
    w.post(2n, "0xaa", 1);
    await indexOnce(w.client, w.db, w.sql, cfg);
    // Re-index the same range by rewinding the cursor to before the event.
    const again = await indexOnce(w.client, w.db, w.sql, { ...cfg, fromBlock: 0n });
    expect(again.inserted).toBe(0);
    expect(w.rows.chain_events).toHaveLength(1);
  });

  it("restarts from the stored cursor and only picks up new blocks", async () => {
    w.post(2n, "0xaa", 1);
    await indexOnce(w.client, w.db, w.sql, cfg);
    const firstCursor = w.cursor();
    w.advance(5n);
    w.post(12n, "0xbb", 4);
    const r = await indexOnce(w.client, w.db, w.sql, cfg);
    expect(r.fromBlock).toBe(BigInt(firstCursor!.last_block) + 1n);
    expect(r.inserted).toBe(1);
    expect(w.rows.chain_events).toHaveLength(2);
  });

  it("records a regime change only when the regime actually changes", async () => {
    w.post(2n, "0xaa", 1);
    await indexOnce(w.client, w.db, w.sql, cfg);
    w.advance(5n);
    w.post(12n, "0xbb", 1); // same regime
    await indexOnce(w.client, w.db, w.sql, cfg);
    expect(w.rows.regime_events).toHaveLength(1);
    w.advance(5n);
    w.post(17n, "0xcc", 4); // changed
    await indexOnce(w.client, w.db, w.sql, cfg);
    expect(w.rows.regime_events).toHaveLength(2);
    expect(w.rows.regime_events[1]).toMatchObject({ fromRegime: 1, toRegime: 4 });
  });

  it("unwinds and re-indexes when a block hash no longer matches", async () => {
    w.post(2n, "0xaa", 1);
    w.advance(20n);
    w.post(25n, "0xbb", 2);
    await indexOnce(w.client, w.db, w.sql, cfg);
    expect(w.rows.chain_events).toHaveLength(2);

    w.forkFrom(24n); // the chain reorganised: block 24 onward is different and the event is gone
    const r = await indexOnce(w.client, w.db, w.sql, cfg);
    expect(r.reorgFrom).not.toBeNull();
    expect(w.rows.chain_events.map((e) => e["txHash"])).toEqual(["0xaa"]);
  });

  it("does nothing when there is nothing new", async () => {
    await indexOnce(w.client, w.db, w.sql, cfg);
    const r = await indexOnce(w.client, w.db, w.sql, cfg);
    expect(r.events).toBe(0);
  });

  it("leaves the confirmation window unindexed", async () => {
    w.post(10n, "0xaa", 1); // head is 10, confirmations 3, so this is not settled yet
    const r = await indexOnce(w.client, w.db, w.sql, cfg);
    expect(r.toBlock).toBeLessThanOrEqual(7n);
    expect(w.rows.chain_events).toHaveLength(0);
  });
});
