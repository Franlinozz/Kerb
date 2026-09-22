"use client";

/**
 * Terms history over 72 h (section 9). Two charts on one time axis rather than one chart with two
 * scales: dollars (debt ceiling and C(1%)) above, LTVs (Carry and Session Max) below, both over
 * regime bands. Then the posts themselves, ten at a time.
 */
import { useState } from "react";
import type { Regime, Terms } from "@/lib/api";
import { explorerTx } from "@/lib/api";
import { ltv, round, scale, usd } from "@/lib/format";
import { REGIME_WORD, RegimePill } from "./RegimePill";

type H = Terms["history"][number];
const BAND: Partial<Record<Regime, string>> = { REFERENCE_CLOSED: "var(--r-closed)", PRE_TRANSITION: "var(--brass-dim)", STALE: "var(--r-stale)", HALTED: "var(--oxide)", THIN: "var(--stone)", RECOVERY: "var(--moss-dim)" };
const W = 900, HH = 150, P = { t: 12, r: 16, b: 22, l: 56 };

function Chart({ rows, series, fmt, label }: { rows: H[]; series: { key: keyof H; name: string; color: string; scaleBy: (h: H) => number }[]; fmt: (v: number) => string; label: string }): React.ReactElement {
  const ts = rows.map((r) => Date.parse(r.observedAt));
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const vals = rows.flatMap((r) => series.map((s) => s.scaleBy(r)));
  const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03;
  const X = (t: number): number => P.l + ((t - t0) / (t1 - t0 || 1)) * (W - P.l - P.r);
  const Y = (v: number): number => HH - P.b - ((v - lo) / (hi - lo || 1)) * (HH - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${HH}`} className="th-chart" role="img" aria-label={label}>
      {rows.map((r, i) => {
        const f = BAND[r.regime];
        const next = rows[i + 1];
        if (!f || !next) return null;
        return <rect key={r.observedAt} x={X(ts[i]!)} y={P.t} width={Math.max(0.5, X(ts[i + 1]!) - X(ts[i]!))} height={HH - P.t - P.b} fill={f} opacity={0.3} />;
      })}
      {[lo, (lo + hi) / 2, hi].map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--hair)" /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end" className="axis">{fmt(v)}</text></g>)}
      {series.map((s) => (
        <path key={String(s.key)} d={rows.map((r, i) => `${i ? "L" : "M"}${X(ts[i]!).toFixed(1)},${Y(s.scaleBy(r)).toFixed(1)}`).join("")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
      ))}
      {[0, 0.5, 1].map((f) => { const t = t0 + (t1 - t0) * f; return <text key={f} x={X(t)} y={HH - 6} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} className="axis">{new Date(t).toISOString().slice(5, 16).replace("T", " ")} UTC</text>; })}
    </svg>
  );
}

export function TermsHistory({ history, symbol }: { history: H[]; symbol: string }): React.ReactElement {
  const [all, setAll] = useState(false);
  const rows = [...history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (rows.length < 2) return <p className="t-small ink-3">Not enough posts in the window to draw a history yet.</p>;
  const money = (raw: string): number => Number(scale(raw, 6)); // chart geometry only; values print from strings
  const wad = (raw: string): number => Number(scale(raw, 18));
  const newest = [...history].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const regimes = [...new Set(rows.map((r) => r.regime))];
  return (
    <div className="th">
      <div className="th-legend t-small">
        <span><i style={{ background: "var(--ink)" }} />Debt ceiling</span><span><i style={{ background: "var(--moss)" }} />C(1%)</span>
        <span><i style={{ background: "var(--ink)" }} />Carry</span><span><i style={{ background: "var(--brass)" }} />Session Max</span>
        {regimes.filter((r) => BAND[r]).map((r) => <span key={r}><i className="th-band" style={{ background: BAND[r] }} />{REGIME_WORD[r]}</span>)}
      </div>
      <Chart rows={rows} label={`${symbol} debt ceiling and C(1%) over the window`} fmt={(v) => usd(round(String(v), 2)) ?? ""}
        series={[{ key: "debtCeiling", name: "Debt ceiling", color: "var(--ink)", scaleBy: (h) => money(h.debtCeiling) }, { key: "executableDepth1", name: "C(1%)", color: "var(--moss)", scaleBy: (h) => money(h.executableDepth1) }]} />
      <Chart rows={rows} label={`${symbol} Carry and Session Max over the window`} fmt={(v) => `${(v * 100).toFixed(1)}%`}
        series={[{ key: "carryLTV", name: "Carry", color: "var(--ink)", scaleBy: (h) => wad(h.carryLTV) }, { key: "sessionMaxLTV", name: "Session Max", color: "var(--brass)", scaleBy: (h) => wad(h.sessionMaxLTV) }]} />
      <div className="dt-wrap mt-5">
        <table className="dt" style={{ minWidth: 820 }}>
          <caption className="sr-only">{symbol} terms posts, newest first</caption>
          <thead><tr><th>Posted</th><th>Regime</th><th className="num">Carry</th><th className="num">Session Max</th><th className="num">Debt ceiling</th><th className="num">C(1%)</th><th>Transaction</th></tr></thead>
          <tbody>
            {(all ? newest : newest.slice(0, 10)).map((h) => (
              <tr key={h.tx}>
                <td className="ink-2">{h.observedAt.slice(5, 16).replace("T", " ")} UTC</td>
                <td><RegimePill regime={h.regime} size="sm" /></td>
                <td className="num">{ltv(scale(h.carryLTV, 18))}</td>
                <td className="num">{ltv(scale(h.sessionMaxLTV, 18))}</td>
                <td className="num">{usd(scale(h.debtCeiling, 6))}</td>
                <td className="num">{usd(scale(h.executableDepth1, 6))}</td>
                <td><a className="mono plain ink-2" href={explorerTx(h.tx)} target="_blank" rel="noreferrer">{h.tx.slice(0, 10)}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {newest.length > 10 ? <button type="button" className="btn btn-sm mt-4" onClick={() => setAll((a) => !a)}>{all ? "Show ten" : `Show all ${newest.length}`}</button> : null}
    </div>
  );
}
