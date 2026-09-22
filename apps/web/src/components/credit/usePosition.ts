"use client";

/**
 * Everything the Credit page reads for one wallet and one collateral, straight from the
 * contracts, and the arithmetic the page shows before anyone signs, done the way KerbCredit
 * does it (integer WAD, rounded against the borrower).
 */
import { useAccount, useBalance, useReadContract } from "wagmi";
import type { Hex } from "viem";
import type { CreditCollateral, CreditMarket } from "@/lib/api";
import { CREDIT_ABI, ERC20_ABI } from "@/lib/creditAbi";

export const WAD = 10n ** 18n;
export const ZERO = "0x0000000000000000000000000000000000000000" as Hex;
export const MAX = (1n << 255n) - 1n;

export function usePosition(market: CreditMarket, c: CreditCollateral, fastPoll: boolean) {
  const { address, isConnected } = useAccount();
  const credit = market.contracts.KerbCredit as Hex;
  const loan = market.contracts.loanAsset as Hex;
  const token = c.token as Hex;
  const assetId = c.assetId as Hex;
  const account = (address ?? ZERO) as Hex;
  const enabled = Boolean(address);
  const every = fastPoll ? 5000 : 10_000;
  const q = { enabled, refetchInterval: every } as const;

  const position = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "position", args: [account, assetId], query: q });
  const debt = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "debtOf", args: [account, assetId], query: q });
  const ltv = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "positionLTV", args: [account, assetId], query: q });
  const hf = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "healthFactor", args: [account, assetId], query: q });
  const cure = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "cureStatus", args: [account, assetId], query: q });
  const collBal = useReadContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [account], query: { enabled } });
  const collAllow = useReadContract({ address: token, abi: ERC20_ABI, functionName: "allowance", args: [account, credit], query: { enabled } });
  const collMinted = useReadContract({ address: token, abi: ERC20_ABI, functionName: "minted", args: [account], query: { enabled } });
  const collCap = useReadContract({ address: token, abi: ERC20_ABI, functionName: "faucetCap", args: [], query: { enabled: true } });
  const loanBal = useReadContract({ address: loan, abi: ERC20_ABI, functionName: "balanceOf", args: [account], query: { enabled } });
  const loanAllow = useReadContract({ address: loan, abi: ERC20_ABI, functionName: "allowance", args: [account, credit], query: { enabled } });
  const loanMinted = useReadContract({ address: loan, abi: ERC20_ABI, functionName: "minted", args: [account], query: { enabled } });
  const loanCap = useReadContract({ address: loan, abi: ERC20_ABI, functionName: "faucetCap", args: [], query: { enabled: true } });
  const supplied = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "suppliedOf", args: [account], query: q });
  const shares = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "supplyShares", args: [account], query: q });
  const gas = useBalance({ address: address as Hex | undefined, chainId: 1952, query: { enabled, refetchInterval: 15_000, refetchOnWindowFocus: true } });

  const refresh = (): void => { for (const r of [position, debt, ltv, hf, cure, collBal, collAllow, collMinted, loanBal, loanAllow, loanMinted, supplied, shares, gas]) void r.refetch(); };

  const p = position.data as { collateralShares: bigint; debtShares: bigint; carryTarget: bigint; mode: number; lastCureAt: bigint } | undefined;
  const cs = cure.data as readonly [boolean, bigint, bigint] | undefined;
  return {
    address, isConnected, credit, loan, token, assetId,
    held: p?.collateralShares ?? 0n, carryTarget: p?.carryTarget ?? 0n, mode: p?.mode ?? 0, lastCureAt: p?.lastCureAt ?? 0n,
    owed: (debt.data as bigint | undefined) ?? 0n,
    ltv: (ltv.data as bigint | undefined) ?? null, hf: (hf.data as bigint | undefined) ?? null,
    cureEligible: cs?.[0] ?? false, cureDeadline: cs?.[1] ? Number(cs[1]) * 1000 : null, cureRequired: cs?.[2] ?? 0n,
    collBalance: (collBal.data as bigint | undefined) ?? 0n, collAllowance: (collAllow.data as bigint | undefined) ?? 0n,
    collRemaining: collCap.data !== undefined && collMinted.data !== undefined ? (collCap.data as bigint) - (collMinted.data as bigint) : null,
    loanBalance: (loanBal.data as bigint | undefined) ?? 0n, loanAllowance: (loanAllow.data as bigint | undefined) ?? 0n,
    loanRemaining: loanCap.data !== undefined && loanMinted.data !== undefined ? (loanCap.data as bigint) - (loanMinted.data as bigint) : null,
    supplied: (supplied.data as bigint | undefined) ?? 0n, shares: (shares.data as bigint | undefined) ?? 0n,
    gas: gas.data?.value ?? null, gasLoading: gas.isLoading,
    loaded: position.isSuccess,
    refresh, refetchCure: cure.refetch,
  };
}

export type PositionState = ReturnType<typeof usePosition>;

/** Collateral value in loan units, exactly as KerbCredit values a mirror: shares * mark / WAD. */
export function valueOf(shares: bigint, mark: bigint, loanDecimals: number): bigint {
  return (shares * mark) / WAD / 10n ** BigInt(18 - loanDecimals);
}

/** LTV in WAD, rounded up: against the borrower. */
export function ltvOf(debt: bigint, value: bigint): bigint | null {
  return value === 0n ? null : (debt * WAD + value - 1n) / value;
}

/** Health factor in WAD against the fixed threshold, rounded down. */
export function hfOf(debt: bigint, value: bigint, lt: bigint): bigint | null {
  return debt === 0n ? null : (value * lt) / debt;
}

/** Parse a typed amount without throwing on a half-typed number. */
export function parseAmount(v: string, decimals: number): bigint {
  const t = v.trim();
  if (!t || !/^\d*\.?\d*$/.test(t) || t === ".") return 0n;
  const [w = "0", f = ""] = t.split(".");
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export function fmtUnits(v: bigint, decimals: number, places = 2): string {
  const neg = v < 0n; const a = neg ? -v : v;
  const s = 10n ** BigInt(decimals); const whole = a / s; const frac = a % s;
  const scaled = (frac * 10n ** BigInt(places) + s / 2n) / s;
  const carry = scaled >= 10n ** BigInt(places) ? 1n : 0n;
  const f = (carry ? scaled - 10n ** BigInt(places) : scaled).toString().padStart(places, "0");
  const w = (whole + carry).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${w}${places ? `.${f}` : ""}`;
}

export const pctWad = (v: bigint | null, places = 1): string => (v === null ? "No debt" : `${fmtUnits(v * 100n, 18, places)}%`);
export const hfWad = (v: bigint | null): string => (v === null ? "No debt" : v > WAD * 1000n ? "Above 1,000" : fmtUnits(v, 18, 2));
