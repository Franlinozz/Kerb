import type { Address } from "viem";
import type { DecString, MarketCode, Provenance } from "@kerb/types";
import type { AssetConfig } from "./config.js";

/**
 * KTS-0.1 section 3, input 1: the asset profile. Everything an engine needs to know about
 * an instrument, from its issuer and from the chain, with provenance on each source.
 */
export interface AssetProfile {
  adapter: string;
  chainId: number;
  symbol: string;
  name: string;
  token: Address;
  decimals: number;
  wrapper: {
    address: Address;
    type: "xstocks-wrapper";
    version: "v2";
    symbol: string;
    decimals: number;
    /** wrapper.convertToAssets(1e18) / 1e18. Never used as a price on its own (KTS-0.1 section 6). */
    assetsPerShare: DecString;
  } | null;
  underlying: {
    symbol: string;
    isin: string;
    currency: string;
    listingCountry: string;
    market: MarketCode;
    exchangeTimezone: string;
  };
  corporateActionMethod: "multiplier";
  multiplier: {
    onchain: DecString;
    issuer: DecString;
    pending: { value: DecString; activatesAt: string; reason: string | null } | null;
  };
  /** KTS-0.1 section 4.2 rule 1 inputs. tokenPaused null when the token exposes no paused(). */
  halted: { issuer: boolean; tokenPaused: boolean | null };
  issuerSession: { mode: string; currentPeriod: string; openNow: boolean; nextChangeAt: string | null };
  observedAt: string;
  observedAtBlock: string;
  sources: Provenance[];
}

/** An issuer-specific adapter. xStocks is the first; the interface never assumes a ticker. */
export interface AssetAdapter {
  readonly id: string;
  supports(asset: AssetConfig): boolean;
  profile(asset: AssetConfig): Promise<AssetProfile>;
}
