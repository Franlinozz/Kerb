/**
 * Credit arithmetic shared by server and client: integer WAD, the way KerbCredit does it, with
 * every rounding against the borrower.
 */
import type { Hex } from "viem";

export const WAD = 10n ** 18n;
export const ZERO = "0x0000000000000000000000000000000000000000" as Hex;
export const MAX = (1n << 255n) - 1n;

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

/**
 * An amount for an input field: never rounded up, so a MAX can never ask for more than exists.
 * Exact to `places` (all decimals by default), trailing zeros trimmed, no thousands separators.
 */
export function toInput(v: bigint, decimals: number, places = decimals): string {
  if (v <= 0n) return "0";
  const s = 10n ** BigInt(decimals);
  const cut = 10n ** BigInt(decimals - Math.min(places, decimals));
  const floored = (v / cut) * cut;
  const whole = floored / s;
  const frac = (floored % s).toString().padStart(decimals, "0").slice(0, Math.min(places, decimals)).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export const pctWad = (v: bigint | null, places = 1): string => (v === null ? "No debt" : `${fmtUnits(v * 100n, 18, places)}%`);
export const hfWad = (v: bigint | null): string => (v === null ? "No debt" : v > WAD * 1000n ? "Above 1,000" : fmtUnits(v, 18, 2));
