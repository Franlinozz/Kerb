/**
 * Exit check (V3-06): Kerb's tick-walk C(1%) beside the OKX DEX quote at the same notionals, which
 * of the two bounds the capacity, how old the quote was, and the record of the last 72 hours as a
 * strip of dots (filled where OKX bound it). A stale quote says stale; an unavailable one says why.
 */
import { ProvMark } from "@/components/ui/ProvMark";
import type { ExitCheck } from "@/lib/api";
import { usd } from "@/lib/format";

const STALE_SEC = 300;
const pctS = (d: string | null): string => (d === null ? "Not measured" : `${(Number(d) * 100).toFixed(2)}%`); // display only

export function ExitCheckPanel({ exit }: { exit: ExitCheck | null }): React.ReactElement {
  if (!exit) return <section className="exit-check"><span className="t-label">Exit check</span><p className="t-small ink-3 mt-3">The exit check record could not be read right now.</p></section>;
  const l = exit.latest, s = exit.summary;
  if (!l) return <section className="exit-check"><span className="t-label">Exit check</span><p className="t-small ink-3 mt-3">No exit check recorded in the last {exit.hours} hours.</p></section>;
  const stale = l.quoteAgeSec !== null && l.quoteAgeSec > STALE_SEC;
  const src = `Posted in ${l.tx.slice(0, 10)}, input bundle ${l.inputsHash.slice(0, 10)}`;
  return (
    <section className="exit-check" aria-labelledby="exit-title">
      <div className="row between"><span className="t-label" id="exit-title">Exit check · C(1%) measured two ways</span><span className="t-small ink-3">{l.at.slice(5, 16).replace("T", " ")} UTC</span></div>
      {l.bound === "unavailable" ? (
        <p className="ink-2 mt-3">The OKX DEX cross-check was not available for the latest post: {l.unavailableReason}. Capacity uses the tick-walk alone ({usd(l.usedC1)}). <ProvMark label="Computed" source={src} observedAt={l.at} href={l.explorer} /></p>
      ) : (
        <dl className="exit-grid mt-4">
          <div><dt className="t-label">Kerb tick-walk</dt><dd className="t-num-l">{usd(l.simulatedC1)}</dd></div>
          <div><dt className="t-label">OKX DEX quote</dt><dd className="t-num-l">{usd(l.quotedC1)}</dd>{stale ? <dd className="t-small oxide">Stale: quote {Math.round((l.quoteAgeSec ?? 0) / 60)} min old</dd> : null}</div>
          <div><dt className="t-label">Difference</dt><dd className="t-num-l">{pctS(l.delta)}</dd></div>
          <div><dt className="t-label">Capacity used</dt><dd className="t-num-l">{usd(l.usedC1)} <ProvMark label="Computed" source={src} observedAt={l.at} href={l.explorer} /></dd><dd className="t-small ink-3">Bounded by {l.bound === "okx-quote" ? "the OKX DEX quote" : "the tick-walk"}</dd></div>
        </dl>
      )}
      <p className="t-small ink-3 mt-3">{l.router ? `Route ${l.router}. ` : ""}{l.quoteAgeSec !== null ? `Quote ${l.quoteAgeSec} s older than the pool reading. ` : ""}The smaller figure is used whenever the two differ by more than 25%.</p>
      <p className="t-small ink-2 mt-4">Last {exit.hours} h: {s.checks.toLocaleString("en-US")} checks, OKX bound the capacity {s.okxBound} {s.okxBound === 1 ? "time" : "times"}, median difference {pctS(s.medianDelta)}, largest {pctS(s.maxDelta)}{s.unavailable ? `, ${s.unavailable} unavailable (${Object.entries(s.unavailableReasons).map(([r, n]) => `${n} ${r}`).join("; ")})` : ""}.</p>
      <div className="exit-strip" role="img" aria-label={`${s.checks} exit checks, ${s.okxBound} bound by the OKX quote`}>
        {[...exit.strip].reverse().map((d) => <i key={d.at} data-bound={d.bound} title={`${d.at.slice(5, 16).replace("T", " ")} UTC: ${d.bound === "okx-quote" ? "OKX bound" : d.bound === "unavailable" ? "unavailable" : "tick-walk bound"}`} />)}
      </div>
    </section>
  );
}
