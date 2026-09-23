import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { attribute } from "@kerb/engine";
import type { PostRow } from "../src/attribution.js";

/**
 * Golden attribution on real posts and their stored input bundles (data/fixtures/attribution),
 * SPEC-TERM-ATTRIBUTION.md section 9: KOx across the 21 Sep New York close (HORIZON dominant) and
 * the KTS 0.1 to 0.2 switch at 19:38 UTC (KTS_VERSION). Causes sum to the posted move.
 */
const FX = resolve(__dirname, "../../../data/fixtures/attribution");
let sideOf: (r: PostRow) => ReturnType<typeof import("../src/attribution.js").sideOf>;
beforeAll(async () => {
  process.env["KERB_BUNDLE_DIR"] = resolve(FX, "bundles");
  ({ sideOf } = await import("../src/attribution.js"));
});
const pair = (name: string): [PostRow, PostRow] => JSON.parse(readFileSync(resolve(FX, `${name}.json`), "utf8")) as [PostRow, PostRow];
const sum = (c: { contribution: string }[]): number => c.reduce((a, x) => a + Number(x.contribution), 0);

describe("golden attribution (V3-04)", () => {
  it("KOx across the 21 Sep New York close: Carry 55.60% to 51.57%, the horizon did it", () => {
    const [P, N] = pair("kox-ny-close");
    const changes = attribute(sideOf(P), sideOf(N));
    const carry = changes.find((c) => c.field === "carryLTV")!;
    expect(carry.headline).toMatch(/^Carry down 55\.60% to 51\.57%/);
    expect(carry.causes[0]?.kind).toBe("HORIZON");
    expect(Math.abs(sum(carry.causes) - Number(carry.delta))).toBeLessThan(0.01);
    expect(carry.residual).toBeNull();
    const session = changes.find((c) => c.field === "sessionMaxLTV")!;
    expect(Math.abs(sum(session.causes) - Number(session.delta))).toBeLessThan(0.01);
    expect(changes.find((c) => c.field === "regime")?.headline).toMatch(/Rule 9/);
  });
  it("the switch from KTS 0.1 to 0.2 is named as such", () => {
    const [P, N] = pair("kox-kts-switch");
    const changes = attribute(sideOf(P), sideOf(N));
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes.filter((x) => x.field !== "regime")) expect(c.causes.map((x) => x.kind)).toEqual(["KTS_VERSION"]);
  });
  it("Hong Kong lunch reopen: the regime moves into the post-reopen cooldown, with its rule", () => {
    const [P, N] = pair("hk-lunch-reopen");
    const r = attribute(sideOf(P), sideOf(N)).find((c) => c.field === "regime");
    expect(r?.headline).toMatch(/Normal to Recovery\. Rule 5/);
  });
  it("a depth fall moves the ceiling, and the causes explain it to the dollar", () => {
    const [P, N] = pair("brk-depth-fall");
    const c = attribute(sideOf(P), sideOf(N)).find((x) => x.field === "debtCeiling")!;
    expect(c.causes[0]?.kind).toBe("DEPTH");
    expect(Math.abs(sum(c.causes) - Number(c.delta))).toBeLessThan(1);
  });
  it("a loosening the attester held back is released, and named", () => {
    const [P, N] = pair("kuai-loosen-release");
    const c = attribute(sideOf(P), sideOf(N)).find((x) => x.field === "carryLTV")!;
    expect(c.causes.map((x) => x.kind)).toContain("LOOSEN_CAP");
    expect(Math.abs(sum(c.causes) - Number(c.delta))).toBeLessThan(0.01);
  });
});
