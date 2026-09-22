"use client";

/**
 * DataTable (section 9): sticky tracked head, 56 px rows, right-aligned tabular numbers, whole-row
 * links, sort buttons with aria-sort. Sorting compares decimal strings exactly, never as floats.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { cmpDecimal } from "@/lib/format";

export interface Column<T> {
  key: string;
  head: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
  /** A decimal string (or plain string) to sort by; omit for an unsortable column. */
  sort?: (row: T) => string | null;
  className?: string;
}

export function DataTable<T>({ rows, columns, rowKey, href, initialSort, label, onRowFocus, minWidth = 880 }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; href?: (r: T) => string; initialSort?: { key: string; dir: "asc" | "desc" };
  label: string; onRowFocus?: (r: T) => void; minWidth?: number;
}): React.ReactElement {
  const router = useRouter();
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const numeric = /^-?\d+(\.\d+)?$/.test(x) && /^-?\d+(\.\d+)?$/.test(y);
      const c = numeric ? cmpDecimal(x, y) : x.localeCompare(y);
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, columns, sort]);
  return (
    <div className="dt-wrap">
      <table className="dt" aria-label={label} style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} scope="col" className={c.align === "right" ? "num" : undefined} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : c.sort ? "none" : undefined}>
                  {c.sort ? (
                    <button type="button" className="dt-sort" onClick={() => setSort(active && sort.dir === "desc" ? { key: c.key, dir: "asc" } : { key: c.key, dir: "desc" })}>
                      {c.head}<span className="dt-sort-mark" aria-hidden="true">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                    </button>
                  ) : c.head}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const to = href?.(r);
            return (
              <tr key={rowKey(r)} className={to ? "dt-link" : undefined} tabIndex={to ? 0 : undefined}
                onClick={to ? (e) => { if (!(e.target as HTMLElement).closest("a,button")) router.push(to); } : undefined}
                onKeyDown={to ? (e) => { if (e.key === "Enter") router.push(to); } : undefined}
                onMouseEnter={onRowFocus ? () => onRowFocus(r) : undefined} onFocus={onRowFocus ? () => onRowFocus(r) : undefined}>
                {columns.map((c) => <td key={c.key} className={[c.align === "right" ? "num" : "", c.className ?? ""].filter(Boolean).join(" ") || undefined}>{c.cell(r)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
