/**
 * KTS-0.1 section 4: the regime machine. Pure. Time enters only as an input field.
 */
import { Regime, dec, regimeName, type DecString } from "@kerb/types";

export interface RegimeConfig {
  stalenessMaxSec: number;
  dispersionMax: DecString;
  actionCooldownSec: number;
  recoveryCooldownSec: number;
  /** C(1%) thresholds, in loan-asset units. */
  thinThreshold: DecString;
  deepThreshold: DecString;
  spreadMax: DecString;
  cureWindowSec: number;
}

export interface RegimeInput {
  atMs: number;
  /** Adapter and underlying halt flags. */
  halted: { adapter: boolean; underlying: boolean };
  sourceMaxAgeSec: number;
  dispersion: DecString;
  /** Corporate action window and multiplier change, from the issuer schedule and the chain. */
  action: { windowStartMs: number | null; windowEndMs: number | null; multiplierChangedAtMs: number | null };
  /** From the Clock resolver. */
  clock: {
    inMainSession: boolean;
    referenceClosed: boolean;
    nextWeakeningAtMs: number;
    lastMainOpenMs: number | null;
    lastLeftStaleOrHaltedMs?: number | null;
  };
  depth: { c1: DecString; spread: DecString | null; available: boolean };
  cfg: RegimeConfig;
}

export interface RegimeResolution {
  regime: Regime;
  name: string;
  /** The rule number in KTS-0.1 section 4.2 that decided it. */
  rule: number;
  reason: string;
}

export function resolveRegime(i: RegimeInput): RegimeResolution {
  const r = (regime: Regime, rule: number, reason: string): RegimeResolution => ({ regime, name: regimeName(regime), rule, reason });
  const c = i.cfg;

  if (i.halted.adapter || i.halted.underlying) return r(Regime.HALTED, 1, i.halted.adapter ? "adapter reports a token halt" : "underlying halted");

  if (i.sourceMaxAgeSec > c.stalenessMaxSec) return r(Regime.STALE, 2, `source age ${Math.round(i.sourceMaxAgeSec)}s exceeds ${c.stalenessMaxSec}s`);
  if (dec(i.dispersion).gt(dec(c.dispersionMax))) return r(Regime.STALE, 2, `dispersion ${i.dispersion} exceeds ${c.dispersionMax}`);

  const { windowStartMs, windowEndMs, multiplierChangedAtMs } = i.action;
  if (windowStartMs !== null && windowEndMs !== null && i.atMs >= windowStartMs && i.atMs <= windowEndMs) {
    return r(Regime.ACTION, 3, "inside a scheduled corporate action window");
  }
  if (multiplierChangedAtMs !== null && i.atMs - multiplierChangedAtMs <= c.actionCooldownSec * 1000 && i.atMs >= multiplierChangedAtMs) {
    return r(Regime.ACTION, 3, "multiplier changed within the action cooldown");
  }

  if (i.clock.nextWeakeningAtMs - i.atMs <= c.cureWindowSec * 1000 && i.clock.nextWeakeningAtMs >= i.atMs) {
    return r(Regime.PRE_TRANSITION, 4, "inside the Last Call window before the next weakening");
  }

  const reopen = i.clock.lastLeftStaleOrHaltedMs ?? i.clock.lastMainOpenMs;
  if (reopen !== null && i.atMs - reopen <= c.recoveryCooldownSec * 1000 && i.atMs >= reopen) {
    return r(Regime.RECOVERY, 5, "inside the post-reopen cooldown");
  }

  if (i.clock.referenceClosed) return r(Regime.REFERENCE_CLOSED, 6, "underlying market is not in any session");

  if (!i.depth.available) return r(Regime.THIN, 7, "executable depth unavailable");
  if (dec(i.depth.c1).lt(dec(c.thinThreshold))) return r(Regime.THIN, 7, `C(1%) ${i.depth.c1} below thin threshold ${c.thinThreshold}`);
  if (i.depth.spread !== null && dec(i.depth.spread).gt(dec(c.spreadMax))) return r(Regime.THIN, 7, `spread ${i.depth.spread} above ${c.spreadMax}`);

  if (dec(i.depth.c1).gte(dec(c.deepThreshold)) && i.clock.inMainSession) {
    return r(Regime.DEEP, 8, `C(1%) ${i.depth.c1} at or above deep threshold and underlying in its main session`);
  }
  return r(Regime.NORMAL, 9, "underlying open with adequate depth");
}

export interface AsymmetryConfig {
  recoveryCooldownSec: number;
  nConfirm: number;
  maxLoosenStep: DecString;
}

export interface PreviousReport {
  observedAtMs: number;
  regime: Regime;
  carryLTV: DecString;
  sessionMaxLTV: DecString;
  debtCeiling: DecString;
  /** Consecutive prior reports that already agreed with the proposed looser value. */
  loosenConfirmations: number;
  lastLoosenAtMs: number | null;
}

export interface AsymmetryResult<T> {
  value: T;
  applied: "tightened" | "loosened" | "held";
  reason: string;
}

/**
 * KTS-0.1 section 4.3. Tightening applies immediately. Loosening requires the cooldown, the
 * confirmations, and never moves by more than maxLoosenStep in one report.
 */
export function applyAsymmetry(
  proposed: DecString, previous: DecString | null, atMs: number, prev: PreviousReport | null, cfg: AsymmetryConfig,
): AsymmetryResult<DecString> {
  if (previous === null || prev === null) return { value: proposed, applied: "held", reason: "no previous report" };
  const p = dec(proposed);
  const q = dec(previous);
  if (p.lte(q)) return { value: proposed, applied: "tightened", reason: "tightening applies immediately" };
  const sinceLoosen = prev.lastLoosenAtMs === null ? Infinity : (atMs - prev.lastLoosenAtMs) / 1000;
  if (sinceLoosen < cfg.recoveryCooldownSec) {
    return { value: previous, applied: "held", reason: `loosening blocked: ${Math.round(sinceLoosen)}s since the last increase, cooldown ${cfg.recoveryCooldownSec}s` };
  }
  if (prev.loosenConfirmations + 1 < cfg.nConfirm) {
    return { value: previous, applied: "held", reason: `loosening blocked: ${prev.loosenConfirmations + 1} of ${cfg.nConfirm} confirmations` };
  }
  const step = dec(cfg.maxLoosenStep);
  const capped = q.plus(step);
  if (p.gt(capped)) return { value: capped.toFixed() as DecString, applied: "loosened", reason: `loosening capped at maxLoosenStep ${cfg.maxLoosenStep}` };
  return { value: proposed, applied: "loosened", reason: "loosening within step and cooldown" };
}
