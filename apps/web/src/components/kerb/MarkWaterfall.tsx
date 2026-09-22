/**
 * MarkWaterfall (section 9): reference median, pool price, the lower of the two, the regime
 * haircut, and the Credit Mark with its band, as a step diagram on one shared price scale.
 */
import type { Report } from "@/lib/api";
import { price, round, shift } from "@/lib/format";

export function MarkWaterfall({ mark, regime }: { mark: Report["mark"]; regime: string }): React.ReactElement {
  const ref = mark.reference.value, pool = mark.pool.value;
  const lower = Number(ref) <= Number(pool) ? ref : pool; // choosing, not computing: both are strings from the report
  const values = [ref, pool, lower, mark.creditMark, mark.band[0], mark.band[1]].map(Number);
  const lo = Math.min(...values) * 0.995, hi = Math.max(...values) * 1.002;
  const at = (v: string): number => ((Number(v) - lo) / (hi - lo)) * 100; // geometry only
  const rows = [
    { label: "Reference median", value: ref, note: `${mark.reference.usedSources?.join(", ") ?? mark.reference.sources.join(", ")}${mark.reference.excluded?.length ? `. Excluded: ${mark.reference.excluded.map((e) => `${e.source} (${e.reason})`).join("; ")}` : ""}` },
    { label: mark.pool.basis === "twap" ? `Pool TWAP (${mark.pool.twapWindowSec ?? 0}s)` : "Pool price (spot)", value: pool, note: mark.pool.sources.join(", ") },
    { label: "Lower of the two", value: lower, note: "The mark never takes the higher price." },
    { label: `Regime haircut (${regime.toLowerCase().replace(/_/g, " ")})`, value: mark.creditMark, note: `${round(shift(mark.haircut, 2), 2)}% taken off for the regime` },
  ];
  return (
    <div className="waterfall">
      {rows.map((r) => (
        <div key={r.label} className="wf-row">
          <span className="wf-label t-label">{r.label}</span>
          <span className="wf-track"><span className="wf-bar" style={{ width: `${Math.max(2, at(r.value))}%` }} /></span>
          <span className="wf-value num">{price(r.value)}</span>
          <span className="wf-note t-small ink-3">{r.note}</span>
        </div>
      ))}
      <div className="wf-row wf-final">
        <span className="wf-label t-label">Credit Mark</span>
        <span className="wf-track">
          <span className="wf-band" style={{ left: `${at(mark.band[0])}%`, width: `${Math.max(0.5, at(mark.band[1]) - at(mark.band[0]))}%` }} />
          <span className="wf-bar wf-bar-final" style={{ width: `${Math.max(2, at(mark.creditMark))}%` }} />
        </span>
        <span className="wf-value num">{price(mark.creditMark)}</span>
        <span className="wf-note t-small ink-3">Band {price(mark.band[0])} to {price(mark.band[1])}. Dispersion between sources {round(shift(mark.dispersion, 2), 2)}%{mark.dispersionBreach ? ", above the guard: the regime is forced to Stale" : ""}.</span>
      </div>
    </div>
  );
}
