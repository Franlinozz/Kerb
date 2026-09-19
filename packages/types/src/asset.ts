import { encodeAbiParameters, getAddress, keccak256, type Address, type Hex } from "viem";

/** Underlying market codes (ISO 10383 MICs). ARCX is NYSE Arca, used by SLV. */
export const MARKET_CODES = ["XNYS", "XNAS", "ARCX", "XHKG", "XCOM"] as const;
export type MarketCode = (typeof MARKET_CODES)[number];

export function isMarketCode(s: string): s is MarketCode {
  return (MARKET_CODES as readonly string[]).includes(s);
}

/**
 * assetId = keccak256(abi.encode(uint256 chainId, address token)).
 * Solidity equivalent: keccak256(abi.encode(block.chainid, token)).
 */
export function assetId(chainId: number, token: Address): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chainId), getAddress(token)]),
  );
}

/** "196:0xabc..." human-readable key used in KTS-0.1 section 2. */
export function assetKey(chainId: number, token: Address): string {
  return `${chainId}:${getAddress(token)}`;
}
