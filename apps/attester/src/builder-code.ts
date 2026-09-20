/**
 * X Layer Builder Codes (ERC-8021). Every Kerb transaction carries an attribution suffix so
 * the contribution is measurable onchain. The suffix is appended to calldata and ignored by
 * the contract, so it can never change what a transaction does.
 */
import * as Attribution from "ox/erc8021/Attribution";
import type { Hex } from "viem";

export const BUILDER_CODE_REGISTRY_TESTNET = "0x00a3b805dbf39e5d54f9d09c130ff2132b4a0a21" as const;

export function builderCode(): string | null {
  const c = process.env["KERB_BUILDER_CODE"];
  return c && c.length > 0 ? c : null;
}

/** The ERC-8021 data suffix for the configured code, or undefined when none is configured. */
export function dataSuffix(code = builderCode()): Hex | undefined {
  if (!code) return undefined;
  return Attribution.toDataSuffix({ codes: [code] }) as Hex;
}

/** Decode the Builder Code(s) carried by a transaction's calldata. */
export function decodeBuilderCode(calldata: Hex): string[] {
  try {
    const parsed = Attribution.fromData(calldata);
    const codes = parsed?.codes;
    return codes ? Array.from(codes) : [];
  } catch {
    return [];
  }
}

/** True when the calldata carries the expected code. */
export function hasBuilderCode(calldata: Hex, code: string): boolean {
  return decodeBuilderCode(calldata).includes(code);
}
