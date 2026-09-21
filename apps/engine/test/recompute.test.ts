/**
 * KTS-0.1 section 10: the engine is a pure function of the bundle. Ten historical bundles
 * are replayed offline and must reproduce byte-identical reports.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "@kerb/types";
import { identifyBundle, type InputBundle } from "../src/bundle.js";
import { engineConfigFromBundle } from "../src/params.js";
import { computeReport } from "../src/report.js";

const dir = resolve(__dirname, "../../../data/fixtures/kts");
interface Row { symbol: string; atMs: number; inputsHash: string; cid: string; bundle: string; report: string }
const index = JSON.parse(readFileSync(resolve(dir, "index.json"), "utf8")) as Row[];
const load = (f: string): string => readFileSync(resolve(dir, f), "utf8");

describe("recompute from pinned bundles", () => {
  it("has ten historical bundles", () => expect(index).toHaveLength(10));

  it.each(index.map((r) => [`${r.symbol} @ ${new Date(r.atMs).toISOString()}`, r] as const))("%s recomputes byte-identically", (_n, row) => {
    const bundle = JSON.parse(load(row.bundle)) as InputBundle;
    const cfg = engineConfigFromBundle(bundle);
    const fresh = canonicalJson(computeReport(bundle, cfg));
    expect(fresh).toBe(load(row.report).trim());
  });

  it.each(index.map((r) => [r.symbol, r] as const))("%s bundle hashes and CID are stable", (_n, row) => {
    const bundle = JSON.parse(load(row.bundle)) as InputBundle;
    const id = identifyBundle(bundle);
    expect(id.inputsHash).toBe(row.inputsHash);
    expect(id.cidV1Raw).toBe(row.cid);
    // The canonical form is exactly what was stored: sorted keys, no whitespace.
    expect(id.canonical).toBe(load(row.bundle).trim());
  });

  it("reports carry the hash of their own bundle", () => {
    for (const row of index) {
      const report = JSON.parse(load(row.report)) as { inputsHash: string; inputsCidV1Raw: string; provenance: { label: string } };
      expect(report.inputsHash).toBe(row.inputsHash);
      expect(report.inputsCidV1Raw).toBe(row.cid);
      expect(report.provenance.label).toBe("Computed");
    }
  });

  it("is order-independent: reserialising the bundle changes nothing", () => {
    const row = index[0] as Row;
    const bundle = JSON.parse(load(row.bundle)) as InputBundle;
    const shuffled = JSON.parse(JSON.stringify({ ...bundle, config: { ...bundle.config } })) as InputBundle;
    expect(identifyBundle(shuffled).inputsHash).toBe(row.inputsHash);
  });

  it("a changed input changes the hash and the report", () => {
    const row = index[0] as Row;
    const bundle = JSON.parse(load(row.bundle)) as InputBundle;
    const tampered: InputBundle = { ...bundle, observedAtMs: bundle.observedAtMs + 1000 };
    expect(identifyBundle(tampered).inputsHash).not.toBe(row.inputsHash);
    const cfg = engineConfigFromBundle(bundle);
    expect(canonicalJson(computeReport(tampered, cfg))).not.toBe(load(row.report).trim());
  });
});

describe("recompute across formula versions (KTS-0.2 section 6)", () => {
  const v02 = resolve(dir, "v02");
  const pairs = [
    { bundle: "KOx-2026-09-21T17-35-44-432Z.bundle.json", report: "KOx-2026-09-21T17-35-44-432Z.report.json" },
    { bundle: "HKEXCx-2026-09-21T17-35-44-432Z.bundle.json", report: "HKEXCx-2026-09-21T17-35-44-432Z.report.json" },
  ];
  it.each(pairs.map((p) => [p.bundle, p] as const))("0.2 bundle %s recomputes byte-identically, margins included", (_n, p) => {
    const bundle = JSON.parse(readFileSync(resolve(v02, p.bundle), "utf8")) as InputBundle;
    expect(bundle.kts).toBe("0.2");
    const report = computeReport(bundle, engineConfigFromBundle(bundle));
    expect(canonicalJson(report)).toBe(readFileSync(resolve(v02, p.report), "utf8").trim());
    expect((report.capacity as { margins?: unknown }).margins).toBeDefined();
  });

  it("a 0.1 bundle stays on 0.1: no margins, the fixed 0.1 margins", () => {
    const row = index[0] as Row;
    const bundle = JSON.parse(load(row.bundle)) as InputBundle;
    const report = computeReport(bundle, engineConfigFromBundle(bundle));
    expect(report.kts).toBe("0.1");
    expect((report.capacity as { margins?: unknown }).margins).toBeUndefined();
  });

  it("the same inputs under 0.2 move Carry off the fixed 0.1 line", () => {
    const bundle = JSON.parse(readFileSync(resolve(v02, pairs[0]!.bundle), "utf8")) as InputBundle;
    const as01 = computeReport({ ...bundle, kts: "0.1" }, engineConfigFromBundle(bundle));
    const as02 = computeReport(bundle, engineConfigFromBundle(bundle));
    expect(as01.capacity.carryLTV).toBe("0.55");
    expect(as02.capacity.carryLTV).not.toBe(as01.capacity.carryLTV);
  });
});
