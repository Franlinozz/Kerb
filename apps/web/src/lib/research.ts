import type { MarketTimeReport } from "./api";
import { cmpDecimal, group } from "./format";

/**
 * The next Market-Time Report, as planned (docs/v2/V2-BUILD-PROMPTS.md, V2-09). Shown on /research
 * as a Scheduled row until a report with this id is published, then it disappears on its own.
 */
export const SCHEDULED = {
  id: 2,
  title: "What happened when the X Liquidity incentives ended",
  window: "23 Sep 07:00 to 25 Sep 07:00 UTC, captured across the campaign end at 07:00 on 24 Sep",
  publishAt: "2026-09-24T20:00:00Z",
} as const;

/** The three strongest measured numbers of a report, for its card and its header. */
export function headline(r: MarketTimeReport): { label: string; value: string }[] {
  const readings = { label: `Readings over ${r.window.hours} h`, value: group(String(r.window.observations)) };
  if (r.campaign) {
    // Report #2: the campaign end is the subject, so lead with executable depth across it.
    const rows = r.campaign.rows.filter((x) => x.c1ChangePct !== null);
    const fell = rows.filter((x) => x.c1ChangePct!.startsWith("-") && !/^-0\.00$/.test(x.c1ChangePct!)).length;
    const worst = [...rows].sort((a, b) => cmpDecimal(a.c1ChangePct!, b.c1ChangePct!))[0];
    return [
      { label: "Assets whose C(1%) fell across the campaign end", value: `${fell} of ${rows.length}` },
      { label: worst ? `Largest C(1%) change · ${worst.symbol}` : "Largest C(1%) change", value: worst ? `${worst.c1ChangePct}%` : "Not measured" },
      readings,
    ];
  }
  const assets = r.pools.filter((p) => p.role === "asset" && p.changePct !== null);
  const fell = assets.filter((p) => p.changePct!.startsWith("-")).length;
  const worst = [...assets].sort((a, b) => cmpDecimal(a.changePct!, b.changePct!))[0];
  return [
    { label: "Asset pools that lost in-range liquidity", value: `${fell} of ${assets.length}` },
    { label: worst ? `Largest fall · ${worst.symbol}` : "Largest fall", value: worst ? `${worst.changePct}%` : "Not measured" },
    readings,
  ];
}
