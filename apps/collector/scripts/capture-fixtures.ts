/**
 * Capture real responses once into data/fixtures/collector so fake-provider mode replays
 * genuine observations offline. Run manually; commit the output.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LiveHttp, loadAssets, publicClient, resolvedAssets, type HttpFetcher, type RawHttp } from "@kerb/adapters";
import { httpProviders } from "../src/providers/live.js";
import { allPools } from "../src/loops.js";
import { fixtureKey, fixturesDir } from "../src/providers/fixture.js";

class RecordingHttp implements HttpFetcher {
  private readonly inner = new LiveHttp(30_000);
  async get(url: string, headers?: Record<string, string>): Promise<RawHttp> {
    const r = await this.inner.get(url, headers);
    const dir = resolve(fixturesDir(), "http");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, `${fixtureKey(url)}.json`), `${JSON.stringify(r, null, 2)}\n`);
    return r;
  }
}

const cfg = loadAssets();
const p = httpProviders(new RecordingHttp(), publicClient(196), "live");
const dir = fixturesDir();
mkdirSync(resolve(dir, "pools"), { recursive: true });
mkdirSync(resolve(dir, "onchain"), { recursive: true });
const block = await p.blockNumber();
writeFileSync(resolve(dir, "block.json"), `${JSON.stringify({ blockNumber: block.toString(), capturedAt: new Date().toISOString() }, null, 2)}\n`);

for (const { label, pool } of allPools(cfg)) {
  const s = await p.poolSnapshot(pool, block);
  writeFileSync(resolve(dir, "pools", `${pool.address}.json`), `${JSON.stringify(s, null, 2)}\n`);
  console.log(`pool ${label} ${pool.address}: ${s.ticks.length} ticks`);
}
for (const a of resolvedAssets(cfg)) {
  const oc = await p.onchainMultiplier(a, block);
  writeFileSync(resolve(dir, "onchain", `${a.token.address}.json`), `${JSON.stringify(oc, null, 2)}\n`);
  await p.xstocksMultiplier(a.symbol);
  await p.xstocksAsset(a.symbol);
  await p.xstocksPrice(a.symbol).catch((e: unknown) => console.log(`price ${a.symbol}: ${(e as Error).message.slice(0, 80)} (recorded as-is)`));
  for (const r of a.references) if (r.source === "yahoo") await p.yahoo(r.id);
}
for (const f of cfg.fx) if (f.source === "yahoo") await p.yahoo(f.id);
console.log(`fixtures captured at block ${block} into ${dir}`);
