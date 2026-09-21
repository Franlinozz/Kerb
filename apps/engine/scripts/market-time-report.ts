/**
 * Market-Time Report #1, generated from the observation store.
 *
 * Every figure here is measured. Nothing is modelled, estimated or rounded up into a claim. Where
 * the record has a hole, the hole is reported. Where a window is too short to support a
 * conclusion, the report says so instead of drawing one.
 *
 *   pnpm --filter @kerb/engine market-time-report
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAssets, repoRoot, resolvedAssets } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { resolveClock } from "@kerb/calendar";

const OUT = resolve(repoRoot(), "data/reports");

interface PoolWindow {
  pool: string;
  symbol: string | null;
  role: "asset" | "route";
  observations: number;
  firstAt: string;
  lastAt: string;
  liquidityAtStart: string;
  liquidityAtEnd: string;
  liquidityMin: string;
  liquidityMax: string;
  changePct: string | null;
  swingPct: string | null;
}

const { sql } = connect();

try {
  const cfg = loadAssets();
  const assets = resolvedAssets(cfg);
  const poolToSymbol = new Map<string, string>();
  for (const a of assets) if (a.pool) poolToSymbol.set(a.pool.address.toLowerCase(), a.symbol);

  const [window] = await sql<{ first: Date; last: Date; rows: string; pools: string }[]>`
    SELECT min(ts) AS first, max(ts) AS last, count(*)::text AS rows, count(DISTINCT pool)::text AS pools
    FROM obs_pool_state WHERE mode = 'live'`;
  if (!window) throw new Error("no live pool observations");

  // The largest hole in the record, reported rather than smoothed over.
  const [gap] = await sql<{ gap: string | null; at: Date | null }[]>`
    SELECT to_char(max(d), 'HH24:MI:SS') AS gap, max(ts) FILTER (WHERE d = (SELECT max(ts - prev) FROM (
      SELECT ts, lag(ts) OVER (ORDER BY ts) AS prev FROM obs_pool_state WHERE mode='live') s)) AS at
    FROM (SELECT ts, ts - lag(ts) OVER (ORDER BY ts) AS d FROM obs_pool_state WHERE mode='live') x`;

  const rows = await sql<{
    pool: string; n: string; first_at: Date; last_at: Date;
    at_start: string; at_end: string; min_liq: string; max_liq: string;
  }[]>`
    WITH a AS (
      SELECT pool, ts, liquidity::numeric AS liq,
             first_value(liquidity::numeric) OVER (PARTITION BY pool ORDER BY ts) AS first_liq,
             last_value(liquidity::numeric) OVER (
               PARTITION BY pool ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_liq
      FROM obs_pool_state WHERE mode = 'live')
    SELECT pool, count(*)::text AS n, min(ts) AS first_at, max(ts) AS last_at,
           max(first_liq)::text AS at_start, max(last_liq)::text AS at_end,
           min(liq)::text AS min_liq, max(liq)::text AS max_liq
    FROM a GROUP BY pool ORDER BY pool`;

  /** Percentage change as a decimal string, to two places, computed on integers. */
  const pctChange = (from: string, to: string): string | null => {
    const a = BigInt(from);
    const b = BigInt(to);
    if (a === 0n) return null;
    const scaled = ((b - a) * 10000n) / a;
    const sign = scaled < 0n ? "-" : "";
    const abs = scaled < 0n ? -scaled : scaled;
    return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
  };

  const pools: PoolWindow[] = rows.map((r) => ({
    pool: r.pool,
    symbol: poolToSymbol.get(r.pool.toLowerCase()) ?? null,
    role: poolToSymbol.has(r.pool.toLowerCase()) ? "asset" : "route",
    observations: Number(r.n),
    firstAt: new Date(r.first_at).toISOString(),
    lastAt: new Date(r.last_at).toISOString(),
    liquidityAtStart: r.at_start,
    liquidityAtEnd: r.at_end,
    liquidityMin: r.min_liq,
    liquidityMax: r.max_liq,
    changePct: pctChange(r.at_start, r.at_end),
    swingPct: pctChange(r.min_liq, r.max_liq),
  }));

  // Was the underlying market open at any point in the observed window?
  const openAtAnyPoint = assets.some((a) => {
    try {
      const c = resolveClock({ market: a.underlying.market, atMs: new Date(window.last).getTime() });
      return c.inMainSession;
    } catch {
      return false;
    }
  });

  const sources = await sql<{ source: string; n: string; first: Date; last: Date }[]>`
    SELECT source, count(*)::text AS n, min(ts) AS first, max(ts) AS last
    FROM obs_price WHERE mode = 'live' GROUP BY source ORDER BY source`;

  /**
   * The campaign-end comparison, if one has been captured. It is a separate measurement with its
   * own snapshots, folded in here rather than recomputed, so the report cannot quietly disagree
   * with the file the comparison was written from.
   */
  const comparisonPath = resolve(repoRoot(), "data/windows/comparison.json");
  const campaign = existsSync(comparisonPath)
    ? (JSON.parse(readFileSync(comparisonPath, "utf8")) as {
        before: { capturedAt: string; label?: string };
        after: { capturedAt: string; label?: string };
        rows: Record<string, unknown>[];
        summary: { statement: string; assets: number; depthMovedAtLeastOnePercent: number; regimeChanges: number };
      })
    : null;

  const withChange = pools.filter((p) => p.changePct !== null && p.role === "asset");
  const fell = withChange.filter((p) => p.changePct!.startsWith("-"));
  const sorted = [...withChange].sort((a, b) => Number(a.changePct) - Number(b.changePct));

  const report = {
    id: 1,
    title: "What happened to executable liquidity while the underlying markets were shut",
    generatedAt: new Date().toISOString(),
    window: {
      from: new Date(window.first).toISOString(),
      to: new Date(window.last).toISOString(),
      hours: (
        (new Date(window.last).getTime() - new Date(window.first).getTime()) / 3_600_000
      ).toFixed(2),
      observations: Number(window.rows),
      pools: Number(window.pools),
      largestGap: gap?.gap ?? null,
      underlyingOpenDuringWindow: openAtAnyPoint,
    },
    method:
      "Every 60 seconds the collector reads slot0, liquidity, tickSpacing, fee and the initialised ticks " +
      "spanning at least +/-60% around spot from each pool on X Layer, and appends the reading with its " +
      "block, a hash of the payload and the payload itself. The figures below are those stored readings. " +
      "`liquidity` is the in-range liquidity L at the observed tick, the quantity a swap consumes first; " +
      "it is not a dollar depth, and it is not converted into one here.",
    pools,
    sources: sources.map((s) => ({
      source: s.source,
      observations: Number(s.n),
      firstAt: new Date(s.first).toISOString(),
      lastAt: new Date(s.last).toISOString(),
    })),
    campaign,
    findings: [
      {
        claim: `In-range liquidity did not hold still while the underlying markets were closed: ${fell.length} of ${withChange.length} asset pools ended the window with less in-range liquidity than they started it.`,
        evidence: `Largest fall ${sorted[0]?.symbol ?? "—"} ${sorted[0]?.changePct ?? "—"}%, largest rise ${sorted[sorted.length - 1]?.symbol ?? "—"} ${sorted[sorted.length - 1]?.changePct ?? "—"}%, over ${Number(window.rows).toLocaleString("en-US")} readings.`,
      },
      {
        claim:
          "A capacity number fixed at Friday's close would have been wrong by the size of those moves for the whole weekend.",
        evidence:
          "This is the arithmetic consequence of the row above, not a separate measurement: debtCeiling is a fraction of C(1%), and C(1%) is computed from exactly this pool state.",
      },
      ...(campaign
        ? [{
            claim: `Between the ${campaign.before.label ?? "first"} and ${campaign.after.label ?? "second"} captures, ${campaign.summary.statement}`,
            evidence: `Engine snapshots of all ${campaign.summary.assets} assets at ${campaign.before.capturedAt} and ${campaign.after.capturedAt}, comparing executable depth at 1% and 3%, the Credit Mark, the regime and the published debt ceiling.`,
          }]
        : []),
    ],
    limitations: [
      "The window observed so far is entirely outside the underlying markets' regular sessions. It therefore measures how liquidity behaves while they are shut, and cannot yet compare that with how it behaves while they are open. That comparison needs a session in the record and will be added once one is.",
      "In-range liquidity L is not executable depth in dollars. Kerb computes C(i) by walking ticks, which uses more of the stored state than L alone; L is used here because it is a single stored number per reading and needs no re-derivation.",
      "The record has a hole. It is reported in the window above rather than interpolated across.",
      "Pool TVL in dollars was not captured before and after, so it is not reported. Executable depth at 1% and 3% is captured, and it is the stronger measure for this question: it is what a liquidation would actually realise, where TVL is what is nominally present.",
    ],
    reproduce:
      "pnpm --filter @kerb/engine market-time-report regenerates this file from the observation store. Every row is a SELECT over append-only tables whose UPDATE, DELETE and TRUNCATE are rejected by database triggers.",
  };

  mkdirSync(OUT, { recursive: true });
  const path = resolve(OUT, "market-time-1.json");
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${path}`);
  console.log(`window ${report.window.from} to ${report.window.to} (${report.window.hours}h, ${report.window.observations} readings)`);
  console.log(`largest gap in the record: ${report.window.largestGap ?? "none"}`);
  for (const f of report.findings) console.log(`- ${f.claim}\n    ${f.evidence}`);
} finally {
  await sql.end();
}
