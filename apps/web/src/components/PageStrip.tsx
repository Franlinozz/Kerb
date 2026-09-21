/**
 * The Session Strip as page furniture.
 *
 * ARCHITECTURE.md section 9: the strip appears on every page, because market time is the thing
 * this product is about and a reader should never be more than a glance from knowing what the
 * clock is doing. Pages that lead with their own asset render the strip themselves; every other
 * page gets this compact one, led by whichever asset currently carries the most capacity.
 *
 * If the clock cannot be read, this renders nothing. A page about developer documentation does
 * not need an error banner about a session it was only showing as context.
 */
import { SessionStrip } from "./SessionStrip";
import { getBoard, getClock } from "@/lib/api";
import { byDecimalDesc } from "@/lib/format";

export async function PageStrip(): Promise<React.ReactElement | null> {
  const board = await getBoard();
  if (!board.ok || board.data.rows.length === 0) return null;
  const lead = [...board.data.rows].sort(byDecimalDesc((r) => r.debtCeiling.value))[0];
  if (!lead) return null;
  const clock = await getClock(lead.symbol);
  if (!clock.ok) return null;
  return (
    <div className="page-strip">
      <SessionStrip clock={clock.data} regime={lead.regime.value} compact />
      <p className="faint page-strip-note">
        {lead.symbol} · the asset currently carrying the most capacity. <a href={`/asset/${lead.symbol}`}>See it →</a>
      </p>
    </div>
  );
}
