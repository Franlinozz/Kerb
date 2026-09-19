import { Decimal, dec, toDecString, type DecString } from "@kerb/types";
import type { VenueDepth } from "./depth.js";

export interface Exclusion {
  path: string[];
  pools: string[];
  reason: string;
}

export interface AggregateDepth {
  venues: VenueDepth[];
  excluded: Exclusion[];
  fragmentationFactor: DecString;
  C_0_5: DecString;
  C_1: DecString;
  C_3: DecString;
  /** True if any eligible venue's capacity was censored by the observed tick range. */
  censored: boolean;
}

/**
 * KTS-0.1 section 5.3: C(i) = sum over eligible venues of C_venue(i), times the
 * fragmentation factor (default 0.8 with more than one venue, else 1.0).
 */
export function aggregate(
  venues: VenueDepth[], excluded: Exclusion[] = [], opts: { fragmentationMulti?: DecString } = {},
): AggregateDepth {
  const f = venues.length > 1 ? dec(opts.fragmentationMulti ?? ("0.8" as DecString)) : new Decimal(1);
  const sum = (k: "C_0_5" | "C_1" | "C_3"): DecString =>
    toDecString(venues.reduce((a, v) => a.plus(dec(v[k].notional)), new Decimal(0)).mul(f), 6, Decimal.ROUND_FLOOR);
  return {
    venues, excluded, fragmentationFactor: toDecString(f),
    C_0_5: sum("C_0_5"), C_1: sum("C_1"), C_3: sum("C_3"),
    censored: venues.some((v) => v.C_0_5.censored || v.C_1.censored || v.C_3.censored),
  };
}

export interface Crosscheck {
  source: string;
  simulated: DecString;
  quoted: DecString;
  delta: DecString;
  flag: boolean;
  /** min(simulated, quoted) when flagged, else simulated. Never the maximum. */
  used: DecString;
}

/** KTS-0.1 section 5.4. delta = |sim - quote| / quote. */
export function crosscheck(simulated: DecString, quoted: DecString, max: DecString, source: string): Crosscheck {
  const s = dec(simulated);
  const q = dec(quoted);
  if (q.lte(0)) {
    return { source, simulated, quoted, delta: "1" as DecString, flag: true, used: toDecString(Decimal.min(s, q.lt(0) ? new Decimal(0) : q)) };
  }
  const delta = s.minus(q).abs().div(q);
  const flag = delta.gt(dec(max));
  return { source, simulated, quoted, delta: toDecString(delta, 18), flag, used: toDecString(flag ? Decimal.min(s, q) : s) };
}

/**
 * Capacity implied by an observed quote curve (e.g. OKX DEX sell quotes at the ladder):
 * largest notional whose impact is <= i, linearly interpolated between observed points
 * and never extrapolated past the last observed notional. Deterministic, labelled Computed.
 */
export function capacityFromCurve(points: { notional: DecString; impact: DecString }[], impactTarget: DecString): DecString {
  const i = dec(impactTarget);
  const pts = [...points].map((p) => ({ n: dec(p.notional), m: dec(p.impact) })).sort((a, b) => a.n.comparedTo(b.n));
  let prev = { n: new Decimal(0), m: new Decimal(0) };
  for (const p of pts) {
    if (p.m.gt(i)) {
      if (p.m.eq(prev.m)) return toDecString(prev.n, 6, Decimal.ROUND_FLOOR);
      const t = i.minus(prev.m).div(p.m.minus(prev.m));
      return toDecString(Decimal.max(prev.n, prev.n.plus(p.n.minus(prev.n).mul(t))), 6, Decimal.ROUND_FLOOR);
    }
    prev = p;
  }
  return toDecString(prev.n, 6, Decimal.ROUND_FLOOR);
}
