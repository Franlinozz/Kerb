/**
 * Horizontal diverging bars for a percentage change (Research, section 11.5): sorted, falls in
 * oxide to the left of zero, rises in moss to the right, one shared scale, the value printed in
 * ink beside every bar. Geometry only uses floats; the printed values are the report's own strings.
 */
import { cmpDecimal } from "@/lib/format";

export interface BarRow { key: string; label: string; sub?: string; value: string | null; href?: string }

export function DivergingBars({ rows, caption }: { rows: BarRow[]; caption: string }): React.ReactElement {
  const measured = rows.filter((r) => r.value !== null).sort((a, b) => cmpDecimal(a.value!, b.value!));
  const missing = rows.filter((r) => r.value === null);
  const max = Math.max(1, ...measured.map((r) => Math.abs(Number(r.value))));
  return (
    <figure className="dbars" aria-label={caption}>
      <div className="dbar dbars-axis t-small ink-3" aria-hidden="true"><span /><span className="dbars-scale"><span>−{max.toFixed(0)}%</span><span>0</span><span>+{max.toFixed(0)}%</span></span><span /></div>
      <ul role="list">
        {[...measured, ...missing].map((r) => {
          const v = r.value === null ? null : Number(r.value);
          const w = v === null ? 0 : (Math.abs(v) / max) * 50;
          const fall = v !== null && v < 0;
          return (
            <li key={r.key} className="dbar" title={r.value === null ? `${r.label}: not measured` : `${r.label}: ${r.value}%`}>
              <span className="dbar-label">{r.href ? <a href={r.href}>{r.label}</a> : r.label}{r.sub ? <span className="t-small ink-3"> {r.sub}</span> : null}</span>
              <span className="dbar-track" aria-hidden="true">
                <span className="dbar-zero" />
                {v !== null ? <span className={`dbar-fill ${fall ? "is-fall" : "is-rise"}`} style={fall ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }} /> : null}
              </span>
              <span className="dbar-value mono">{r.value === null ? "Not measured" : `${fall || v === 0 ? "" : "+"}${r.value}%`}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
