/**
 * KTS-0.1 section 9: the report. computeReport is a PURE function of the input bundle:
 * no clock reads, no network, no randomness. Time enters as bundle.observedAtMs.
 */
import { Decimal, Regime, dec, toDecString, type DecString } from "@kerb/types";
import { resolveClock, timeline } from "@kerb/calendar";
import type { MarketCode } from "@kerb/types";
import { aggregate, capacityFromCurve, crosscheck, twapPriceFromCumulatives, venueDepth, type Crosscheck, type Exclusion, type Leg, type VenueDepth, type VenueSnapshot } from "@kerb/v3math";
import { identifyBundle, type InputBundle } from "./bundle.js";
import { computeMark, type Mark, type MarkConfig, type MarkInput } from "./mark.js";
import { applyAsymmetry, resolveRegime, type AsymmetryConfig, type RegimeConfig } from "./regime.js";
import { computeCapacity, computeCapacityV02, gapForHours, type Capacity, type CapacityConfig, type Guardrails } from "./capacity.js";

export interface EngineConfig {
  mark: MarkConfig;
  regime: RegimeConfig;
  capacity: CapacityConfig;
  asymmetry: AsymmetryConfig;
  depth: { ladder: DecString[]; fragmentationFactorMulti: DecString; stalenessMaxSec: number; crosscheckMax: DecString; minVenueC1: DecString };
  guardrails: Guardrails;
}

export interface Report {
  kts: "0.1" | "0.2";
  engineVersion: string;
  paramsVersion: string;
  chainId: number;
  asset: string;
  assetSymbol: string;
  underlying: { symbol: string; market: string; multiplier: DecString };
  observedAt: string;
  regime: string;
  regimeInputs: {
    calendarSession: string;
    calendarVersion: string;
    nextTransition: { type: string; at: string };
    nextWeakening: { type: string; at: string };
    nextReferenceClosed: { type: string; at: string };
    cureWindowOpensAt: string;
    cureWindowOpen: boolean;
    sourceMaxAgeSec: number;
    dispersion: DecString;
    rule: number;
    reason: string;
    asymmetry: { carryLTV: string; sessionMaxLTV: string; debtCeiling: string };
  };
  mark: Mark;
  depth: {
    venues: VenueDepth[];
    excluded: Exclusion[];
    fragmentationFactor: DecString;
    C_0_5: DecString;
    C_1: DecString;
    C_3: DecString;
    /** C(1%) from the tick-walk alone, before the cross-check picks the conservative value. */
    C_1_simulated: DecString;
    /** Impact implied by each aggregator quote, at the same mid the simulation used. */
    quoteCurve: { notional: DecString; impact: DecString }[];
    censored: boolean;
    crosscheck: Crosscheck | { source: string; status: "unavailable"; reason: string; rung: number };
  };
  capacity: Capacity;
  stress: {
    horizonHoursWeak: DecString;
    horizonHoursCure: DecString;
    sessionsWeak: number;
    sessionsCure: number;
    quantile: DecString;
    gapQuantileWeak: DecString;
    gapQuantileCure: DecString;
    volScaler: DecString;
    impactAtReferenceSize: DecString;
    liquidationBonus: DecString;
    buffer: DecString;
    historySufficient: boolean;
    seriesDigest: string;
  };
  inputsHash: `0x${string}`;
  inputsCidV1Raw: string;
  provenance: { label: string; note: string };
}

const HOUR = 3_600_000;


function toVenueSnapshot(v: InputBundle["venues"][number]): VenueSnapshot {
  const s = v.snapshot;
  return {
    pool: s.pool, token0: s.token0, token1: s.token1, decimals0: v.decimals0, decimals1: v.decimals1, sqrtPriceX96: s.sqrtPriceX96,
    tick: s.tick, liquidity: s.liquidity, fee: s.fee, tickSpacing: s.tickSpacing,
    ticks: s.ticks.map((t) => ({ tick: t.tick, liquidityNet: t.liquidityNet })), bitmapWords: s.bitmapWords,
  };
}

/** Number of underlying sessions the horizon spans, used to pick the comparable gap window. */
export function sessionsInHorizon(market: MarketCode, fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 1;
  const days = new Set<string>();
  for (const seg of timeline(market, fromMs, toMs)) {
    if (seg.kind !== "REGULAR") continue;
    for (const d of seg.dates) days.add(d);
  }
  return Math.max(1, days.size);
}

function pickQuantile(b: InputBundle, sessions: number): { value: DecString; source: string; sampleSize: number } {
  const table = b.stress.gapQuantileBySessions;
  const exact = table[String(sessions)];
  if (exact) return { value: exact.value, source: exact.source, sampleSize: exact.sampleSize };
  const keys = Object.keys(table).map(Number).sort((x, y) => x - y);
  const above = keys.find((k) => k >= sessions) ?? keys[keys.length - 1];
  const chosen = table[String(above)];
  if (!chosen) throw new Error(`bundle has no gap quantile for ${sessions} sessions`);
  return { value: chosen.value, source: `${chosen.source}:nearest(${above})`, sampleSize: chosen.sampleSize };
}

export function computeReport(b: InputBundle, cfg: EngineConfig): Report {
  const at = b.observedAtMs;
  const market = b.market.code as MarketCode;
  const clock = resolveClock({ market, atMs: at, cureWindowSec: b.market.cureWindowSec });

  // ---- depth (KTS-0.1 section 5)
  const venues: VenueDepth[] = [];
  const excluded: Exclusion[] = [];
  const grouped = new Map<string, InputBundle["venues"]>();
  for (const v of b.venues) grouped.set(v.pathId, [...(grouped.get(v.pathId) ?? []), v]);
  for (const [, legsRaw] of grouped) {
    const ordered = [...legsRaw].sort((x, y) => x.legIndex - y.legIndex);
    const path = [ordered[0]?.path[0] as string, ...ordered.map((v) => v.path[1] as string)];
    const stale = ordered.find((v) => (at - v.observedAtMs) / 1000 > cfg.depth.stalenessMaxSec);
    if (stale) {
      excluded.push({ path, pools: ordered.map((v) => v.pool), reason: `stale: observed ${Math.round((at - stale.observedAtMs) / 1000)}s before report` });
      continue;
    }
    const legs: Leg[] = ordered.map((v) => ({
      venue: toVenueSnapshot(v), sellToken: v.sellToken, symbols: [v.path[0] as string, v.path[1] as string],
    }));
    try {
      const vd = venueDepth(legs, cfg.depth.ladder);
      if (dec(vd.C_1.notional).lt(dec(cfg.depth.minVenueC1))) {
        excluded.push({ path, pools: ordered.map((v) => v.pool), reason: `dust: C(1%) ${vd.C_1.notional} below minVenueC1 ${cfg.depth.minVenueC1}` });
        continue;
      }
      venues.push(vd);
    } catch (e) {
      excluded.push({ path, pools: ordered.map((v) => v.pool), reason: `simulation failed: ${(e as Error).message}` });
    }
  }
  const agg = aggregate(venues, excluded, { fragmentationMulti: cfg.depth.fragmentationFactorMulti });

  // KTS-0.1 5.4: cross-check against aggregator quotes when they exist; never take the maximum.
  let cc: Report["depth"]["crosscheck"];
  let quoteCurve: { notional: DecString; impact: DecString }[] = [];
  if (b.quotes.length > 0 && venues.length > 0) {
    // Impact implied by each quote, measured against the same mid the simulation used.
    const mid = dec((venues[0] as VenueDepth).midPrice);
    quoteCurve = b.quotes.map((q) => {
      const realised = dec(q.quoteOut).div(dec(q.amountIn));
      const impact = mid.minus(realised).div(mid);
      return { notional: q.notional, impact: toDecString(Decimal.max(impact, new Decimal(0)), 18) };
    });
    cc = crosscheck(agg.C_1, capacityFromCurve(quoteCurve, "0.01" as DecString), cfg.depth.crosscheckMax, b.quotes[0]?.source ?? "okx-dex");
  } else {
    cc = { source: "okx-dex", status: "unavailable", reason: b.quotes.length === 0 ? "no aggregator quotes in the bundle" : "no eligible venue to compare against", rung: 2 };
  }
  const c1Used: DecString = "used" in cc ? cc.used : agg.C_1;

  // ---- mark (KTS-0.1 section 6)
  // The pool price must be denominated in the loan asset, so a multi-leg path is priced
  // along its whole path (wCOINx -> xETH -> USDG), never at its first leg alone.
  const primaryPoolAddr = (b.venues.find((v) => v.legIndex === 0)?.pool ?? "").toLowerCase();
  const primaryDepth = venues.find((v) => (v.pools[0] ?? "").toLowerCase() === primaryPoolAddr)
    ?? [...venues].sort((x, y) => dec(y.C_1.notional).comparedTo(dec(x.C_1.notional)))[0];
  if (!primaryDepth) throw new Error("no eligible venue: the mark has no pool price");
  const primaryFirstLeg = b.venues.find((v) => v.pool.toLowerCase() === (primaryDepth.pools[0] ?? "").toLowerCase());
  if (!primaryFirstLeg) throw new Error("bundle is missing the primary venue leg");
  const singleLeg = primaryDepth.pools.length === 1;

  // TWAP is only meaningful for a single-leg path; a multi-leg path uses the path mid.
  let twap: { windowSec: number; price: DecString } | null = null;
  const tw = primaryFirstLeg.snapshot.twap;
  if (singleLeg && tw && "tickCumulatives" in tw) {
    const snap = toVenueSnapshot(primaryFirstLeg);
    const sellIsToken0 = snap.token0.toLowerCase() === primaryFirstLeg.sellToken.toLowerCase();
    const t = twapPriceFromCumulatives(tw.tickCumulatives, tw.windowSec, primaryFirstLeg.decimals0, primaryFirstLeg.decimals1);
    twap = { windowSec: tw.windowSec, price: sellIsToken0 ? t.price : toDecString(new Decimal(1).div(dec(t.price)), 30) };
  }

  const markInput: MarkInput = {
    references: b.references.map((r) => ({ source: r.source, value: r.value, currency: r.currency, observedAt: new Date(r.observedAtMs).toISOString(), ageSec: (at - r.observedAtMs) / 1000, contentHash: r.contentHash })),
    fx: b.fx.map((f) => ({ source: f.source, perUsd: f.perUsd, currency: f.currency, ageSec: (at - f.observedAtMs) / 1000, contentHash: f.contentHash })),
    pool: {
      pool: primaryDepth.pools.join(" -> "), spot: primaryDepth.midPrice, twap, quoteToken: singleLeg ? (primaryFirstLeg.quote) : (primaryDepth.path[primaryDepth.path.length - 1] as string),
      ageSec: (at - primaryFirstLeg.observedAtMs) / 1000, contentHash: primaryFirstLeg.contentHash,
    },
    wrapper: b.asset.wrapper ? { address: b.asset.wrapper.address, version: "v2", assetsPerShare: b.asset.wrapper.assetsPerShare, contentHash: primaryFirstLeg.contentHash } : null,
    regime: Regime.NORMAL,
    regimeName: "DISPERSION_PASS",
    cfg: { ...cfg.mark, regimeHaircut: { ...cfg.mark.regimeHaircut, DISPERSION_PASS: "0" as DecString } },
  };
  const preliminaryMark = computeMark(markInput);

  // ---- regime (KTS-0.1 section 4)
  // Age of the inputs the mark actually used. A source that is down or returns no quote is
  // excluded by the mark and recorded there; it must not by itself force the asset STALE
  // while another independent reference is fresh. If nothing is fresh the mark throws first.
  const usedSources = new Set(preliminaryMark.reference.usedSources);
  const sourceMaxAgeSec = Math.max(
    ...b.references.filter((r) => usedSources.has(r.source)).map((r) => (at - r.observedAtMs) / 1000),
    ...b.fx.filter((f) => usedSources.has(f.source)).map((f) => (at - f.observedAtMs) / 1000),
    ...b.venues.map((v) => (at - v.observedAtMs) / 1000),
  );
  const res = resolveRegime({
    atMs: at,
    halted: b.asset.halted,
    sourceMaxAgeSec,
    dispersion: preliminaryMark.dispersion,
    action: {
      windowStartMs: b.asset.multiplier.pending ? b.asset.multiplier.pending.activatesAtMs - cfg.regime.actionCooldownSec * 1000 : null,
      windowEndMs: b.asset.multiplier.pending ? b.asset.multiplier.pending.activatesAtMs + cfg.regime.actionCooldownSec * 1000 : null,
      multiplierChangedAtMs: null,
    },
    clock: {
      inMainSession: clock.inMainSession,
      referenceClosed: clock.referenceClosed,
      nextWeakeningAtMs: Date.parse(clock.nextWeakening.at),
      lastMainOpenMs: clock.lastMainOpen ? Date.parse(clock.lastMainOpen) : null,
    },
    depth: { c1: c1Used, spread: null, available: venues.length > 0 },
    cfg: { ...cfg.regime, cureWindowSec: b.market.cureWindowSec },
  });

  const mark = computeMark({ ...markInput, regime: res.regime, regimeName: res.name, cfg: cfg.mark });

  // ---- stress horizons (KTS-0.1 section 7.1)
  const weakEndMs = Date.parse(clock.nextMainOpen.at);
  const cureOpensMs = Date.parse(clock.cureWindow.opensAt);
  const sessionsWeak = sessionsInHorizon(market, at, weakEndMs);
  const sessionsCure = sessionsInHorizon(market, at, Math.max(cureOpensMs, at + 1));
  const qWeak = pickQuantile(b, sessionsWeak);
  const qCure = pickQuantile(b, sessionsCure);
  const impactAtRef = impactAt(venues, cfg.capacity.referenceLiquidationSize);

  const stressWeak = { gapQuantile: qWeak.value, volScaler: b.stress.volScaler.value, impactAtReferenceSize: impactAtRef };
  const stressCure = { gapQuantile: qCure.value, volScaler: b.stress.volScaler.value, impactAtReferenceSize: impactAtRef };
  const hoursWeak = toDecString(dec(String(Math.round(((weakEndMs - at) / HOUR) * 10000))).div(10000), 4);
  const hoursCure = toDecString(dec(String(Math.max(0, Math.round(((cureOpensMs - at) / HOUR) * 10000)))).div(10000), 4);

  // The formula version is read from the bundle, never from the running code's defaults, so
  // a 0.1 bundle recomputes under 0.1 for as long as it exists.
  let capacityRaw: Capacity;
  if (b.kts === "0.2") {
    const c = cfg.capacity;
    if (c.stressMultiplier === undefined || c.minCarryMargin === undefined || c.minSessionMargin === undefined) {
      throw new Error("a KTS-0.2 bundle needs capacity.stressMultiplier, minCarryMargin and minSessionMargin");
    }
    capacityRaw = computeCapacityV02({
      gaps: b.stress.gapQuantileBySessions,
      volScaler: b.stress.volScaler.value,
      impactAtReferenceSize: impactAtRef,
      weak: { hours: hoursWeak, endsAt: clock.nextMainOpen.at },
      cure: { hours: hoursCure, endsAt: new Date(Math.max(cureOpensMs, at)).toISOString() },
      c1: c1Used,
      cfg: { ...c, stressMultiplier: c.stressMultiplier, minCarryMargin: c.minCarryMargin, minSessionMargin: c.minSessionMargin },
      guardrails: cfg.guardrails,
      stressWeak,
      stressCure,
    });
  } else {
    capacityRaw = computeCapacity({ stressWeak, stressCure, c1: c1Used, cfg: cfg.capacity, guardrails: cfg.guardrails });
  }

  // ---- tighten fast, loosen slow (KTS-0.1 section 4.3)
  const prev = b.previous;
  const prevState = prev ? { ...prev, regime: prev.regime as Regime } : null;
  const aCarry = applyAsymmetry(capacityRaw.carryLTV, prev?.carryLTV ?? null, at, prevState, cfg.asymmetry);
  const aSession = applyAsymmetry(capacityRaw.sessionMaxLTV, prev?.sessionMaxLTV ?? null, at, prevState, cfg.asymmetry);
  const aCeiling = applyAsymmetry(capacityRaw.debtCeiling, prev?.debtCeiling ?? null, at, prevState, cfg.asymmetry);
  const capacity: Capacity = { ...capacityRaw, carryLTV: aCarry.value, sessionMaxLTV: aSession.value, debtCeiling: aCeiling.value };

  const id = identifyBundle(b);
  return {
    kts: b.kts,
    engineVersion: b.engineVersion,
    paramsVersion: b.paramsVersion,
    chainId: b.asset.chainId,
    asset: b.asset.token,
    assetSymbol: b.asset.symbol,
    underlying: { symbol: b.asset.underlying.symbol, market: b.asset.underlying.market, multiplier: b.asset.multiplier.onchain },
    observedAt: new Date(at).toISOString(),
    regime: res.name,
    regimeInputs: {
      calendarSession: clock.session.kind,
      calendarVersion: clock.calendarVersion,
      nextTransition: { type: clock.nextTransition.type, at: clock.nextTransition.at },
      nextWeakening: { type: clock.nextWeakening.type, at: clock.nextWeakening.at },
      nextReferenceClosed: { type: clock.nextReferenceClosed.type, at: clock.nextReferenceClosed.at },
      cureWindowOpensAt: clock.cureWindow.opensAt,
      cureWindowOpen: clock.cureWindow.open,
      sourceMaxAgeSec: Math.round(sourceMaxAgeSec),
      dispersion: mark.dispersion,
      rule: res.rule,
      reason: res.reason,
      asymmetry: { carryLTV: aCarry.applied, sessionMaxLTV: aSession.applied, debtCeiling: aCeiling.applied },
    },
    mark,
    depth: {
      venues, excluded, fragmentationFactor: agg.fragmentationFactor, C_0_5: agg.C_0_5, C_1: c1Used, C_3: agg.C_3,
      C_1_simulated: agg.C_1, quoteCurve, censored: agg.censored, crosscheck: cc,
    },
    capacity,
    stress: {
      horizonHoursWeak: hoursWeak,
      horizonHoursCure: hoursCure,
      sessionsWeak,
      sessionsCure,
      quantile: b.config["stressQuantile"] as DecString,
      // Under 0.2 the gap that set the margin is the hours-based one, reported in capacity.margins.
      gapQuantileWeak: b.kts === "0.2" ? gapForHours(b.stress.gapQuantileBySessions, hoursWeak) : qWeak.value,
      gapQuantileCure: b.kts === "0.2" ? gapForHours(b.stress.gapQuantileBySessions, hoursCure) : qCure.value,
      volScaler: b.stress.volScaler.value,
      impactAtReferenceSize: impactAtRef,
      liquidationBonus: cfg.capacity.liquidationBonus,
      buffer: cfg.capacity.buffer,
      historySufficient: b.stress.historySufficient,
      seriesDigest: b.stress.seriesDigest,
    },
    inputsHash: id.inputsHash,
    inputsCidV1Raw: id.cidV1Raw,
    provenance: { label: "Computed", note: "Produced by KTS-0.1 from the pinned input bundle; recompute with `kerb verify`" },
  };
}

/** Impact at the reference liquidation size, taken from the best (lowest impact) eligible venue. */
function impactAt(venues: VenueDepth[], notional: DecString): DecString {
  const impacts = venues
    .map((v) => v.curve.find((q) => q.notional === toDecString(dec(notional))))
    .filter((q): q is NonNullable<typeof q> => q !== undefined && q.filled)
    .map((q) => dec(q.impact));
  if (impacts.length === 0) return "1" as DecString;
  return toDecString(impacts.reduce((a, x) => (x.lt(a) ? x : a)), 18);
}

