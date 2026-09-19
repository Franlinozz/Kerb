/**
 * The single shared decimal module. Every value that becomes a price, amount,
 * ratio or term passes through here. Never use JavaScript floats on a value path.
 */
import DecimalJs from "decimal.js";

/** Isolated Decimal constructor so no other module can change global precision. */
export const Decimal = DecimalJs.clone({
  precision: 60,
  rounding: DecimalJs.ROUND_HALF_EVEN,
  toExpNeg: -100,
  toExpPos: 100,
});
export type Decimal = InstanceType<typeof Decimal>;

/** A decimal number serialised as a plain string, e.g. "68.42". Never exponent form. */
export type DecString = string & { readonly __dec: unique symbol };

const DEC_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

export function isDecString(s: string): s is DecString {
  return DEC_RE.test(s);
}

/** Parse a decimal string or bigint. Numbers are rejected on purpose. */
export function dec(v: DecString | string | bigint | Decimal): Decimal {
  if (typeof v === "bigint") return new Decimal(v.toString());
  if (typeof v === "string") {
    if (!isDecString(v)) throw new Error(`not a decimal string: ${JSON.stringify(v)}`);
    return new Decimal(v);
  }
  return v;
}

/** Canonical decimal string: no exponent, no trailing zeros, "-0" normalised to "0". */
export function toDecString(d: Decimal, maxDp?: number, rounding: DecimalJs.Rounding = Decimal.ROUND_HALF_EVEN): DecString {
  let x = maxDp === undefined ? d : d.toDecimalPlaces(maxDp, rounding);
  if (x.isZero()) x = new Decimal(0);
  let s = x.toFixed();
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s as DecString;
}

/** Scale a raw integer token amount by its decimals: 1500000n, 6 -> "1.5". */
export function fromUnits(raw: bigint, decimals: number): DecString {
  return toDecString(new Decimal(raw.toString()).div(new Decimal(10).pow(decimals)));
}

/** Decimal to raw integer units, rounding down (against the user when they receive). */
export function toUnitsFloor(v: DecString | string | Decimal, decimals: number): bigint {
  const x = dec(v).mul(new Decimal(10).pow(decimals)).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  return BigInt(x.toFixed());
}

/** Decimal to raw integer units, rounding up (against the user when they pay). */
export function toUnitsCeil(v: DecString | string | Decimal, decimals: number): bigint {
  const x = dec(v).mul(new Decimal(10).pow(decimals)).toDecimalPlaces(0, Decimal.ROUND_CEIL);
  return BigInt(x.toFixed());
}

export function decMin(...xs: Decimal[]): Decimal {
  if (xs.length === 0) throw new Error("decMin of nothing");
  return Decimal.min(...xs);
}

export function decMax(...xs: Decimal[]): Decimal {
  if (xs.length === 0) throw new Error("decMax of nothing");
  return Decimal.max(...xs);
}

/** Median of decimals; mean of the two middle values for even length. */
export function decMedian(xs: Decimal[]): Decimal {
  if (xs.length === 0) throw new Error("median of nothing");
  const s = [...xs].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(s.length / 2);
  const hi = s[mid] as Decimal;
  if (s.length % 2 === 1) return hi;
  const lo = s[mid - 1] as Decimal;
  return lo.plus(hi).div(2);
}
