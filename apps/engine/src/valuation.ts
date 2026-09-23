/**
 * Collateral valuation exactly as KerbCredit does it onchain (V3-03, SPEC-AGENTS.md section 3),
 * so an offchain answer (Kerb Credit Check, KerbQuote parity) never differs from the contract by
 * a wei. Pure, integer arithmetic only; rounding matches the contract, always against the user.
 *
 *   value  = rescale(floor(underlying * mark / 1e18), tokenDecimals -> loanDecimals, down)
 *   maxBorrow(ltv) = floor(value * ltv / 1e18)           (borrow reverts when ceil(debt*1e18/value) > ltv)
 *   positionLTV    = ceil(debt * 1e18 / value)
 * Not in the posting path.
 */
export const WAD = 10n ** 18n;

function rescaleDown(x: bigint, from: number, to: number): bigint {
  if (from === to) return x;
  if (from < to) return x * 10n ** BigInt(to - from);
  return x / 10n ** BigInt(from - to);
}

/** Collateral value in loan units. `underlying` is in token units (a mirror has no wrapper: shares = amount). */
export function creditCollateralValue(underlying: bigint, markWad: bigint, tokenDecimals: number, loanDecimals: number): bigint {
  if (underlying === 0n || markWad === 0n) return 0n;
  return rescaleDown((underlying * markWad) / WAD, tokenDecimals, loanDecimals);
}

/** The largest debt a mode's LTV allows against a value, in loan units. */
export function maxBorrow(valueUnits: bigint, ltvWad: bigint): bigint {
  return (valueUnits * ltvWad) / WAD;
}

/** The position's LTV as KerbCredit.positionLTV reports it, rounded up. */
export function positionLtv(debtUnits: bigint, valueUnits: bigint): bigint {
  if (debtUnits === 0n) return 0n;
  if (valueUnits === 0n) return (1n << 256n) - 1n;
  return (debtUnits * WAD + valueUnits - 1n) / valueUnits;
}
