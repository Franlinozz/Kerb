#!/usr/bin/env node
/**
 * kerb report <symbol> [--at <iso>] [--pin] [--json]
 * kerb verify <reportId|bundleCID|path> : recompute from the pinned bundle and diff.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import { canonicalJson } from "@kerb/types";
import { connect } from "@kerb/collector/db";
import { buildBundle } from "./build.js";
import { identifyBundle, type InputBundle } from "./bundle.js";
import { engineConfig, loadParams } from "./params.js";
import { computeReport, type Report } from "./report.js";
import { pinBundle } from "./pin.js";

const OUT = process.env["KERB_REPORT_DIR"] ?? resolve(repoRoot(), "data/reports/kts");

function store(): string {
  mkdirSync(OUT, { recursive: true });
  return OUT;
}

export function reportId(r: Report): string {
  return `${r.assetSymbol}-${r.observedAt.replace(/[:.]/g, "-")}`;
}

async function cmdReport(symbol: string, args: string[]): Promise<void> {
  const atArg = args[args.indexOf("--at") + 1];
  const atMs = args.includes("--at") && atArg ? Date.parse(atArg) : undefined;
  const params = loadParams();
  const { sql } = connect();
  try {
    const bundle = await buildBundle(sql, symbol, params, atMs === undefined ? {} : { atMs });
    const cfg = engineConfig(params, symbol, bundle.market.cureWindowSec);
    const report = computeReport(bundle, cfg);
    const id = identifyBundle(bundle);
    const dir = store();
    const rid = reportId(report);
    writeFileSync(resolve(dir, `${rid}.bundle.json`), id.canonical);
    if (args.includes("--pin")) {
      const pin = await pinBundle(id.canonical, id.cidV1Raw, `${rid}.bundle.json`);
      (report as Report & { pin?: unknown }).pin = pin;
      console.error(`pin: ${pin.status} ${pin.cid}${pin.reason ? ` (${pin.reason})` : ""}`);
    }
    writeFileSync(resolve(dir, `${rid}.report.json`), `${canonicalJson(report)}\n`);
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else printReport(report, id.bytes, rid);
  } finally {
    await sql.end();
  }
}

function printReport(r: Report, bundleBytes: number, rid: string): void {
  const pct = (x: string): string => `${(Number(x) * 100).toFixed(2)}%`;
  console.log(`${r.assetSymbol}  ${r.regime}  (${r.underlying.symbol} on ${r.underlying.market})  observed ${r.observedAt}`);
  console.log(`  report id     ${rid}`);
  console.log(`  session       ${r.regimeInputs.calendarSession}, rule ${r.regimeInputs.rule}: ${r.regimeInputs.reason}`);
  console.log(`  next          ${r.regimeInputs.nextTransition.type} at ${r.regimeInputs.nextTransition.at}`);
  console.log(`  weakening     ${r.regimeInputs.nextWeakening.type} at ${r.regimeInputs.nextWeakening.at}   cure window opens ${r.regimeInputs.cureWindowOpensAt} (open=${r.regimeInputs.cureWindowOpen})`);
  console.log(`  mark          creditMark ${r.mark.creditMark}  reference ${r.mark.reference.value} [${r.mark.reference.sources.join(", ")}]  pool ${r.mark.pool.value} (${r.mark.pool.basis})`);
  console.log(`                band [${r.mark.band.join(", ")}]  haircut ${pct(r.mark.haircut)}  dispersion ${pct(r.mark.dispersion)}${r.mark.dispersionBreach ? " BREACH" : ""}`);
  console.log(`  depth         C(0.5%) ${r.depth.C_0_5}  C(1%) ${r.depth.C_1}  C(3%) ${r.depth.C_3}  frag ${r.depth.fragmentationFactor}  crosscheck ${"status" in r.depth.crosscheck ? `${r.depth.crosscheck.status} (rung ${r.depth.crosscheck.rung})` : r.depth.crosscheck.used}`);
  for (const v of r.depth.venues) console.log(`                path ${v.path.join(" -> ")}  C(1%) ${v.C_1.notional}`);
  for (const x of r.depth.excluded) console.log(`                excluded ${x.path.join(" -> ")}: ${x.reason}`);
  console.log(`  capacity      LT ${pct(r.capacity.LT)}  carryLTV ${pct(r.capacity.carryLTV)}  sessionMaxLTV ${pct(r.capacity.sessionMaxLTV)}`);
  console.log(`                debtCeiling ${r.capacity.debtCeiling}  maxPositionDebt ${r.capacity.maxPositionDebt}  coverage ${r.capacity.coverageRatioAtCeiling}`);
  if (r.capacity.clamped.length) for (const c of r.capacity.clamped) console.log(`                clamped ${c.field}: ${c.from} -> ${c.to} (${c.reason})`);
  console.log(`  stress        H_weak ${r.stress.horizonHoursWeak}h (${r.stress.sessionsWeak} sessions) g=${r.stress.gapQuantileWeak}  H_cure ${r.stress.horizonHoursCure}h g=${r.stress.gapQuantileCure}`);
  console.log(`                volScaler ${r.stress.volScaler}  s=${r.stress.impactAtReferenceSize}  historySufficient=${r.stress.historySufficient}`);
  console.log(`  inputs        hash ${r.inputsHash}  cid ${r.inputsCidV1Raw}  (${bundleBytes} bytes)`);
}

function loadBundleByRef(ref: string): { bundle: InputBundle; path: string } {
  const candidates = [ref, resolve(OUT, ref), resolve(OUT, `${ref}.bundle.json`)];
  for (const p of candidates) if (existsSync(p)) return { bundle: JSON.parse(readFileSync(p, "utf8")) as InputBundle, path: p };
  throw new Error(`no bundle found for ${ref} (looked in ${OUT})`);
}

function cmdVerify(ref: string): void {
  const { bundle, path } = loadBundleByRef(ref);
  const id = identifyBundle(bundle);
  const params = loadParams();
  const cfg = engineConfig(params, bundle.asset.symbol, bundle.market.cureWindowSec);
  const recomputed = computeReport(bundle, cfg);
  const rid = reportId(recomputed);
  const storedPath = resolve(OUT, `${rid}.report.json`);
  console.log(`bundle   ${path}`);
  console.log(`inputsHash ${id.inputsHash}`);
  console.log(`cid        ${id.cidV1Raw}`);
  if (!existsSync(storedPath)) {
    console.log("no stored report to diff against; recomputed report:");
    console.log(canonicalJson(recomputed));
    return;
  }
  const stored = readFileSync(storedPath, "utf8").trim();
  const fresh = canonicalJson(recomputed);
  if (stored === fresh) {
    console.log(`recompute  IDENTICAL to ${storedPath} (${fresh.length} bytes)`);
    return;
  }
  console.error(`recompute  DIFFERS from ${storedPath}`);
  const a = JSON.parse(stored) as Record<string, unknown>;
  const b = JSON.parse(fresh) as Record<string, unknown>;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = JSON.stringify(a[k]);
    const y = JSON.stringify(b[k]);
    if (x !== y) console.error(`  ${k}:\n    stored:     ${x}\n    recomputed: ${y}`);
  }
  process.exitCode = 1;
}

const [cmd, arg, ...rest] = process.argv.slice(2);
if (cmd === "report" && arg) await cmdReport(arg, rest);
else if (cmd === "verify" && arg) cmdVerify(arg);
else {
  console.error("usage: kerb report <symbol> [--at <iso>] [--pin] [--json]\n       kerb verify <reportId|bundle path>");
  process.exitCode = 2;
}
