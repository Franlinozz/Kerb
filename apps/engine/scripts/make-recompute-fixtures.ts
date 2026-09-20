/**
 * Build ten bundles from historical points in the append-only record and store them with
 * their reports as fixtures. The recompute test replays them offline and must match byte
 * for byte. Bundles carry derived stress statistics and a series digest, not the licensed
 * series itself (data/SOURCES.md).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import { canonicalJson } from "@kerb/types";
import { connect } from "@kerb/collector/db";
import { buildBundle } from "../src/build.js";
import { identifyBundle } from "../src/bundle.js";
import { engineConfig, loadParams } from "../src/params.js";
import { computeReport } from "../src/report.js";

const params = loadParams();
const { sql } = connect();
const out = resolve(repoRoot(), "data/fixtures/kts");
mkdirSync(out, { recursive: true });

const rows = await sql<{ ts: Date }[]>`
  SELECT DISTINCT ts FROM obs_pool_state WHERE mode = 'live' ORDER BY ts DESC LIMIT 600`;
const picks = [0, 60, 120, 180, 240, 300, 360, 420, 480, 540].map((i) => rows[i]).filter((r): r is { ts: Date } => Boolean(r));
const symbols = ["KOx", "HKEXCx", "BRK.Bx", "SLVx", "COINx", "MIXUx", "KUAIx", "ICEx", "BMNRx", "SHEINx"];

const index: { symbol: string; atMs: number; inputsHash: string; cid: string; bundle: string; report: string }[] = [];
for (let i = 0; i < picks.length; i++) {
  const symbol = symbols[i % symbols.length] as string;
  const atMs = new Date((picks[i] as { ts: Date }).ts).getTime();
  const bundle = await buildBundle(sql, symbol, params, { atMs });
  const id = identifyBundle(bundle);
  const report = computeReport(bundle, engineConfig(params, symbol, bundle.market.cureWindowSec));
  const base = `${symbol}-${new Date(atMs).toISOString().replace(/[:.]/g, "-")}`;
  writeFileSync(resolve(out, `${base}.bundle.json`), `${id.canonical}\n`);
  writeFileSync(resolve(out, `${base}.report.json`), `${canonicalJson(report)}\n`);
  index.push({ symbol, atMs, inputsHash: id.inputsHash, cid: id.cidV1Raw, bundle: `${base}.bundle.json`, report: `${base}.report.json` });
  console.log(`${base}  ${id.inputsHash}  ${id.cidV1Raw}  regime=${report.regime} C(1%)=${report.depth.C_1}`);
}
writeFileSync(resolve(out, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
await sql.end();
