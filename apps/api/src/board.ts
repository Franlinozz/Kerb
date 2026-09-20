/**
 * The Board: one row per tracked asset, built from the latest onchain Terms and the
 * observation record. Every number carries a provenance label and the time it was observed.
 */
import { fromUnits, regimeName, type DecString, type ProvenanceLabel } from "@kerb/types";
import { explorerAddress, explorerTx, loadAssets, resolvedAssets } from "@kerb/adapters";
import type { Sql } from "@kerb/collector/db";

export interface Labelled {
  value: DecString | null;
  label: ProvenanceLabel;
  source: string;
  observedAt: string | null;
  /** keccak256 of the pinned input bundle, where the number came from a report. */
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
}

export interface Board {
  chainId: number;
  loanAsset: string;
  generatedAt: string;
  contracts: { KerbClock: string | null; KerbTerms: string | null; explorer: string | null };
  rows: BoardRow[];
  sources: { name: string; lastObservedAt: string | null; ageSec: number | null; healthy: boolean }[];
}

const WAD = 18;

export async function buildBoard(
  sql: Sql,
  chainId: number,
  contracts: { clock?: string; terms?: string },
  nowMs: number = Date.now(),
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

  const { assetId } = await import("@kerb/types");
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
    };
  });

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
    sources: srcRows.map((s) => {
      const last = s.last ? new Date(s.last) : null;
      const age = last ? Math.round((now - last.getTime()) / 1000) : null;
      return { name: s.source, lastObservedAt: last ? last.toISOString() : null, ageSec: age, healthy: age !== null && age < 900 };
    }).sort((x, y) => x.name.localeCompare(y.name)),
  };
}
