/**
 * Turn a KTS report into the onchain Terms struct, clamped into the contract's guardrails,
 * then sign and post it. Clamping happens here so the contract never has to reject a report
 * that the engine produced honestly: what is clamped is recorded and reported.
 */
import { Decimal, dec, toUnitsFloor, type DecString } from "@kerb/types";
import type { Address, Hex } from "viem";
import { stringToHex } from "viem";
import type { Report } from "@kerb/engine";
import type { TermsStruct } from "./sign.js";

export interface OnchainGuardrails {
  ltvMin: bigint;
  ltvMax: bigint;
  ceilingMin: bigint;
  ceilingMax: bigint;
  maxLoosenStepBps: bigint;
  loosenCooldownSec: number;
  maxReportAgeSec: number;
  LT: bigint;
  exists: boolean;
}

const REGIMES = ["DEEP", "NORMAL", "THIN", "PRE_TRANSITION", "REFERENCE_CLOSED", "ACTION", "HALTED", "STALE", "RECOVERY"];

export function regimeIndex(name: string): number {
  const i = REGIMES.indexOf(name);
  if (i < 0) throw new Error(`unknown regime ${name}`);
  return i;
}

const clampBig = (v: bigint, lo: bigint, hi: bigint): bigint => (v < lo ? lo : v > hi ? hi : v);

export interface PreparedTerms {
  terms: TermsStruct;
  clamped: { field: string; from: string; to: string }[];
}

/**
 * Prepare a report for posting. Loosening is capped to maxLoosenStepBps against the previous
 * onchain values and held entirely while the loosen cooldown is still running, so the
 * attester never sends a transaction the contract would revert. Tightening always passes.
 */
export function prepareTerms(
  report: Report,
  g: OnchainGuardrails,
  previous: TermsStruct | null,
  loanDecimals = 18,
  canLoosen = true,
): PreparedTerms {
  const clamped: { field: string; from: string; to: string }[] = [];
  const wad = (x: DecString): bigint => toUnitsFloor(x, 18);
  const loan = (x: DecString): bigint => toUnitsFloor(x, loanDecimals);

  let carry = clampBig(wad(report.capacity.carryLTV), g.ltvMin, g.ltvMax);
  let session = clampBig(wad(report.capacity.sessionMaxLTV), g.ltvMin, g.ltvMax);
  if (session < carry) session = carry;
  if (session > g.LT) session = g.LT;
  let ceiling = clampBig(loan(report.capacity.debtCeiling), g.ceilingMin, g.ceilingMax);

  const note = (field: string, from: bigint, to: bigint): void => {
    if (from !== to) clamped.push({ field, from: from.toString(), to: to.toString() });
  };
  note("carryLTV", wad(report.capacity.carryLTV), carry);
  note("sessionMaxLTV", wad(report.capacity.sessionMaxLTV), session);
  note("debtCeiling", loan(report.capacity.debtCeiling), ceiling);

  if (previous) {
    const step = (from: bigint): bigint => from + (from * g.maxLoosenStepBps) / 10_000n;
    const cap = (field: string, from: bigint, to: bigint): bigint => {
      if (to <= from) return to;
      if (!canLoosen) {
        // Inside the loosen cooldown the contract refuses any increase, so hold the old value.
        clamped.push({ field: `${field} (loosen cooldown)`, from: to.toString(), to: from.toString() });
        return from;
      }
      if (from === 0n) return to;
      const max = step(from);
      if (to <= max) return to;
      clamped.push({ field: `${field} (loosen step)`, from: to.toString(), to: max.toString() });
      return max;
    };
    carry = cap("carryLTV", previous.carryLTV, carry);
    session = cap("sessionMaxLTV", previous.sessionMaxLTV, session);
    ceiling = cap("debtCeiling", previous.debtCeiling, ceiling);
    if (session < carry) session = carry;
  }

  return {
    terms: {
      observedAt: BigInt(Math.floor(Date.parse(report.observedAt) / 1000)),
      regime: regimeIndex(report.regime),
      creditMark: wad(report.mark.creditMark),
      carryLTV: carry,
      sessionMaxLTV: session,
      debtCeiling: ceiling,
      maxPositionDebt: loan(report.capacity.maxPositionDebt),
      executableDepth1: loan(report.depth.C_1),
      inputsHash: report.inputsHash,
      engineVersion: stringToHex(report.engineVersion.slice(0, 31), { size: 32 }),
    },
    clamped,
  };
}

/** True when nothing material changed: the same regime and every value within epsilon. */
export function withinEpsilon(prev: TermsStruct | null, next: TermsStruct, epsilonBps: bigint): boolean {
  if (!prev) return false;
  if (prev.regime !== next.regime) return false;
  const close = (a: bigint, b: bigint): boolean => {
    if (a === b) return true;
    if (a === 0n) return b === 0n;
    const diff = a > b ? a - b : b - a;
    return (diff * 10_000n) / a <= epsilonBps;
  };
  return close(prev.creditMark, next.creditMark)
    && close(prev.carryLTV, next.carryLTV)
    && close(prev.sessionMaxLTV, next.sessionMaxLTV)
    && close(prev.debtCeiling, next.debtCeiling)
    && close(prev.executableDepth1, next.executableDepth1);
}

export function isLoosening(prev: TermsStruct | null, next: TermsStruct): boolean {
  if (!prev) return false;
  return next.carryLTV > prev.carryLTV || next.sessionMaxLTV > prev.sessionMaxLTV || next.debtCeiling > prev.debtCeiling;
}

export type { Address, Hex, Decimal, dec };
