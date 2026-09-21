/**
 * KTS section 7: capacity. 0.1 (computeCapacity) and 0.2 (computeCapacityV02, horizon-bound margins). Pure. Every output is a decimal string, and every clamp is recorded.
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
  /** KTS-0.2 only: k over the empirical gap quantile. Ignored by 0.1. */
  stressMultiplier?: DecString;
  /** KTS-0.2 only: floor on the Carry margin below LT. */
  minCarryMargin?: DecString;
  /** KTS-0.2 only: floor on the Session Max margin below LT. */
  minSessionMargin?: DecString;
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

// ---------------------------------------------------------------------------------------------
// KTS-0.2: horizon-bound margins (docs/v2/KTS-0.2.md). Amends section 7.4 only. The 0.1 path
// above is kept unchanged so every 0.1 bundle recomputes under 0.1 forever.
// ---------------------------------------------------------------------------------------------

/** The bundle's gap table: g(a, k) for k underlying sessions, from daily closes. */
export type GapTable = Record<string, { value: DecString }>;

export interface MarginTerm {
  /** g(a, H): the 99th percentile |log move| over the horizon, from gapForHours. */
  gap: DecString;
  volScaler: DecString;
  /** s: impact at the reference liquidation size in the current regime. */
  exitCost: DecString;
  /** k * v * g + s. */
  raw: DecString;
  floor: DecString;
  /** max(floor, raw): the margin kept below the fixed liquidation line. */
  used: DecString;
  horizonHours: DecString;
  horizonEndsAt: string;
}

export interface Margins {
  kts: "0.2";
  stressMultiplier: DecString;
  /** How a horizon in hours becomes a gap quantile. Stated so a verifier need not guess. */
  gapMethod: string;
  carry: MarginTerm;
  session: MarginTerm;
}

export interface CapacityV02 extends Capacity {
  margins: Margins;
}

export const GAP_METHOD =
  "hours/24 = d; d <= 1: g(1 session) * sqrt(d); d > 1: variance-interpolated between g(floor d) and g(ceil d) sessions, nearest larger bucket when a session count is not in the table";

function gapAtSessions(table: GapTable, k: number): Decimal {
  const exact = table[String(k)];
  if (exact) return dec(exact.value);
  const keys = Object.keys(table).map(Number).sort((x, y) => x - y);
  const above = keys.find((x) => x >= k) ?? keys[keys.length - 1];
  const chosen = above === undefined ? undefined : table[String(above)];
  if (!chosen) throw new Error(`gap table has no quantile for ${k} sessions`);
  return dec(chosen.value);
}

/**
 * g(a, H) for a horizon in hours. The bundle pins 99th percentile gaps over whole numbers of
 * sessions (close to close). A horizon is converted to days of calendar time: under one day the
 * one-session gap is scaled by the square root of the fraction (the usual square-root-of-time
 * rule); beyond one day the variance is interpolated linearly between the neighbouring whole
 * session counts. Calendar days stand in for sessions, which is conservative across a closure:
 * a weekend is priced as the days it spans, not as the single close-to-close step it is on a
 * daily bar chart.
 */
export function gapForHours(table: GapTable, hours: DecString): DecString {
  const d = Decimal.max(dec(hours), new Decimal(0)).div(24);
  if (d.lte(1)) return toDecString(gapAtSessions(table, 1).mul(d.sqrt()), 18);
  const lo = d.floor();
  const hi = d.ceil();
  const gLo = gapAtSessions(table, lo.toNumber());
  if (lo.eq(hi)) return toDecString(gLo, 18);
  const gHi = gapAtSessions(table, hi.toNumber());
  const w = d.minus(lo);
  const variance = gLo.pow(2).plus(w.mul(gHi.pow(2).minus(gLo.pow(2))));
  return toDecString(variance.sqrt(), 18);
}

export interface CapacityV02Input {
  gaps: GapTable;
  volScaler: DecString;
  impactAtReferenceSize: DecString;
  weak: { hours: DecString; endsAt: string };
  cure: { hours: DecString; endsAt: string };
  c1: DecString;
  cfg: CapacityConfig & { stressMultiplier: DecString; minCarryMargin: DecString; minSessionMargin: DecString };
  guardrails: Guardrails;
  /** 0.1 stress statistics, still reported so the shape of a report does not change. */
  stressWeak: StressInput;
  stressCure: StressInput;
}

function marginTerm(i: CapacityV02Input, h: { hours: DecString; endsAt: string }, floor: DecString): MarginTerm {
  const gap = gapForHours(i.gaps, h.hours);
  const raw = dec(i.cfg.stressMultiplier).mul(dec(i.volScaler)).mul(dec(gap)).plus(dec(i.impactAtReferenceSize));
  const used = Decimal.max(dec(floor), raw);
  return {
    gap,
    volScaler: i.volScaler,
    exitCost: i.impactAtReferenceSize,
    raw: toDecString(raw, 18),
    floor,
    used: toDecString(used, 18),
    horizonHours: h.hours,
    horizonEndsAt: h.endsAt,
  };
}

/**
 * KTS-0.2 section 2:
 *   carryMargin   = max(minCarryMargin,   k * v * g(H_weak) + s)
 *   sessionMargin = max(minSessionMargin, k * v * g(H_cure) + s)
 *   carryLTV      = clamp(LT - carryMargin,   ltvMin, ltvMax)
 *   sessionMaxLTV = clamp(LT - sessionMargin, ltvMin, ltvMax), then >= carryLTV, then <= LT
 */
export function computeCapacityV02(i: CapacityV02Input): CapacityV02 {
  const { cfg, guardrails: g } = i;
  const clamped: Clamp[] = [];
  const LT = dec(g.LT);

  const carryM = marginTerm(i, i.weak, cfg.minCarryMargin);
  const sessionM = marginTerm(i, i.cure, cfg.minSessionMargin);

  const carry = clampTo("carryLTV", LT.minus(dec(carryM.used)), dec(g.ltvMin), dec(g.ltvMax), clamped, "guardrail bounds");
  let session = clampTo("sessionMaxLTV", LT.minus(dec(sessionM.used)), dec(g.ltvMin), dec(g.ltvMax), clamped, "guardrail bounds");
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
    stressLTVWeak: stressLTV(i.stressWeak, cfg),
    stressLTVCure: stressLTV(i.stressCure, cfg),
    debtCeiling: toDecString(ceiling, 6),
    maxPositionDebt: toDecString(maxPosition, 6),
    coverageRatioAtCeiling: toDecString(coverage, 6),
    clamped,
    margins: { kts: "0.2", stressMultiplier: cfg.stressMultiplier, gapMethod: GAP_METHOD, carry: carryM, session: sessionM },
  };
}
