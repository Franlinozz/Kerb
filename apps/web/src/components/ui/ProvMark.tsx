"use client";
import { useId, useState } from "react";
import type { ProvenanceLabel } from "@/lib/format";
import { utcStamp } from "@/lib/format";

export const PROVENANCE_MEANING: Record<ProvenanceLabel, string> = {
  Verified: "Read from the chain and checked.",
  Observed: "Read from a named source, with a timestamp and a hash of the payload.",
  Attested: "Signed by the Kerb attester and posted on chain inside the contract guardrails.",
  Computed: "Produced by KTS from a pinned input bundle.",
};

/**
 * The provenance marker. The four labels stay; V2 adds a card on hover and focus with the source,
 * the time and a link. On critical numbers the label is also printed.
 */
export function ProvMark({ label, source, observedAt, href, hrefLabel, printed = false }: {
  label: ProvenanceLabel; source?: string; observedAt?: string | null; href?: string; hrefLabel?: string; printed?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="prov-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className={`prov prov-${label}`} aria-label={`${label}: ${PROVENANCE_MEANING[label]}`} aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)} onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false); }}
        onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      {printed ? <span className="prov-text">{label}</span> : null}
      {open ? (
        <span role="tooltip" id={id} className="prov-card">
          <strong>{label}</strong>
          {PROVENANCE_MEANING[label]}
          {source ? <><span className="t-label">Source</span>{source}</> : null}
          {observedAt ? <><span className="t-label">Observed</span>{utcStamp(observedAt)}</> : null}
          {href ? <><span className="t-label">Check it</span><a href={href} target="_blank" rel="noreferrer">{hrefLabel ?? (/\/tx\//.test(href) ? "The posted transaction on OKLink" : /oklink/.test(href) ? "On OKLink" : "The source")}</a></> : null}
        </span>
      ) : null}
    </span>
  );
}
