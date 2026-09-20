/** Index both chains continuously, or once with --once. */
import { loadAssets, publicClient, resolvedAssets, type KerbChainId } from "@kerb/adapters";
import { assetId } from "@kerb/types";
import { connect } from "@kerb/collector/db";
import { deploymentOf } from "@kerb/attester";
import { indexOnce, type IndexerConfig } from "./indexer.js";

const chains = (process.env["KERB_INDEX_CHAINS"] ?? "196,1952").split(",").map(Number) as KerbChainId[];
const intervalMs = Number(process.env["KERB_INDEXER_INTERVAL_MS"] ?? 30_000);
const { db, sql } = connect();
const cfgFile = loadAssets();
const symbols = new Map(resolvedAssets(cfgFile).map((a) => [assetId(196, a.token.address).toLowerCase(), a.symbol]));

function configFor(chainId: KerbChainId): IndexerConfig {
  const terms = deploymentOf(chainId, "KerbTerms");
  const clock = deploymentOf(chainId, "KerbClock");
  return {
    chainId, name: "kerb", terms: terms.address, clock: clock.address,
    fromBlock: BigInt(Math.min(Number(terms.deployedAtBlock), Number(clock.deployedAtBlock))), symbols,
  };
}

const log = (...a: unknown[]): void => console.log(new Date().toISOString(), ...a);
let stopped = false;

async function pass(): Promise<void> {
  for (const chainId of chains) {
    try {
      const r = await indexOnce(publicClient(chainId), db, sql, configFor(chainId));
      if (r.events > 0 || r.reorgFrom !== null) {
        log(`chain ${chainId}: blocks ${r.fromBlock}..${r.toBlock} events ${r.events} new ${r.inserted}${r.reorgFrom !== null ? ` REORG rolled back to ${r.reorgFrom}` : ""}`);
      }
    } catch (e) {
      console.error(`${new Date().toISOString()} chain ${chainId}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
}

if (process.argv.includes("--once")) {
  await pass();
  await sql.end();
} else {
  log(`indexer starting for chains ${chains.join(", ")} every ${intervalMs / 1000}s`);
  const stop = (s: string): void => { log(`received ${s}, stopping`); stopped = true; };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  while (!stopped) {
    const t0 = Date.now();
    await pass();
    await new Promise((r) => setTimeout(r, Math.max(2_000, intervalMs - (Date.now() - t0))));
  }
  await sql.end();
}
