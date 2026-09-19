/**
 * Phase 1 report: impact curves with paths, C(0.5%), C(1%), C(3%) for every resolved asset
 * from the latest LIVE pool observations, plus sample Clock resolutions. I/O lives here;
 * the computation is the pure engine.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { loadAssets, repoRoot, resolvedAssets } from "@kerb/adapters";
import { resolveAssetClock } from "@kerb/calendar";
import { connect } from "@kerb/collector/db";
import { assetDepth, type DepthParams, type ObservedSnapshot } from "../src/depth.js";

const cfg = loadAssets();
const params = (JSON.parse(readFileSync(resolve(repoRoot(), "config/kts-params.json"), "utf8")) as { depth: DepthParams }).depth;
const { sql } = connect();
const rows = await sql<{ pool: string; ts: Date; content_hash: string; bytes: Buffer }[]>`
  SELECT DISTINCT ON (p.pool) p.pool, p.ts, p.content_hash, b.bytes
  FROM obs_pool_state p JOIN blobs b ON b.cid = p.ticks_blob_cid
  WHERE p.mode = 'live' ORDER BY p.pool, p.ts DESC`;
await sql.end();
const snaps = new Map<string, ObservedSnapshot>();
for (const r of rows) {
  snaps.set(r.pool.toLowerCase(), { observedAtMs: new Date(r.ts).getTime(), contentHash: r.content_hash, snapshot: JSON.parse(gunzipSync(r.bytes).toString("utf8")) });
}
const at = Math.max(...[...snaps.values()].map((s) => s.observedAtMs));
console.log(`Depth report at ${new Date(at).toISOString()} from ${snaps.size} live pool observations (params ${JSON.stringify(params)})\n`);

const pct = (x: string): string => `${(Number(x) * 100).toFixed(3)}%`; // display only
const summary: string[] = [];
for (const a of resolvedAssets(cfg)) {
  const d = assetDepth(cfg, a, snaps, at, params);
  console.log(`== ${a.symbol} (${a.underlying.market}) C(0.5%)=${d.C_0_5} C(1%)=${d.C_1} C(3%)=${d.C_3} ${d.loanAsset} frag=${d.fragmentationFactor}${d.censored ? " CENSORED" : ""} crosscheck=${d.crosscheck.status}`);
  for (const v of d.venues) {
    console.log(`   path ${v.path.join(" -> ")} pools ${v.pools.join(",")} mid=${Number(v.midPrice).toPrecision(8)}`);
    console.log(`     C(0.5%)=${v.C_0_5.notional}${v.C_0_5.censored ? "*" : ""} C(1%)=${v.C_1.notional}${v.C_1.censored ? "*" : ""} C(3%)=${v.C_3.notional}${v.C_3.censored ? "*" : ""}`);
    console.log(`     curve ${v.curve.map((q) => `${q.notional}:${q.filled ? pct(q.impact) : "unfilled"}`).join("  ")}`);
  }
  for (const x of d.excluded) console.log(`   EXCLUDED ${x.path.join(" -> ")} ${x.pools.join(",")}: ${x.reason}`);
  summary.push(`${a.symbol.padEnd(7)} C(1%) = ${d.C_1.padStart(14)} ${d.loanAsset}  via ${d.venues.map((v) => v.path.join(">")).join(" + ")}`);
}
console.log(`\nC(1%) summary\n${summary.join("\n")}`);

console.log("\nSample Clock resolutions");
for (const [sym, iso] of [["KOx", "now"], ["HKEXCx", "2026-09-21T03:40:00Z"], ["BRK.Bx", "2026-09-25T19:10:00Z"], ["HKEXCx", "now"]] as const) {
  const a = resolvedAssets(cfg).find((x) => x.symbol === sym)!;
  const t = iso === "now" ? at : Date.parse(iso);
  const c = resolveAssetClock(a, t);
  console.log(`${sym} @ ${c.at}: session=${c.session.kind}/${c.session.reason} next=${c.nextTransition.type}@${c.nextTransition.at} weakening=${c.nextWeakening.type}@${c.nextWeakening.at} cure=[${c.cureWindow.opensAt}..${c.cureWindow.closesAt}] open=${c.cureWindow.open} H=${c.horizonHours}h`);
}
