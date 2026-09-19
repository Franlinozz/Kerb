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
