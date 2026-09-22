/** DepthSpark (section 9): C(1%) over 24 h with regime bands behind it, last point marked. */
import type { Regime } from "@/lib/api";

const BAND: Partial<Record<Regime, string>> = { REFERENCE_CLOSED: "var(--r-closed)", PRE_TRANSITION: "var(--brass-dim)", STALE: "var(--r-stale)", HALTED: "var(--oxide)", THIN: "var(--stone)" };

export function DepthSpark({ points, width = 96, height = 24, label }: { points: { at: string; c1: string; regime: Regime }[]; width?: number; height?: number; label: string }): React.ReactElement {
  if (points.length < 2) return <span className="t-small ink-3">Not enough posts yet</span>;
  const xs = points.map((p) => Date.parse(p.at));
  const ys = points.map((p) => Number(p.c1)); // geometry only
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys) * 0.96, y1 = Math.max(...ys) * 1.02;
  const X = (t: number): number => ((t - x0) / (x1 - x0 || 1)) * (width - 4) + 2;
  const Y = (v: number): number => height - 2 - ((v - y0) / (y1 - y0 || 1)) * (height - 4);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(xs[i]!).toFixed(1)},${Y(ys[i]!).toFixed(1)}`).join("");
  const last = points.length - 1;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {points.map((p, i) => {
        const fill = BAND[p.regime];
        if (!fill || i === last) return null;
        return <rect key={p.at} x={X(xs[i]!)} y={0} width={Math.max(1, X(xs[i + 1]!) - X(xs[i]!))} height={height} fill={fill} opacity={0.35} />;
      })}
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={X(xs[last]!)} cy={Y(ys[last]!)} r={2.5} fill="var(--ink)" />
    </svg>
  );
}
