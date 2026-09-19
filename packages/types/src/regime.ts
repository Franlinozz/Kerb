/**
 * KTS-0.1 section 4.1. Numeric order matches the Solidity enum in ARCHITECTURE.md 3.1
 * so the TS resolver and KerbClock agree on the wire.
 */
export enum Regime {
  DEEP = 0,
  NORMAL = 1,
  THIN = 2,
  PRE_TRANSITION = 3,
  REFERENCE_CLOSED = 4,
  ACTION = 5,
  HALTED = 6,
  STALE = 7,
  RECOVERY = 8,
}

export type RegimeName = keyof typeof Regime;

export const REGIME_NAMES: readonly RegimeName[] = [
  "DEEP",
  "NORMAL",
  "THIN",
  "PRE_TRANSITION",
  "REFERENCE_CLOSED",
  "ACTION",
  "HALTED",
  "STALE",
  "RECOVERY",
] as const;

export function regimeName(r: Regime): RegimeName {
  const n = REGIME_NAMES[r];
  if (n === undefined) throw new Error(`unknown regime ${r}`);
  return n;
}
