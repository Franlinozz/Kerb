/**
 * Kerb Credit Check and Kerb Exit Check (V3-03, docs/v3/SPEC-AGENTS.md sections 3 and 4).
 * Pure functions from the posted mainnet terms, the report recomputed from the posted input
 * bundle, and the Board's clock fields. No model, no floats: every money value is a decimal
 * string, and collateral is valued exactly as KerbCredit values it (@kerb/engine valuation).
 */
import { creditCollateralValue as collateralValue, maxBorrow, type Report } from "@kerb/engine";
import { dec, fromUnits, toDecString, toUnitsFloor } from "@kerb/types";

export const LOAN_DECIMALS = 6;
export const PUBLIC_API = "https://api.usekerb.xyz";
export const DISCLAIMER = "Kerb Terms describe measured risk. Not investment advice.";

/** The latest posted terms, as GET /v1/terms/196/:asset serves them. */
export interface PostedTerms {
  chainId: number; assetId: string; symbol: string; observedAt: string; ageSec: number; usable: boolean;
  regime: { value: string | null };
  creditMark: { raw: string }; carryLTV: { raw: string }; sessionMaxLTV: { raw: string };
  debtCeiling: { raw: string }; executableDepth1: { raw: string };
  inputsHash: string; tx: string; contracts: { terms: string };
}
/** The Board row fields the covenant needs. */
export interface BoardFields {
  lt?: { value: string | null } | undefined;
  cure?: { opensAt: string; closesAt: string; open: boolean } | null | undefined;
  margins?: { carry: { horizonEndsAt: string } } | null | undefined;
}
export interface AssetRef { symbol: string; assetId: string; token: string; tokenDecimals: number }

export class InputError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

const DECIMAL = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,18})?$/;
export function decimalInput(v: unknown, field: string): string {
  if (typeof v !== "string" && typeof v !== "number") throw new InputError(`${field} is required, as a decimal string`);
  const s = String(v).trim();
  if (!DECIMAL.test(s)) throw new InputError(`${field} must be a positive decimal string, at most 15 digits before the point`);
  if (dec(s).lte(0)) throw new InputError(`${field} must be above zero`);
  return s;
}

/** A symbol ("HKEXCx", any case), a token address, or an assetId. */
export function resolveAsset(q: unknown, assets: AssetRef[]): AssetRef {
  if (typeof q !== "string" || q.trim() === "") throw new InputError("asset is required: a symbol such as HKEXCx, a token address, or an assetId");
  const s = q.trim().toLowerCase();
  const hit = assets.find((a) => a.symbol.toLowerCase() === s || a.token.toLowerCase() === s || a.assetId.toLowerCase() === s);
  if (!hit) throw new InputError(`unknown asset ${q.slice(0, 80)}; see GET /agents/terms for the ten assets`, 404);
  return hit;
}

const wadStr = (raw: string, dp = 6): string => toDecString(dec(fromUnits(BigInt(raw), 18)), dp);
/** USDG to the cent, rounded down: an answer never promises a cent more than the contract allows. */
const usdg = (units: bigint): string => dec(fromUnits(units, LOAN_DECIMALS)).toFixed(2, 1);
const pts = (d: string): string => toDecString(dec(d).mul(100), 1);

function hoursBetween(fromIso: string, toIso: string): string {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const mins = Math.round(ms / 60_000);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

/**
 * The margin sentences, from the report recomputed from the posted bundle. Marked "now": the
 * attribution module (V3-04) replaces them with post-to-post causes.
 */
export function explainNow(report: Report): string[] {
  const m = (report.capacity as unknown as { margins?: unknown }).margins as Record<string, unknown> | undefined;
  if (!m || !("carry" in m)) return [`Carry and Session Max are ${pts(report.capacity.carryLTV)}% and ${pts(report.capacity.sessionMaxLTV)}% under KTS ${report.kts}; the liquidation threshold is fixed at ${pts(report.capacity.LT)}%.`];
  const mm = m as unknown as { carry: { used: string; horizonEndsAt: string }; session: { used: string; horizonEndsAt: string } };
  return [
    `Session Max margin is ${pts(mm.session.used)} pts: the loan must reach the cure deadline, ${hoursBetween(report.observedAt, mm.session.horizonEndsAt)} away.`,
    `Carry margin is ${pts(mm.carry.used)} pts: it must survive until the next deep session, ${hoursBetween(report.observedAt, mm.carry.horizonEndsAt)} away.`,
  ];
}

function provenance(t: PostedTerms, kts: string): Record<string, string> {
  return {
    kts,
    contract: t.contracts.terms,
    tx: t.tx,
    inputsHash: t.inputsHash,
    bundle: `${PUBLIC_API}/v1/bundle/${t.inputsHash}`,
    verify: `pnpm --filter @kerb/engine kerb verify ${t.inputsHash}`,
  };
}

function crosscheckOf(report: Report): Record<string, string | null> {
  const c = report.depth.crosscheck as { source: string; status?: string; reason?: string; simulated?: string; quoted?: string; delta?: string; used?: string };
  if (c.status === "unavailable" || c.quoted === undefined) return { source: c.source, status: "unavailable", reason: c.reason ?? "no quote" };
  return { source: c.source, simulatedUSDG: dec(c.simulated ?? "0").toFixed(2, 1), quotedUSDG: dec(c.quoted).toFixed(2, 1), delta: c.delta ?? null, bound: c.used !== undefined && c.simulated !== undefined && dec(c.used).lt(dec(c.simulated)) ? "okx-quote" : "tick-walk" };
}

export function creditCheck(
  input: { asset: unknown; amount: unknown; unit?: unknown; mode?: unknown; chain?: unknown },
  ctx: { asset: AssetRef; terms: PostedTerms; report: Report; board: BoardFields; why?: string[] | null },
): Record<string, unknown> {
  const amount = decimalInput(input.amount, "amount");
  const unit = input.unit === undefined || input.unit === "" ? "token" : input.unit;
  if (unit !== "token" && unit !== "usdg") throw new InputError('unit must be "token" or "usdg"');
  const mode = input.mode === undefined || input.mode === "" ? "carry" : input.mode;
  if (mode !== "carry" && mode !== "session_max") throw new InputError('mode must be "carry" or "session_max"');
  if (input.chain !== undefined && input.chain !== "" && String(input.chain) !== "196") throw new InputError("chain must be 196: credit checks read the mainnet terms");
  const { terms: t, report: r, asset: a, board } = ctx;

  const mark = BigInt(t.creditMark.raw);
  const value = unit === "token" ? collateralValue(toUnitsFloor(amount, a.tokenDecimals), mark, a.tokenDecimals, LOAN_DECIMALS) : toUnitsFloor(amount, LOAN_DECIMALS);
  const ltvRaw = mode === "carry" ? t.carryLTV.raw : t.sessionMaxLTV.raw;
  const byLtv = maxBorrow(value, BigInt(ltvRaw));
  const positionCap = toUnitsFloor(r.capacity.maxPositionDebt, LOAN_DECIMALS);
  const cap = byLtv <= positionCap ? { v: byLtv, boundBy: "ltv" } : { v: positionCap, boundBy: "maxPositionDebt" };
  const regime = t.regime.value ?? "UNKNOWN";
  const usable = t.usable;
  const cureRequired = mode === "session_max" && BigInt(t.sessionMaxLTV.raw) > BigInt(t.carryLTV.raw);

  return {
    asset: a.symbol,
    token: a.token,
    chainId: 196,
    asOf: t.observedAt,
    ageSec: t.ageSec,
    usable,
    ...(usable ? {} : { reason: `terms are not usable in regime ${regime}: borrowing is closed until they are` }),
    regime,
    creditMark: wadStr(t.creditMark.raw, 6),
    collateralValueUSDG: usdg(value),
    mode,
    ltv: { carry: wadStr(t.carryLTV.raw), sessionMax: wadStr(t.sessionMaxLTV.raw), liquidation: board.lt?.value ?? r.capacity.LT, liquidationFixed: true },
    maxBorrowUSDG: usable ? usdg(cap.v) : "0",
    limits: { maxPositionDebtUSDG: usdg(positionCap), debtCeilingUSDG: usdg(BigInt(t.debtCeiling.raw)), boundBy: cap.boundBy },
    covenant: cureRequired
      ? { cureRequired: true, lastCallOpensAt: board.cure?.opensAt ?? r.regimeInputs.cureWindowOpensAt, cureDeadline: board.cure?.closesAt ?? r.regimeInputs.nextWeakening.at }
      : { cureRequired: false },
    carrySurvivesUntil: board.margins?.carry.horizonEndsAt ?? r.regimeInputs.nextWeakening.at,
    exit: { c1USDG: usdg(BigInt(t.executableDepth1.raw)), crosscheck: crosscheckOf(r) },
    why: ctx.why?.length ? ctx.why : explainNow(r),
    // "attribution": the V3-04 sentences for this post; "now": the margin sentences, when those are unavailable.
    whyKind: ctx.why?.length ? "attribution" : "now",
    provenance: provenance(t, r.kts),
    disclaimer: DISCLAIMER,
  };
}

interface CurvePoint { notional: string; impact: string; filled: boolean }

/** Impact at a size, linear between the two walked points around it; never extrapolated. */
export function impactAt(curve: CurvePoint[], size: string): { impact: string | null; beyond: boolean; bracket: [CurvePoint | null, CurvePoint | null] } {
  const pts = curve.filter((p) => p.filled).sort((x, y) => dec(x.notional).cmp(dec(y.notional)));
  const s = dec(size);
  const last = pts[pts.length - 1];
  if (!last || s.gt(dec(last.notional))) return { impact: null, beyond: true, bracket: [last ?? null, null] };
  let lo: CurvePoint = { notional: "0", impact: "0", filled: true };
  for (const hi of pts) {
    if (s.lte(dec(hi.notional))) {
      const span = dec(hi.notional).sub(dec(lo.notional));
      const f = span.isZero() ? dec("1") : s.sub(dec(lo.notional)).div(span);
      const imp = dec(lo.impact).add(dec(hi.impact).sub(dec(lo.impact)).mul(f));
      return { impact: toDecString(imp, 6), beyond: false, bracket: [lo.notional === "0" ? null : lo, hi] };
    }
    lo = hi;
  }
  return { impact: null, beyond: true, bracket: [lo, null] };
}

export function exitCheck(input: { asset: unknown; sizeUSDG: unknown }, ctx: { asset: AssetRef; terms: PostedTerms; report: Report }): Record<string, unknown> {
  const size = decimalInput(input.sizeUSDG, "sizeUSDG");
  const { terms: t, report: r, asset: a } = ctx;
  const venue = r.depth.venues[0];
  const at = impactAt((venue?.curve ?? []) as CurvePoint[], size);
  return {
    asset: a.symbol,
    chainId: 196,
    asOf: t.observedAt,
    sizeUSDG: size,
    impactAtSize: at.impact,
    beyondMeasuredCurve: at.beyond,
    bracket: at.bracket.map((p) => (p ? { notionalUSDG: p.notional, impact: p.impact } : null)),
    withinOnePercent: dec(size).lte(dec(r.depth.C_1)),
    c05USDG: dec(r.depth.C_0_5).toFixed(2, 1),
    c1USDG: dec(r.depth.C_1).toFixed(2, 1),
    c3USDG: dec(r.depth.C_3).toFixed(2, 1),
    route: venue ? { path: venue.path, pools: venue.pools } : null,
    crosscheck: crosscheckOf(r),
    provenance: provenance(t, r.kts),
    disclaimer: DISCLAIMER,
  };
}
