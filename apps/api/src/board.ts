/**
 * The Board: one row per tracked asset, built from the latest onchain Terms and the
 * observation record. Every number carries a provenance label and the time it was observed.
 */
import { Decimal, dec, fromUnits, regimeName, toDecString, type DecString, type ProvenanceLabel } from "@kerb/types";
import { explorerAddress, explorerTx, loadAssets, resolvedAssets } from "@kerb/adapters";
import type { Sql } from "@kerb/collector/db";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import { computeReport, engineConfigFromBundle, type InputBundle } from "@kerb/engine";
import { MARKETS, resolveClock } from "@kerb/calendar";
import type { MarketCode } from "@kerb/types";
import { marketMeta, type MarketMeta } from "./markets.js";

export interface Labelled {
  value: DecString | null;
  label: ProvenanceLabel;
  source: string;
  observedAt: string | null;
  /** keccak256 of the published input bundle, where the number came from a report. */
  inputsHash?: string;
  tx?: string;
}

export interface BoardRow {
  symbol: string;
  underlying: { symbol: string; market: string; currency: string };
  pool: { address: string; quote: string; fee: number; explorer: string } | null;
  status: "live" | "no report" | "stale";
  regime: { value: string | null; label: ProvenanceLabel; source: string; observedAt: string | null; tx?: string };
  creditMark: Labelled;
  executableDepth1: Labelled;
  carryLTV: Labelled;
  sessionMaxLTV: Labelled;
  debtCeiling: Labelled;
  coverageRatio: Labelled;
  /** Age of the latest posted report in seconds; null when nothing is posted yet. */
  reportAgeSec: number | null;
  poolObservedAt: string | null;
  poolObservationAgeSec: number | null;
  /** Formula version of the posted report, read from its bundle; null when the bundle is not on this server. */
  kts: "0.1" | "0.2" | null;
  /** KTS-0.2 only: why Carry and Session Max sit where they do, in compact form. */
  margins: CompactMargins | null;
  /** The fixed liquidation threshold, read from KerbTerms guardrails on this chain. */
  lt: { value: DecString | null; label: ProvenanceLabel; source: string; observedAt: string | null };
  market: Pick<MarketMeta, "code" | "city" | "tz" | "lat" | "lon">;
  /** The asset's next calendar transition and next weakening, from the Clock. */
  next: { type: string; at: string; weakening: string; label: ProvenanceLabel } | null;
  /** Last Call for this asset's market: when it opens and closes, and whether it is open now. */
  cure: { opensAt: string; closesAt: string; open: boolean; label: ProvenanceLabel } | null;
  /** C(1%) and regime from posted terms over the last 24 h, oldest first, at most 48 points. */
  spark: { at: string; c1: DecString; regime: string }[];
}

export interface BoardSummary {
  inLastCall: number;
  c1Total: DecString;
  ceilingTotal: DecString;
  sourcesHealthy: number;
  sourcesTotal: number;
  lastPostAgeSec: number | null;
  label: ProvenanceLabel;
}

export interface BoardOptions {
  /** Liquidation thresholds by assetId (lowercase), in WAD, as read from chain; null when unreadable. */
  readLT?: (chainId: number, assetIds: string[]) => Promise<Map<string, bigint> | null>;
}

export interface CompactMargins {
  label: "Computed";
  inputsHash: string;
  stressMultiplier: DecString;
  carry: { margin: DecString; gap: DecString; exitCost: DecString; floor: DecString; horizonHours: DecString; horizonEndsAt: string };
  session: { margin: DecString; gap: DecString; exitCost: DecString; floor: DecString; horizonHours: DecString; horizonEndsAt: string };
  carryMarginUsed: DecString;
  sessionMarginUsed: DecString;
  /** End of the Carry horizon: the next deep market. */
  horizonEndsAt: string;
}

const BUNDLE_DIR = process.env["KERB_BUNDLE_DIR"] ?? resolve(repoRoot(), "data/reports/bundles");

/** A posted bundle never changes, so what it says is cached by its hash. */
const detailCache = new Map<string, { kts: "0.1" | "0.2"; margins: CompactMargins | null }>();

export function postedDetail(inputsHash: string, dir = BUNDLE_DIR): { kts: "0.1" | "0.2"; margins: CompactMargins | null } | null {
  const key = inputsHash.toLowerCase();
  const hit = detailCache.get(key);
  if (hit) return hit;
  const path = resolve(dir, `${key}.json`);
  if (!/^0x[0-9a-f]{64}$/.test(key) || !existsSync(path)) return null;
  try {
    const bundle = JSON.parse(readFileSync(path, "utf8")) as InputBundle;
    let margins: CompactMargins | null = null;
    if (bundle.kts === "0.2") {
      const m = (computeReport(bundle, engineConfigFromBundle(bundle)).capacity as { margins?: import("@kerb/engine").Margins }).margins;
      if (m) {
        const term = (t: import("@kerb/engine").MarginTerm) => ({ margin: t.used, gap: t.gap, exitCost: t.exitCost, floor: t.floor, horizonHours: t.horizonHours, horizonEndsAt: t.horizonEndsAt });
        margins = {
          label: "Computed", inputsHash: key, stressMultiplier: m.stressMultiplier, carry: term(m.carry), session: term(m.session),
          carryMarginUsed: m.carry.used, sessionMarginUsed: m.session.used, horizonEndsAt: m.carry.horizonEndsAt,
        };
      }
    }
    const out = { kts: bundle.kts, margins };
    if (detailCache.size > 500) detailCache.clear();
    detailCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

export interface Board {
  chainId: number;
  loanAsset: string;
  generatedAt: string;
  contracts: { KerbClock: string | null; KerbTerms: string | null; explorer: string | null };
  rows: BoardRow[];
  sources: { name: string; lastObservedAt: string | null; ageSec: number | null; healthy: boolean }[];
  summary: BoardSummary;
}

const WAD = 18;

export async function buildBoard(
  sql: Sql,
  chainId: number,
  contracts: { clock?: string; terms?: string },
  nowMs: number = Date.now(),
  opts: BoardOptions = {},
): Promise<Board> {
  const cfg = loadAssets();
  const assets = resolvedAssets(cfg);
  const now = nowMs;
  // Depth and ceilings are posted in loan-asset units (USDG has 6 decimals), not 1e18.
  const loanDecimals = cfg.quoteTokens[cfg.loanAsset]?.decimals ?? 18;

  const reports = await sql<{
    asset_id: string; symbol: string | null; observed_at: Date; regime: number; credit_mark: string; carry_ltv: string;
    session_max_ltv: string; debt_ceiling: string; executable_depth1: string; inputs_hash: string; tx_hash: string;
  }[]>`
    SELECT DISTINCT ON (asset_id) asset_id, symbol, observed_at, regime, credit_mark, carry_ltv, session_max_ltv,
           debt_ceiling, executable_depth1, inputs_hash, tx_hash
    FROM terms_reports WHERE chain_id = ${chainId} ORDER BY asset_id, observed_at DESC`;
  const byAsset = new Map(reports.map((r) => [r.asset_id.toLowerCase(), r]));

  const pools = await sql<{ pool: string; ts: Date }[]>`
    SELECT DISTINCT ON (pool) pool, ts FROM obs_pool_state WHERE mode = 'live' ORDER BY pool, ts DESC`;
  const poolTs = new Map(pools.map((p) => [p.pool.toLowerCase(), new Date(p.ts)]));

  const srcRows = await sql<{ source: string; last: Date }[]>`
    SELECT source, max(ts) AS last FROM obs_price WHERE mode = 'live' GROUP BY source
    UNION ALL SELECT 'xlayer:uniswap-v3', max(ts) FROM obs_pool_state WHERE mode = 'live'
    UNION ALL SELECT 'okx-dex:v6-quote', max(ts) FROM obs_quote WHERE mode = 'live'`;

  // Sparklines: one point per half hour per asset over the last day, oldest first.
  const sparkRows = await sql<{ asset_id: string; observed_at: Date; executable_depth1: string; regime: number }[]>`
    SELECT DISTINCT ON (asset_id, floor(extract(epoch FROM observed_at) / 1800))
           asset_id, observed_at, executable_depth1, regime
    FROM terms_reports
    WHERE chain_id = ${chainId} AND observed_at > ${new Date(now - 86_400_000).toISOString()}
    ORDER BY asset_id, floor(extract(epoch FROM observed_at) / 1800), observed_at DESC`;
  const sparks = new Map<string, { at: string; c1: DecString; regime: string }[]>();
  for (const p of sparkRows) {
    const k = p.asset_id.toLowerCase();
    const list = sparks.get(k) ?? [];
    list.push({ at: new Date(p.observed_at).toISOString(), c1: fromUnits(BigInt(p.executable_depth1), loanDecimals), regime: regimeName(p.regime) });
    sparks.set(k, list);
  }
  for (const [k, list] of sparks) sparks.set(k, list.sort((x, y) => x.at.localeCompare(y.at)).slice(-48));

  const { assetId } = await import("@kerb/types");
  const ids = assets.map((a) => assetId(196, a.token.address).toLowerCase());
  let lts: Map<string, bigint> | null = null;
  try { lts = opts.readLT ? await opts.readLT(chainId, ids) : null; } catch { lts = null; }
  const ltReadAt = lts ? new Date(now).toISOString() : null;

  const rows: BoardRow[] = assets.map((a) => {
    const id = assetId(196, a.token.address).toLowerCase();
    const r = byAsset.get(id);
    const observedAt = r ? new Date(r.observed_at).toISOString() : null;
    const ageSec = r ? Math.round((now - new Date(r.observed_at).getTime()) / 1000) : null;
    const pTs = a.pool ? poolTs.get(a.pool.address.toLowerCase()) ?? null : null;
    const attested = (value: DecString | null, decimals = WAD): Labelled => ({
      value, label: "Attested", source: `KerbTerms ${chainId}`, observedAt,
      ...(r ? { inputsHash: r.inputs_hash, tx: explorerTx(chainId, r.tx_hash as `0x${string}`) } : {}),
      ...(decimals === WAD ? {} : {}),
    });
    const loanUnits = (raw: string): DecString => fromUnits(BigInt(raw), loanDecimals);
    const coverage = r && BigInt(r.debt_ceiling) > 0n
      ? (Number(r.executable_depth1) / Number(r.debt_ceiling)).toFixed(6)
      : null;

    return {
      symbol: a.symbol,
      underlying: { symbol: a.underlying.symbol, market: a.underlying.market, currency: a.underlying.currency },
      pool: a.pool ? { address: a.pool.address, quote: a.quoteToken, fee: a.pool.fee, explorer: explorerAddress(196, a.pool.address) } : null,
      status: !r ? "no report" : (ageSec ?? 0) > 900 ? "stale" : "live",
      regime: {
        value: r ? regimeName(r.regime) : null, label: "Attested", source: `KerbTerms ${chainId}`, observedAt,
        ...(r ? { tx: explorerTx(chainId, r.tx_hash as `0x${string}`) } : {}),
      },
      creditMark: attested(r ? fromUnits(BigInt(r.credit_mark), 18) : null),
      executableDepth1: attested(r ? loanUnits(r.executable_depth1) : null),
      carryLTV: attested(r ? fromUnits(BigInt(r.carry_ltv), 18) : null),
      sessionMaxLTV: attested(r ? fromUnits(BigInt(r.session_max_ltv), 18) : null),
      debtCeiling: attested(r ? loanUnits(r.debt_ceiling) : null),
      coverageRatio: { value: coverage as DecString | null, label: "Computed", source: "C(1%) / debtCeiling", observedAt },
      reportAgeSec: ageSec,
      poolObservedAt: pTs ? pTs.toISOString() : null,
      poolObservationAgeSec: pTs ? Math.round((now - pTs.getTime()) / 1000) : null,
      ...(() => {
        const d = r ? postedDetail(r.inputs_hash) : null;
        return { kts: d?.kts ?? null, margins: d?.margins ?? null };
      })(),
      lt: {
        value: lts?.has(id) ? fromUnits(lts.get(id) as bigint, 18) : null,
        label: "Verified", source: `KerbTerms ${chainId} guardrails`, observedAt: ltReadAt,
      },
      market: (({ code, city, tz, lat, lon }) => ({ code, city, tz, lat, lon }))(marketMeta(a.underlying.market)),
      ...(() => {
        try {
          const m = a.underlying.market as MarketCode;
          const c = resolveClock({ market: m, atMs: now, cureWindowSec: MARKETS[m].defaultCureWindowSec });
          return {
            next: { type: c.nextTransition.type, at: c.nextTransition.at, weakening: c.nextWeakening.at, label: "Computed" as const },
            cure: { opensAt: c.cureWindow.opensAt, closesAt: c.cureWindow.closesAt, open: c.cureWindow.open, label: "Computed" as const },
          };
        } catch {
          return { next: null, cure: null };
        }
      })(),
      spark: sparks.get(id) ?? [],
    };
  });

  const sources = srcRows.map((s) => {
    const last = s.last ? new Date(s.last) : null;
    const age = last ? Math.round((now - last.getTime()) / 1000) : null;
    return { name: s.source, lastObservedAt: last ? last.toISOString() : null, ageSec: age, healthy: age !== null && age < 900 };
  }).sort((x, y) => x.name.localeCompare(y.name));
  // Decimal strings throughout: these are amounts, so no float ever touches them.
  const sum = (xs: (DecString | null)[]): DecString =>
    toDecString(xs.reduce((acc: Decimal, x) => (x === null ? acc : acc.plus(dec(x))), new Decimal(0)), 6);
  const ages = rows.map((r) => r.reportAgeSec).filter((x): x is number => x !== null);
  const summary: BoardSummary = {
    inLastCall: rows.filter((r) => r.cure?.open).length,
    c1Total: sum(rows.map((r) => r.executableDepth1.value)),
    ceilingTotal: sum(rows.map((r) => r.debtCeiling.value)),
    sourcesHealthy: sources.filter((x) => x.healthy).length,
    sourcesTotal: sources.length,
    lastPostAgeSec: ages.length ? Math.min(...ages) : null,
    label: "Computed",
  };

  return {
    chainId,
    loanAsset: cfg.loanAsset,
    generatedAt: new Date(now).toISOString(),
    contracts: {
      KerbClock: contracts.clock ?? null,
      KerbTerms: contracts.terms ?? null,
      explorer: contracts.terms ? explorerAddress(chainId, contracts.terms as `0x${string}`) : null,
    },
    rows,
    sources,
    summary,
  };
}
