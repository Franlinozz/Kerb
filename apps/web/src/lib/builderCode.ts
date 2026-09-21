"use client";

/**
 * X Layer Builder Codes (ERC-8021) for transactions the web app sends.
 *
 * AGENTS.md: the data suffix goes on every client that sends a transaction, not just the
 * attester. A borrow signed in the browser is as much a Kerb transaction as one the poster sends,
 * and the attribution has to say so. The suffix is appended to calldata and ignored by the
 * contract, so it can never change what a transaction does.
 */
import * as Attribution from "ox/erc8021/Attribution";
import type { Hex } from "viem";

export const BUILDER_CODE = process.env["NEXT_PUBLIC_KERB_BUILDER_CODE"] ?? "kt0hl6xyhlx8xmt";

let cached: Hex | undefined;

export function builderSuffix(): Hex | undefined {
  if (cached !== undefined) return cached;
  try {
    cached = Attribution.toDataSuffix({ codes: [BUILDER_CODE] }) as Hex;
  } catch {
    // A malformed code must not stop someone from borrowing; it just means no attribution.
    cached = undefined;
  }
  return cached;
}
