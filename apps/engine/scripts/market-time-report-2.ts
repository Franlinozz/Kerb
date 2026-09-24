/**
 * Market-Time Report #2: what happened when the X Liquidity incentives ended (V2-09).
 *
 * Generated from stored observations and the window captures only. Nothing is modelled. The window
 * runs from 23 Sep 07:00 to 25 Sep 07:00 UTC, as far as the record reaches when this runs; a window
 * still accumulating is marked partial. If depth did not fall across the campaign end, the report
 * says so.
 *
 *   pnpm --filter @kerb/engine exec tsx scripts/market-time-report-2.ts [--from ISO] [--to ISO] [--cliff ISO]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAssets, repoRoot, resolvedAssets } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { timeline } from "@kerb/calendar";

const arg = (k: string, d: string): string => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : d; };
const PLANNED_TO = "2026-09-25T07:00:00Z";
const FROM = arg("--from", "2026-09-23T07:00:00Z");
const CLIFF = arg("--cliff", "2026-09-24T07:00:00Z");
const toArg = arg("--to", "");
const OUT = resolve(repoRoot(), "data/reports");
const WINDOWS = resolve(repoRoot(), "data/windows");

/** Percentage change of two decimal strings (or integers), two places, exact. */
function pct(from: string | null | undefined, to: string | null | undefined): string | null {
  if (!from || !to) return null;
  const s = (d: string): bigint => { const [w = "0", f = ""] = d.split("."); return BigInt(w + f.padEnd(18, "0").slice(0, 18)); };
  const a = s(from), b = s(to);
  if (a === 0n) return null;
  const x = ((b - a) * 10000n) / a;
  const abs = x < 0n ? -x : x;
  return `${x < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}
const neg = (p: string | null): boolean => p !== null && p.startsWith("-") && !/^-0\.00$/.test(p);
const atLeast = (p: string | null, whole: bigint): boolean => { if (p === null) return false; const v = BigInt(p.replace("-", "").replace(".", "")); return v >= whole * 100n; };

interface Snap { label: string; capturedAt: string; assets: Record<string, { error?: string; regime?: string; depth?: { C_1?: string; C_3?: string }; mark?: { creditMark?: string }; capacity?: { debtCeiling?: string; carryLTV?: string } }> }

const { sql } = connect();
try {
  const assets = resolvedAssets(loadAssets());
  const bySymbolPool = new Map(assets.filter((a) => a.pool).map((a) => [a.pool!.address.toLowerCase(), a]));
  const [last] = await sql<{ t: Date | null }[]>`SELECT max(ts) AS t FROM obs_pool_state WHERE mode = 'live'`;
  const lastMs = last?.t ? new Date(last.t).getTime() : Date.now();
  const toMs = Math.min(toArg ? Date.parse(toArg) : Date.parse(PLANNED_TO), lastMs);
  const fromMs = Date.parse(FROM), cliffMs = Date.parse(CLIFF);
  if (!(toMs > fromMs)) throw new Error(`no observations after ${FROM} yet`);
  const from = new Date(fromMs), to = new Date(toMs), cliff = new Date(cliffMs);
  // postgres.js here takes timestamps as ISO strings.
  const F = from.toISOString(), T = to.toISOString(), C = cliff.toISOString(), C1 = new Date(cliffMs + 3_600_000).toISOString();

  const [win] = await sql<{ rows: string; pools: string }[]>`
    SELECT count(*)::text AS rows, count(DISTINCT pool)::text AS pools FROM obs_pool_state
    WHERE mode = 'live' AND ts BETWEEN ${F} AND ${T}`;
  const gaps = await sql<{ prev: Date; ts: Date; mins: string }[]>`
    SELECT prev, ts, round(extract(epoch FROM ts - prev) / 60)::text AS mins FROM (
      SELECT ts, lag(ts) OVER (ORDER BY ts) AS prev FROM obs_pool_state WHERE mode = 'live' AND ts BETWEEN ${F} AND ${T}) s
    WHERE ts - prev > interval '5 minutes' ORDER BY prev`;
  const largest = gaps.reduce((m, g) => Math.max(m, Number(g.mins)), 0);

  // Per pool: L at the window's ends, and across the cliff (last reading at or before 07:00 against
  // the last reading at or before 08:00, the first hour without incentives).
  const rows = await sql<{ pool: string; n: string; first_at: Date; last_at: Date; at_start: string; at_end: string; min_liq: string; max_liq: string; before_cliff: string | null; after_cliff: string | null }[]>`
    WITH a AS (
      SELECT pool, ts, liquidity::numeric AS liq FROM obs_pool_state WHERE mode = 'live' AND ts BETWEEN ${F} AND ${T})
    SELECT pool, count(*)::text AS n, min(ts) AS first_at, max(ts) AS last_at,
      (array_agg(liq ORDER BY ts ASC))[1]::text AS at_start, (array_agg(liq ORDER BY ts DESC))[1]::text AS at_end,
      min(liq)::text AS min_liq, max(liq)::text AS max_liq,
      (array_agg(liq ORDER BY ts DESC) FILTER (WHERE ts <= ${C}))[1]::text AS before_cliff,
      (array_agg(liq ORDER BY ts DESC) FILTER (WHERE ts <= ${C1} AND ts > ${C}))[1]::text AS after_cliff
    FROM a GROUP BY pool ORDER BY pool`;
  const pools = rows.map((r) => {
    const asset = bySymbolPool.get(r.pool.toLowerCase());
    return {
      pool: r.pool, symbol: asset?.symbol ?? null, role: asset ? "asset" as const : "route" as const, observations: Number(r.n),
      firstAt: new Date(r.first_at).toISOString(), lastAt: new Date(r.last_at).toISOString(),
      liquidityAtStart: r.at_start, liquidityAtEnd: r.at_end, liquidityMin: r.min_liq, liquidityMax: r.max_liq,
      changePct: pct(r.at_start, r.at_end), swingPct: pct(r.min_liq, r.max_liq),
      liquidityBeforeCliff: r.before_cliff, liquidityAfterCliff: r.after_cliff, cliffChangePct: pct(r.before_cliff, r.after_cliff),
    };
  });

  // Session against closed: how much L moves from one reading to the next while the underlying
  // market is in its regular session, against while it is shut. Mean absolute change, in basis points.
  const sessionVsClosed = [];
  for (const a of assets) {
    if (!a.pool) continue;
    const segs = timeline(a.underlying.market as never, fromMs, toMs);
    const regular = (t: number): boolean => segs.some((s) => s.kind === "REGULAR" && t >= s.startMs && t < s.endMs);
    const closed = (t: number): boolean => segs.some((s) => s.kind === "CLOSED" && t >= s.startMs && t < s.endMs);
    const pts = await sql<{ ts: Date; liq: string }[]>`
      SELECT ts, liquidity::text AS liq FROM obs_pool_state WHERE mode = 'live' AND lower(pool) = ${a.pool.address.toLowerCase()} AND ts BETWEEN ${F} AND ${T} ORDER BY ts`;
    const acc = { regular: { n: 0n, sum: 0n }, closed: { n: 0n, sum: 0n } };
    for (let i = 1; i < pts.length; i++) {
      const p = BigInt(pts[i - 1]!.liq), c = BigInt(pts[i]!.liq), t = new Date(pts[i]!.ts).getTime();
      if (p === 0n || t - new Date(pts[i - 1]!.ts).getTime() > 5 * 60_000) continue; // never across a hole
      const bp = ((c > p ? c - p : p - c) * 1_000_000n) / p; // hundredths of a basis point
      const k = regular(t) ? acc.regular : closed(t) ? acc.closed : null;
      if (k) { k.n += 1n; k.sum += bp; }
    }
    const mean = (x: { n: bigint; sum: bigint }): string | null => x.n === 0n ? null : `${x.sum / x.n / 100n}.${String((x.sum / x.n) % 100n).padStart(2, "0")}`;
    sessionVsClosed.push({ symbol: a.symbol, market: a.underlying.market, regularReadings: Number(acc.regular.n), closedReadings: Number(acc.closed.n), meanAbsMoveBpRegular: mean(acc.regular), meanAbsMoveBpClosed: mean(acc.closed) });
  }

  // Every window capture inside the window, with executable depth in USDG per asset.
  const snaps: Snap[] = existsSync(WINDOWS) ? readdirSync(WINDOWS).filter((f) => /^(campaign|window)-.*Z\.json$/.test(f)).sort()
    .map((f) => JSON.parse(readFileSync(resolve(WINDOWS, f), "utf8")) as Snap)
    .filter((s) => { const t = Date.parse(s.capturedAt); return t >= fromMs - 3_600_000 && t <= toMs + 3_600_000; })
    // In time order, not file-name order: "window-start" sorts after "campaign-" but was taken a day earlier.
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt)) : [];
  const snapshots = snaps.map((s) => ({
    label: s.label, capturedAt: s.capturedAt,
    assets: Object.entries(s.assets).map(([symbol, v]) => v.error ? { symbol, error: "not captured" } : { symbol, regime: v.regime ?? null, c1: v.depth?.C_1 ?? null, c3: v.depth?.C_3 ?? null, creditMark: v.mark?.creditMark ?? null, debtCeiling: v.capacity?.debtCeiling ?? null }),
  }));

  // Before and after: the last capture before the cliff against the first one after it.
  const pre = [...snaps].filter((s) => Date.parse(s.capturedAt) <= cliffMs).pop();
  const post = snaps.find((s) => Date.parse(s.capturedAt) > cliffMs);
  let campaign = null;
  if (pre && post) {
    const crow = Object.keys(pre.assets).filter((k) => !pre.assets[k]?.error && post.assets[k] && !post.assets[k]!.error).map((symbol) => {
      const b = pre.assets[symbol]!, a = post.assets[symbol]!;
      return {
        symbol, regimeBefore: b.regime ?? null, regimeAfter: a.regime ?? null, regimeChanged: (b.regime ?? null) !== (a.regime ?? null),
        c1Before: b.depth?.C_1 ?? null, c1After: a.depth?.C_1 ?? null, c1ChangePct: pct(b.depth?.C_1, a.depth?.C_1),
        c3Before: b.depth?.C_3 ?? null, c3After: a.depth?.C_3 ?? null, c3ChangePct: pct(b.depth?.C_3, a.depth?.C_3),
        markBefore: b.mark?.creditMark ?? null, markAfter: a.mark?.creditMark ?? null, markChangePct: pct(b.mark?.creditMark, a.mark?.creditMark),
        ceilingBefore: b.capacity?.debtCeiling ?? null, ceilingAfter: a.capacity?.debtCeiling ?? null, ceilingChangePct: pct(b.capacity?.debtCeiling, a.capacity?.debtCeiling),
      };
    });
    // V3-09: one word per asset, from C(1%) and C(3%) together, the only words a finding may use.
    // An hour later (the last capture of the morning) is reported beside it, so a slow move shows too.
    const last = [...snaps].filter((x) => Date.parse(x.capturedAt) > cliffMs).pop();
    for (const r of crow as (typeof crow[number] & { verdict?: string; c1Later?: string | null; c1LaterChangePct?: string | null; laterAt?: string | null })[]) {
      const moved = (p: string | null): -1 | 0 | 1 | null => (p === null ? null : !atLeast(p, 1n) ? 0 : neg(p) ? -1 : 1);
      const m1 = moved(r.c1ChangePct), m3 = moved(r.c3ChangePct);
      r.verdict = m1 === null || m3 === null ? "insufficient evidence" : m1 === 0 && m3 === 0 ? "held" : m1 <= 0 && m3 <= 0 ? "fell" : m1 >= 0 && m3 >= 0 ? "rose" : "mixed";
      const l = last && last !== post ? last.assets[r.symbol] : undefined;
      r.laterAt = last && last !== post ? last.capturedAt : null;
      r.c1Later = l && !l.error ? l.depth?.C_1 ?? null : null;
      r.c1LaterChangePct = pct(r.c1Before, r.c1Later);
    }
    const fellC1 = crow.filter((r) => neg(r.c1ChangePct) && atLeast(r.c1ChangePct, 1n));
    const roseC1 = crow.filter((r) => !neg(r.c1ChangePct) && atLeast(r.c1ChangePct, 1n));
    const regimeChanges = crow.filter((r) => r.regimeChanged).length;
    campaign = {
      before: { capturedAt: pre.capturedAt, label: pre.label }, after: { capturedAt: post.capturedAt, label: post.label }, rows: crow,
      summary: {
        assets: crow.length, depthMovedAtLeastOnePercent: fellC1.length + roseC1.length, regimeChanges,
        verdicts: Object.fromEntries(["held", "fell", "rose", "mixed", "insufficient evidence"].map((v) => [v, (crow as { verdict?: string }[]).filter((r) => r.verdict === v).length])),
        statement: fellC1.length === 0
          ? `executable depth at 1% did not fall by one percent or more for any of the ${crow.length} assets; ${roseC1.length} rose by at least one percent and ${regimeChanges} changed regime.`
          : `executable depth at 1% fell by at least one percent for ${fellC1.length} of ${crow.length} assets and rose by at least one percent for ${roseC1.length}; ${regimeChanges} changed regime.`,
      },
    };
  }

  const sources = await sql<{ source: string; n: string; first: Date; last: Date }[]>`
    SELECT source, count(*)::text AS n, min(ts) AS first, max(ts) AS last FROM obs_price
    WHERE mode = 'live' AND ts BETWEEN ${F} AND ${T} GROUP BY source ORDER BY source`;

  const assetPools = pools.filter((p) => p.role === "asset");
  const crossed = assetPools.filter((p) => p.cliffChangePct !== null);
  const fellCliff = crossed.filter((p) => neg(p.cliffChangePct));
  const cmp = sessionVsClosed.filter((s) => s.meanAbsMoveBpRegular !== null && s.meanAbsMoveBpClosed !== null);
  const busierOpen = cmp.filter((s) => BigInt(s.meanAbsMoveBpRegular!.replace(".", "")) > BigInt(s.meanAbsMoveBpClosed!.replace(".", "")));
  const partial = toMs < Date.parse(PLANNED_TO);

  const at = (ms: number): string => `${new Date(ms).toISOString().slice(11, 16)} UTC on ${new Date(ms).getUTCDate()} Sep`;
  const findings = [];
  if (crossed.length) findings.push({
    claim: fellCliff.length === 0
      ? `In-range liquidity did not fall across the campaign end: none of the ${crossed.length} asset pools had less in range in the hour after ${at(cliffMs)} than just before it.`
      : `${fellCliff.length} of ${crossed.length} asset pools had less in-range liquidity in the hour after the campaign ended at ${at(cliffMs)} than just before it.`,
    evidence: `Last reading at or before ${at(cliffMs).slice(0, 5)} against the last reading at or before ${at(cliffMs + 3_600_000).slice(0, 5)}, per pool; ${crossed.map((p) => `${p.symbol} ${p.cliffChangePct}%`).join(", ")}.`,
  });
  if (campaign) findings.push({
    claim: `Between the ${campaign.before.label} capture at ${campaign.before.capturedAt.slice(11, 16)} and the ${campaign.after.label} capture at ${campaign.after.capturedAt.slice(11, 16)} UTC, ${campaign.summary.statement}`,
    evidence: "Full engine captures of every asset: executable depth at 1% and 3% by tick walk, the Credit Mark, the regime and the debt ceiling Kerb would publish.",
  });
  // V3-09: the slower story. The last capture of the morning against the last one before the cliff.
  const laterRows = (campaign?.rows ?? []) as { symbol: string; c1LaterChangePct?: string | null; laterAt?: string | null }[];
  const withLater = laterRows.filter((r) => r.c1LaterChangePct !== null && r.c1LaterChangePct !== undefined);
  if (campaign && withLater.length) {
    const fellLater = withLater.filter((r) => neg(r.c1LaterChangePct!) && atLeast(r.c1LaterChangePct!, 10n)).sort((x, y) => Number(x.c1LaterChangePct) - Number(y.c1LaterChangePct));
    const roseLater = withLater.filter((r) => !neg(r.c1LaterChangePct!) && atLeast(r.c1LaterChangePct!, 10n));
    const laterAt = withLater[0]?.laterAt ?? null;
    findings.push({
      claim: `By the ${laterAt ? laterAt.slice(11, 16) : "later"} UTC capture, executable depth at 1% had fallen by 10% or more for ${fellLater.length} of ${withLater.length} assets${fellLater[0] ? `, the largest ${fellLater[0].symbol} at ${fellLater[0].c1LaterChangePct}%` : ""}, and risen by 10% or more for ${roseLater.length}.`,
      evidence: `C(1%) at the last capture before the cliff against the last capture of the morning, per asset: ${withLater.map((r) => `${r.symbol} ${r.c1LaterChangePct}%`).join(", ")}. The Hong Kong market closes at 08:00 UTC, inside this interval, so for its assets the incentive end and the close cannot be told apart from these readings alone.`,
    });
  }
  if (cmp.length) findings.push({
    claim: `Now that the record holds sessions, it can compare them: for ${busierOpen.length} of ${cmp.length} assets, in-range liquidity moved more from minute to minute while the underlying market was in its regular session than while it was shut.`,
    evidence: `Mean absolute change between consecutive readings, never across a hole: ${cmp.map((s) => `${s.symbol} ${s.meanAbsMoveBpRegular} bp open, ${s.meanAbsMoveBpClosed} bp closed`).join("; ")}.`,
  });

  const report = {
    id: 2,
    title: "What happened when the X Liquidity incentives ended",
    generatedAt: new Date().toISOString(),
    window: {
      from: from.toISOString(), to: to.toISOString(), hours: ((toMs - fromMs) / 3_600_000).toFixed(2), observations: Number(win?.rows ?? 0), pools: Number(win?.pools ?? 0),
      largestGap: largest ? `${String(Math.floor(largest / 60)).padStart(2, "0")}:${String(largest % 60).padStart(2, "0")}:00` : null,
      underlyingOpenDuringWindow: sessionVsClosed.some((s) => s.regularReadings > 0),
      partial, plannedTo: PLANNED_TO, cliff: cliff.toISOString(),
    },
    method: "Every 60 seconds the collector reads each X Layer pool's slot0, in-range liquidity and initialised ticks and appends the reading. Around the campaign end, full engine captures were taken at 06:30, 06:55, 07:05, 07:30 and 08:30 UTC: executable depth at 1% and 3% by walking the pool's ticks, the Credit Mark, the regime and the debt ceiling. Every figure below is one of those stored readings or captures, or exact integer arithmetic on them.",
    pools, sessionVsClosed, snapshots, gaps: gaps.map((g) => ({ from: new Date(g.prev).toISOString(), to: new Date(g.ts).toISOString(), minutes: Number(g.mins) })),
    sources: sources.map((s) => ({ source: s.source, observations: Number(s.n), firstAt: new Date(s.first).toISOString(), lastAt: new Date(s.last).toISOString() })),
    campaign, findings,
    limitations: [
      ...(partial ? [`The window is partial: the record reaches ${to.toISOString().slice(0, 16)} UTC of a planned ${PLANNED_TO.slice(0, 16)} UTC. The report is regenerated as it fills.`] : []),
      "Two days either side of one event is one observation of that event. It shows what happened here, not what always happens.",
      "The later comparison spans the Hong Kong close at 08:00 UTC; for HKEXCx, KUAIx, MIXUx and SHEINx the end of incentives and the market close overlap.",
      "In-range liquidity L is in protocol units, not dollars; executable depth C(1%) in the captures is the dollar measure.",
      "The session comparison measures how much L moved, not why. Liquidity providers act for reasons the record does not hold.",
      ...(gaps.length ? [`The record has ${gaps.length} hole${gaps.length === 1 ? "" : "s"} longer than five minutes; they are listed and nothing is interpolated across them.`] : []),
    ],
    reproduce: "pnpm --filter @kerb/engine exec tsx scripts/market-time-report-2.ts regenerates this file from the observation store and the window captures in data/windows. Every row is a SELECT over append-only tables.",
  };

  mkdirSync(OUT, { recursive: true });
  const dry = process.argv.includes("--dry-run");
  const path = resolve(OUT, dry ? "market-time-2.dry.json" : "market-time-2.json");
  const body = `${JSON.stringify({ ...report, status: partial ? "partial" : "final" }, null, 2)}\n`;
  writeFileSync(path, body);
  // V3-09: every published version is kept beside the current one; nothing is overwritten away.
  if (!dry) {
    mkdirSync(resolve(OUT, "versions"), { recursive: true });
    writeFileSync(resolve(OUT, "versions", `market-time-2.${report.generatedAt.replace(/[:.]/g, "-")}.json`), body);
  }
  console.log(`wrote ${path}${partial ? " (partial)" : ""}`);
  for (const f of findings) console.log(`- ${f.claim}\n    ${f.evidence.slice(0, 300)}`);
} finally {
  await sql.end();
}
