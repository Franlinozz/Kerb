/**
 * Add executable depth in dollars to a published Market-Time Report without touching its figures
 * (V2-09 step 3). C(1%) is recomputed from the stored pool state at the report's window start and
 * end, with the engine's own depth walk, and written as a dated appendix beside the original.
 *
 *   pnpm --filter @kerb/engine exec tsx scripts/c1-appendix.ts 1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot, loadAssets, resolvedAssets } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { buildBundle } from "../src/build.js";
import { computeReport } from "../src/report.js";
import { engineConfig, loadParams } from "../src/params.js";

const id = process.argv[2] ?? "1";
const path = resolve(repoRoot(), `data/reports/market-time-${id}.json`);
const report = JSON.parse(readFileSync(path, "utf8")) as { window: { from: string; to: string }; appendix?: unknown };
const params = loadParams();
const { sql } = connect();

/** Percentage change of two decimal strings to two places, in bigint arithmetic. */
function changePct(a: string, b: string): string | null {
  const s = (d: string): bigint => { const [w = "0", f = ""] = d.split("."); return BigInt(w + (f + "000000").slice(0, 6)); };
  const x = s(a), y = s(b);
  if (x === 0n) return null;
  const bp = ((y - x) * 1_000_000n) / x; // hundredths of a basis point
  const sign = bp < 0n ? "-" : "";
  const abs = bp < 0n ? -bp : bp;
  return `${sign}${abs / 10_000n}.${String((abs % 10_000n) / 100n).padStart(2, "0")}`;
}

try {
  const rows = [];
  for (const a of resolvedAssets(loadAssets())) {
    // The first readings of a window can predate an input the engine needs (the multiplier loop runs
    // every ten minutes), so step forward to the first moment a bundle can be built, and say when.
    const at = async (iso: string, dir: 1 | -1): Promise<{ at: string; c1: string } | null> => {
      for (let step = 0; step <= 12; step++) {
        const t = Date.parse(iso) + dir * step * 5 * 60_000;
        try {
          const bundle = await buildBundle(sql, a.symbol, params, { atMs: t });
          return { at: new Date(t).toISOString(), c1: computeReport(bundle, engineConfig(params, a.symbol, bundle.market.cureWindowSec)).depth.C_1 };
        } catch { /* an input is missing at this instant; try five minutes on */ }
      }
      return null;
    };
    const start = await at(report.window.from, 1), end = await at(report.window.to, -1);
    rows.push({ symbol: a.symbol, startAt: start?.at ?? null, c1AtStart: start?.c1 ?? null, endAt: end?.at ?? null, c1AtEnd: end?.c1 ?? null, changePct: start && end ? changePct(start.c1, end.c1) : null });
    console.log(`${a.symbol.padEnd(8)} ${start?.at.slice(11, 16) ?? "--"} ${start?.c1 ?? "n/a"} -> ${end?.at.slice(11, 16) ?? "--"} ${end?.c1 ?? "n/a"}`);
  }
  report.appendix = {
    label: `added ${new Date().toUTCString().slice(5, 11).trim()}`,
    addedAt: new Date().toISOString(),
    what: "Executable depth C(1%) in USDG near the window's first and last reading (each row says the exact moment: the first instant every engine input existed), recomputed from the stored pool state with the engine's tick walk. Added after publication; the report's original figures are unchanged.",
    paramsVersion: (params as { paramsVersion?: string }).paramsVersion ?? null,
    rows,
    reproduce: `pnpm --filter @kerb/engine exec tsx scripts/c1-appendix.ts ${id}`,
  };
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`appendix written to ${path}`);
} finally {
  await sql.end();
}
