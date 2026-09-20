/**
 * KTS-0.1 section 5: executable depth. Decimal strings in and out, pure functions, no I/O.
 * Internally amounts are exact bigint token units; prices and ratios use the shared Decimal.
 */
import { Decimal, dec, toDecString, toUnitsFloor, type DecString } from "@kerb/types";
import { Q96 } from "./core.js";
import { swapExactIn, type PoolState } from "./swap.js";

/** A pool snapshot as recorded by the collector, plus the token decimals. */
export interface VenueSnapshot {
  pool: string;
  token0: string;
  token1: string;
  decimals0: number;
  decimals1: number;
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  fee: number;
  tickSpacing: number;
  ticks: { tick: number; liquidityNet: string }[];
  bitmapWords: { lower: number; upper: number };
}

/** One leg of a sale: sell `sellToken` into this pool. */
export interface Leg {
  venue: VenueSnapshot;
  sellToken: string;
  /** Symbols for the recorded path, e.g. ["COINx", "xETH"]. */
  symbols: [string, string];
}

export interface PathQuote {
  notional: DecString;
  amountIn: DecString;
  amountOut: DecString;
  midPrice: DecString;
  realisedPrice: DecString;
  impact: DecString;
  legImpacts: DecString[];
  filled: boolean;
  exhaustedReason: string;
}

const PRICE_DP = 30;
const RATIO_DP = 18;

function toState(v: VenueSnapshot): PoolState {
  return {
    sqrtPriceX96: BigInt(v.sqrtPriceX96),
    tick: v.tick,
    liquidity: BigInt(v.liquidity),
    fee: v.fee,
    tickSpacing: v.tickSpacing,
    ticks: v.ticks.map((t) => ({ tick: t.tick, liquidityNet: BigInt(t.liquidityNet) })).sort((a, b) => a.tick - b.tick),
    words: v.bitmapWords,
  };
}

function side(leg: Leg): { zeroForOne: boolean; decIn: number; decOut: number } {
  const s = leg.sellToken.toLowerCase();
  if (s === leg.venue.token0.toLowerCase()) return { zeroForOne: true, decIn: leg.venue.decimals0, decOut: leg.venue.decimals1 };
  if (s === leg.venue.token1.toLowerCase()) return { zeroForOne: false, decIn: leg.venue.decimals1, decOut: leg.venue.decimals0 };
  throw new Error(`sell token ${leg.sellToken} not in pool ${leg.venue.pool}`);
}

/** Mid price of the sell token in the other token, decimals-adjusted, before any trade. */
export function legMidPrice(leg: Leg): Decimal {
  const sp = new Decimal(leg.venue.sqrtPriceX96).div(new Decimal(Q96.toString()));
  const p01 = sp.mul(sp).mul(new Decimal(10).pow(leg.venue.decimals0 - leg.venue.decimals1));
  if (p01.isZero()) throw new Error(`pool ${leg.venue.pool} has zero price`);
  return side(leg).zeroForOne ? p01 : new Decimal(1).div(p01);
}

export function pathMidPrice(legs: Leg[]): Decimal {
  if (legs.length === 0) throw new Error("empty path");
  return legs.reduce((acc, l) => acc.mul(legMidPrice(l)), new Decimal(1));
}

interface RawPath {
  inRaw: bigint;
  outRaw: bigint;
  legImpacts: Decimal[];
  filled: boolean;
  reason: string;
}

/** Sell exactly inRaw units of the first token along the path. Leg n+1 sells leg n's output. */
function runPath(legs: Leg[], inRaw: bigint): RawPath {
  let amt = inRaw;
  const legImpacts: Decimal[] = [];
  let filled = true;
  let reason = "none";
  for (const leg of legs) {
    const { zeroForOne, decIn, decOut } = side(leg);
    const r = swapExactIn(toState(leg.venue), zeroForOne, amt);
    if (r.exhausted) {
      filled = false;
      reason = `${leg.symbols.join("->")}:${r.exhaustedReason}`;
    }
    const mid = legMidPrice(leg);
    if (r.amountIn > 0n) {
      const realised = new Decimal(r.amountOut.toString()).div(new Decimal(10).pow(decOut))
        .div(new Decimal(r.amountIn.toString()).div(new Decimal(10).pow(decIn)));
      legImpacts.push(mid.minus(realised).div(mid));
    } else {
      legImpacts.push(new Decimal(1));
    }
    amt = r.amountOut;
    if (!filled) break;
  }
  return { inRaw, outRaw: amt, legImpacts, filled, reason };
}

function decimalsIn(legs: Leg[]): number {
  return side(legs[0] as Leg).decIn;
}
function decimalsOut(legs: Leg[]): number {
  return side(legs[legs.length - 1] as Leg).decOut;
}

/**
 * Quote a sale of `notional` (in final quote units, valued at the path mid price).
 * impact = (mid - realised) / mid over the whole path, which equals
 * 1 - prod(1 - impact_leg) (KTS-0.1 section 5.2).
 */
export function quotePath(legs: Leg[], notional: DecString): PathQuote {
  const mid = pathMidPrice(legs);
  const dIn = decimalsIn(legs);
  const dOut = decimalsOut(legs);
  const inRaw = toUnitsFloor(dec(notional).div(mid), dIn);
  const r = runPath(legs, inRaw);
  const amountIn = new Decimal(inRaw.toString()).div(new Decimal(10).pow(dIn));
  // An unfilled sale has no realised price: the last leg never received the full amount, so
  // reporting its intermediate output as an outcome would be a fabricated number.
  const amountOut = r.filled ? new Decimal(r.outRaw.toString()).div(new Decimal(10).pow(dOut)) : new Decimal(0);
  const realised = !r.filled || amountIn.isZero() ? new Decimal(0) : amountOut.div(amountIn);
  const impact = r.filled ? mid.minus(realised).div(mid) : new Decimal(1);
  return {
    notional: toDecString(dec(notional)),
    amountIn: toDecString(amountIn),
    amountOut: toDecString(amountOut),
    midPrice: toDecString(mid, PRICE_DP),
    realisedPrice: toDecString(realised, PRICE_DP),
    impact: toDecString(impact, RATIO_DP),
    legImpacts: r.legImpacts.map((x) => toDecString(x, RATIO_DP)),
    filled: r.filled,
    exhaustedReason: r.reason,
  };
}

export const DEFAULT_LADDER: DecString[] = ["1000", "2500", "5000", "10000", "25000", "50000", "100000", "250000"] as DecString[];

export function impactCurve(legs: Leg[], ladder: DecString[] = DEFAULT_LADDER): PathQuote[] {
  return ladder.map((n) => quotePath(legs, n));
}

export interface Capacity {
  impact: DecString;
  /** Max notional (final quote units, at path mid) whose impact is <= impact. */
  notional: DecString;
  /**
   * True when the observed tick range ran out before impact reached the target: depth
   * beyond the observed range is unknown and not counted (KTS-0.1 section 5.3).
   */
  censored: boolean;
}

/** C(i) = max { n : impact(n) <= i }, by bisection on the exact simulation. */
export function capacityAt(legs: Leg[], impactTarget: DecString): Capacity {
  const target = dec(impactTarget);
  const mid = pathMidPrice(legs);
  const dIn = decimalsIn(legs);
  const dOut = decimalsOut(legs);
  const scaleIn = new Decimal(10).pow(dIn);
  const scaleOut = new Decimal(10).pow(dOut);

  const impactOf = (inRaw: bigint): { ok: boolean; filled: boolean } => {
    if (inRaw === 0n) return { ok: true, filled: true };
    const r = runPath(legs, inRaw);
    if (!r.filled) return { ok: false, filled: false };
    const realised = new Decimal(r.outRaw.toString()).div(scaleOut).div(new Decimal(inRaw.toString()).div(scaleIn));
    return { ok: mid.minus(realised).div(mid).lte(target), filled: true };
  };

  // Grow from one quote unit until impact exceeds the target or observed state runs out.
  let lo = 0n;
  let hi = toUnitsFloor(new Decimal(1).div(mid), dIn);
  if (hi === 0n) hi = 1n;
  let censored = false;
  for (let i = 0; i < 256; i++) {
    const r = impactOf(hi);
    if (!r.filled) { censored = true; break; }
    if (!r.ok) break;
    lo = hi;
    hi *= 2n;
  }
  // Bisection. When censored, the largest fillable amount within target bounds the answer.
  while (hi - lo > 1n && hi - lo > lo / 10_000_000n) {
    const m = (lo + hi) / 2n;
    const r = impactOf(m);
    if (r.filled && r.ok) lo = m;
    else hi = m;
  }
  if (censored) {
    // The loop ended because state ran out, unless impact itself stopped it first.
    const r = runPath(legs, hi);
    censored = !r.filled;
  }
  // Report a notional whose own quote (notional -> floor units -> simulate) satisfies the
  // budget, so impact(C) <= i holds exactly for any caller, despite wei-level rounding.
  let notional = new Decimal(lo.toString()).div(scaleIn).mul(mid).toDecimalPlaces(6, Decimal.ROUND_FLOOR);
  for (let i = 0; i < 64 && notional.gt(0); i++) {
    const inRaw = toUnitsFloor(notional.div(mid), dIn);
    if (impactOf(inRaw).ok) break;
    notional = notional.mul(new Decimal(1).minus(new Decimal(2).pow(i - 30))).toDecimalPlaces(6, Decimal.ROUND_FLOOR);
  }
  return { impact: toDecString(target), notional: toDecString(notional), censored };
}

export interface VenueDepth {
  path: string[];
  pools: string[];
  midPrice: DecString;
  curve: PathQuote[];
  C_0_5: Capacity;
  C_1: Capacity;
  C_3: Capacity;
}

export function venueDepth(legs: Leg[], ladder: DecString[] = DEFAULT_LADDER): VenueDepth {
  const path = [(legs[0] as Leg).symbols[0], ...legs.map((l) => l.symbols[1])];
  return {
    path,
    pools: legs.map((l) => l.venue.pool),
    midPrice: toDecString(pathMidPrice(legs), PRICE_DP),
    curve: impactCurve(legs, ladder),
    C_0_5: capacityAt(legs, "0.005" as DecString),
    C_1: capacityAt(legs, "0.01" as DecString),
    C_3: capacityAt(legs, "0.03" as DecString),
  };
}

/**
 * Arithmetic-mean-tick TWAP price from a pool's observe() cumulatives, as token1 per token0
 * adjusted for decimals. Pure integer tick maths plus one decimal exponentiation.
 */
export function twapPriceFromCumulatives(
  tickCumulatives: [string, string], windowSec: number, decimals0: number, decimals1: number,
): { tick: number; price: DecString } {
  if (windowSec <= 0) throw new Error("twap window must be positive");
  const delta = BigInt(tickCumulatives[1]) - BigInt(tickCumulatives[0]);
  const w = BigInt(windowSec);
  // Uniswap's OracleLibrary rounds the mean tick toward negative infinity.
  let tick = delta / w;
  if (delta < 0n && delta % w !== 0n) tick -= 1n;
  const price = new Decimal("1.0001").pow(Number(tick)).mul(new Decimal(10).pow(decimals0 - decimals1));
  return { tick: Number(tick), price: toDecString(price, 30) };
}
