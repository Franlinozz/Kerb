import { createServer, type Server } from "node:http";
import type { Sql } from "./db/client.js";
import type { Mode } from "./providers/types.js";

export interface SourceHealth {
  table: string;
  source: string;
  subject: string;
  lastObservationAt: string | null;
  ageSec: number | null;
  /** Age of the data as reported by the source itself (e.g. Pyth publish_time), if any. */
  sourceDataAgeSec: number | null;
  rowsTotal: number;
  rows10m: number;
  stale: boolean;
}

export interface Health {
  status: "ok" | "degraded";
  mode: Mode;
  now: string;
  startedAt: string;
  freshnessAlarmSec: number;
  sources: SourceHealth[];
  loops: { loop: string; lastStartedAt: string; lastFinishedAt: string; ok: number; failed: number; cycles10m: number }[];
  errors10m: { source: string; subject: string; count: number; last: string; lastError: string }[];
  alarms: string[];
}

const toDate = (v: Date | string): Date => (v instanceof Date ? v : new Date(v));

export async function computeHealth(sql: Sql, mode: Mode, startedAt: Date, alarmSec: number): Promise<Health> {
  const rows = await sql<{ tbl: string; source: string; subject: string; last: Date; src_last: Date | null; total: string; r10: string }[]>`
    SELECT 'obs_pool_state' AS tbl, source, pool AS subject, max(ts) AS last, max(block_ts) AS src_last, count(*) AS total,
           count(*) FILTER (WHERE ts > now() - interval '10 minutes') AS r10
      FROM obs_pool_state WHERE mode = ${mode} GROUP BY source, pool
    UNION ALL
    SELECT 'obs_price', source, symbol, max(ts), max(source_ts), count(*), count(*) FILTER (WHERE ts > now() - interval '10 minutes')
      FROM obs_price WHERE mode = ${mode} GROUP BY source, symbol
    UNION ALL
    SELECT 'obs_multiplier', source, symbol, max(ts), NULL, count(*), count(*) FILTER (WHERE ts > now() - interval '10 minutes')
      FROM obs_multiplier WHERE mode = ${mode} GROUP BY source, symbol
    ORDER BY 1, 2, 3`;
  const now = Date.now();
  // Multipliers poll every 10 minutes; their alarm threshold scales with the cadence.
  const limit = (tbl: string): number => (tbl === "obs_multiplier" ? Math.max(alarmSec, 1500) : alarmSec);
  const sources: SourceHealth[] = rows.map((r) => {
    const last = toDate(r.last);
    const age = Math.round((now - last.getTime()) / 1000);
    return {
      table: r.tbl, source: r.source, subject: r.subject, lastObservationAt: last.toISOString(), ageSec: age,
      sourceDataAgeSec: r.src_last ? Math.round((now - toDate(r.src_last).getTime()) / 1000) : null,
      rowsTotal: Number(r.total), rows10m: Number(r.r10), stale: age > limit(r.tbl),
    };
  });
  const loops = await sql<{ loop: string; s: Date; f: Date; ok: number; failed: number; c10: string }[]>`
    SELECT DISTINCT ON (loop) loop, started_at AS s, finished_at AS f, ok, failed,
      (SELECT count(*) FROM collector_cycles c2 WHERE c2.loop = c.loop AND c2.mode = ${mode} AND c2.started_at > now() - interval '10 minutes') AS c10
    FROM collector_cycles c WHERE mode = ${mode} ORDER BY loop, started_at DESC`;
  const errs = await sql<{ source: string; subject: string; n: string; last: Date; err: string }[]>`
    SELECT source, subject, count(*) AS n, max(ts) AS last, (array_agg(error ORDER BY ts DESC))[1] AS err
    FROM obs_source_error WHERE mode = ${mode} AND ts > now() - interval '10 minutes' GROUP BY source, subject ORDER BY n DESC`;
  const alarms = sources.filter((s) => s.stale).map((s) => `${s.source} ${s.subject} last observed ${s.ageSec}s ago`);
  for (const l of ["pools", "prices", "multipliers"]) if (!loops.some((x) => x.loop === l)) alarms.push(`loop ${l} has never completed a cycle`);
  return {
    status: alarms.length ? "degraded" : "ok", mode, now: new Date(now).toISOString(), startedAt: startedAt.toISOString(), freshnessAlarmSec: alarmSec,
    sources,
    loops: loops.map((l) => ({ loop: l.loop, lastStartedAt: toDate(l.s).toISOString(), lastFinishedAt: toDate(l.f).toISOString(), ok: l.ok, failed: l.failed, cycles10m: Number(l.c10) })),
    errors10m: errs.map((e) => ({ source: e.source, subject: e.subject, count: Number(e.n), last: toDate(e.last).toISOString(), lastError: e.err })),
    alarms,
  };
}

export function startHealthServer(port: number, get: () => Promise<Health>): Server {
  const s = createServer((req, res) => {
    if (req.url !== "/health" && req.url !== "/health/") {
      res.writeHead(404, { "content-type": "application/json" }).end('{"error":"not found"}');
      return;
    }
    get().then(
      (h) => res.writeHead(h.status === "ok" ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(h, null, 2)),
      (e: unknown) => {
        console.error("health query failed", e);
        res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ status: "error", error: "health query failed" }));
      },
    );
  });
  s.listen(port, "127.0.0.1");
  return s;
}
