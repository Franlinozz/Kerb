/**
 * Term attribution (V3-04, docs/v3/SPEC-TERM-ATTRIBUTION.md): why a posted term changed between
 * two consecutive posts, and why the current terms are what they are, computed from the posts
 * and the reports recomputed from their input bundles. Pure, no I/O, not in the posting path.
 * Never a guess: when a side cannot be decomposed the change says why, and any residual the
 * causes do not explain is shown, never hidden.
 *
 * KTS-0.2, per mode:  used = max(floor, raw),  raw = k * v * g + s,  target = LT - used,
 * engine = clamp(target, ltvMin, ltvMax),  posted = engine after the attester's loosening cap.
 * So posted_N - posted_P splits exactly into
 *   HORIZON      -k * v_P * (g_N - g_P)        the gap over a longer or shorter horizon
 *   VOLATILITY   -k * (v_N - v_P) * g_N
 *   EXIT_COST    -(s_N - s_P)
 *   (or FLOOR_ENTER / FLOOR_EXIT when a side sits on its floor)
 *   GUARDRAIL    change in (engine - target)
 *   LOOSEN_CAP / ATTESTER_CLAMP   change in (posted - engine)
 * The debt ceiling splits the same way with DEPTH = k_ceiling * (C1_N - C1_P).
 */
import { Decimal, dec, toDecString, type DecString } from "@kerb/types";
import type { Report } from "./report.js";

export type CauseKind =
  | "HORIZON" | "VOLATILITY" | "EXIT_COST" | "FLOOR_ENTER" | "FLOOR_EXIT" | "GUARDRAIL" | "LOOSEN_CAP"
  | "ATTESTER_CLAMP" | "DEPTH" | "REGIME" | "USABLE" | "KTS_VERSION" | "UNAVAILABLE";

export interface Cause { kind: CauseKind; /** Signed: LTV points (x100) or USDG for the ceiling. */ contribution: DecString; sentence: string }

export type Field = "carryLTV" | "sessionMaxLTV" | "debtCeiling" | "regime";

export interface Change {
  field: Field;
  from: string;
  to: string;
  /** Signed move in points (LTV) or USDG (ceiling); null for the regime. */
  delta: DecString | null;
  headline: string;
  causes: Cause[];
  /** What the causes do not explain, when above 0.05 points (or 1% of the ceiling move). */
  residual: DecString | null;
}

/** One posted term and what is known about how it was made. */
export interface PostSide {
  at: string;
  tx: string;
  inputsHash: string;
  kts: string;
  posted: { carryLTV: DecString; sessionMaxLTV: DecString; debtCeiling: DecString; regime: string };
  /** The report recomputed from this post's bundle; null when the bundle is not retrievable. */
  report: Report | null;
  /** The attester's record of what it clamped for this post (terms_posts.clamped). */
  attesterClamps: { field: string; from: string; to: string }[] | null;
  /** From the bundle config: debtCeiling = k * C(1%). */
  ceilingK: DecString | null;
  referenceSize: DecString | null;
}

const CARRY_MIN = dec("0.0005"); // 0.05 points
const RESIDUAL_MIN = dec("0.0005");
const pts = (x: Decimal): string => x.mul(100).toFixed(2);
const pctS = (x: Decimal | string): string => `${dec(x as DecString).mul(100).toFixed(2)}%`;
const usd = (x: Decimal | string): string => `$${dec(x as DecString).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const hoursWords = (h: DecString): string => {
  const m = Math.round(dec(h).mul(60).toNumber());
  if (m >= 48 * 60) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
};
const utc = (iso: string): string => { const d = new Date(iso); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.toISOString().slice(11, 16)} UTC`; };
const signed = (x: Decimal): DecString => toDecString(x, 6);
const upDown = (x: Decimal): string => (x.gte(0) ? "up" : "down");

type Margin = { gap: DecString; volScaler: DecString; exitCost: DecString; raw: DecString; floor: DecString; used: DecString; horizonHours: DecString; horizonEndsAt: string };
function marginsOf(r: Report | null): { k: DecString; carry: Margin; session: Margin } | null {
  const m = r ? (r.capacity as unknown as { margins?: { stressMultiplier: DecString; carry: Margin; session: Margin } }).margins : undefined;
  return m ? { k: m.stressMultiplier, carry: m.carry, session: m.session } : null;
}

/** The attester's adjustment for a field on one side, classified by its own record. */
function attesterKind(side: PostSide, field: string): "LOOSEN_CAP" | "ATTESTER_CLAMP" | "GUARDRAIL" | null {
  const c = side.attesterClamps?.find((x) => x.field.startsWith(field));
  if (!c) return null;
  if (c.field.includes("loosen")) return "LOOSEN_CAP";
  return c.field === field ? "GUARDRAIL" : "ATTESTER_CLAMP";
}

function rank(total: Decimal, causes: Cause[], unit: "pts" | "usd"): { causes: Cause[]; headline: string } {
  const sorted = [...causes].sort((a, b) => dec(b.contribution).abs().comparedTo(dec(a.contribution).abs()));
  const sumAbs = sorted.reduce((s, c) => s.plus(dec(c.contribution).abs()), new Decimal(0));
  const shown = sumAbs.isZero() ? sorted : sorted.filter((c) => dec(c.contribution).abs().div(sumAbs).gte(0.2));
  const [a, b] = shown;
  if (!a) return { causes: sorted, headline: "No single cause: the inputs moved only slightly." };
  const close = b && dec(b.contribution).abs().gte(dec(a.contribution).abs().mul(0.7));
  void total; void unit;
  return { causes: sorted, headline: close && b ? `Two causes: ${lower(a.sentence)} And ${lower(b.sentence)}` : a.sentence };
}
const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

function ltvChange(field: "carryLTV" | "sessionMaxLTV", P: PostSide, N: PostSide): Change | null {
  const from = dec(P.posted[field]), to = dec(N.posted[field]);
  const delta = to.minus(from);
  if (delta.abs().lt(CARRY_MIN)) return null;
  const label = field === "carryLTV" ? "Carry" : "Session Max";
  const base = { field, from: P.posted[field], to: N.posted[field], delta: signed(delta.mul(100)) } as const;
  if (P.kts !== N.kts) {
    const s = `Formula changed from KTS ${P.kts} to KTS ${N.kts}.`;
    return { ...base, headline: s, causes: [{ kind: "KTS_VERSION", contribution: signed(delta.mul(100)), sentence: s }], residual: null };
  }
  const mP = marginsOf(P.report), mN = marginsOf(N.report);
  if (!mP || !mN || !P.report || !N.report) {
    const why = !P.report || !N.report ? "an input bundle is not retrievable" : "KTS 0.1 margins are fixed and have no horizon decomposition";
    return { ...base, headline: `${label} ${upDown(delta)} ${pctS(from)} to ${pctS(to)}: cause unavailable (${why}).`, causes: [{ kind: "UNAVAILABLE", contribution: signed(delta.mul(100)), sentence: `Cause unavailable: ${why}.` }], residual: null };
  }
  const key = field === "carryLTV" ? "carry" : "session";
  const p = mP[key], n = mN[key];
  const k = dec(mN.k);
  const causes: Cause[] = [];
  const pRaw = dec(p.raw).gte(dec(p.floor)), nRaw = dec(n.raw).gte(dec(n.floor));
  const horizonText = field === "carryLTV" ? "until the next deep session" : "to the cure deadline";
  if (pRaw && nRaw) {
    const horizon = k.mul(dec(p.volScaler)).mul(dec(n.gap).minus(dec(p.gap))).neg();
    const vol = k.mul(dec(n.volScaler).minus(dec(p.volScaler))).mul(dec(n.gap)).neg();
    const exit = dec(n.exitCost).minus(dec(p.exitCost)).neg();
    if (!horizon.isZero()) causes.push({ kind: "HORIZON", contribution: signed(horizon.mul(100)), sentence: `${label} ${upDown(horizon)} ${pts(horizon.abs())} pts from the horizon: the loan must now survive ${hoursWords(n.horizonHours)} ${horizonText} (${utc(n.horizonEndsAt)}) instead of ${hoursWords(p.horizonHours)}; the stressed gap over that horizon is ${pctS(n.gap)} (was ${pctS(p.gap)}).` });
    if (!exit.isZero()) causes.push({ kind: "EXIT_COST", contribution: signed(exit.mul(100)), sentence: `Exit cost at ${N.referenceSize ? usd(N.referenceSize) : "the reference size"} ${dec(n.exitCost).gt(dec(p.exitCost)) ? "rose" : "fell"} from ${pctS(p.exitCost)} to ${pctS(n.exitCost)} as pool depth moved (${pts(exit)} pts).` });
    if (!vol.isZero()) causes.push({ kind: "VOLATILITY", contribution: signed(vol.mul(100)), sentence: `Recent volatility scaler moved from ${dec(p.volScaler).toFixed(3)} to ${dec(n.volScaler).toFixed(3)} (${pts(vol)} pts).` });
  } else if (pRaw !== nRaw || !dec(p.used).eq(dec(n.used))) {
    const c = dec(n.used).minus(dec(p.used)).neg();
    causes.push(nRaw
      ? { kind: "FLOOR_EXIT", contribution: signed(c.mul(100)), sentence: `Margin left its ${pts(dec(p.floor))}-point floor: raw margin is now ${pts(dec(n.raw))} points over ${hoursWords(n.horizonHours)} ${horizonText}.` }
      : { kind: "FLOOR_ENTER", contribution: signed(c.mul(100)), sentence: `Margin reached its ${pts(dec(n.floor))}-point floor: the horizon ${horizonText} is ${hoursWords(n.horizonHours)}.` });
  }
  const LT = (r: Report): Decimal => dec(r.capacity.LT);
  const guard = (r: Report, m: Margin): Decimal => dec(r.capacity[field]).minus(LT(r).minus(dec(m.used)));
  const g = guard(N.report, n).minus(guard(P.report, p));
  if (g.abs().gte(RESIDUAL_MIN)) causes.push({ kind: "GUARDRAIL", contribution: signed(g.mul(100)), sentence: `The engine clamps ${label} to its guardrail bounds (${pts(g)} pts).` });
  const adj = (s: PostSide): Decimal => dec(s.posted[field]).minus(dec((s.report as Report).capacity[field]));
  const a = adj(N).minus(adj(P));
  if (a.abs().gte(RESIDUAL_MIN)) {
    const kind = attesterKind(N, field) ?? attesterKind(P, field) ?? "ATTESTER_CLAMP";
    const engineN = dec(N.report.capacity[field]);
    causes.push(kind === "LOOSEN_CAP"
      ? { kind, contribution: signed(a.mul(100)), sentence: a.lt(0) ? `Would be ${pctS(engineN)}, but terms loosen at most one step at a time after a cooldown; the posted value waits (${pts(a)} pts).` : `A loosening held back earlier is released (${pts(a)} pts).` }
      : { kind: "ATTESTER_CLAMP", contribution: signed(a.mul(100)), sentence: `Posted ${pctS(N.posted[field])}, tighter than the engine's ${pctS(engineN)}: the attester may clamp tighter, never looser.` });
  }
  const explained = causes.reduce((s, c) => s.plus(dec(c.contribution)), new Decimal(0)).div(100);
  const residual = delta.minus(explained);
  const r = rank(delta, causes, "pts");
  const head = `${label} ${upDown(delta)} ${pctS(from)} to ${pctS(to)} (${pts(delta)} pts). ${r.headline}`;
  return { ...base, headline: head, causes: r.causes, residual: residual.abs().gte(RESIDUAL_MIN) ? signed(residual.mul(100)) : null };
}

function ceilingChange(P: PostSide, N: PostSide): Change | null {
  const from = dec(P.posted.debtCeiling), to = dec(N.posted.debtCeiling);
  const delta = to.minus(from);
  const rel = from.isZero() ? (to.isZero() ? new Decimal(0) : new Decimal(1)) : delta.abs().div(from);
  if (rel.lt(0.01)) return null;
  const base = { field: "debtCeiling" as const, from: P.posted.debtCeiling, to: N.posted.debtCeiling, delta: toDecString(delta, 2) };
  if (!P.report || !N.report || !N.ceilingK) {
    return { ...base, headline: `Debt ceiling ${usd(from)} to ${usd(to)}: cause unavailable (an input bundle is not retrievable).`, causes: [{ kind: "UNAVAILABLE", contribution: toDecString(delta, 2), sentence: "Cause unavailable: an input bundle is not retrievable." }], residual: null };
  }
  const k = dec(N.ceilingK);
  const c1P = dec(P.report.depth.C_1), c1N = dec(N.report.depth.C_1);
  const causes: Cause[] = [];
  const depth = k.mul(c1N.minus(c1P));
  const pool = N.report.depth.venues[0]?.pools[0];
  if (!depth.isZero()) causes.push({ kind: "DEPTH", contribution: toDecString(depth, 2), sentence: `C(1%) moved from ${usd(c1P)} to ${usd(c1N)}${pool ? ` in pool ${pool.slice(0, 6)}…${pool.slice(-4)}` : ""}, and the ceiling is ${k.toString()} × C(1%).` });
  const guard = (r: Report): Decimal => dec(r.capacity.debtCeiling).minus(k.mul(dec(r.depth.C_1)));
  const g = guard(N.report).minus(guard(P.report));
  if (g.abs().gte(1)) causes.push({ kind: "GUARDRAIL", contribution: toDecString(g, 2), sentence: `The engine clamps the ceiling to its guardrail bounds (${usd(g)}).` });
  const adj = (s: PostSide): Decimal => dec(s.posted.debtCeiling).minus(dec((s.report as Report).capacity.debtCeiling));
  const a = adj(N).minus(adj(P));
  if (a.abs().gte(1)) {
    const kind = attesterKind(N, "debtCeiling") ?? attesterKind(P, "debtCeiling") ?? "ATTESTER_CLAMP";
    causes.push(kind === "LOOSEN_CAP"
      ? { kind, contribution: toDecString(a, 2), sentence: a.lt(0) ? `Would be ${usd(N.report.capacity.debtCeiling)}, but terms loosen at most one step at a time after a cooldown.` : "A loosening held back earlier is released." }
      : { kind: "ATTESTER_CLAMP", contribution: toDecString(a, 2), sentence: `Posted ${usd(N.posted.debtCeiling)}, tighter than the engine's ${usd(N.report.capacity.debtCeiling)}: the attester may clamp tighter, never looser.` });
  }
  const explained = causes.reduce((s, c) => s.plus(dec(c.contribution)), new Decimal(0));
  const residual = delta.minus(explained);
  const r = rank(delta, causes, "usd");
  return { ...base, headline: `Debt ceiling ${usd(from)} to ${usd(to)}. ${r.headline}`, causes: r.causes, residual: residual.abs().gte(Decimal.max(delta.abs().mul(0.01), 1)) ? toDecString(residual, 2) : null };
}

const REGIME_WORD: Record<string, string> = { DEEP: "Deep", NORMAL: "Normal", THIN: "Thin", PRE_TRANSITION: "Pre-transition", REFERENCE_CLOSED: "Reference closed", ACTION: "Corporate action", HALTED: "Halted", STALE: "Stale", RECOVERY: "Recovery" };
export const regimeWord = (r: string): string => REGIME_WORD[r] ?? r.replace(/_/g, " ").toLowerCase();

function regimeChange(P: PostSide, N: PostSide): Change | null {
  if (P.posted.regime === N.posted.regime) return null;
  const rule = N.report ? ` Rule ${N.report.regimeInputs.rule}: ${N.report.regimeInputs.reason}` : "";
  const unusable = (r: string): boolean => r === "STALE" || r === "HALTED";
  const s = `Regime ${regimeWord(P.posted.regime)} to ${regimeWord(N.posted.regime)}.${rule}${rule && !/[.!?]$/.test(rule) ? "." : ""}`;
  const causes: Cause[] = [{ kind: "REGIME", contribution: "0" as DecString, sentence: s }];
  if (unusable(P.posted.regime) !== unusable(N.posted.regime)) causes.push({ kind: "USABLE", contribution: "0" as DecString, sentence: unusable(N.posted.regime) ? `New borrowing paused: the regime is ${regimeWord(N.posted.regime)}. Repay and cure keep working.` : "New borrowing resumed." });
  return { field: "regime", from: P.posted.regime, to: N.posted.regime, delta: null, headline: s, causes, residual: null };
}

/** Every material change between two consecutive posts of one asset. */
export function attribute(P: PostSide, N: PostSide): Change[] {
  return [regimeChange(P, N), ltvChange("carryLTV", P, N), ltvChange("sessionMaxLTV", P, N), ceilingChange(P, N)].filter((c): c is Change => c !== null);
}

/** SPEC section 5: three sentences on why the current terms are what they are. */
export function explainNow(side: Pick<PostSide, "report" | "posted" | "ceilingK" | "referenceSize">): { field: "carryLTV" | "sessionMaxLTV" | "debtCeiling"; sentence: string }[] {
  const r = side.report;
  const m = marginsOf(r);
  if (!r || !m) return [];
  const LT = dec(r.capacity.LT);
  const carry = dec(side.posted.carryLTV), session = dec(side.posted.sessionMaxLTV);
  const tighter = (posted: Decimal, engine: DecString): string => (posted.lt(dec(engine).minus(dec("0.00005"))) ? ` Posted tighter than the engine's ${pctS(engine)} while a loosening waits.` : "");
  const c = m.carry, s = m.session;
  const carryS = dec(c.raw).lt(dec(c.floor))
    ? `Carry is ${pts(LT.minus(carry))} points below the fixed ${pctS(LT)} line, held at its ${pts(dec(c.floor))}-point floor; the horizon to the next deep session is short (${hoursWords(c.horizonHours)}, ${utc(c.horizonEndsAt)}).`
    : `Carry is ${pts(LT.minus(carry))} points below the fixed ${pctS(LT)} line: ${m.k} × ${dec(c.volScaler).toFixed(2)} volatility × the ${pctS(c.gap)} stressed gap over the ${hoursWords(c.horizonHours)} until the next deep session (${utc(c.horizonEndsAt)}), plus ${pctS(c.exitCost)} exit cost at ${side.referenceSize ? usd(side.referenceSize) : "the reference size"}.`;
  const sessionS = `Session Max only has to reach the cure deadline, ${hoursWords(s.horizonHours)} away (${utc(s.horizonEndsAt)}): margin ${pts(dec(s.used))} points${dec(s.raw).lt(dec(s.floor)) ? ", its floor" : ""}.`;
  const ceilingS = side.ceilingK
    ? `Debt ceiling ${usd(side.posted.debtCeiling)} is ${side.ceilingK} × C(1%) ${usd(r.depth.C_1)}${dec(side.posted.debtCeiling).lt(dec(r.capacity.debtCeiling).minus(1)) ? ", held lower while a loosening waits" : ""}.`
    : `Debt ceiling ${usd(side.posted.debtCeiling)}.`;
  return [
    { field: "carryLTV", sentence: carryS + tighter(carry, r.capacity.carryLTV) },
    { field: "sessionMaxLTV", sentence: sessionS + tighter(session, r.capacity.sessionMaxLTV) },
    { field: "debtCeiling", sentence: ceilingS },
  ];
}
