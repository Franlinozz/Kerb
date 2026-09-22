import { describe, expect, it } from "vitest";
import { centredWindow, clip, countdown, dayColumns, demoSegments, pct, weekWindow } from "../src/lib/time";

const T = (iso: string): number => Date.parse(iso);

describe("time geometry", () => {
  it("pct clamps to the window", () => {
    expect(pct(50, 0, 100)).toBe(50);
    expect(pct(-5, 0, 100)).toBe(0);
    expect(pct(500, 0, 100)).toBe(100);
    expect(pct(5, 10, 10)).toBe(0);
  });

  it("clip trims segments to the window and drops ones outside it", () => {
    expect(clip(-10, 30, 0, 100)).toEqual({ left: 0, width: 30 });
    expect(clip(90, 150, 0, 100)).toEqual({ left: 90, width: 10 });
    expect(clip(120, 150, 0, 100)).toBeNull();
    expect(clip(40, 40, 0, 100)).toBeNull();
  });

  it("labels each day at the centre of its column, not on the midnight tick", () => {
    const from = T("2026-09-21T00:00:00Z"), to = T("2026-09-28T00:00:00Z");
    const cols = dayColumns(from, to);
    expect(cols.map((c) => c.label)).toEqual(["MON 21", "TUE 22", "WED 23", "THU 24", "FRI 25", "SAT 26", "SUN 27"]);
    // Monday's label sits in the middle of Monday.
    expect(cols[0]!.centre).toBeCloseTo(100 / 14, 6);
    // A New York session (13:30 to 20:00 UTC Monday) falls entirely inside Monday's column.
    const ny = clip(T("2026-09-21T13:30:00Z"), T("2026-09-21T20:00:00Z"), from, to)!;
    expect(ny.left).toBeGreaterThan(cols[0]!.left);
    expect(ny.left + ny.width).toBeLessThan(cols[0]!.left + cols[0]!.width);
  });

  it("centres a partial first day on its visible part", () => {
    const cols = dayColumns(T("2026-09-21T12:00:00Z"), T("2026-09-23T12:00:00Z"));
    expect(cols[0]).toMatchObject({ label: "MON 21", full: false });
    expect(cols[0]!.centre).toBeCloseTo(12.5, 6);
  });

  it("countdown is never negative and never a dash", () => {
    const now = T("2026-09-21T19:00:00Z");
    expect(countdown(now + 3 * 3600_000 + 5 * 60_000, now)).toBe("3h 05m");
    expect(countdown(now + 65_000, now)).toBe("1m 05s");
    expect(countdown(now + 2 * 86_400_000 + 3_600_000, now)).toBe("2d 1h");
    for (const past of [0, -1, -60_000, -86_400_000]) expect(countdown(now + past, now)).toBe("Updating");
    expect(countdown(Number.NaN, now)).toBe("Updating");
    for (let ms = -5000; ms < 5000; ms += 250) expect(countdown(now + ms, now)).not.toMatch(/-|—/);
  });

  it("windows: a week from Monday, and a centred window for phones", () => {
    const w = weekWindow(T("2026-09-24T10:00:00Z"));
    expect(new Date(w.fromMs).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(w.toMs - w.fromMs).toBe(7 * 86_400_000);
    const c = centredWindow(T("2026-09-24T10:00:00Z"), 72);
    expect(new Date(c.fromMs).toISOString()).toBe("2026-09-22T22:00:00.000Z");
  });

  it("the demo cycle puts Last Call inside the session and closed after it", () => {
    const d = demoSegments({ cycleStartedAt: "2026-09-21T19:13:58.000Z", weekLengthSec: 3600, cureStartSec: 2400, sessionEndSec: 3000 });
    expect(d.toMs - d.fromMs).toBe(3_600_000);
    expect(d.lastCall.startMs - d.fromMs).toBe(2_400_000);
    expect(d.lastCall.endMs).toBe(d.segments[0]!.endMs);
    expect(d.segments[1]!.kind).toBe("CLOSED");
  });
});
