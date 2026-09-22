/** /changelog (V2-10, P2): BUILD_PERIOD.md by day, newest first, as served by /v1/proof. */
import type { Metadata } from "next";
import { ErrorState } from "@/components/ui/ErrorState";
import { buildRows, Inline } from "@/components/kerb/BuildLog";
import { getProof } from "@/lib/api";

export const metadata: Metadata = { title: "Changelog", description: "What was built when, one line per functionality, from BUILD_PERIOD.md." };
export const revalidate = 300;

export default async function ChangelogPage(): Promise<React.ReactElement> {
  const proof = await getProof();
  const rows = proof.ok ? buildRows(proof.data.build.buildPeriodMarkdown) : [];
  const days = [...new Set(rows.map((r) => r.date))].reverse();
  return (
    <div className="changelog">
      <header className="page-head">
        <span className="t-label">Changelog · {rows.length} entries · build period 18 to 25 Sep 2026</span>
        <h1>What was built, and when.</h1>
        <p className="lede">One line per functionality, in UTC, from BUILD_PERIOD.md in the repository. Newest first.</p>
      </header>
      {!proof.ok ? <ErrorState source="The build record" /> : (
        <div className="build-log">
          {days.map((day) => (
            <section key={day}>
              <h2 className="t-label">{day}</h2>
              <ul role="list">
                {rows.filter((r) => r.date === day).reverse().map((r, i) => <li key={i}><span className="mono ink-3">{r.task}</span><span><Inline text={r.what} /></span></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
