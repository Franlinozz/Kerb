"use client";
/**
 * "What changed" (V3-04): every material term change in the last 72 hours, newest first, with the
 * cause computed from the two posts' input bundles. Chips filter by field. Empty is said plainly.
 */
import { useState } from "react";
import { ProvMark } from "@/components/ui/ProvMark";
import type { TermChange } from "@/lib/api";

const CHIPS: { id: TermChange["field"] | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "carryLTV", label: "Carry" }, { id: "sessionMaxLTV", label: "Session Max" }, { id: "debtCeiling", label: "Ceiling" }, { id: "regime", label: "Regime" },
];
const FIELD: Record<TermChange["field"], string> = { carryLTV: "Carry", sessionMaxLTV: "Session Max", debtCeiling: "Ceiling", regime: "Regime" };

export function ChangeTimeline({ changes, hours = 72 }: { changes: TermChange[] | null; hours?: number }): React.ReactElement {
  const [f, setF] = useState<TermChange["field"] | "all">("all");
  const [all, setAll] = useState(false);
  if (changes === null) return <p className="t-small ink-3">The change record could not be read right now.</p>;
  const rows = changes.filter((c) => f === "all" || c.field === f);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <section className="change-tl" aria-label="What changed">
      <div className="row between">
        <span className="t-label">What changed · last {hours} h · {changes.length} {changes.length === 1 ? "change" : "changes"}</span>
        <div className="chip-row" role="group" aria-label="Filter by term">
          {CHIPS.map((c) => <button key={c.id} type="button" className="chip-filter" aria-pressed={f === c.id} onClick={() => setF(c.id)}>{c.label}</button>)}
        </div>
      </div>
      {shown.length === 0 ? <p className="t-small ink-3 mt-3">{changes.length === 0 ? `No material change in the last ${hours} hours: Carry and Session Max moved less than 0.05 points, the ceiling less than 1%, and the regime held.` : "No change of this kind in the window."}</p> : (
        <ol className="change-list">
          {shown.map((c) => (
            <li key={`${c.tx}${c.field}`}>
              <span className="change-when ink-3 mono">{c.at.slice(5, 16).replace("T", " ")} UTC</span>
              <span className="change-field t-label">{FIELD[c.field]}</span>
              <p>{c.headline}{c.residual ? ` Rounding and other inputs: ${c.residual}.` : ""} <ProvMark label="Computed" source={`Attributed from input bundle ${c.inputsHash.slice(0, 10)} against the post before it`} observedAt={c.at} href={c.explorer} hrefLabel="The post that made this change" /></p>
            </li>
          ))}
        </ol>
      )}
      {rows.length > 12 ? <button type="button" className="btn btn-sm mt-3" onClick={() => setAll((a) => !a)}>{all ? "Show twelve" : `Show all ${rows.length}`}</button> : null}
    </section>
  );
}
