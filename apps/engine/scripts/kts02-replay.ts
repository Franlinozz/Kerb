/**
 * KTS-0.2 replay (V2-01, KTS-0.2 section 7.2). Inputs only: nothing is signed or posted.
 *
 * Two sources, both real observations:
 *   1. every bundle the attester stored on disk in the window (the exact inputs it posted), and
 *   2. bundles rebuilt from the append-only observation store every --step minutes across the
 *      window, so the replay spans a full market closure and not only the hours since K-43.
 * Each bundle is recomputed as posted (0.1, its own pinned config) and under 0.2 (the same bundle
 * with kts "0.2" and the 0.2 capacity parameters). Output: data/reports/kts-0.2-replay.json and
 * data/reports/kts-0.2-replay.svg.
 *
 *   pnpm --filter @kerb/engine kts02-replay [--hours 72] [--step 15] [--symbols KOx,HKEXCx,SLVx]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAssets, repoRoot } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { buildBundle } from "../src/build.js";
import type { InputBundle } from "../src/bundle.js";
import { engineConfigFromBundle, loadParams } from "../src/params.js";
import { computeReport } from "../src/report.js";

const arg = (k: string, d: string): string => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? (process.argv[i + 1] ?? d) : d; };
const hours = Number(arg("hours", "72"));
const stepMin = Number(arg("step", "15"));
const params = loadParams();
if (params.kts !== "0.2") throw new Error("run the replay on the KTS-0.2 parameter file");
const cap02 = params.capacityDefaults;
const symbols = arg("symbols", loadAssets().assets.filter((a) => a.status === "resolved").map((a) => a.symbol).join(",")).split(",");

const endMs = Date.now();
const startMs = endMs - hours * 3_600_000;

interface Point {
  symbol: string; at: string; source: "stored" | "rebuilt"; regime: string;
  carry01: string; session01: string; carry02: string; session02: string;
  carryMargin: string; sessionMargin: string; hoursWeak: string; hoursCure: string; gapWeak: string; gapCure: string; exitCost: string;
  LT: string;
}

function as02(b: InputBundle): InputBundle {
  const config = { ...b.config, capacity: { ...(b.config["capacity"] as object), stressMultiplier: cap02.stressMultiplier, minCarryMargin: cap02.minCarryMargin, minSessionMargin: cap02.minSessionMargin } };
  return { ...b, kts: "0.2", paramsVersion: params.paramsVersion, config };
}

function point(b: InputBundle, source: Point["source"]): Point {
  // The 0.1 side is the bundle as a 0.1 bundle: stored ones already are; rebuilt ones are built
  // under today's parameter file, whose extra 0.2 fields 0.1 ignores.
  const b1: InputBundle = { ...b, kts: "0.1" };
  const r1 = computeReport(b1, engineConfigFromBundle(b1));
  const b2 = as02(b);
  const r2 = computeReport(b2, engineConfigFromBundle(b2));
  const m = (r2.capacity as { margins?: import("../src/capacity.js").Margins }).margins;
  if (!m) throw new Error("0.2 report without margins");
  return {
    symbol: b.asset.symbol, at: r1.observedAt, source, regime: r1.regime,
    carry01: r1.capacity.carryLTV, session01: r1.capacity.sessionMaxLTV,
    carry02: r2.capacity.carryLTV, session02: r2.capacity.sessionMaxLTV,
    carryMargin: m.carry.used, sessionMargin: m.session.used,
    hoursWeak: m.carry.horizonHours, hoursCure: m.session.horizonHours,
    gapWeak: m.carry.gap, gapCure: m.session.gap, exitCost: m.carry.exitCost, LT: r2.capacity.LT,
  };
}

const points: Point[] = [];
const failures: { symbol: string; at: string; error: string }[] = [];

// 1. Stored bundles: exactly what the attester posted.
const dir = resolve(repoRoot(), "data/reports/bundles");
const bundleDir = process.env["KERB_BUNDLE_DIR"] ?? dir;
let stored = 0;
for (const f of readdirSync(bundleDir).filter((x) => x.endsWith(".json"))) {
  const b = JSON.parse(readFileSync(resolve(bundleDir, f), "utf8")) as InputBundle;
  if (b.observedAtMs < startMs || !symbols.includes(b.asset.symbol)) continue;
  try { points.push(point(b, "stored")); stored++; } catch (e) { failures.push({ symbol: b.asset.symbol, at: new Date(b.observedAtMs).toISOString(), error: String(e) }); }
}
console.log(`stored bundles replayed: ${stored} from ${bundleDir}`);

// 2. Rebuilt from the observation store across the whole window.
const { sql } = connect();
let rebuilt = 0;
try {
  for (let t = startMs; t <= endMs; t += stepMin * 60_000) {
    for (const s of symbols) {
      try { points.push(point(await buildBundle(sql, s, params, { atMs: t }), "rebuilt")); rebuilt++; }
      catch (e) { failures.push({ symbol: s, at: new Date(t).toISOString(), error: e instanceof Error ? e.message : String(e) }); }
    }
    if (rebuilt % 200 === 0) process.stderr.write(`  rebuilt ${rebuilt} (${new Date(t).toISOString()})\n`);
  }
} finally { await sql.end(); }
console.log(`rebuilt bundles replayed: ${rebuilt}, failures ${failures.length}`);

points.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.at.localeCompare(b.at));

// Summary per asset, and the guardrail invariants: carry <= session <= LT, both >= ltvMin.
const summary = symbols.map((s) => {
  const ps = points.filter((p) => p.symbol === s);
  const n = (k: keyof Point) => ps.map((p) => Number(p[k]));
  const mm = (xs: number[]) => xs.length ? { min: Math.min(...xs).toFixed(4), max: Math.max(...xs).toFixed(4), spread: (Math.max(...xs) - Math.min(...xs)).toFixed(4) } : null;
  const g = params.guardrails.assets[s] ?? params.guardrails.default;
  const breaches = ps.filter((p) => Number(p.carry02) > Number(p.session02) || Number(p.session02) > Number(p.LT) || Number(p.carry02) < Number(g.ltvMin) || Number(p.session02) > Number(g.ltvMax)).length;
  const byRegime: Record<string, { n: number; carryMin: string; carryMax: string; sessionMin: string; sessionMax: string }> = {};
  for (const p of ps) {
    const r = byRegime[p.regime] ?? { n: 0, carryMin: p.carry02, carryMax: p.carry02, sessionMin: p.session02, sessionMax: p.session02 };
    r.n++;
    if (Number(p.carry02) < Number(r.carryMin)) r.carryMin = p.carry02;
    if (Number(p.carry02) > Number(r.carryMax)) r.carryMax = p.carry02;
    if (Number(p.session02) < Number(r.sessionMin)) r.sessionMin = p.session02;
    if (Number(p.session02) > Number(r.sessionMax)) r.sessionMax = p.session02;
    byRegime[p.regime] = r;
  }
  return { symbol: s, points: ps.length, LT: g.LT, carry01: mm(n("carry01")), session01: mm(n("session01")), carry02: mm(n("carry02")), session02: mm(n("session02")), guardrailBreaches: breaches, byRegime };
});

const out = { generatedAt: new Date().toISOString(), note: "Replay only: nothing was signed or posted. Values are Computed from real observation bundles.", window: { from: new Date(startMs).toISOString(), to: new Date(endMs).toISOString(), stepMinutes: stepMin }, paramsVersion: params.paramsVersion, capacity02: { stressMultiplier: cap02.stressMultiplier, minCarryMargin: cap02.minCarryMargin, minSessionMargin: cap02.minSessionMargin }, counts: { stored, rebuilt, failures: failures.length }, summary, failures: failures.slice(0, 50), points };
writeFileSync(resolve(repoRoot(), "data/reports/kts-0.2-replay.json"), JSON.stringify(out, null, 1) + "\n");
console.table(summary.map((s) => ({ symbol: s.symbol, n: s.points, LT: s.LT, carry01: `${s.carry01?.min}-${s.carry01?.max}`, carry02: `${s.carry02?.min}-${s.carry02?.max}`, session02: `${s.session02?.min}-${s.session02?.max}`, breaches: s.guardrailBreaches })));

// ---- chart: small multiples, one per asset. Carry and Session Max under 0.2, 0.1 dashed, regime bands.
const W = 900, PH = 150, PAD = { l: 52, r: 16, t: 26, b: 22 };
const H = symbols.length * (PH + 18) + 60;
const REGIME_FILL: Record<string, string> = { DEEP: "#ffffff", NORMAL: "#ffffff", THIN: "#eef1f5", PRE_TRANSITION: "#fbf1dc", REFERENCE_CLOSED: "#e3e7ed", RECOVERY: "#eef1f5", STALE: "#f6e3e3", HALTED: "#f6e3e3", ACTION: "#f6e3e3" };
const CARRY = "#2a6fdb", SESSION = "#d9730d";
const x = (ms: number) => PAD.l + ((ms - startMs) / (endMs - startMs)) * (W - PAD.l - PAD.r);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif" font-size="11">\n<rect width="${W}" height="${H}" fill="#fbfbf9"/>\n`;
svg += `<text x="${PAD.l}" y="18" font-size="13" font-weight="600" fill="#1d232b">KTS-0.2 replay: Carry and Session Max over ${hours} h of real observations (0.1 dashed)</text>\n`;
svg += `<g transform="translate(${PAD.l},26)"><rect width="12" height="3" y="4" fill="${CARRY}"/><text x="16" y="10" fill="#1d232b">Carry 0.2</text><rect x="86" width="12" height="3" y="4" fill="${SESSION}"/><text x="102" y="10" fill="#1d232b">Session Max 0.2</text><rect x="202" width="12" height="10" fill="#e3e7ed"/><text x="218" y="10" fill="#1d232b">Reference closed</text></g>\n`;
symbols.forEach((s, i) => {
  const ps = points.filter((p) => p.symbol === s && p.source === "rebuilt");
  const top = 40 + i * (PH + 18);
  const vals = ps.flatMap((p) => [Number(p.carry02), Number(p.session02), Number(p.carry01), Number(p.session01)]);
  const lo = Math.max(0, Math.floor((Math.min(...vals, 1) - 0.02) * 20) / 20), hi = Math.min(1, Math.ceil((Math.max(...vals, 0) + 0.02) * 20) / 20);
  const y = (v: number) => top + PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (PH - PAD.t - PAD.b);
  svg += `<g>\n<text x="${PAD.l}" y="${top + 14}" font-weight="600" fill="#1d232b">${s}</text>\n`;
  // regime bands
  for (let j = 0; j < ps.length; j++) {
    const p = ps[j] as Point, next = ps[j + 1];
    const fill = REGIME_FILL[p.regime] ?? "#ffffff";
    const x0 = x(Date.parse(p.at)), x1 = next ? x(Date.parse(next.at)) : W - PAD.r;
    svg += `<rect x="${x0.toFixed(1)}" y="${top + PAD.t}" width="${Math.max(0, x1 - x0).toFixed(1)}" height="${PH - PAD.t - PAD.b}" fill="${fill}"><title>${p.regime}</title></rect>`;
  }
  for (const v of [lo, (lo + hi) / 2, hi]) svg += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#d5d9df" stroke-width="0.5"/><text x="${PAD.l - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" fill="#5b6470">${(v * 100).toFixed(0)}%</text>`;
  const path = (k: keyof Point) => ps.map((p, j) => `${j ? "L" : "M"}${x(Date.parse(p.at)).toFixed(1)},${y(Number(p[k])).toFixed(1)}`).join("");
  svg += `<path d="${path("carry01")}" fill="none" stroke="${CARRY}" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`;
  svg += `<path d="${path("session01")}" fill="none" stroke="${SESSION}" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`;
  svg += `<path d="${path("carry02")}" fill="none" stroke="${CARRY}" stroke-width="2"/>`;
  svg += `<path d="${path("session02")}" fill="none" stroke="${SESSION}" stroke-width="2"/>\n</g>\n`;
});
for (let d = Math.ceil(startMs / 86_400_000) * 86_400_000; d < endMs; d += 86_400_000) {
  const xx = x(d);
  svg += `<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="36" y2="${H - 20}" stroke="#aab1bb" stroke-width="0.5"/><text x="${(xx + 3).toFixed(1)}" y="${H - 8}" fill="#5b6470">${new Date(d).toISOString().slice(0, 10)} 00:00 UTC</text>`;
}
svg += "</svg>\n";
writeFileSync(resolve(repoRoot(), "data/reports/kts-0.2-replay.svg"), svg);
console.log("wrote data/reports/kts-0.2-replay.json and .svg");
