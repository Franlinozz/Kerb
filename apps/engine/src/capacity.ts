/**
 * KTS-0.1 section 7: capacity. Pure. Every output is a decimal string, and every clamp is recorded.
 */
import { Decimal, dec, toDecString, type DecString } from "@kerb/types";

export interface Guardrails {
  ltvMin: DecString;
  ltvMax: DecString;
  ceilingMin: DecString;
  ceilingMax: DecString;
  /** Fixed liquidation threshold, set at listing and changed only by timelocked governance. */
  LT: DecString;
}

export interface CapacityConfig {
  /** debtCeiling = k * C(1%). */
  k: DecString;
  buffer: DecString;
  liquidationBonus: DecString;
  carryMargin: DecString;
  sessionMargin: DecString;
  positionCapAbs: DecString;
  positionCapShare: DecString;
  /** Notional used to measure the impact term s in stressLTV. */
  referenceLiquidationSize: DecString;
}

export interface StressInput {
  /** g(a, H) at the horizon in question. */
  gapQuantile: DecString;
  /** v(a). */
  volScaler: DecString;
  /** s: impact at the reference liquidation size. */
  impactAtReferenceSize: DecString;
}

export interface Clamp {
  field: string;
  from: DecString;
  to: DecString;
  reason: string;
}

/** stressLTV = 1 - ( v(a) * g(a, H) + s + liquidation_bonus + buffer ), floored at zero. */
export function stressLTV(s: StressInput, cfg: CapacityConfig): DecString {
  const raw = new Decimal(1).minus(
    dec(s.volScaler).mul(dec(s.gapQuantile)).plus(dec(s.impactAtReferenceSize)).plus(dec(cfg.liquidationBonus)).plus(dec(cfg.buffer)),
  );
  return toDecString(Decimal.max(raw, new Decimal(0)), 18);
}

export interface CapacityInput {
  stressWeak: StressInput;
  stressCure: StressInput;
  c1: DecString;
  cfg: CapacityConfig;
  guardrails: Guardrails;
}

export interface Capacity {
  LT: DecString;
  carryLTV: DecString;
  sessionMaxLTV: DecString;
  stressLTVWeak: DecString;
  stressLTVCure: DecString;
  debtCeiling: DecString;
  maxPositionDebt: DecString;
  coverageRatioAtCeiling: DecString;
  clamped: Clamp[];
}

function clampTo(field: string, v: Decimal, lo: Decimal, hi: Decimal, out: Clamp[], reason: string): Decimal {
  const c = Decimal.min(Decimal.max(v, lo), hi);
  if (!c.eq(v)) out.push({ field, from: toDecString(v, 18), to: toDecString(c, 18), reason });
  return c;
}

export function computeCapacity(i: CapacityInput): Capacity {
  const { cfg, guardrails: g } = i;
  const clamped: Clamp[] = [];
  const LT = dec(g.LT);

  const sWeak = dec(stressLTV(i.stressWeak, cfg));
  const sCure = dec(stressLTV(i.stressCure, cfg));

  let carry = Decimal.min(sWeak, LT.minus(dec(cfg.carryMargin)));
  let session = Decimal.min(sCure, LT.minus(dec(cfg.sessionMargin)));

  carry = clampTo("carryLTV", carry, dec(g.ltvMin), dec(g.ltvMax), clamped, "guardrail bounds");
  session = clampTo("sessionMaxLTV", session, dec(g.ltvMin), dec(g.ltvMax), clamped, "guardrail bounds");

  // By construction carryLTV <= sessionMaxLTV <= LT (KTS-0.1 7.4).
  if (session.lt(carry)) {
    clamped.push({ field: "sessionMaxLTV", from: toDecString(session, 18), to: toDecString(carry, 18), reason: "sessionMaxLTV may not be below carryLTV" });
    session = carry;
  }
  if (session.gt(LT)) {
    clamped.push({ field: "sessionMaxLTV", from: toDecString(session, 18), to: toDecString(LT, 18), reason: "sessionMaxLTV may not exceed LT" });
    session = LT;
  }

  const rawCeiling = dec(cfg.k).mul(dec(i.c1));
  const ceiling = clampTo("debtCeiling", rawCeiling, dec(g.ceilingMin), dec(g.ceilingMax), clamped, "guardrail bounds");
  const maxPosition = Decimal.min(dec(cfg.positionCapAbs), dec(cfg.positionCapShare).mul(dec(i.c1)));
  const coverage = ceiling.lte(0) ? new Decimal(0) : dec(i.c1).div(ceiling);

  return {
    LT: toDecString(LT, 18),
    carryLTV: toDecString(carry, 18),
    sessionMaxLTV: toDecString(session, 18),
    stressLTVWeak: toDecString(sWeak, 18),
    stressLTVCure: toDecString(sCure, 18),
    debtCeiling: toDecString(ceiling, 6),
    maxPositionDebt: toDecString(maxPosition, 6),
    coverageRatioAtCeiling: toDecString(coverage, 6),
    clamped,
  };
}
