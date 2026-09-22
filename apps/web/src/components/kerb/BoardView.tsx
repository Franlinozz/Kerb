"use client";

/**
 * The Board (V2-07, V2-DESIGN-SYSTEM.md section 11.2): KPI band, market filter and regime chips
 * (reflected in the URL), a full SessionRail for the selected row, the DataTable on desktop and a
 * card list on phones, and the sources in a disclosure. Refreshes every 30 s.
 */
import Link from "@/components/ui/Link";
import { useEffect, useMemo, useState } from "react";
import type { Board, BoardRow, Clock, Regime } from "@/lib/api";
import { byDecimalDesc, price, ratio, usd } from "@/lib/format";
import { instrument } from "@/lib/instruments";
import { countdown, localHm, TRANSITION_SHORT } from "@/lib/time";
import { Disclosure } from "@/components/ui/Disclosure";
import { Kpi } from "@/components/ui/Kpi";
import { ProvMark } from "@/components/ui/ProvMark";
import { DataTable, type Column } from "./DataTable";
import { DepthSpark } from "./DepthSpark";
import { LtvLadder } from "./LtvLadder";
import { REGIME_WORD, RegimePill } from "./RegimePill";
import { AssetRail } from "./SessionRail";
import { useLive, useNow } from "./useLive";

const MARKETS = [
  { id: "all", label: "All" },
  { id: "ny", label: "New York" },
  { id: "hk", label: "Hong Kong" },
  { id: "metals", label: "Metals" },
] as const;
type MarketId = (typeof MARKETS)[number]["id"];

function ago(sec: number | null): string {
  if (sec === null) return "Not yet posted";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m ago`;
}

export function BoardView({ initial, initialClock }: { initial: Board; initialClock: Clock | null }): React.ReactElement {
  const live = useLive<Board>("/v1/board?chain=196", initial, 30_000);
  const board = live.data ?? initial;
  const now = useNow();
  // The filters live in the URL, read after mount rather than with useSearchParams: on a
  // statically rendered page that hook makes Next skip server-rendering the whole table.
  const [query, setQueryState] = useState<URLSearchParams>(() => new URLSearchParams());
  useEffect(() => {
    const read = (): void => setQueryState(new URLSearchParams(window.location.search));
    read(); window.addEventListener("popstate", read); return () => window.removeEventListener("popstate", read);
  }, []);
  const market = (query.get("market") ?? "all") as MarketId;
  const regimeFilter = query.get("regime") as Regime | null;

  const setQuery = (k: string, v: string | null): void => {
    const q = new URLSearchParams(query.toString());
    if (v === null) q.delete(k); else q.set(k, v);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
    setQueryState(q);
  };

  const all = useMemo(() => [...board.rows].sort(byDecimalDesc((r) => r.debtCeiling.value)), [board.rows]);
  const present = useMemo(() => [...new Set(all.map((r) => r.regime.value).filter((x): x is Regime => x !== null))], [all]);
  const rows = all.filter((r) => (market === "all" || instrument(r.symbol).group === market) && (!regimeFilter || r.regime.value === regimeFilter));

  const [selected, setSelected] = useState<string | null>(null);
  const sel = rows.find((r) => r.symbol === selected) ?? rows[0] ?? null;
  const s = board.summary;
  const generatedAgo = now === null ? null : Math.max(0, Math.round((now - Date.parse(board.generatedAt)) / 1000));

  const columns: Column<BoardRow>[] = [
    { key: "asset", head: "Asset", sort: (r) => r.symbol, cell: (r) => (
      <><Link href={`/asset/${r.symbol}`} className="dt-tick plain">{r.symbol}</Link>
        <span className="dt-under">{instrument(r.symbol).name} · {r.underlying.market}{now !== null && r.market ? ` · ${localHm(now, r.market.tz).split(" ")[0]}` : ""}</span></>
    ) },
    { key: "regime", head: "Regime", sort: (r) => r.regime.value, cell: (r) => <RegimePill regime={r.regime.value} size="sm" /> },
    { key: "mark", head: "Credit Mark", align: "right", sort: (r) => r.creditMark.value, cell: (r) => <>{price(r.creditMark.value) ?? "Not yet posted"}<ProvMark label={r.creditMark.label} source={r.creditMark.source ?? "KerbTerms 196"} observedAt={r.creditMark.observedAt ?? null} {...(r.creditMark.tx ? { href: r.creditMark.tx, hrefLabel: "Posted transaction" } : {})} /></> },
    { key: "c1", head: "C(1%)", align: "right", sort: (r) => r.executableDepth1.value, cell: (r) => (
      <span className="dt-c1"><DepthSpark points={r.spark ?? []} label={`${r.symbol} C(1%) over 24 hours`} /><span>{usd(r.executableDepth1.value) ?? "Not yet posted"}<ProvMark label={r.executableDepth1.label} source="Tick-walk of the X Layer pool, posted in the terms" observedAt={r.executableDepth1.observedAt ?? null} /></span></span>
    ) },
    { key: "terms", head: "Terms", sort: (r) => r.carryLTV.value, cell: (r) => <LtvLadder compact carry={r.carryLTV.value} session={r.sessionMaxLTV.value} lt={r.lt?.value ?? null} label={r.symbol} /> },
    { key: "ceiling", head: "Debt ceiling", align: "right", sort: (r) => r.debtCeiling.value, cell: (r) => <>{usd(r.debtCeiling.value) ?? "Not yet posted"}<ProvMark label={r.debtCeiling.label} source="KerbTerms 196" observedAt={r.debtCeiling.observedAt ?? null} /></> },
    { key: "coverage", head: "Coverage", align: "right", sort: (r) => r.coverageRatio.value, cell: (r) => <>{ratio(r.coverageRatio.value) ?? "Not yet posted"}<ProvMark label="Computed" source="C(1%) divided by the debt ceiling" /></> },
    { key: "next", head: "Next", align: "right", sort: (r) => r.next?.at ?? null, cell: (r) => r.next ? <span suppressHydrationWarning>{TRANSITION_SHORT[r.next.type] ?? r.next.type}{now === null ? "" : ` in ${countdown(Date.parse(r.next.at), now)}`}</span> : "Reading the clock" },
    { key: "posted", head: "Posted", align: "right", sort: (r) => (r.reportAgeSec === null ? null : String(-r.reportAgeSec)), cell: (r) => r.carryLTV.tx ? <a className="plain ink-2" href={r.carryLTV.tx} target="_blank" rel="noreferrer">{ago(r.reportAgeSec)}</a> : <span className="ink-3">{ago(r.reportAgeSec)}</span> },
  ];

  return (
    <div className="board">
      <header className="board-head">
        <span className="t-label">The Board · X Layer 196 · {board.rows.length} assets · {new Set(board.rows.map((r) => r.underlying.market)).size} markets</span>
        <h1>What each stock can safely support, right now.</h1>
        <p className="t-small ink-3 live-line" aria-live="polite" suppressHydrationWarning>{live.updating ? "Updating" : generatedAgo === null ? "Refreshes every 30 seconds" : `Updated ${ago(generatedAgo)} · refreshes every 30 seconds`}</p>
      </header>

      {s ? (
        <div className="kpi-band">
          <Kpi label="In Last Call now" value={String(s.inLastCall)} prov="Computed" source="Assets whose market is inside its cure window, from the Clock" />
          <Kpi label="Executable at 1%" value={usd(s.c1Total)} prov="Computed" source="Sum of posted C(1%) across the Board" />
          <Kpi label="Debt capacity" value={usd(s.ceilingTotal)} prov="Computed" source="Sum of posted debt ceilings" />
          <Kpi label="Sources healthy" value={`${s.sourcesHealthy} of ${s.sourcesTotal}`} prov="Computed" source="Sources that reported in the last 15 minutes" />
          <Kpi label="Last post" value={ago(s.lastPostAgeSec)} prov="Computed" source="Age of the newest posted terms on chain 196" />
        </div>
      ) : null}

      <div className="board-filters">
        <div className="segmented" role="radiogroup" aria-label="Market">
          {MARKETS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={market === m.id} onClick={() => setQuery("market", m.id === "all" ? null : m.id)}>{m.label}</button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Regime">
          {present.map((r) => (
            <button key={r} type="button" className="chip-filter" aria-pressed={regimeFilter === r} onClick={() => setQuery("regime", regimeFilter === r ? null : r)}>
              {REGIME_WORD[r]} <span className="ink-3">{all.filter((x) => x.regime.value === r).length}</span>
            </button>
          ))}
        </div>
      </div>

      {sel ? (
        <div className="board-rail">
          <AssetRail key={sel.symbol} symbol={sel.symbol} initial={initialClock && initialClock.symbol === sel.symbol ? initialClock : null} regime={sel.regime.value} tz={sel.market?.tz ?? "UTC"} />
          <p className="t-small ink-3 mt-2">Showing {sel.symbol}<span className="hide-sm">. Hover or focus a row to see its market.</span><span className="show-sm">, the largest by debt ceiling.</span></p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="state state-empty mt-5"><h3>No asset matches this filter.</h3><p><button type="button" className="btn btn-quiet" onClick={() => { window.history.replaceState(window.history.state, "", window.location.pathname); setQueryState(new URLSearchParams()); }}>Clear the filters</button></p></div>
      ) : (
        <>
          <div className="board-table hide-md">
            <DataTable rows={rows} columns={columns} rowKey={(r) => r.symbol} href={(r) => `/asset/${r.symbol}`} label="The Board" onRowFocus={(r) => setSelected(r.symbol)} minWidth={1080} />
          </div>
          <ul className="board-cards show-md" role="list">
            {rows.map((r) => (
              <li key={r.symbol}>
                <Link href={`/asset/${r.symbol}`} className="board-card plain">
                  <span className="row between"><span className="dt-tick">{r.symbol}</span><RegimePill regime={r.regime.value} size="sm" /></span>
                  <span className="dt-under">{instrument(r.symbol).name} · {r.underlying.market}</span>
                  <span className="mt-3" style={{ display: "block" }}><LtvLadder compact carry={r.carryLTV.value} session={r.sessionMaxLTV.value} lt={r.lt?.value ?? null} label={r.symbol} /></span>
                  <span className="board-card-grid">
                    <span><span className="t-label">C(1%)</span>{usd(r.executableDepth1.value) ?? "Not yet posted"}</span>
                    <span><span className="t-label">Ceiling</span>{usd(r.debtCeiling.value) ?? "Not yet posted"}</span>
                    <span><span className="t-label">Next</span><span suppressHydrationWarning>{r.next ? `${TRANSITION_SHORT[r.next.type] ?? r.next.type}${now === null ? "" : ` in ${countdown(Date.parse(r.next.at), now)}`}` : "Reading"}</span></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {board.sources?.length ? (
        <div className="mt-6">
          <Disclosure summary={<span>{board.sources.length} sources reporting <span className="ink-3">· {board.sources.filter((x) => x.healthy).length} healthy</span></span>}>
            <div className="dt-wrap">
              <table className="dt" style={{ minWidth: 560 }}>
                <thead><tr><th>Source</th><th className="num">Last observed</th><th className="num">Age</th><th>State</th></tr></thead>
                <tbody>
                  {board.sources.map((x) => (
                    <tr key={x.name}><td className="mono">{x.name}</td><td className="num ink-2">{x.lastObservedAt ? x.lastObservedAt.slice(11, 19) + " UTC" : "Never"}</td><td className="num">{ago(x.ageSec)}</td><td>{x.healthy ? <span className="moss">Reporting</span> : <span className="brass">Quiet</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        </div>
      ) : null}
      <p className="t-small ink-3 mt-5">Every value is the latest term posted on X Layer mainnet with its provenance marker: hover or focus a marker for its source and time.</p>
    </div>
  );
}
