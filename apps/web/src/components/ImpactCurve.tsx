/**
 * The impact curve: what a sale of a given size would actually realise, walked tick by tick
 * through the real pool state Kerb observed. Inline SVG, no chart library, legible in both themes.
 *
 * The x axis is notional sold, the y axis is price impact. C(1%) is marked because that is the
 * number the debt ceiling is built from.
 */
import type { CurvePoint, Venue } from "@/lib/api";
import { compact, round, shift } from "@/lib/format";

const W = 560;
const H = 210;
const PAD = { top: 16, right: 22, bottom: 30, left: 46 };

/** log10 of a positive decimal string, good enough for axis placement (never a value path). */
function logScale(v: string): number {
  const n = Number(v);
  return n > 0 ? Math.log10(n) : 0;
}

export function ImpactCurve({ venue, c1 }: { venue: Venue; c1: string }): React.ReactElement {
  const points = venue.curve.filter((p) => p.filled);
  if (points.length < 2) {
    return (
      <div className="empty">
        This venue could not fill two points on the notional ladder from the liquidity Kerb observed, so there
        is no curve to draw. The excluded venues below say why.
      </div>
    );
  }

  const xs = points.map((p) => logScale(p.notional));
  const ys = points.map((p) => Number(p.impact));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  // Leave headroom so the final point never sits on the frame.
  const yMax = Math.max(...ys, 0.01) * 1.08;

  const px = (v: number): number => PAD.left + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right);
  const py = (v: number): number => H - PAD.bottom - (v / yMax) * (H - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${px(logScale(p.notional)).toFixed(1)} ${py(Number(p.impact)).toFixed(1)}`).join(" ");
  const c1x = px(logScale(c1));

  const yTicks = [0, yMax / 2, yMax];
  const c1Label = c1x > W - 120 ? c1x - 6 : c1x + 4;
  const c1Anchor = c1x > W - 120 ? "end" : "start";

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(points, c1)} preserveAspectRatio="xMidYMid meet">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} y1={py(t)} x2={W - PAD.right} y2={py(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 6} y={py(t) + 3.5} textAnchor="end" className="chart-tick">
              {round(shift(String(t), 2), 2)}%
            </text>
          </g>
        ))}

        {/* C(1%): the notional the debt ceiling is built from. */}
        {c1x >= PAD.left && c1x <= W - PAD.right ? (
          <g>
            <line x1={c1x} y1={PAD.top} x2={c1x} y2={H - PAD.bottom} stroke="var(--accent-lastcall)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={c1Label} y={PAD.top + 3} textAnchor={c1Anchor} className="chart-tick" fill="var(--accent-lastcall)">
              C(1%) {compact(c1)}
            </text>
          </g>
        ) : null}

        <path d={path} fill="none" stroke="var(--tone-deep)" strokeWidth="1.8" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.notional} cx={px(logScale(p.notional))} cy={py(Number(p.impact))} r="2.6" fill="var(--tone-deep)">
            <title>{`Sell ${compact(p.notional)}: impact ${round(shift(p.impact, 2), 3)}%, realised ${round(p.realisedPrice, 4)}`}</title>
          </circle>
        ))}

        {points.map((p, i) =>
          i % 2 === 0 ? (
            <text key={`x${p.notional}`} x={px(logScale(p.notional))} y={H - PAD.bottom + 14} textAnchor="middle" className="chart-tick">
              {compact(p.notional, 0)}
            </text>
          ) : null,
        )}
        <text x={PAD.left} y={H - 4} className="chart-axis">notional sold</text>
        <text x={W - PAD.right} y={H - 4} textAnchor="end" className="chart-axis">price impact</text>
      </svg>
    </figure>
  );
}

function describe(points: CurvePoint[], c1: string): string {
  const first = points[0];
  const last = points[points.length - 1];
  return `Impact curve: selling ${compact(first?.notional ?? "0")} moves the price ${round(shift(first?.impact ?? "0", 2), 3)} percent, selling ${compact(last?.notional ?? "0")} moves it ${round(shift(last?.impact ?? "0", 2), 3)} percent. C(1%) is ${compact(c1)}.`;
}
