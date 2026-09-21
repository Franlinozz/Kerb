/**
 * Compare two captured snapshots of the whole engine, for Market-Time Report #1.
 *
 * The window is whatever the two snapshots say it is. This script never assumes which event it is
 * measuring: the labels come from the captures, so a Monday open and a campaign cliff cannot be
 * confused with each other in the published report.
 *
 * Takes two captured snapshots and reports, per asset, what actually changed: executable depth at
 * 1% and 3%, the Credit Mark, the regime, and the terms Kerb published in response. If nothing
 * moved it says so and publishes the numbers anyway — a null result measured honestly is still a
 * result, and pretending otherwise is how reports become marketing.
 *
 *   pnpm --filter @kerb/engine campaign-compare <before.json> <after.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";

interface Snapshot {
  label: string;
  capturedAt: string;
  assets: Record<string, {
    regime?: string;
    depth?: { C_1?: string; C_3?: string; C_0_5?: string };
    mark?: { creditMark?: string };
    capacity?: { carryLTV?: string; sessionMaxLTV?: string; debtCeiling?: string };
    error?: string;
  }>;
}

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw new Error("usage: campaign-compare <before.json> <after.json>");

const before = JSON.parse(readFileSync(beforePath, "utf8")) as Snapshot;
const after = JSON.parse(readFileSync(afterPath, "utf8")) as Snapshot;

/** Percentage change between two decimal strings, exact to two places, never via a float. */
function changePct(from: string | undefined, to: string | undefined): string | null {
  if (!from || !to) return null;
  const scale = (d: string): bigint => {
    const [w = "0", f = ""] = d.split(".");
    return BigInt(w + f.padEnd(18, "0").slice(0, 18));
  };
  const a = scale(from);
  const b = scale(to);
  if (a === 0n) return null;
  const s = ((b - a) * 10000n) / a;
  const sign = s < 0n ? "-" : "";
  const abs = s < 0n ? -s : s;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

const rows = Object.keys(before.assets)
  .filter((k) => !before.assets[k]?.error && !after.assets[k]?.error)
  .map((symbol) => {
    const b = before.assets[symbol]!;
    const a = after.assets[symbol]!;
    return {
      symbol,
      regimeBefore: b.regime ?? null,
      regimeAfter: a.regime ?? null,
      regimeChanged: (b.regime ?? null) !== (a.regime ?? null),
      c1Before: b.depth?.C_1 ?? null,
      c1After: a.depth?.C_1 ?? null,
      c1ChangePct: changePct(b.depth?.C_1, a.depth?.C_1),
      c3Before: b.depth?.C_3 ?? null,
      c3After: a.depth?.C_3 ?? null,
      c3ChangePct: changePct(b.depth?.C_3, a.depth?.C_3),
      markBefore: b.mark?.creditMark ?? null,
      markAfter: a.mark?.creditMark ?? null,
      markChangePct: changePct(b.mark?.creditMark, a.mark?.creditMark),
      carryBefore: b.capacity?.carryLTV ?? null,
      carryAfter: a.capacity?.carryLTV ?? null,
      ceilingBefore: b.capacity?.debtCeiling ?? null,
      ceilingAfter: a.capacity?.debtCeiling ?? null,
      ceilingChangePct: changePct(b.capacity?.debtCeiling, a.capacity?.debtCeiling),
    };
  });

const moved = rows.filter((r) => r.c1ChangePct !== null && Math.abs(Number(r.c1ChangePct)) >= 1);
const regimeChanges = rows.filter((r) => r.regimeChanged);

const out = {
  before: { label: before.label, capturedAt: before.capturedAt },
  after: { label: after.label, capturedAt: after.capturedAt },
  rows,
  summary: {
    assets: rows.length,
    depthMovedAtLeastOnePercent: moved.length,
    regimeChanges: regimeChanges.length,
    statement:
      moved.length === 0 && regimeChanges.length === 0
        ? "Nothing moved by more than one percent and no regime changed across this window. The numbers are published unchanged."
        : `${moved.length} of ${rows.length} assets moved executable depth at 1% by at least one percent, and ${regimeChanges.length} changed regime.`,
  },
};

const path = resolve(repoRoot(), "data/windows/comparison.json");
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);

console.log(`${before.capturedAt}  ->  ${after.capturedAt}`);
console.log(out.summary.statement);
console.log();
console.log("asset     regime                         C(1%) change   C(3%) change   mark change   ceiling change");
for (const r of rows) {
  const regime = r.regimeChanged ? `${r.regimeBefore} -> ${r.regimeAfter}` : (r.regimeBefore ?? "—");
  console.log(
    `${r.symbol.padEnd(9)} ${regime.padEnd(30)} ${String(r.c1ChangePct ?? "—").padStart(9)}%  ${String(r.c3ChangePct ?? "—").padStart(12)}%  ${String(r.markChangePct ?? "—").padStart(10)}%  ${String(r.ceilingChangePct ?? "—").padStart(12)}%`,
  );
}
console.log(`\nwrote ${path}`);
