/**
 * Backfill terms_posts from TermsPosted logs onchain, for posts made before the attester
 * recorded them locally. Append-only: existing rows are left untouched.
 */
import { parseAbiItem, type Hex } from "viem";
import { loadAssets, publicClient, resolvedAssets, type KerbChainId } from "@kerb/adapters";
import { assetId } from "@kerb/types";
import { connect } from "@kerb/collector/db";
import { termsPosts } from "@kerb/collector/schema";
import { deploymentOf } from "../src/chain.js";

const chainId = Number(process.argv[2] ?? 1952) as KerbChainId;
const client = publicClient(chainId);
const terms = deploymentOf(chainId, "KerbTerms");
const { db, sql } = connect();

const event = parseAbiItem(
  "event TermsPosted(bytes32 indexed assetId, address indexed attester, uint64 observedAt, uint16 regime, uint128 creditMark, uint64 carryLTV, uint64 sessionMaxLTV, uint128 debtCeiling, uint128 executableDepth1, bytes32 inputsHash)",
);
const symbols = new Map(resolvedAssets(loadAssets()).map((a) => [assetId(196, a.token.address).toLowerCase(), a.symbol]));

const from = BigInt(terms.deployedAtBlock);
const to = await client.getBlockNumber();
console.log(`scanning ${to - from} blocks for TermsPosted (RPC caps ranges at 100 blocks)`);

let found = 0;
let inserted = 0;
for (let start = from; start <= to; start += 100n) {
  const end = start + 99n > to ? to : start + 99n;
  const logs = await client.getLogs({ address: terms.address, event, fromBlock: start, toBlock: end });
  for (const l of logs) {
    found++;
    const a = l.args;
    const receipt = await client.getTransactionReceipt({ hash: l.transactionHash as Hex });
    const block = await client.getBlock({ blockNumber: l.blockNumber });
    const r = await db.insert(termsPosts).values({
      chainId, assetId: a.assetId as string, symbol: symbols.get((a.assetId as string).toLowerCase()) ?? "unknown",
      txHash: l.transactionHash as string, blockNumber: l.blockNumber,
      ts: new Date(Number(block.timestamp) * 1000),
      observedAt: new Date(Number(a.observedAt) * 1000), regime: Number(a.regime),
      creditMark: String(a.creditMark), carryLtv: String(a.carryLTV), sessionMaxLtv: String(a.sessionMaxLTV),
      debtCeiling: String(a.debtCeiling), executableDepth1: String(a.executableDepth1),
      inputsHash: a.inputsHash as string, bundleCid: "(not recorded: posted before local recording existed)",
      pinStatus: "unknown", gasUsed: receipt.gasUsed, feeWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
      clamped: null,
    }).onConflictDoNothing();
    inserted += r.count ?? 0;
  }
}
console.log(`found ${found} TermsPosted events, inserted ${inserted} new rows`);
await sql.end();
