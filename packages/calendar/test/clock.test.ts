import { describe, expect, it } from "vitest";
import { resolveAssetClock, resolveClock } from "../src/index.js";

const T = (iso: string): number => Date.parse(iso);

describe("resolveClock", () => {
  it("US Friday afternoon: cure window opens one hour before the close, horizon runs to Monday open", () => {
    const c = resolveClock({ market: "XNYS", atMs: T("2026-09-25T19:10:00Z") });
    expect(c.session.kind).toBe("REGULAR");
    expect(c.nextWeakening).toMatchObject({ type: "SESSION_CLOSE", at: "2026-09-25T20:00:00.000Z" });
    expect(c.nextReferenceClosed.at).toBe("2026-09-26T00:00:00.000Z");
    expect(c.nextMainOpen.at).toBe("2026-09-28T13:30:00.000Z");
    expect(c.cureWindow).toMatchObject({ opensAt: "2026-09-25T19:00:00.000Z", closesAt: "2026-09-25T20:00:00.000Z", open: true });
    expect(c.horizonHours).toBe("66.3333");
  });

  it("HK morning: the lunch break is the next weakening and the 30 minute cure window opens at 11:30 HKT", () => {
    const c = resolveClock({ market: "XHKG", atMs: T("2026-09-21T03:40:00Z") });
    expect(c.nextWeakening).toMatchObject({ type: "LUNCH_BREAK", at: "2026-09-21T04:00:00.000Z" });
    expect(c.cureWindow).toMatchObject({ opensAt: "2026-09-21T03:30:00.000Z", open: true });
    expect(c.nextMainOpen.at).toBe("2026-09-21T05:00:00.000Z");
    expect(c.horizonHours).toBe("1.3333");
  });

  it("HK lunch: reference is not closed but not in main session; next weakening is the afternoon close", () => {
    const c = resolveClock({ market: "XHKG", atMs: T("2026-09-21T04:30:00Z") });
    expect(c.session.kind).toBe("LUNCH");
    expect(c.inMainSession).toBe(false);
    expect(c.referenceClosed).toBe(false);
    expect(c.nextTransition).toMatchObject({ type: "LUNCH_END", at: "2026-09-21T05:00:00.000Z" });
    expect(c.nextWeakening).toMatchObject({ type: "SESSION_CLOSE", at: "2026-09-21T08:00:00.000Z" });
    expect(c.cureWindow.open).toBe(false);
  });

  it("weekend: reference closed, last main open recorded, horizon to the next close's following open", () => {
    const c = resolveClock({ market: "XNYS", atMs: T("2026-09-19T12:00:00Z") });
    expect(c.referenceClosed).toBe(true);
    expect(c.session.reason).toBe("WEEKEND");
    expect(c.nextTransition).toMatchObject({ type: "PRE_OPEN", at: "2026-09-21T08:00:00.000Z" });
    expect(c.lastMainOpen).toBe("2026-09-18T13:30:00.000Z");
  });

  it("holiday half day in HK closes early and names itself", () => {
    const c = resolveClock({ market: "XHKG", atMs: T("2026-12-24T03:00:00Z") });
    expect(c.nextWeakening).toMatchObject({ type: "EARLY_CLOSE", at: "2026-12-24T04:00:00.000Z" });
    expect(c.session.names).toContain("Christmas Eve");
  });

  it("per-asset cure window overrides the market default", () => {
    const c = resolveAssetClock({ underlying: { market: "XNYS" } }, T("2026-09-21T19:40:00Z"), 900);
    expect(c.cureWindow).toMatchObject({ lengthSec: 900, opensAt: "2026-09-21T19:45:00.000Z", open: false });
  });

  it("is a pure function of its inputs", () => {
    const a = resolveClock({ market: "XHKG", atMs: T("2026-09-21T03:40:00Z") });
    const b = resolveClock({ market: "XHKG", atMs: T("2026-09-21T03:40:00Z") });
    expect(a).toEqual(b);
  });
});
