/**
 * KTS-0.1 section 7.1 inputs: the gap quantile g(a, H) and the volatility scaler v(a).
 * Pure functions over a daily bar series. Decimal throughout; no floats anywhere.
 */
import { Decimal, canonicalJson, dec, keccakText, toDecString, type DecString } from "@kerb/types";

export interface DailyBar {
  date: string;
  open: DecString;
  close: DecString;
}

export interface StressConfig {
  /** Quantile for the adverse move, default 0.99. */
  quantile: DecString;
  lookbackYears: number;
  /** Minimum bars for an asset's own history to be usable for the quantile. */
  minBarsForOwnQuantile: number;
  /** Minimum bars to consider the 5-year requirement satisfied. */
  minBarsForSufficientHistory: number;
  volWindowDays: number;
  volMin: DecString;
  volMax: DecString;
}

export const DEFAULT_STRESS: StressConfig = {
  quantile: "0.99" as DecString,
  lookbackYears: 5,
  minBarsForOwnQuantile: 60,
  minBarsForSufficientHistory: 1260,
  volWindowDays: 20,
  volMin: "0.75" as DecString,
  volMax: "2" as DecString,
};

/** keccak256 of the canonical series, so a bundle can pin the data without republishing it. */
export function seriesDigest(symbol: string, bars: DailyBar[]): `0x${string}` {
  return keccakText(canonicalJson({ symbol, bars }));
}

/**
 * ln(close) once per series, reused for every horizon: |ln(C_{i+k}/C_i)| = |L_{i+k} - L_i|.
 * Logarithms at this precision are the expensive step, so they are computed once and cached.
 */
const logCache = new WeakMap<DailyBar[], (Decimal | null)[]>();

function logCloses(bars: DailyBar[]): (Decimal | null)[] {
  let l = logCache.get(bars);
  if (!l) {
    l = bars.map((b) => {
      const c = dec(b.close);
      return c.lte(0) ? null : c.ln();
    });
    logCache.set(bars, l);
  }
  return l;
}

function logCloseReturns(bars: DailyBar[], k: number): Decimal[] {
  const l = logCloses(bars);
  const out: Decimal[] = [];
  for (let i = k; i < bars.length; i++) {
    const a = l[i - k];
    const b = l[i];
    if (!a || !b) continue;
    out.push(b.minus(a).abs());
  }
  return out;
}

/** Empirical quantile, nearest-rank on the sorted sample, so the result is always an observed value. */
export function empiricalQuantile(xs: Decimal[], q: DecString): Decimal {
  if (xs.length === 0) throw new Error("quantile of an empty sample");
  const sorted = [...xs].sort((a, b) => a.comparedTo(b));
  const rank = dec(q).mul(sorted.length).toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
  const i = Math.min(Math.max(rank, 1), sorted.length) - 1;
  return sorted[i] as Decimal;
}

export interface GapQuantile {
  /** Sessions of the underlying spanned by the horizon; the window length used on the series. */
  sessions: number;
  value: DecString;
  sampleSize: number;
  source: "own" | "universe-fallback";
  historySufficient: boolean;
}

/**
 * g(a, H): the quantile of |log move| over windows covering the same number of underlying
 * sessions as the horizon. An asset without enough history takes the most conservative
 * value observed across the covered universe at the same horizon, never a smaller one.
 */
export function gapQuantile(bars: DailyBar[], sessions: number, cfg: StressConfig, universeFallback?: DecString): GapQuantile {
  const k = Math.max(1, Math.floor(sessions));
  const historySufficient = bars.length >= cfg.minBarsForSufficientHistory;
  const usableOwn = bars.length >= cfg.minBarsForOwnQuantile && bars.length > k;
  const own = usableOwn ? empiricalQuantile(logCloseReturns(bars, k), cfg.quantile) : null;
  if (historySufficient && own) {
    return { sessions: k, value: toDecString(own, 18), sampleSize: bars.length - k, source: "own", historySufficient: true };
  }
  if (universeFallback === undefined) {
    if (!own) throw new Error(`insufficient history (${bars.length} bars) and no universe fallback supplied`);
    return { sessions: k, value: toDecString(own, 18), sampleSize: bars.length - k, source: "own", historySufficient: false };
  }
  const value = own ? Decimal.max(own, dec(universeFallback)) : dec(universeFallback);
  return {
    sessions: k, value: toDecString(value, 18), sampleSize: own ? bars.length - k : 0,
    source: own && value.eq(own) ? "own" : "universe-fallback", historySufficient: false,
  };
}

/** Most conservative gap quantile across assets that do have sufficient history. */
export function universeGapQuantile(series: { bars: DailyBar[] }[], sessions: number, cfg: StressConfig): DecString {
  const vals = series
    .filter((s) => s.bars.length >= cfg.minBarsForSufficientHistory)
    .map((s) => dec(gapQuantile(s.bars, sessions, cfg).value));
  if (vals.length === 0) throw new Error("no asset has sufficient history for a universe fallback");
  return toDecString(Decimal.max(...vals), 18);
}

/** Sample standard deviation of daily log returns over the last `window` bars. */
export function realisedVol(bars: DailyBar[], window: number, end = bars.length): Decimal {
  const l = logCloses(bars);
  const rets: Decimal[] = [];
  for (let i = Math.max(1, end - window); i < end; i++) {
    const a = l[i - 1];
    const b = l[i];
    if (!a || !b) continue;
    rets.push(b.minus(a));
  }
  if (rets.length < 2) throw new Error("not enough returns for a volatility estimate");
  const mean = rets.reduce((s, r) => s.plus(r), new Decimal(0)).div(rets.length);
  const varSum = rets.reduce((s, r) => s.plus(r.minus(mean).pow(2)), new Decimal(0));
  return varSum.div(rets.length - 1).sqrt();
}

export interface VolScaler {
  value: DecString;
  /** "own" or "universe-fallback" when the asset lacks enough history for its own estimate. */
  source: "own" | "universe-fallback";
  recentVol: DecString;
  medianVol: DecString;
  clamped: boolean;
  sampleSize: number;
}

/** v(a) = clamp(realised_vol_20d / median(rolling realised_vol_20d over the lookback), vMin, vMax). */
export function volScaler(bars: DailyBar[], cfg: StressConfig): VolScaler {
  const w = cfg.volWindowDays;
  if (bars.length < w + 2) throw new Error(`not enough bars (${bars.length}) for a ${w}-day volatility window`);
  const recent = realisedVol(bars, w);
  const rolling: Decimal[] = [];
  for (let end = w + 1; end <= bars.length; end++) rolling.push(realisedVol(bars, w, end));
  const sorted = [...rolling].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? (sorted[mid] as Decimal)
    : (sorted[mid - 1] as Decimal).plus(sorted[mid] as Decimal).div(2);
  if (median.lte(0)) throw new Error("median realised volatility is zero");
  const raw = recent.div(median);
  const lo = dec(cfg.volMin);
  const hi = dec(cfg.volMax);
  const value = Decimal.min(Decimal.max(raw, lo), hi);
  return {
    value: toDecString(value, 18), source: "own", recentVol: toDecString(recent, 18), medianVol: toDecString(median, 18),
    clamped: !value.eq(raw), sampleSize: rolling.length,
  };
}

/**
 * v(a) for an asset without enough history of its own: the most conservative (highest)
 * scaler observed across assets that do have it. Never a quieter one.
 */
export function volScalerWithFallback(bars: DailyBar[], universe: { bars: DailyBar[] }[], cfg: StressConfig): VolScaler {
  if (bars.length >= cfg.volWindowDays + 2) return volScaler(bars, cfg);
  const others = universe
    .filter((u) => u.bars.length >= Math.max(cfg.volWindowDays + 2, cfg.minBarsForSufficientHistory))
    .map((u) => volScaler(u.bars, cfg));
  if (others.length === 0) throw new Error("no asset has enough history for a volatility scaler");
  const worst = others.reduce((a, x) => (dec(x.value).gt(dec(a.value)) ? x : a));
  return { ...worst, source: "universe-fallback", sampleSize: 0 };
}
