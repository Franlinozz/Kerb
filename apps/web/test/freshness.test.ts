import { describe, expect, it } from "vitest";
import { age, freshness, liveLine, parseAsOf, REFRESH_GRACE_MS, STALE_AFTER_MS } from "../src/lib/freshness";

const NOW = Date.parse("2026-09-23T10:50:00Z");

describe("freshness (L-01)", () => {
  it("is fresh under 90 s, and when there is no stamp to judge by", () => {
    expect(freshness({ asOfMs: NOW - STALE_AFTER_MS, nowMs: NOW, failed: false, refreshStartedMs: null })).toBe("fresh");
    expect(freshness({ asOfMs: null, nowMs: NOW, failed: true, refreshStartedMs: null })).toBe("fresh");
  });
  it("refreshes a stale payload, then admits it is the last known value", () => {
    const old = NOW - 2 * 3600_000;
    expect(freshness({ asOfMs: old, nowMs: NOW, failed: false, refreshStartedMs: null })).toBe("refreshing");
    expect(freshness({ asOfMs: old, nowMs: NOW, failed: false, refreshStartedMs: NOW - 1000 })).toBe("refreshing");
    expect(freshness({ asOfMs: old, nowMs: NOW, failed: false, refreshStartedMs: NOW - REFRESH_GRACE_MS })).toBe("lastKnown");
    expect(freshness({ asOfMs: old, nowMs: NOW, failed: true, refreshStartedMs: NOW })).toBe("lastKnown");
  });
  it("words", () => {
    expect(age(12_000)).toBe("12s");
    expect(age((2 * 3600 + 17 * 60) * 1000)).toBe("2h 17m");
    expect(liveLine("lastKnown", NOW - 8_220_000, NOW)).toBe("Last known, 2h 17m old");
    expect(liveLine("fresh", NOW - 12_000, NOW)).toBe("Updated 12s ago");
    expect(liveLine("refreshing", NOW - 1, NOW)).toBe("Refreshing live data");
    expect(parseAsOf("nope")).toBeNull();
  });
});
