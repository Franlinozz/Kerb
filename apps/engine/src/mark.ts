/**
 * KTS-0.1 section 6: the Credit Mark. Pure. Every component carries a provenance label.
 *
 * Prices are expressed per unit of the asset token (e.g. one KOx), never per wrapper share.
 * The wrapper exchange rate is used only to convert a wrapper-quoted pool price into an
 * asset price, and to value collateral as convertToAssets(shares) * CreditMark. It is never
 * used as a price on its own.
 */
import { Decimal, Regime, dec, decMedian, toDecString, type DecString, type ProvenanceLabel } from "@kerb/types";

export interface ReferenceObservation {
  source: string;
  /** Price of one underlying share in `currency`. */
  value: DecString;
  currency: string;
  observedAt: string;
  ageSec: number;
  contentHash: string;
}

export interface FxObservation {
  source: string;
  /** Units of `currency` per 1 USD, e.g. 7.8 HKD per USD. */
  perUsd: DecString;
  currency: string;
  ageSec: number;
  contentHash: string;
}

export interface PoolPriceObservation {
  pool: string;
  /** Price of one wrapper share in the quote token, from the pool. */
  spot: DecString;
  twap: { windowSec: number; price: DecString } | null;
  quoteToken: string;
  ageSec: number;
  contentHash: string;
}

export interface WrapperState {
  address: string;
  version: "v2";
  /** convertToAssets(1e18) / 1e18: asset tokens per wrapper share. */
  assetsPerShare: DecString;
  contentHash: string;
}

export interface MarkConfig {
  stalenessMaxSec: number;
  dispersionMax: DecString;
  /** h_regime per regime name. */
  regimeHaircut: Record<string, DecString>;
  hDispersion: DecString;
  bandRegime: DecString;
  twapWindowSec: number;
}

export interface MarkComponent {
  value: DecString;
  label: ProvenanceLabel;
  sources: string[];
}

export interface Mark {
  /** Price per asset token (not per wrapper share), in the loan asset unit. */
  reference: MarkComponent & { usedSources: string[]; excluded: { source: string; reason: string }[] };
  pool: MarkComponent & { basis: "twap" | "spot"; twapWindowSec: number | null };
  creditMark: DecString;
  band: [DecString, DecString];
  haircut: DecString;
  dispersion: DecString;
  dispersionBreach: boolean;
  /** Assumption recorded on every report: the loan asset is treated as one dollar. */
  quoteAssumption: string;
}

export class WrapperNotSupported extends Error {}

/** Legacy v1 xStocks wrappers are never integrated (docs/ARCHITECTURE.md 3.3, KTS-0.1 6). */
export function assertSupportedWrapper(w: { version: string; address: string }): asserts w is WrapperState {
  if (w.version !== "v2") throw new WrapperNotSupported(`wrapper ${w.address} is version ${w.version}; only v2 is supported`);
}

/** Collateral valuation: convertToAssets(shares) * CreditMark. */
export function collateralValue(shares: DecString, wrapper: { version: string; address: string; assetsPerShare: DecString }, creditMark: DecString): DecString {
  assertSupportedWrapper(wrapper);
  return toDecString(dec(shares).mul(dec(wrapper.assetsPerShare)).mul(dec(creditMark)), 18);
}

export interface MarkInput {
  references: ReferenceObservation[];
  fx: FxObservation[];
  pool: PoolPriceObservation;
  wrapper: WrapperState | null;
  regime: Regime;
  regimeName: string;
  cfg: MarkConfig;
}

/** Convert a reference into USD using a fresh FX observation when the currency is not USD. */
function toUsd(r: ReferenceObservation, fx: FxObservation[], maxAgeSec: number): { value: Decimal; sources: string[] } | { error: string } {
  if (r.currency === "USD") return { value: dec(r.value), sources: [r.source] };
  const f = fx.find((x) => x.currency === r.currency && x.ageSec <= maxAgeSec);
  if (!f) return { error: `no fresh FX for ${r.currency}` };
  if (dec(f.perUsd).lte(0)) return { error: `bad FX rate for ${r.currency}` };
  return { value: dec(r.value).div(dec(f.perUsd)), sources: [r.source, f.source] };
}

export function computeMark(input: MarkInput): Mark {
  const { references, fx, pool, wrapper, regimeName, cfg } = input;
  const used: Decimal[] = [];
  const usedSources: string[] = [];
  const excluded: { source: string; reason: string }[] = [];

  for (const r of references) {
    if (r.ageSec > cfg.stalenessMaxSec) { excluded.push({ source: r.source, reason: `stale by ${Math.round(r.ageSec - cfg.stalenessMaxSec)}s` }); continue; }
    if (dec(r.value).lte(0)) { excluded.push({ source: r.source, reason: "non-positive price" }); continue; }
    const c = toUsd(r, fx, cfg.stalenessMaxSec);
    if ("error" in c) { excluded.push({ source: r.source, reason: c.error }); continue; }
    used.push(c.value);
    usedSources.push(...c.sources);
  }
  if (used.length === 0) throw new Error("no fresh reference price: mark cannot be computed");

  const pRef = decMedian(used);

  // Pool price is quoted per wrapper share; divide by assetsPerShare to price the asset token.
  const basis: "twap" | "spot" = pool.twap ? "twap" : "spot";
  const poolRaw = dec(pool.twap ? pool.twap.price : pool.spot);
  if (poolRaw.lte(0)) throw new Error("non-positive pool price");
  const perShare = wrapper ? dec(wrapper.assetsPerShare) : new Decimal(1);
  if (perShare.lte(0)) throw new Error("non-positive wrapper exchange rate");
  const pPool = poolRaw.div(perShare);

  const dispersion = pRef.minus(pPool).abs().div(pRef);
  const dispersionBreach = dispersion.gt(dec(cfg.dispersionMax));

  const hRegime = dec(cfg.regimeHaircut[regimeName] ?? cfg.regimeHaircut["DEFAULT"] ?? ("0" as DecString));
  const haircut = hRegime.plus(dec(cfg.hDispersion).mul(dispersion));
  const pBase = Decimal.min(pRef, pPool);
  const creditMark = pBase.mul(new Decimal(1).minus(haircut));
  const bandLow = creditMark.mul(new Decimal(1).minus(dec(cfg.bandRegime)));

  return {
    reference: { value: toDecString(pRef, 18), label: "Observed", sources: [...new Set(usedSources)], usedSources: [...new Set(usedSources)], excluded },
    pool: {
      value: toDecString(pPool, 18), label: "Observed", sources: [pool.pool], basis,
      twapWindowSec: pool.twap ? pool.twap.windowSec : null,
    },
    creditMark: toDecString(creditMark, 18),
    band: [toDecString(bandLow, 18), toDecString(pBase, 18)],
    haircut: toDecString(haircut, 18),
    dispersion: toDecString(dispersion, 18),
    dispersionBreach,
    quoteAssumption: `${pool.quoteToken} is treated as 1 USD; the ${pool.quoteToken} peg is observed separately and reported`,
  };
}
