/**
 * Server-side reads of the Kerb API.
 *
 * Every page renders on the server from the same public API a judge can curl. A source that is
 * down returns a typed failure, never a placeholder number: AGENTS.md rule 1.
 */
import type { ProvenanceLabel } from "./format";

const BASE = process.env["KERB_API_INTERNAL"] ?? "http://127.0.0.1:8720";
export const PUBLIC_API = process.env["KERB_API_PUBLIC"] ?? "https://api.usekerb.xyz";
export const CHAIN_ID = Number(process.env["KERB_CHAIN_ID"] ?? 196);

export type Regime =
  | "DEEP" | "NORMAL" | "THIN" | "PRE_TRANSITION"
  | "REFERENCE_CLOSED" | "ACTION" | "HALTED" | "STALE" | "RECOVERY";

export interface RawValue { raw: string; decimals: number; label: ProvenanceLabel }

/** Every board value is already a decimal string and carries where it came from. */
export interface BoardValue {
  value: string | null;
  label: ProvenanceLabel;
  source?: string;
  observedAt?: string | null;
  inputsHash?: string;
  tx?: string;
}

export interface BoardRow {
  symbol: string;
  underlying: { symbol: string; market: string; currency: string };
  pool: { address: string; quote: string; fee: number; explorer: string };
  status: "live" | "no report" | "stale";
  regime: BoardValue & { value: Regime | null };
  creditMark: BoardValue;
  executableDepth1: BoardValue;
  carryLTV: BoardValue;
  sessionMaxLTV: BoardValue;
  debtCeiling: BoardValue;
  coverageRatio: BoardValue;
  reportAgeSec: number | null;
  poolObservedAt: string | null;
  poolObservationAgeSec: number | null;
  // V2-02 additions.
  kts?: "0.1" | "0.2" | null;
  margins?: BoardMargins | null;
  lt?: BoardValue;
  market?: MarketMeta;
  next?: { type: string; at: string; weakening: string; label: ProvenanceLabel } | null;
  cure?: { opensAt: string; closesAt: string; open: boolean; label: ProvenanceLabel } | null;
  spark?: { at: string; c1: string; regime: Regime }[];
}

export interface MarketMeta { code: string; city: string; tz: string; lat: number; lon: number; label?: string }

export interface MarginTermCompact { margin: string; gap: string; exitCost: string; floor: string; horizonHours: string; horizonEndsAt: string }
export interface BoardMargins {
  label: ProvenanceLabel; inputsHash: string; stressMultiplier: string;
  carry: MarginTermCompact; session: MarginTermCompact;
  carryMarginUsed: string; sessionMarginUsed: string; horizonEndsAt: string;
}

export interface BoardSummary { inLastCall: number; c1Total: string; ceilingTotal: string; sourcesHealthy: number; sourcesTotal: number; lastPostAgeSec: number | null; label: ProvenanceLabel }

export interface Board {
  chainId: number;
  loanAsset: string;
  generatedAt: string;
  contracts: { KerbClock: string | null; KerbTerms: string | null; explorer?: string };
  rows: BoardRow[];
  sources?: { name: string; lastObservedAt: string | null; ageSec: number | null; healthy: boolean }[];
  summary?: BoardSummary;
}

export interface Transition {
  type: string;
  at: string;
  atMs: number;
  from: string;
  to: string;
  weakening: boolean;
}

export interface ClockSegment {
  kind: "PRE" | "REGULAR" | "LUNCH" | "POST" | "CLOSED";
  reason: string;
  startsAt: string;
  endsAt: string;
  names: string[];
}

export interface Clock {
  chainId: number;
  symbol: string;
  market: string;
  timezone: string;
  at: string;
  label: ProvenanceLabel;
  clock: {
    calendarVersion: string;
    session: { kind: ClockSegment["kind"]; reason: string; startedAt: string; endsAt: string; names: string[] };
    inMainSession: boolean;
    referenceClosed: boolean;
    nextTransition: Transition;
    nextWeakening: Transition;
    nextReferenceClosed: Transition;
    cureWindow: { lengthSec: number; opensAt: string; closesAt: string; open: boolean };
    horizonHours: string;
  };
  window: { from: string; to: string };
  segments: ClockSegment[];
}

export interface Terms {
  chainId: number;
  assetId: string;
  symbol: string | null;
  observedAt: string;
  ageSec: number;
  usable: boolean;
  regime: { value: Regime; index: number; label: ProvenanceLabel };
  creditMark: RawValue;
  carryLTV: RawValue;
  sessionMaxLTV: RawValue;
  debtCeiling: RawValue;
  executableDepth1: RawValue;
  loanAsset: { symbol: string; decimals: number };
  inputsHash: string;
  bundle: {
    cid: string | null; pinStatus: string | null; pinned: boolean;
    ipfsUrl: string | null; url: string | null; servedByApi: boolean; verifyCommand: string;
  };
  tx: string;
  contracts: { clock?: string; terms?: string };
  history: { observedAt: string; regime: Regime; carryLTV: string; sessionMaxLTV: string; debtCeiling: string; executableDepth1: string; creditMark: string; tx: string }[];
}

export interface Health {
  status: string;
  now: string;
  observations: { poolRows: number; lastObservedAt: string | null; ageSec: number | null };
  posts: { chainId: number; count: number; lastAt: string | null }[];
}

/** A read either succeeded or it did not. The UI renders the difference. */
export type Read<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function read<T>(path: string, revalidateSec = 0): Promise<Read<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(12_000),
      ...(revalidateSec > 0 ? { next: { revalidate: revalidateSec } } : { cache: "no-store" as const }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, status: res.status, error: body.error ?? `API returned ${res.status}` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: msg.includes("timed out") || msg.includes("aborted") ? "the Kerb API did not answer in time" : msg };
  }
}

export const getBoard = (chainId = CHAIN_ID): Promise<Read<Board>> => read<Board>(`/v1/board?chain=${chainId}`);
export const getClock = (symbol: string, chainId = CHAIN_ID, window?: { fromMs: number; toMs: number }): Promise<Read<Clock>> =>
  read<Clock>(`/v1/clock/${chainId}/${encodeURIComponent(symbol)}${window ? `?from=${new Date(window.fromMs).toISOString()}&to=${new Date(window.toMs).toISOString()}` : ""}`);

export interface DemoClock {
  address: string; weekLengthSec: number; sessionEndSec: number; cureStartSec: number; epoch: number; now: string; phaseSec: number;
  state: "SESSION" | "LAST_CALL" | "CLOSED"; nextCureOpensAt: string; nextCureClosesAt: string; nextSessionAt: string; cycleStartedAt: string;
  label: ProvenanceLabel; note: string;
}
export const getDemoClock = (chainId = 1952): Promise<Read<DemoClock>> => read<DemoClock>(`/v1/credit/${chainId}/demo-clock`);

export interface TapePost { symbol: string; chainId: number; regime: Regime; c1: string; carryLTV: string; sessionMaxLTV: string; tx: string; explorer: string; observedAt: string }
export const getTape = (limit = 20): Promise<Read<{ label: ProvenanceLabel; posts: TapePost[] }>> => read(`/v1/tape?limit=${limit}`);

export interface Stats {
  label: ProvenanceLabel; obsPoolRows: number; obsTotalRows: number; postsByChain: { chainId: number; count: number }[]; assets: number; markets: number;
  marketMeta: MarketMeta[]; latestReport: { id: string; title: string; headline: string | null; figure: string | null } | null;
}
export const getStats = (): Promise<Read<Stats>> => read<Stats>("/v1/stats", 60);
export const getTerms = (symbol: string, chainId = CHAIN_ID, historyHours?: number): Promise<Read<Terms>> =>
  read<Terms>(`/v1/terms/${chainId}/${encodeURIComponent(symbol)}${historyHours ? `?historyHours=${historyHours}` : ""}`);
export const getHealth = (): Promise<Read<Health>> => read<Health>("/health");

export const explorerTx = (hash: string, chainId = CHAIN_ID): string =>
  `${chainId === 196 ? "https://www.oklink.com/xlayer" : "https://www.oklink.com/x-layer-testnet"}/tx/${hash}`;
export const explorerAddress = (addr: string, chainId = CHAIN_ID): string =>
  `${chainId === 196 ? "https://www.oklink.com/xlayer" : "https://www.oklink.com/x-layer-testnet"}/address/${addr}`;

export interface CurvePoint {
  notional: string;
  amountIn: string;
  amountOut: string;
  midPrice: string;
  realisedPrice: string;
  impact: string;
  filled: boolean;
  exhaustedReason: string;
  legImpacts?: string[];
}

export interface Venue {
  path: string[];
  pools: string[];
  midPrice: string;
  curve: CurvePoint[];
  C_0_5: { notional: string; impact: string; censored: boolean };
  C_1: { notional: string; impact: string; censored: boolean };
  C_3: { notional: string; impact: string; censored: boolean };
}

export interface MarkComponent {
  value: string;
  label: ProvenanceLabel;
  sources: string[];
  usedSources?: string[];
  excluded?: { source: string; reason: string }[];
  basis?: string;
  twapWindowSec?: number | null;
}

export interface Report {
  assetSymbol: string;
  asset?: unknown;
  chainId: number;
  observedAt: string;
  engineVersion: string;
  paramsVersion: string;
  regime: Regime;
  mark: {
    creditMark: string;
    band: [string, string];
    dispersion: string;
    dispersionBreach: boolean;
    haircut: string;
    quoteAssumption: string;
    reference: MarkComponent;
    pool: MarkComponent;
  };
  depth: {
    /** Aggregate capacities are plain decimal strings; the per-venue ones are objects. */
    C_0_5: string;
    C_1: string;
    C_3: string;
    C_1_simulated?: string;
    venues: Venue[];
    excluded: { path: string[]; pools: string[]; reason: string }[];
    fragmentationFactor: string;
    censored?: boolean;
    quoteCurve?: { notional: string; impact: string }[];
    /**
     * Either the cross-check ran, or it could not. Rung 2 is a real answer with a reason,
     * not a missing field, so the two shapes are modelled separately.
     */
    crosscheck?:
      | { source: string; simulated: string; quoted: string; delta: string; flag: boolean; used: string; status?: undefined }
      | { source: string; status: "unavailable"; reason: string; rung: number }
      | null;
  };
  capacity: {
    LT: string; carryLTV: string; sessionMaxLTV: string; stressLTVWeak: string; stressLTVCure: string;
    debtCeiling: string; maxPositionDebt: string; coverageRatioAtCeiling: string; clamped: unknown[];
    margins?: {
      kts: "0.2"; stressMultiplier: string; gapMethod: string;
      carry: { gap: string; volScaler: string; exitCost: string; raw: string; floor: string; used: string; horizonHours: string; horizonEndsAt: string };
      session: { gap: string; volScaler: string; exitCost: string; raw: string; floor: string; used: string; horizonHours: string; horizonEndsAt: string };
    };
  };
  kts?: "0.1" | "0.2";
  regimeInputs?: { calendarSession: string; rule: number; reason: string; cureWindowOpensAt: string; cureWindowOpen: boolean; nextWeakening: { type: string; at: string } };
  stress: {
    horizonHoursWeak: string; horizonHoursCure: string; sessionsWeak: number; sessionsCure: number;
    quantile: string; gapQuantileWeak: string; gapQuantileCure: string; volScaler: string;
    impactAtReferenceSize: string; liquidationBonus: string; buffer: string;
    historySufficient: boolean; seriesDigest: string;
  };
  underlying: { symbol: string; market: string; multiplier: string };
  provenance?: { label: ProvenanceLabel; note: string };
  inputsHash: string;
  inputsCidV1Raw: string;
  bundleBytes: number;
}

export const getReport = (symbol: string, chainId = CHAIN_ID): Promise<Read<Report>> =>
  read<Report>(`/v1/report/${chainId}/${encodeURIComponent(symbol)}`);

export interface Proof {
  generatedAt: string;
  build: {
    repo: string;
    firstCommitAt: string | null;
    latestCommitAt: string | null;
    commits: number;
    commitsPerDay: { date: string; count: number }[];
    buildPeriodMarkdown: string | null;
    tests: {
      startedAt: string; finishedAt: string; commit: string;
      typescript: { passed: number; suitesWithFailures: number; command: string };
      solidity: { passed: number; failed: number; command: string };
    } | null;
  };
  onchain: {
    deployments: { key: string; chainId: number; contract: string; address: string; block: string | null; deployedAt: string | null; verification: string | null; verificationUrl: string | null; explorer: string }[];
    latestPosts: { chainId: number; symbol: string | null; observedAt: string; tx: string; explorer: string; gasUsed: string | null; builderCode: string[] | null }[];
    postCounts: { chainId: number; count: number }[];
  };
  data: {
    sources: { source: string; lastObservedAt: string | null; ageSec: number | null; rows: number }[];
    totals: { table: string; rows: number }[];
    latestBundle: { symbol: string | null; inputsHash: string; cid: string | null; pinStatus: string | null; gateway: string | null; apiUrl: string } | null;
    pinning: { recentPosts: number; pinned: number; unpinned: number; storedByApi: number; retrievable: number; note: string };
  };
  risk: { report: { symbol: string | null; observedAt: string; inputsHash: string; cid: string | null; recomputeCommand: string } | null };
  limitations: { subsystem: string; rung: string; note: string }[];
}

export const getProof = (): Promise<Read<Proof>> => read<Proof>("/v1/proof");

// ---------------------------------------------------------------- credit plane

export interface CreditCollateral {
  key: string;
  mirrors: string;
  token: string;
  assetId: string;
  tokenDecimals: number;
  liquidationThreshold: string;
  closeFactor: string;
  cureBonus: string;
  defaultBonus: string;
  terms: {
    carryLTV: string;
    sessionMaxLTV: string;
    creditMark: string;
    regime: number;
    usable: boolean;
    debtCeiling: string;
    maxPositionDebt: string;
    observedAt: string | null;
  };
  relayedFrom: { symbol: string; chainId: number; token: string } | null;
}

export interface CreditMarket {
  chainId: number;
  contracts: {
    KerbCredit: string | null;
    KerbTerms: string | null;
    clock: string | null;
    clockIsDemo: boolean;
    loanAsset: string | null;
  };
  loanAsset: { symbol: string; decimals: number; isMock: boolean; standsInFor: string | null };
  pool: {
    totalSupplied: string; totalDebt: string; reserves: string;
    utilisation: string; borrowRate: string; available: string;
  };
  collaterals: CreditCollateral[];
  disclaimer: string;
}

export interface CreditPosition {
  user: string;
  assetId: string;
  collateralShares: string;
  debt: string;
  positionLTV: string | null;
  healthFactor: string | null;
  carryTarget: string;
  mode: number;
  modeName: "Carry" | "Session Max";
  cure: { eligible: boolean; deadline: string | null; requiredRepay: string };
}

export const CREDIT_CHAIN_ID = Number(process.env["KERB_CREDIT_CHAIN_ID"] ?? 1952);

export const getCreditMarket = (chainId = CREDIT_CHAIN_ID): Promise<Read<CreditMarket>> =>
  read<CreditMarket>(`/v1/credit/${chainId}`);

export const getCreditPosition = (user: string, assetId: string, chainId = CREDIT_CHAIN_ID): Promise<Read<CreditPosition>> =>
  read<CreditPosition>(`/v1/credit/${chainId}/position/${user}/${assetId}`);

export const REGIME_BY_INDEX: Regime[] = [
  "DEEP", "NORMAL", "THIN", "PRE_TRANSITION", "REFERENCE_CLOSED", "ACTION", "HALTED", "STALE", "RECOVERY",
];

// ---------------------------------------------------------------- market-time reports

export interface MarketTimeReport {
  id: number;
  title: string;
  generatedAt: string;
  window: {
    from: string; to: string; hours: string; observations: number; pools: number;
    largestGap: string | null; underlyingOpenDuringWindow: boolean;
  };
  method: string;
  pools: {
    pool: string; symbol: string | null; role: "asset" | "route"; observations: number;
    firstAt: string; lastAt: string; liquidityAtStart: string; liquidityAtEnd: string;
    liquidityMin: string; liquidityMax: string; changePct: string | null; swingPct: string | null;
  }[];
  sources: { source: string; observations: number; firstAt: string; lastAt: string }[];
  campaign: {
    before: { capturedAt: string };
    after: { capturedAt: string };
    rows: {
      symbol: string;
      regimeBefore: string | null; regimeAfter: string | null; regimeChanged: boolean;
      c1Before: string | null; c1After: string | null; c1ChangePct: string | null;
      c3Before: string | null; c3After: string | null; c3ChangePct: string | null;
      markBefore: string | null; markAfter: string | null; markChangePct: string | null;
      ceilingBefore: string | null; ceilingAfter: string | null; ceilingChangePct: string | null;
    }[];
    summary: { statement: string; assets: number; depthMovedAtLeastOnePercent: number; regimeChanges: number };
  } | null;
  findings: { claim: string; evidence: string }[];
  limitations: string[];
  reproduce: string;
}

export const getMarketTimeReport = (id: number): Promise<Read<MarketTimeReport>> =>
  read<MarketTimeReport>(`/v1/market-time/${id}`);

export interface MarketTimeIndexEntry {
  id: number; title: string; generatedAt: string;
  window: string; windowTo: string; hours: string; observations: number;
}

export const getMarketTimeIndex = (): Promise<Read<{ reports: MarketTimeIndexEntry[] }>> =>
  read<{ reports: MarketTimeIndexEntry[] }>("/v1/market-time");

export interface KtsParams {
  kts: string;
  paramsVersion: string;
  depth: Record<string, unknown>;
  mark: Record<string, unknown>;
  regime: Record<string, unknown>;
  asymmetry: Record<string, unknown>;
  capacityDefaults: Record<string, string>;
  stress: Record<string, unknown>;
  note?: string;
}

export const getParams = (): Promise<Read<KtsParams>> => read<KtsParams>("/v1/params");
