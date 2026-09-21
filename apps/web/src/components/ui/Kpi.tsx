import type { ReactNode } from "react";
import type { ProvenanceLabel } from "@/lib/format";
import { ProvMark } from "./ProvMark";

/** Tracked label, value, unit, ProvMark. Never a KPI without a source. */
export function Kpi({ label, value, unit, prov, source, observedAt, href, delta, size = "l", missing = "Not yet posted" }: {
  label: string; value: string | null; unit?: string; prov: ProvenanceLabel; source: string; observedAt?: string | null; href?: string;
  delta?: ReactNode; size?: "l" | "xl"; missing?: string;
}): React.ReactElement {
  return (
    <div className="kpi">
      <span className="t-label">{label}</span>
      <span className="kpi-value">
        {value === null ? <span className="t-body ink-3">{missing}</span> : <span className={size === "xl" ? "t-num-xl" : "t-num-l"}>{value}</span>}
        {value !== null && unit ? <span className="kpi-unit">{unit}</span> : null}
        <ProvMark label={prov} source={source} observedAt={observedAt ?? null} {...(href ? { href } : {})} />
      </span>
      {delta ? <span className="kpi-delta">{delta}</span> : null}
    </div>
  );
}
