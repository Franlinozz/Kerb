"use client";

/**
 * The impact curve, rebuilt (section 9): the area under price impact against notional sold, walked
 * tick by tick through the real pool, with C(0.5%), C(1%) and C(3%) marked, the aggregator
 * cross-check as a dashed marker, and a hover or keyboard readout of notional, impact and price.
 */
import { useState } from "react";
import type { Venue } from "@/lib/api";
import { price, round, shift, usd } from "@/lib/format";

const W = 1100, H = 320, P = { t: 22, r: 24, b: 36, l: 52 };

export function ImpactChart({ venue, crosscheck }: { venue: Venue; crosscheck?: { quoted: string; source: string } | null }): React.ReactElement {
  const pts = venue.curve.filter((p) => p.filled);
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length < 2) return <p className="t-small ink-3">This venue could not fill two points on the notional ladder, so there is no curve to draw. The excluded venues below say why.</p>;
  const lx = (v: string): number => Math.log10(Number(v)); // axis geometry only
  const xs = pts.map((p) => lx(p.notional));
  const maxImpact = Math.ceil(Math.max(0.035, ...pts.map((p) => Number(p.impact))) * 100) / 100;
  const step = maxImpact > 0.06 ? 0.02 : 0.01;
  const grid = Array.from({ length: Math.floor(maxImpact / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
  const X = (v: number): number => P.l + ((v - xs[0]!) / (xs[xs.length - 1]! - xs[0]! || 1)) * (W - P.l - P.r);
  const Y = (imp: number): number => H - P.b - (imp / maxImpact) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(xs[i]!).toFixed(1)},${Y(Number(p.impact)).toFixed(1)}`).join("");
  const area = `${line}L${X(xs[xs.length - 1]!).toFixed(1)},${H - P.b}L${X(xs[0]!).toFixed(1)},${H - P.b}Z`;
  const marks = [
    { k: "C(0.5%)", c: venue.C_0_5, imp: 0.005 },
    { k: "C(1%)", c: venue.C_1, imp: 0.01 },
    { k: "C(3%)", c: venue.C_3, imp: 0.03 },
  ].filter((m) => Number(m.c.notional) > 0);
  const h = hover === null ? null : pts[hover];
  const ticks = pts.filter((_, i) => i % 2 === 0);
  return (
    <figure className="impact">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Price impact against notional sold on ${venue.path.join(" to ")}. ${marks.map((m) => `${m.k} ${usd(m.c.notional)}`).join(", ")}.`}
        onMouseLeave={() => setHover(null)}>
        {grid.map((v) => (
          <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--hair)" /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end" className="axis">{Math.round(v * 100)}%</text></g>
        ))}
        <path d={area} fill="var(--ink)" opacity={0.08} />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2} />
        {marks.map((m) => (
          <g key={m.k}>
            <line x1={X(lx(m.c.notional))} x2={X(lx(m.c.notional))} y1={Y(m.imp)} y2={H - P.b} stroke={m.k === "C(1%)" ? "var(--brass)" : "var(--ink-3)"} strokeWidth={m.k === "C(1%)" ? 1.5 : 1} />
            <circle cx={X(lx(m.c.notional))} cy={Y(m.imp)} r={4} fill={m.k === "C(1%)" ? "var(--brass)" : "var(--ink-2)"} />
            <text x={X(lx(m.c.notional)) - 6} y={Y(m.imp) - 12} textAnchor="end" className="axis axis-strong">{m.k} {usd(m.c.notional)}</text>
          </g>
        ))}
        {crosscheck && Number(crosscheck.quoted) > 0 ? (
          <g><line x1={X(lx(crosscheck.quoted))} x2={X(lx(crosscheck.quoted))} y1={P.t} y2={H - P.b} stroke="var(--moss)" strokeDasharray="4 4" /><text x={X(lx(crosscheck.quoted)) + 4} y={P.t + 10} className="axis">aggregator C(1%) {usd(crosscheck.quoted)}</text></g>
        ) : null}
        {ticks.map((p) => <text key={p.notional} x={X(lx(p.notional))} y={H - P.b + 18} textAnchor="middle" className="axis">{usd(p.notional)}</text>)}
        {pts.map((p, i) => (
          <rect key={p.notional} x={X(xs[i]!) - 14} y={P.t} width={28} height={H - P.t - P.b} fill="transparent" tabIndex={0} role="img"
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${usd(p.notional)} sold: ${round(shift(p.impact, 2), 2)}% impact, realised ${price(p.realisedPrice)}`} />
        ))}
        {h ? <circle cx={X(lx(h.notional))} cy={Y(Number(h.impact))} r={5} fill="none" stroke="var(--moss)" strokeWidth={2} /> : null}
      </svg>
      <figcaption className="impact-readout" aria-live="polite">
        {h ? <>Selling <b>{usd(h.notional)}</b>: {round(shift(h.impact, 2), 2)}% impact, realised price {price(h.realisedPrice)} against a mid of {price(h.midPrice)}.</>
          : <>Hover, tap or focus the curve for the impact at each size. Notional is on a log scale.</>}
      </figcaption>
    </figure>
  );
}
