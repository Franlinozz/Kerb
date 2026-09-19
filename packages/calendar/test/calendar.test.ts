import { describe, expect, it } from "vitest";
import type { MarketCode } from "@kerb/types";
import { segmentAt, timeline, transitions, type SessionKind } from "../src/index.js";

const T = (iso: string): number => Date.parse(iso);

// [market, UTC instant, expected session, note]
const CASES: [MarketCode, string, SessionKind, string][] = [
  ["XNYS", "2026-09-18T19:59:59Z", "REGULAR", "last second of Friday regular (EDT)"],
  ["XNYS", "2026-09-18T20:00:00Z", "POST", "Friday close -> post"],
  ["XNYS", "2026-09-18T23:59:59Z", "POST", "post-market before UTC midnight"],
  ["XNYS", "2026-09-19T00:00:00Z", "CLOSED", "post ends at 20:00 ET, crossing UTC midnight"],
  ["XNYS", "2026-09-19T12:00:00Z", "CLOSED", "Saturday"],
  ["XNYS", "2026-09-21T07:59:59Z", "CLOSED", "Monday before pre-market"],
  ["XNYS", "2026-09-21T08:00:00Z", "PRE", "pre-market opens 04:00 ET"],
  ["XNYS", "2026-09-21T13:29:59Z", "PRE", "last pre-market second"],
  ["XNYS", "2026-09-21T13:30:00Z", "REGULAR", "open 09:30 ET"],
  ["XNYS", "2026-09-21T23:59:59Z", "POST", "Monday post before UTC midnight"],
  ["XNYS", "2026-09-22T00:00:00Z", "CLOSED", "Monday post ends at UTC midnight"],
  ["XNYS", "2026-11-26T15:00:00Z", "CLOSED", "Thanksgiving holiday"],
  ["XNYS", "2026-11-27T17:59:59Z", "REGULAR", "early close day, before 13:00 EST"],
  ["XNYS", "2026-11-27T18:00:00Z", "POST", "early close 13:00 EST"],
  ["XNYS", "2026-11-27T21:59:59Z", "POST", "early-close post runs to 17:00 EST"],
  ["XNYS", "2026-11-27T22:00:00Z", "CLOSED", "after early-close post"],
  ["XNYS", "2026-12-24T18:30:00Z", "POST", "Christmas Eve early close"],
  ["XNYS", "2026-07-03T15:00:00Z", "CLOSED", "Independence Day observed"],
  ["XNYS", "2027-12-24T15:00:00Z", "CLOSED", "Christmas observed 2027"],
  ["XNYS", "2026-10-30T13:30:00Z", "REGULAR", "last Friday of EDT"],
  ["XNYS", "2026-11-02T13:30:00Z", "PRE", "first Monday of EST: 08:30 EST is pre-market"],
  ["XNYS", "2026-11-02T14:30:00Z", "REGULAR", "EST open is 14:30 UTC"],
  ["XNYS", "2026-11-02T20:30:00Z", "REGULAR", "EST close is 21:00 UTC"],
  ["XNYS", "2026-11-02T21:00:00Z", "POST", "EST close"],
  ["XNYS", "2027-03-12T13:45:00Z", "PRE", "last Friday of EST"],
  ["XNYS", "2027-03-15T13:45:00Z", "REGULAR", "first Monday of EDT"],
  ["XNAS", "2026-09-21T13:30:00Z", "REGULAR", "Nasdaq shares the US calendar"],
  ["ARCX", "2026-09-21T14:00:00Z", "REGULAR", "NYSE Arca (SLV) shares the US calendar"],
  ["XHKG", "2026-09-21T00:59:59Z", "CLOSED", "before HK pre-opening"],
  ["XHKG", "2026-09-21T01:00:00Z", "PRE", "pre-opening auction 09:00 HKT"],
  ["XHKG", "2026-09-21T01:30:00Z", "REGULAR", "morning session opens"],
  ["XHKG", "2026-09-21T03:59:59Z", "REGULAR", "last morning second"],
  ["XHKG", "2026-09-21T04:00:00Z", "LUNCH", "lunch break starts 12:00 HKT"],
  ["XHKG", "2026-09-21T04:59:59Z", "LUNCH", "last lunch second"],
  ["XHKG", "2026-09-21T05:00:00Z", "REGULAR", "afternoon opens 13:00 HKT"],
  ["XHKG", "2026-09-21T07:59:59Z", "REGULAR", "last afternoon second"],
  ["XHKG", "2026-09-21T08:00:00Z", "POST", "closing auction 16:00 HKT"],
  ["XHKG", "2026-09-21T08:10:00Z", "CLOSED", "after closing auction"],
  ["XHKG", "2026-10-01T02:00:00Z", "CLOSED", "National Day holiday"],
  ["XHKG", "2026-10-19T02:00:00Z", "CLOSED", "day following Chung Yeung"],
  ["XHKG", "2026-12-24T03:59:00Z", "REGULAR", "Christmas Eve half day morning"],
  ["XHKG", "2026-12-24T04:05:00Z", "POST", "half-day closing auction 12:00-12:10 HKT"],
  ["XHKG", "2026-12-24T05:30:00Z", "CLOSED", "no afternoon on a half day"],
  ["XHKG", "2026-11-02T02:00:00Z", "REGULAR", "US DST change does not move HK"],
  ["XHKG", "2026-09-19T02:00:00Z", "CLOSED", "HK Saturday"],
  ["XCOM", "2026-09-20T21:59:59Z", "CLOSED", "Sunday before Globex reopen"],
  ["XCOM", "2026-09-20T22:00:00Z", "REGULAR", "Sunday 18:00 EDT reopen"],
  ["XCOM", "2026-09-21T21:00:00Z", "CLOSED", "daily maintenance break 17:00 EDT"],
  ["XCOM", "2026-09-22T00:00:00Z", "REGULAR", "continuous across UTC midnight"],
  ["XCOM", "2026-09-25T20:59:00Z", "REGULAR", "Friday before 17:00 EDT"],
  ["XCOM", "2026-09-25T21:00:00Z", "CLOSED", "Friday close into weekend"],
  ["XCOM", "2026-11-26T19:30:00Z", "CLOSED", "Thanksgiving halt 14:30 EST"],
  ["XCOM", "2026-11-26T23:00:00Z", "REGULAR", "Thanksgiving evening reopen 18:00 EST"],
  ["XCOM", "2026-12-25T12:00:00Z", "CLOSED", "Christmas"],
];

describe("session at timestamp", () => {
  it("has at least 40 cases", () => expect(CASES.length).toBeGreaterThanOrEqual(40));
  it.each(CASES)("%s %s -> %s (%s)", (m, iso, kind) => {
    expect(segmentAt(m, T(iso)).kind).toBe(kind);
  });
});

describe("closed segments are explained", () => {
  it.each([
    ["XNYS", "2026-09-19T12:00:00Z", "WEEKEND"],
    ["XNYS", "2026-11-26T15:00:00Z", "HOLIDAY"],
    ["XHKG", "2026-10-01T02:00:00Z", "HOLIDAY"],
    ["XHKG", "2026-09-21T10:00:00Z", "OVERNIGHT"],
  ] as const)("%s %s is %s", (m, iso, reason) => {
    expect(segmentAt(m, T(iso)).reason).toBe(reason);
  });
  it("names the holiday", () => {
    expect(segmentAt("XNYS", T("2026-11-26T15:00:00Z")).names).toContain("Thanksgiving Day");
  });
});

describe("timeline", () => {
  it("is contiguous with no gaps or overlaps across a DST change", () => {
    const segs = timeline("XNYS", T("2026-10-28T00:00:00Z"), T("2026-11-05T00:00:00Z"));
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.startMs).toBe(segs[i - 1]!.endMs);
  });
  it("merges Globex sessions across local midnight", () => {
    const segs = timeline("XCOM", T("2026-09-21T00:00:00Z"), T("2026-09-23T00:00:00Z")).filter((s) => s.kind === "REGULAR");
    expect(segs.some((s) => s.endMs - s.startMs === 23 * 3_600_000)).toBe(true);
  });
  it("refuses years it does not cover", () => {
    expect(() => segmentAt("XNYS", T("2028-06-01T15:00:00Z"))).toThrow(/does not cover/);
  });
});

describe("transitions", () => {
  it("HK lunch is a first-class weakening boundary", () => {
    const t = transitions("XHKG", T("2026-09-21T03:00:00Z"))[0]!;
    expect(t).toMatchObject({ type: "LUNCH_BREAK", at: "2026-09-21T04:00:00.000Z", weakening: true });
  });
  it("US close then post close", () => {
    const [a, b] = transitions("XNYS", T("2026-09-21T19:00:00Z"));
    expect(a).toMatchObject({ type: "SESSION_CLOSE", at: "2026-09-21T20:00:00.000Z", weakening: true });
    expect(b).toMatchObject({ type: "POST_CLOSE", at: "2026-09-22T00:00:00.000Z", to: "CLOSED" });
  });
  it("early close is labelled", () => {
    expect(transitions("XNYS", T("2026-11-27T15:00:00Z"))[0]).toMatchObject({ type: "EARLY_CLOSE", at: "2026-11-27T18:00:00.000Z" });
  });
});
