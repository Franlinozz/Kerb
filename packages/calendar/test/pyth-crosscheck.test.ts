/**
 * Independent check: the Pyth feed catalogue publishes machine-readable market hours with
 * holiday overrides. Every override it lists must agree with our main-session windows.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { MarketCode } from "@kerb/types";
import { localToUtc, timeline } from "../src/index.js";

interface Fixture { attributes: { schedule: string; symbol: string } }
const load = (n: string): Fixture => JSON.parse(readFileSync(resolve(__dirname, `../../../data/fixtures/calendar/pyth_${n}.json`), "utf8")) as Fixture;

/** Parse "tz;weekly;MMDD/spec,..." into dated overrides; years roll forward from startYear. */
function parse(schedule: string, startYear: number) {
  const [tz, , overrides = ""] = schedule.split(";") as [string, string, string?];
  let year = startYear;
  let prev = 0;
  return overrides.split(",").filter(Boolean).map((o) => {
    const [mmdd, spec] = o.split("/") as [string, string];
    const n = Number(mmdd);
    if (n < prev) year++;
    prev = n;
    const m = Number(mmdd.slice(0, 2));
    const d = Number(mmdd.slice(2));
    const windows = spec === "C" ? [] : spec.split("&").map((w) => {
      const [a, b] = w.split("-") as [string, string];
      const mins = (x: string): number => Number(x.slice(0, 2)) * 60 + Number(x.slice(2));
      return [localToUtc(tz, year, m, d, mins(a)), localToUtc(tz, year, m, d, mins(b))] as [number, number];
    });
    return { date: `${year}-${mmdd.slice(0, 2)}-${mmdd.slice(2)}`, tz, y: year, m, d, windows };
  });
}

function regularWithin(market: MarketCode, tz: string, y: number, m: number, d: number): [number, number][] {
  const a = localToUtc(tz, y, m, d, 0);
  const b = localToUtc(tz, y, m, d, 1440);
  return timeline(market, a, b).filter((s) => s.kind === "REGULAR").map((s) => [Math.max(s.startMs, a), Math.min(s.endMs, b)] as [number, number]);
}

const SETS: [string, MarketCode, number][] = [["KO", "XNYS", 2026], ["SLV", "ARCX", 2026], ["0388", "XHKG", 2026], ["XAG", "XCOM", 2026]];

describe.each(SETS)("Pyth %s schedule vs %s", (file, market, startYear) => {
  const f = load(file);
  const rows = parse(f.attributes.schedule, startYear);
  it("lists overrides", () => expect(rows.length).toBeGreaterThan(5));
  it.each(rows.map((r) => [r.date, r] as const))("%s matches", (_d, r) => {
    expect(regularWithin(market, r.tz, r.y, r.m, r.d)).toEqual(r.windows);
  });
});
