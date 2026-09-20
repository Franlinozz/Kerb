/**
 * @kerb/sdk: read Kerb Terms from the REST API or straight from the chain.
 *
 *   const kerb = new Kerb();
 *   const terms = await kerb.terms("KOx");
 *   if (!terms.usable) return;                       // no new risk may be taken
 *   const maxDebt = Number(terms.carryLTV) * collateralValue;
 *
 * Every number is a decimal string and carries the provenance label it was published with.
 */

export type ProvenanceLabel = "Verified" | "Observed" | "Attested" | "Computed";
export const KERB_API = "https://api.usekerb.xyz";
export const X_LAYER = 196;
export const X_LAYER_TESTNET = 1952;

export const REGIMES = [
  "DEEP", "NORMAL", "THIN", "PRE_TRANSITION", "REFERENCE_CLOSED", "ACTION", "HALTED", "STALE", "RECOVERY",
] as const;
export type Regime = (typeof REGIMES)[number];

export interface RawValue {
  raw: string;
  decimals: number;
  label: ProvenanceLabel;
}

export interface Terms {
  chainId: number;
  assetId: string;
  symbol: string | null;
  observedAt: string;
  ageSec: number;
  /** false means "no new risk may be taken". It never means "liquidate everything". */
  usable: boolean;
  regime: { value: Regime; index: number; label: ProvenanceLabel };
  creditMark: RawValue;
  carryLTV: RawValue;
  sessionMaxLTV: RawValue;
  debtCeiling: RawValue;
  executableDepth1: RawValue;
  inputsHash: string;
  tx: string;
  contracts: { clock?: string; terms?: string };
  history: { observedAt: string; regime: Regime; carryLTV: string; sessionMaxLTV: string; creditMark: string; tx: string }[];
}

export interface BoardRow {
  symbol: string;
  underlying: { symbol: string; market: string; currency: string };
  status: "live" | "no report" | "stale";
  regime: { value: Regime | null; label: ProvenanceLabel; observedAt: string | null };
  creditMark: { value: string | null; label: ProvenanceLabel };
  executableDepth1: { value: string | null; label: ProvenanceLabel };
  carryLTV: { value: string | null; label: ProvenanceLabel };
  sessionMaxLTV: { value: string | null; label: ProvenanceLabel };
  debtCeiling: { value: string | null; label: ProvenanceLabel };
  coverageRatio: { value: string | null; label: ProvenanceLabel };
  reportAgeSec: number | null;
}

export interface Board {
  chainId: number;
  loanAsset: string;
  generatedAt: string;
  contracts: { KerbClock: string | null; KerbTerms: string | null };
  rows: BoardRow[];
  sources: { name: string; lastObservedAt: string | null; ageSec: number | null; healthy: boolean }[];
}

/** Scale a raw integer string by its decimals, exactly, without floating point. */
export function toDecimalString(v: RawValue | { raw: string; decimals: number }): string {
  const neg = v.raw.startsWith("-");
  const digits = (neg ? v.raw.slice(1) : v.raw).padStart(v.decimals + 1, "0");
  const cut = digits.length - v.decimals;
  const out = `${digits.slice(0, cut)}.${digits.slice(cut)}`.replace(/\.?0+$/, "");
  return `${neg ? "-" : ""}${out === "" ? "0" : out}`;
}

export class KerbError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface KerbOptions {
  baseUrl?: string;
  chainId?: number;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class Kerb {
  private readonly baseUrl: string;
  private readonly chainId: number;
  private readonly doFetch: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(opts: KerbOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? KERB_API).replace(/\/$/, "");
    this.chainId = opts.chainId ?? X_LAYER;
    this.doFetch = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.doFetch(`${this.baseUrl}${path}`, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new KerbError(res.status, `kerb: ${path} returned ${res.status}`);
    return (await res.json()) as T;
  }

  /** Latest posted Terms for an asset, by symbol, token address or assetId. */
  async terms(asset: string, chainId = this.chainId): Promise<Terms> {
    return this.get<Terms>(`/v1/terms/${chainId}/${encodeURIComponent(asset)}`);
  }

  /** Every tracked asset with its regime, mark, depth and capacities. */
  async board(chainId = this.chainId): Promise<Board> {
    return this.get<Board>(`/v1/board?chain=${chainId}`);
  }

  /** The pinned input bundle behind a report, so any number can be recomputed. */
  async bundle(inputsHashOrReportId: string): Promise<unknown> {
    return this.get(`/v1/bundle/${encodeURIComponent(inputsHashOrReportId)}`);
  }

  async report(reportId: string): Promise<unknown> {
    return this.get(`/v1/reports/${encodeURIComponent(reportId)}`);
  }

  async health(): Promise<{ status: string; observations: { ageSec: number | null } }> {
    return this.get("/health");
  }
}

/**
 * Read `effectiveTerms` straight from KerbTerms with any viem-compatible client, for
 * consumers that will not trust an HTTP API.
 */
export const KERB_TERMS_ABI = [
  {
    type: "function",
    name: "effectiveTerms",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "bytes32" }],
    outputs: [
      { name: "carryLTV", type: "uint64" },
      { name: "sessionMaxLTV", type: "uint64" },
      { name: "creditMark", type: "uint128" },
      { name: "regime", type: "uint16" },
      { name: "usable", type: "bool" },
    ],
  },
] as const;

export function regimeName(index: number): Regime {
  const r = REGIMES[index];
  if (!r) throw new KerbError(0, `unknown regime index ${index}`);
  return r;
}
