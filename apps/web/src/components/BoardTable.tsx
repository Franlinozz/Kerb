"use client";

/**
 * The Board. Tables, not card grids. Numbers right aligned with tabular figures. Every number
 * carries its provenance marker, and sorting never reorders a column's meaning.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import type { BoardRow } from "@/lib/api";
import { age, cmpDecimal, compact, group, round, shift } from "@/lib/format";
import { RegimeTag } from "./Regime";
import { Value } from "./Value";

type Key = "symbol" | "market" | "regime" | "creditMark" | "depth" | "carry" | "session" | "ceiling" | "coverage";
type Dir = "asc" | "desc";

const NUMERIC: Record<Key, boolean> = {
  symbol: false, market: false, regime: false,
  creditMark: true, depth: true, carry: true, session: true, ceiling: true, coverage: true,
};

function cell(r: BoardRow, k: Key): string | null {
  switch (k) {
    case "symbol": return r.symbol;
    case "market": return r.underlying.market;
    case "regime": return r.regime.value;
    case "creditMark": return r.creditMark.value;
    case "depth": return r.executableDepth1.value;
    case "carry": return r.carryLTV.value;
    case "session": return r.sessionMaxLTV.value;
    case "ceiling": return r.debtCeiling.value;
    case "coverage": return r.coverageRatio.value;
  }
}

const pct = (v: string | null): string | null => (v === null ? null : `${round(shift(v, 2), 2)}%`);

export function BoardTable({ rows }: { rows: BoardRow[] }): React.ReactElement {
  const [key, setKey] = useState<Key>("ceiling");
  const [dir, setDir] = useState<Dir>("desc");

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((x, y) => {
      const a = cell(x, key);
      const b = cell(y, key);
      // A missing number sorts last in both directions: absence is not a small value.
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      const c = NUMERIC[key] ? cmpDecimal(a, b) : a.localeCompare(b);
      return dir === "asc" ? c : -c;
    });
    return out;
  }, [rows, key, dir]);

  const head = (k: Key, label: string, numeric = false): React.ReactElement => (
    <th className={numeric ? "num" : undefined} aria-sort={key === k ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="sort"
        onClick={() => {
          if (key === k) setDir(dir === "asc" ? "desc" : "asc");
          else { setKey(k); setDir(numeric ? "desc" : "asc"); }
        }}
      >
        {label}
        <span className="sort-mark" aria-hidden="true">{key === k ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );

  if (rows.length === 0) {
    return <div className="empty">No assets are being tracked yet. The Board fills as the collector records its first observations.</div>;
  }

  return (
    <>
      <p className="scroll-hint">Scroll the table sideways for depth, capacity and ceilings.</p>
      <div className="scroll-x">
      <table className="board">
        <thead>
          <tr>
            {head("symbol", "Asset")}
            {head("market", "Underlying")}
            {head("regime", "Regime")}
            {head("creditMark", "Credit Mark", true)}
            {head("depth", "Depth at 1%", true)}
            {head("carry", "Carry", true)}
            {head("session", "Session Max", true)}
            {head("ceiling", "Debt ceiling", true)}
            {head("coverage", "Coverage", true)}
            <th className="hide-sm">Reported</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.symbol} className={r.status === "live" ? undefined : "row-degraded"}>
              <td>
                <Link href={`/asset/${encodeURIComponent(r.symbol)}`}>{r.symbol}</Link>
              </td>
              <td className="dim">
                {r.underlying.symbol} <span className="faint">{r.underlying.market}</span>
              </td>
              <td>
                {r.regime.value ? <RegimeTag regime={r.regime.value} /> : <span className="faint">not posted</span>}
              </td>
              <td className="num">
                <Value value={r.creditMark.value === null ? null : group(round(r.creditMark.value, 4))}
                  label={r.creditMark.label} observedAt={r.creditMark.observedAt ?? null} />
              </td>
              <td className="num">
                <Value value={compact(r.executableDepth1.value)} label={r.executableDepth1.label}
                  observedAt={r.executableDepth1.observedAt ?? null} />
              </td>
              <td className="num"><Value value={pct(r.carryLTV.value)} label={r.carryLTV.label} /></td>
              <td className="num"><Value value={pct(r.sessionMaxLTV.value)} label={r.sessionMaxLTV.label} /></td>
              <td className="num"><Value value={compact(r.debtCeiling.value)} label={r.debtCeiling.label} /></td>
              <td className="num"><Value value={r.coverageRatio.value === null ? null : round(r.coverageRatio.value, 2)} label={r.coverageRatio.label} /></td>
              <td className="hide-sm faint">
                {r.status === "no report" ? "never" : `${age(r.reportAgeSec)} ago`}
                {r.status === "stale" ? <span className="badge badge-warn" style={{ marginLeft: 6 }}>stale</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
