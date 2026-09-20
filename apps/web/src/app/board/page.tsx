import type { Metadata } from "next";
import { BoardTable } from "@/components/BoardTable";
import { SourceTrouble, Stale } from "@/components/States";
import { getBoard, getClock } from "@/lib/api";
import { SessionStrip } from "@/components/SessionStrip";
import { age, byDecimalDesc, utcStamp } from "@/lib/format";

export const metadata: Metadata = { title: "Board" };
export const dynamic = "force-dynamic";

export default async function BoardPage(): Promise<React.ReactElement> {
  const board = await getBoard();
  if (!board.ok) {
    return (
      <>
        <h1>Board</h1>
        <SourceTrouble what="the Board" detail={board.error} />
      </>
    );
  }

  const rows = [...board.data.rows].sort(byDecimalDesc((r) => r.debtCeiling.value));
  const lead = rows[0];
  const clock = lead ? await getClock(lead.symbol) : null;
  const unhealthy = (board.data.sources ?? []).filter((s) => !s.healthy);
  const staleRows = rows.filter((r) => r.status !== "live");

  return (
    <>
      {clock?.ok && lead ? <SessionStrip clock={clock.data} regime={lead.regime.value} compact /> : null}

      <div className="rowbar" style={{ marginTop: 22 }}>
        <h1>Board</h1>
        <span className="faint">
          Chain {board.data.chainId} · loan asset {board.data.loanAsset} · generated {utcStamp(board.data.generatedAt)}
        </span>
      </div>
      <p className="section-note">
        Every asset Kerb tracks, with the terms currently posted on chain. Click a column to sort. Hover any
        number for its provenance and the time it was observed.
      </p>

      {staleRows.length > 0 ? (
        <Stale
          what={`${staleRows.length} ${staleRows.length === 1 ? "asset" : "assets"}`}
          ageText={age(staleRows[0]?.reportAgeSec ?? null)}
        />
      ) : null}

      <BoardTable rows={rows} />

      <section className="section">
        <h2>Sources</h2>
        <p className="section-note">
          What Kerb is reading right now, and how old the last observation from each is. A source that stops is
          shown as down rather than quietly dropped.
        </p>
        <p className="scroll-hint">Scroll the table sideways for age and state.</p>
        <div className="scroll-x">
          <table className="sources">
            <thead>
              <tr>
                <th>Source</th>
                <th>Last observation</th>
                <th className="num">Age</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {(board.data.sources ?? []).map((s) => (
                <tr key={s.name}>
                  <td className="mono">{s.name}</td>
                  <td className="dim">{s.lastObservedAt ? utcStamp(s.lastObservedAt) : "never"}</td>
                  <td className="num">{age(s.ageSec)}</td>
                  <td>
                    {s.healthy ? (
                      <span className="dim">reporting</span>
                    ) : (
                      <span className="badge badge-warn">not reporting</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {unhealthy.length > 0 ? (
          <p className="section-note" style={{ marginTop: 10 }}>
            {unhealthy.length} of {(board.data.sources ?? []).length} sources are not reporting. Kerb keeps
            publishing from the sources that are, and forces the regime to Stale for any asset whose mark
            depended on one that is not.
          </p>
        ) : null}
      </section>
    </>
  );
}
