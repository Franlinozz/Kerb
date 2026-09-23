/**
 * A number with its provenance. AGENTS.md rule 3: if a number cannot carry a label, it does not ship,
 * and a value that is genuinely missing says so rather than rendering a zero.
 */
import type { ProvenanceLabel } from "@/lib/format";
import { age, utcStamp } from "@/lib/format";

export const PROVENANCE_MEANING: Record<ProvenanceLabel, string> = {
  Verified: "Read from the chain and checked.",
  Observed: "Read from a named source, with a timestamp and a hash of the payload.",
  Attested: "Signed by the Kerb attester and posted on chain inside the contract guardrails.",
  Computed: "Produced by KTS from a published input bundle.",
};

export function Prov({ label }: { label: ProvenanceLabel }): React.ReactElement {
  return <span className={`prov prov-${label}`} title={`${label}. ${PROVENANCE_MEANING[label]}`} aria-label={label} />;
}

export function Value({ value, label, observedAt, ageSec, missing = "not posted", suffix }: {
  value: string | null;
  label: ProvenanceLabel;
  observedAt?: string | null;
  ageSec?: number | null;
  missing?: string;
  suffix?: string;
}): React.ReactElement {
  if (value === null) return <span className="faint">{missing}</span>;
  const title = [
    `${label}. ${PROVENANCE_MEANING[label]}`,
    observedAt ? `Observed ${utcStamp(observedAt)}` : null,
    ageSec !== undefined && ageSec !== null ? `${age(ageSec)} ago` : null,
  ].filter(Boolean).join("\n");
  return (
    <span title={title}>
      {value}
      {suffix ?? ""}
      <Prov label={label} />
    </span>
  );
}

/** A labelled row in a definition list, used by the mark and instrument panels. */
export function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: string }): React.ReactElement {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>
        {children}
        {note ? <div className="faint field-note">{note}</div> : null}
      </dd>
    </div>
  );
}
