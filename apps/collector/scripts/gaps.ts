/**
 * Report the largest gap in the live record, per loop and per series.
 * A gap is the time between consecutive successful observations of the same series.
 */
import { connect } from "../src/db/client.js";

const { sql } = connect();
const series = await sql<{ tbl: string; series: string; n: string; first: Date; last: Date; max_gap_s: string | null; gap_end: Date | null }[]>`
  WITH s AS (
    SELECT 'obs_pool_state' AS tbl, pool AS series, ts FROM obs_pool_state WHERE mode = 'live'
    UNION ALL SELECT 'obs_price', source || ' ' || symbol, ts FROM obs_price WHERE mode = 'live'
    UNION ALL SELECT 'obs_multiplier', source || ' ' || symbol, ts FROM obs_multiplier WHERE mode = 'live'
    UNION ALL SELECT 'collector_cycles', loop, started_at FROM collector_cycles WHERE mode = 'live'
  ), g AS (
    SELECT tbl, series, ts, extract(epoch FROM ts - lag(ts) OVER (PARTITION BY tbl, series ORDER BY ts)) AS gap FROM s
  )
  SELECT tbl, series, count(*) AS n, min(ts) AS first, max(ts) AS last, max(gap) AS max_gap_s,
         (array_agg(ts ORDER BY gap DESC NULLS LAST))[1] AS gap_end
  FROM g GROUP BY tbl, series ORDER BY max(gap) DESC NULLS LAST`;
const fmt = (d: Date | null): string => (d ? new Date(d).toISOString() : "-");
for (const r of series) {
  console.log(`${r.tbl.padEnd(16)} ${r.series.slice(0, 48).padEnd(48)} n=${r.n.padStart(6)} maxGap=${Number(r.max_gap_s ?? 0).toFixed(0).padStart(6)}s ending ${fmt(r.gap_end)}  [${fmt(r.first)} .. ${fmt(r.last)}]`);
}
const worst = series[0];
if (worst) console.log(`\nLARGEST GAP: ${Number(worst.max_gap_s ?? 0).toFixed(0)}s in ${worst.tbl} ${worst.series}, ending ${fmt(worst.gap_end)}`);
await sql.end();
