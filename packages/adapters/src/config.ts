import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Address } from "viem";
import type { MarketCode } from "@kerb/types";

/** Shape of config/assets.json. The only place a ticker may appear. */
export interface TokenRef {
  symbol: string;
  address: Address;
  decimals: number;
}

export interface PoolRef {
  dex: "uniswap-v3";
  address: Address;
  fee: number;
  tickSpacing: number;
  token0: Address;
  token1: Address;
  /** The token that is not the asset, i.e. what a sale of the asset receives. */
  quote: string;
  liquidityAtDiscovery: string;
  explorer: string;
}

export interface ReferenceFeed {
  source: "pyth" | "xstocks" | "yahoo";
  id: string;
  symbol: string;
  currency: string;
}

export interface AssetConfig {
  symbol: string;
  status: "resolved" | "unresolved";
  unresolvedReason?: string;
  issuer: "xstocks";
  issuerId: string;
  isin: string;
  token: TokenRef;
  wrapper: (TokenRef & { version: "v2" }) | null;
  /** Which token trades in the pools: the rebasing token or its wrapper. */
  poolToken: "token" | "wrapper";
  quoteToken: string;
  /** Primary venue, the campaign pool. */
  pool: PoolRef | null;
  /** Every pool with non-zero liquidity found for this asset, primary first. */
  venues: PoolRef[];
  underlying: {
    symbol: string;
    isin: string;
    currency: string;
    listingCountry: string;
    market: MarketCode;
    exchangeTimezone: string;
    tradingHoursMode: string;
  };
  references: ReferenceFeed[];
  explorer: { token: string; wrapper: string | null; pool: string | null };
  verifiedAt: string;
  verifiedAtBlock: string;
  sourceNote: string;
}

export interface RouteConfig {
  /** Leg-two pool converting a non-loan quote token into the loan asset. */
  from: string;
  to: string;
  pool: PoolRef;
}

export interface AssetsFile {
  version: 1;
  generatedAt: string;
  chainId: 196;
  loanAsset: string;
  discovery: {
    issuer: "xstocks";
    targets: string[];
    feeTiers: number[];
    factory: Address;
    quoteCandidates: string[];
  };
  quoteTokens: Record<string, TokenRef & { note: string }>;
  fx: ReferenceFeed[];
  routes: RouteConfig[];
  assets: AssetConfig[];
}

export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function assetsPath(): string {
  return process.env["KERB_ASSETS_FILE"] ?? resolve(repoRoot(), "config/assets.json");
}

export function loadAssets(path = assetsPath()): AssetsFile {
  const f = JSON.parse(readFileSync(path, "utf8")) as AssetsFile;
  if (f.version !== 1) throw new Error(`unsupported assets.json version ${String(f.version)}`);
  return f;
}

export function resolvedAssets(f: AssetsFile): AssetConfig[] {
  return f.assets.filter((a) => a.status === "resolved" && a.pool !== null);
}
