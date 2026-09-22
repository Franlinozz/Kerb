/**
 * The compact rail for an inner page, about the page's own subject (V2-05 step 5): an asset page
 * shows that asset, Credit shows the demo clock, everything else shows the two markets. Renders
 * nothing if the clock cannot be read: it is context, not the page's content.
 */
import { getBoard, getClock, getDemoClock } from "@/lib/api";
import { AssetRail, DemoRail, LanesRail } from "./SessionRail";
import { railWindow } from "@/lib/time";

export async function PageRail({ subject }: { subject: { kind: "lanes" } | { kind: "demo" } | { kind: "asset"; symbol: string; compact?: boolean } }): Promise<React.ReactElement | null> {
  const w = railWindow(Date.now());
  if (subject.kind === "demo") {
    const d = await getDemoClock();
    return d.ok ? <div className="page-rail"><DemoRail initial={d.data} /></div> : null;
  }
  if (subject.kind === "asset") {
    const [clock, board] = await Promise.all([getClock(subject.symbol, 196, w), getBoard()]);
    if (!clock.ok) return null;
    const row = board.ok ? board.data.rows.find((r) => r.symbol === subject.symbol) : undefined;
    return <div className="page-rail"><AssetRail symbol={subject.symbol} initial={clock.data} regime={row?.regime.value ?? null} tz={row?.market?.tz ?? clock.data.timezone} compact={subject.compact ?? false} /></div>;
  }
  const [ny, hk] = await Promise.all([getClock("KOx", 196, w), getClock("HKEXCx", 196, w)]);
  if (!ny.ok || !hk.ok) return null;
  return <div className="page-rail"><LanesRail initial={{ ny: ny.data, hk: hk.data }} compact /></div>;
}
