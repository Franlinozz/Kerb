import { LiveRoot } from "@/components/kerb/LiveRoot";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardView } from "@/components/kerb/BoardView";
import { ErrorState } from "@/components/ui/ErrorState";
import { getBoard, getClock } from "@/lib/api";
import { byDecimalDesc } from "@/lib/format";
import { railWindow } from "@/lib/time";

export const metadata: Metadata = { title: "Board", description: "What each tokenized stock can safely support right now: regime, Credit Mark, executable depth and terms, live from X Layer." };
export const revalidate = 15;

export default async function BoardPage(): Promise<React.ReactElement> {
  const board = await getBoard();
  if (!board.ok) return <ErrorState source="The Board" />;
  const lead = [...board.data.rows].sort(byDecimalDesc((r) => r.debtCeiling.value))[0];
  const clock = lead ? await getClock(lead.symbol, 196, railWindow(Date.now())) : null;
  return (
    <LiveRoot asOf={board.data.generatedAt}>
      <Suspense>
        <BoardView initial={board.data} initialClock={clock?.ok ? clock.data : null} />
      </Suspense>
    </LiveRoot>
  );
}
