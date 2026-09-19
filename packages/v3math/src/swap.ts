import {
  MAX_SQRT_RATIO, MAX_TICK, MIN_SQRT_RATIO, MIN_TICK, computeSwapStepExactIn, sqrtRatioAtTick, tickAtSqrtRatio,
} from "./core.js";

/** Pool state for simulation, integers already parsed. */
export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  /** Fee in hundredths of a bip (500 = 0.05%). */
  fee: number;
  tickSpacing: number;
  /** Initialised ticks and their liquidityNet, ascending by tick. */
  ticks: { tick: number; liquidityNet: bigint }[];
  /** Bitmap words fully observed. Stepping into any other word is refused, never guessed. */
  words: { lower: number; upper: number };
}

export interface SwapResult {
  amountIn: bigint;
  amountOut: bigint;
  feePaid: bigint;
  /** True when the requested input was not fully consumed because observed state ran out. */
  exhausted: boolean;
  exhaustedReason: "none" | "observed_range_end" | "price_limit";
  sqrtPriceX96After: bigint;
  tickAfter: number;
  ticksCrossed: number;
}

const floorDiv = (a: number, b: number): number => Math.floor(a / b);

/** First index in the ascending compressed list with value >= x. */
function lowerBound(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if ((xs[m] as number) < x) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * TickBitmap.nextInitializedTickWithinOneWord emulated over the observed tick list.
 * Returns the word it had to inspect so the caller can refuse unobserved words.
 */
export function nextInitializedTickWithinOneWord(
  compressedTicks: number[], tick: number, spacing: number, lte: boolean,
): { next: number; initialized: boolean; word: number } {
  let compressed = floorDiv(tick, spacing);
  if (lte) {
    const word = compressed >> 8;
    const wordStart = word * 256;
    const i = lowerBound(compressedTicks, compressed + 1) - 1;
    const c = i >= 0 ? (compressedTicks[i] as number) : undefined;
    if (c !== undefined && c >= wordStart) return { next: c * spacing, initialized: true, word };
    return { next: wordStart * spacing, initialized: false, word };
  }
  compressed += 1;
  const word = compressed >> 8;
  const wordEnd = word * 256 + 255;
  const i = lowerBound(compressedTicks, compressed);
  const c = compressedTicks[i];
  if (c !== undefined && c <= wordEnd) return { next: c * spacing, initialized: true, word };
  return { next: wordEnd * spacing, initialized: false, word };
}

/**
 * Exact-input swap walking ticks from slot0, as UniswapV3Pool.swap does, with no price limit
 * beyond the protocol bounds. Stops (exhausted) at the edge of the observed bitmap words.
 */
export function swapExactIn(pool: PoolState, zeroForOne: boolean, amountIn: bigint): SwapResult {
  if (amountIn < 0n) throw new Error("amountIn must be >= 0");
  const compressed = pool.ticks.map((t) => floorDiv(t.tick, pool.tickSpacing));
  const netByTick = new Map(pool.ticks.map((t) => [t.tick, t.liquidityNet]));
  const limit = zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n;

  let remaining = amountIn;
  let out = 0n;
  let fees = 0n;
  let sqrtP = pool.sqrtPriceX96;
  let tick = pool.tick;
  let L = pool.liquidity;
  let crossed = 0;
  let reason: SwapResult["exhaustedReason"] = "none";

  while (remaining > 0n && sqrtP !== limit) {
    const step = nextInitializedTickWithinOneWord(compressed, tick, pool.tickSpacing, zeroForOne);
    if (step.word < pool.words.lower || step.word > pool.words.upper) {
      reason = "observed_range_end";
      break;
    }
    const next = Math.min(Math.max(step.next, MIN_TICK), MAX_TICK);
    const sqrtNextTick = sqrtRatioAtTick(next);
    const target = zeroForOne ? (sqrtNextTick < limit ? limit : sqrtNextTick) : sqrtNextTick > limit ? limit : sqrtNextTick;
    const s = computeSwapStepExactIn(sqrtP, target, L, remaining, pool.fee);
    remaining -= s.amountIn + s.feeAmount;
    out += s.amountOut;
    fees += s.feeAmount;
    const start = sqrtP;
    sqrtP = s.sqrtNext;
    if (sqrtP === sqrtNextTick) {
      if (step.initialized) {
        let net = netByTick.get(next) ?? 0n;
        if (zeroForOne) net = -net;
        L += net;
        if (L < 0n) throw new Error(`negative liquidity crossing tick ${next}: snapshot inconsistent`);
        crossed++;
      }
      tick = zeroForOne ? next - 1 : next;
    } else if (sqrtP !== start) {
      tick = tickAtSqrtRatio(sqrtP);
    }
  }
  if (remaining > 0n && reason === "none") reason = "price_limit";
  return {
    amountIn: amountIn - remaining, amountOut: out, feePaid: fees, exhausted: remaining > 0n, exhaustedReason: reason,
    sqrtPriceX96After: sqrtP, tickAfter: tick, ticksCrossed: crossed,
  };
}
