/**
 * The open dataset (V3-09 step 4): hourly executable depth for every asset since the first
 * observation. For each asset and each complete UTC hour: C(1%) and C(3%) in USDG recomputed from
 * the stored pool state at the end of the hour with the engine's own tick walk, the regime the
 * engine resolves then, the pool's in-range liquidity at the last reading in the hour, and how many
 * pool readings the hour holds. An hour the record cannot support is an explicit gap row with its
 * reason, never an interpolation. Incremental: hours already in the file are kept as they are.
 *
 *   pnpm --filter @kerb/engine exec tsx scripts/dataset-depth-hourly.ts
 * Writes data/datasets/depth-hourly.json and .csv (served at /v1/datasets/depth-hourly.{json,csv}).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAssets, repoRoot, resolvedAssets } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { buildBundle, computeReport, engineConfig, loadParams } from "../src/index.js";

interface Row { hour: string; asset: string; pool: string; c1USDG: string | null; c3USDG: string | null; regime: string | null; inRangeLiquidity: string | null; poolReadings: number; gap: boolean; gapReason: string | null }
const DIR = resolve(repoRoot(), "data/datasets");
const JSON_PATH = resolve(DIR, "depth-hourly.json");
const HOUR = 3_600_000;

const params = loadParams();
const { sql } = connect();
mkdirSync(DIR, { recursive: true });
const prev = existsSync(JSON_PATH) ? (JSON.parse(readFileSync(JSON_PATH, "utf8")) as { rows: Row[] }).rows : [];
const have = new Set(prev.map((r) => `${r.asset}|${r.hour}`));
const rows: Row[] = [...prev];
const lastComplete = Math.floor(Date.now() / HOUR) * HOUR - HOUR;
let added = 0;

try {
  for (const a of resolvedAssets(loadAssets())) {
    const pool = a.pool!.address.toLowerCase();
    const counts = await sql<{ h: Date; n: string; liq: string }[]>`
      SELECT date_trunc('hour', ts) AS h, count(*) AS n, (array_agg(liquidity::text ORDER BY ts DESC))[1] AS liq
      FROM obs_pool_state WHERE lower(pool) = ${pool} GROUP BY 1 ORDER BY 1`;
    if (!counts.length) continue;
    const byHour = new Map(counts.map((c) => [new Date(c.h).getTime(), c]));
    for (let h = new Date(counts[0]!.h).getTime(); h <= lastComplete; h += HOUR) {
      const hour = new Date(h).toISOString();
      if (have.has(`${a.symbol}|${hour}`)) continue;
      const c = byHour.get(h);
      const base = { hour, asset: a.symbol, pool, inRangeLiquidity: c?.liq ?? null, poolReadings: Number(c?.n ?? 0) };
      if (!c) { rows.push({ ...base, c1USDG: null, c3USDG: null, regime: null, gap: true, gapReason: "no pool reading in this hour" }); added++; continue; }
      try {
        const bundle = await buildBundle(sql, a.symbol, params, { atMs: h + HOUR - 1000 });
        const r = computeReport(bundle, engineConfig(params, a.symbol, bundle.market.cureWindowSec));
        rows.push({ ...base, c1USDG: r.depth.C_1, c3USDG: r.depth.C_3, regime: r.regime, gap: false, gapReason: null });
      } catch (e) {
        rows.push({ ...base, c1USDG: null, c3USDG: null, regime: null, gap: true, gapReason: `an engine input was missing at the end of the hour: ${e instanceof Error ? e.message.split("\n")[0]!.slice(0, 120) : "unknown"}` });
      }
      added++;
    }
    console.log(`${a.symbol} done, ${rows.length} rows`);
  }
  rows.sort((x, y) => (x.hour === y.hour ? x.asset.localeCompare(y.asset) : x.hour.localeCompare(y.hour)));
  const meta = {
    name: "Kerb depth-hourly", generatedAt: new Date().toISOString(), license: "CC BY 4.0",
    what: "Hourly executable depth of the X Layer xStocks pools Kerb observes: C(1%) and C(3%) in USDG from the engine's tick walk over the stored pool state at the end of each hour, the engine's regime, in-range liquidity and the number of pool readings. Gaps are explicit rows.",
    paramsVersion: (params as { paramsVersion?: string }).paramsVersion ?? null,
    reproduce: "pnpm --filter @kerb/engine exec tsx scripts/dataset-depth-hourly.ts",
    rows: rows.length, gaps: rows.filter((r) => r.gap).length,
  };
  const tmp = `${JSON_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...meta, rows }));
  renameSync(tmp, JSON_PATH);
  const csv = ["hour,asset,pool,c1_usdg,c3_usdg,regime,in_range_liquidity,pool_readings,gap,gap_reason",
    ...rows.map((r) => [r.hour, r.asset, r.pool, r.c1USDG ?? "", r.c3USDG ?? "", r.regime ?? "", r.inRangeLiquidity ?? "", r.poolReadings, r.gap, r.gapReason ? `"${r.gapReason.replace(/"/g, "'")}"` : ""].join(","))].join("\n");
  writeFileSync(resolve(DIR, "depth-hourly.csv.tmp"), `${csv}\n`);
  renameSync(resolve(DIR, "depth-hourly.csv.tmp"), resolve(DIR, "depth-hourly.csv"));
  console.log(`added ${added} rows; ${meta.rows} rows, ${meta.gaps} gaps`);
} finally {
  await sql.end();
}
