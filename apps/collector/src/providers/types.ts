import type { AssetConfig, PoolRef, PoolSnapshot, PythLatest, RawHttp } from "@kerb/adapters";
import type { DecString } from "@kerb/types";

export type Mode = "live" | "fixture";

export interface OnchainMultiplier {
  blockNumber: string;
  blockHash: `0x${string}`;
  multiplier: DecString;
  wrapperAssetsPerShare: DecString | null;
  paused: boolean | null;
  /** Canonical JSON of the raw call results, stored as the blob. */
  raw: string;
}

export interface QuoteRequest {
  sellToken: string;
  buyToken: string;
  amountInRaw: bigint;
}

export interface QuoteResult {
  raw: RawHttp;
  toTokenAmountRaw: bigint;
  priceImpactPercent: string | null;
  router: string;
}

export interface Providers {
  mode: Mode;
  /** Null when no OKX DEX credentials are configured: depth then stays on rung 2. */
  okxQuote: ((q: QuoteRequest) => Promise<QuoteResult>) | null;
  pythEnabled: boolean;
  blockNumber(): Promise<bigint>;
  poolSnapshot(pool: PoolRef, blockNumber: bigint): Promise<PoolSnapshot>;
  xstocksPrice(symbol: string): Promise<{ raw: RawHttp; quote: DecString }>;
  xstocksMultiplier(symbol: string): Promise<{ raw: RawHttp; current: DecString; next: DecString; activationDateTime: string; reason: string | null }>;
  xstocksAsset(symbol: string): Promise<{ raw: RawHttp; halted: boolean }>;
  pyth(ids: string[]): Promise<PythLatest>;
  yahoo(symbol: string): Promise<{ raw: RawHttp; price: DecString; currency: string; marketTime: number }>;
  onchainMultiplier(asset: AssetConfig, blockNumber: bigint): Promise<OnchainMultiplier>;
}
