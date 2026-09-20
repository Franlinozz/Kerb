import Link from "next/link";
import { SessionStrip } from "@/components/SessionStrip";
import { BoardTable } from "@/components/BoardTable";
import { getBoard, getClock } from "@/lib/api";
import { byDecimalDesc } from "@/lib/format";
import { SourceTrouble } from "@/components/States";

export const dynamic = "force-dynamic";

export default async function Home(): Promise<React.ReactElement> {
  const board = await getBoard();
  // The strip leads with the asset carrying the largest debt ceiling, which is the one that matters most.
  const lead = board.ok
    ? [...board.data.rows].sort(byDecimalDesc((r) => r.debtCeiling.value))[0]
    : undefined;
  const clock = lead ? await getClock(lead.symbol) : null;

  return (
    <>
      {clock?.ok && lead ? (
        <SessionStrip clock={clock.data} regime={lead.regime.value} />
      ) : (
        <SourceTrouble what="the Clock" detail={clock && !clock.ok ? clock.error : "no asset to show yet"} />
      )}

      <p className="lede">
        Kerb reads the session the underlying market is actually in, the depth you could actually sell into on
        X Layer, and how fresh the price sources are, then turns all three into credit terms anyone can
        recompute. <strong>Never lend more than you can liquidate.</strong>
      </p>

      <section className="section">
        <div className="rowbar">
          <h2>Board</h2>
          <Link href="/board" className="dim">All {board.ok ? board.data.rows.length : ""} assets</Link>
        </div>
        <p className="section-note">
          Live terms posted on X Layer mainnet. Every number carries the provenance marker it was published with.
        </p>
        {board.ok ? (
          <BoardTable rows={[...board.data.rows].sort(byDecimalDesc((r) => r.debtCeiling.value)).slice(0, 3)} />
        ) : (
          <SourceTrouble what="the Board" detail={board.error} />
        )}
      </section>
    </>
  );
}
