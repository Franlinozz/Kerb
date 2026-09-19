/**
 * Independent TypeScript implementation of the integer math a Uniswap v3 swap performs,
 * as specified by the v3-core libraries FullMath, TickMath, SqrtPriceMath and SwapMath
 * (those libraries are GPL-2.0-or-later; no Solidity source is copied, and nothing from the
 * BUSL-licensed core contracts is used). The TickMath constants are the published magic
 * numbers. All values are bigint; no floats. Over a faithful pool snapshot this reproduces
 * the chain's swap output to the wei, which the tests check against QuoterV2.
 */

export const Q96 = 1n << 96n;
export const Q128 = 1n << 128n;
const MAX_UINT256 = (1n << 256n) - 1n;
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export function mulDiv(a: bigint, b: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("mulDiv: divide by zero");
  const r = (a * b) / d;
  if (r > MAX_UINT256) throw new Error("mulDiv: overflow");
  return r;
}

export function mulDivRoundingUp(a: bigint, b: bigint, d: bigint): bigint {
  const r = mulDiv(a, b, d);
  return (a * b) % d > 0n ? r + 1n : r;
}

function divRoundingUp(a: bigint, b: bigint): bigint {
  return a / b + (a % b > 0n ? 1n : 0n);
}

const TICK_CONSTS: [number, bigint][] = [
  [0x2, 0xfff97272373d413259a46990580e213an],
  [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
  [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
  [0x10, 0xffcb9843d60f6159c9db58835c926644n],
  [0x20, 0xff973b41fa98c081472e6896dfb254c0n],
  [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
  [0x80, 0xfe5dee046a99a2a811c461f1969c3053n],
  [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
  [0x200, 0xf987a7253ac413176f2b074cf7815e54n],
  [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
  [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n],
  [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
  [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n],
  [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
  [0x8000, 0x31be135f97d08fd981231505542fcfa6n],
  [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
  [0x20000, 0x5d6af8dedb81196699c329225ee604n],
  [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
  [0x80000, 0x48a170391f7dc42444e8fa2n],
];

/** TickMath.getSqrtRatioAtTick. */
export function sqrtRatioAtTick(tick: number): bigint {
  if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) throw new Error(`tick out of range: ${tick}`);
  const abs = Math.abs(tick);
  let ratio = (abs & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  for (const [bit, c] of TICK_CONSTS) if ((abs & bit) !== 0) ratio = (ratio * c) >> 128n;
  if (tick > 0) ratio = MAX_UINT256 / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/** TickMath.getTickAtSqrtRatio: greatest tick whose sqrt ratio is <= the input. Exact via search on sqrtRatioAtTick. */
export function tickAtSqrtRatio(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 < MIN_SQRT_RATIO || sqrtPriceX96 >= MAX_SQRT_RATIO) throw new Error("sqrt ratio out of range");
  let lo = MIN_TICK;
  let hi = MAX_TICK;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (sqrtRatioAtTick(mid) <= sqrtPriceX96) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function amount0Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint, roundUp: boolean): bigint {
  const [a, b] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  const n1 = liquidity << 96n;
  const n2 = b - a;
  if (a <= 0n) throw new Error("amount0Delta: zero price");
  return roundUp ? divRoundingUp(mulDivRoundingUp(n1, n2, b), a) : mulDiv(n1, n2, b) / a;
}

export function amount1Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint, roundUp: boolean): bigint {
  const [a, b] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  return roundUp ? mulDivRoundingUp(liquidity, b - a, Q96) : mulDiv(liquidity, b - a, Q96);
}

function nextSqrtFromAmount0RoundingUp(sqrtP: bigint, liquidity: bigint, amount: bigint): bigint {
  if (amount === 0n) return sqrtP;
  const numerator1 = liquidity << 96n;
  const product = amount * sqrtP;
  const denominator = numerator1 + product;
  if (denominator >= numerator1 && product / amount === sqrtP && product <= MAX_UINT256) {
    return mulDivRoundingUp(numerator1, sqrtP, denominator);
  }
  return divRoundingUp(numerator1, numerator1 / sqrtP + amount);
}

function nextSqrtFromAmount1RoundingDown(sqrtP: bigint, liquidity: bigint, amount: bigint): bigint {
  const quotient = amount <= (1n << 160n) - 1n ? (amount << 96n) / liquidity : mulDiv(amount, Q96, liquidity);
  return sqrtP + quotient;
}

export function nextSqrtPriceFromInput(sqrtP: bigint, liquidity: bigint, amountIn: bigint, zeroForOne: boolean): bigint {
  if (sqrtP <= 0n || liquidity <= 0n) throw new Error("nextSqrtPriceFromInput: bad state");
  return zeroForOne ? nextSqrtFromAmount0RoundingUp(sqrtP, liquidity, amountIn) : nextSqrtFromAmount1RoundingDown(sqrtP, liquidity, amountIn);
}

/** SwapMath.computeSwapStep for exact input (amountRemaining > 0). feePips in hundredths of a bip. */
export function computeSwapStepExactIn(sqrtCurrent: bigint, sqrtTarget: bigint, liquidity: bigint, amountRemaining: bigint, feePips: number) {
  const zeroForOne = sqrtCurrent >= sqrtTarget;
  const fee = BigInt(feePips);
  const remainingLessFee = mulDiv(amountRemaining, 1_000_000n - fee, 1_000_000n);
  let amountIn = zeroForOne ? amount0Delta(sqrtTarget, sqrtCurrent, liquidity, true) : amount1Delta(sqrtCurrent, sqrtTarget, liquidity, true);
  let sqrtNext: bigint;
  if (remainingLessFee >= amountIn) sqrtNext = sqrtTarget;
  else sqrtNext = nextSqrtPriceFromInput(sqrtCurrent, liquidity, remainingLessFee, zeroForOne);
  const max = sqrtTarget === sqrtNext;
  let amountOut: bigint;
  if (zeroForOne) {
    amountIn = max ? amountIn : amount0Delta(sqrtNext, sqrtCurrent, liquidity, true);
    amountOut = amount1Delta(sqrtNext, sqrtCurrent, liquidity, false);
  } else {
    amountIn = max ? amountIn : amount1Delta(sqrtCurrent, sqrtNext, liquidity, true);
    amountOut = amount0Delta(sqrtCurrent, sqrtNext, liquidity, false);
  }
  const feeAmount = !max ? amountRemaining - amountIn : mulDivRoundingUp(amountIn, fee, 1_000_000n - fee);
  return { sqrtNext, amountIn, amountOut, feeAmount };
}
