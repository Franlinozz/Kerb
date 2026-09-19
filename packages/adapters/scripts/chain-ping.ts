import { CHAINS, publicClient, explorerBlock, type KerbChainId } from "../src/chain.js";

for (const id of Object.keys(CHAINS).map(Number) as KerbChainId[]) {
  try {
    const c = publicClient(id);
    const b = await c.getBlock();
    const age = Math.floor(Date.now() / 1000) - Number(b.timestamp);
    console.log(`${CHAINS[id].name} (${id}): block ${b.number} at ${new Date(Number(b.timestamp) * 1000).toISOString()} (${age}s ago) ${explorerBlock(id, b.number)}`);
  } catch (e) {
    console.error(`${CHAINS[id].name} (${id}): FAILED ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
