import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExitCheckPanel } from "../src/components/kerb/ExitCheckPanel";
import type { ExitCheck } from "../src/lib/api";

const base: ExitCheck = {
  chainId: 196, symbol: "KOx", hours: 72, label: "Computed", generatedAt: "2026-09-23T12:00:00Z",
  latest: { at: "2026-09-23T11:58:00Z", tx: "0xabc0000000", explorer: "https://www.oklink.com/xlayer/tx/0xabc", inputsHash: "0xdef0000000", simulatedC1: "12343.10", quotedC1: "12411.90", usedC1: "12343.10", delta: "0.0055", bound: "tick-walk", unavailableReason: null, quoteAgeSec: 4, router: "Uniswap V3:100%", source: "okx-dex:v6-quote" },
  summary: { checks: 431, okxBound: 3, medianDelta: "0.004", maxDelta: "0.31", unavailable: 0, unavailableReasons: {} },
  strip: [{ at: "2026-09-23T11:58:00Z", bound: "tick-walk" }, { at: "2026-09-23T11:48:00Z", bound: "okx-quote" }],
};
const html = (e: ExitCheck | null): string => renderToStaticMarkup(<ExitCheckPanel exit={e} />);

describe("exit check panel (V3-06)", () => {
  it("normal: both measurements, the bound, the 72 h line and the strip", () => {
    const h = html(base);
    expect(h).toContain("Kerb tick-walk");
    expect(h).toContain("OKX DEX quote");
    expect(h).toContain("Bounded by the tick-walk");
    expect(h).toContain("OKX bound the capacity 3 times");
    expect(h.match(/data-bound=/g)?.length).toBe(2);
    expect(h).not.toMatch(/Stale/);
  });
  it("stale quote says stale", () => {
    expect(html({ ...base, latest: { ...base.latest!, quoteAgeSec: 900 } })).toMatch(/Stale: quote 15 min old/);
  });
  it("unavailable says why, and never shows a zero", () => {
    const h = html({ ...base, latest: { ...base.latest!, bound: "unavailable", simulatedC1: null, quotedC1: null, delta: null, unavailableReason: "OKX DEX quote API did not answer" } });
    expect(h).toContain("was not available for the latest post: OKX DEX quote API did not answer");
    expect(h).not.toMatch(/\$0\b/);
  });
  it("no record and no read are plain states", () => {
    expect(html(null)).toContain("could not be read");
    expect(html({ ...base, latest: null })).toContain("No exit check recorded");
  });
});
