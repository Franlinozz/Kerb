"use client";
import Link from "@/components/ui/Link";
import type { BoardRow } from "@/lib/api";
import { price, usd } from "@/lib/format";
import { countdown, TRANSITION_SHORT } from "@/lib/time";
import { DataTable, type Column } from "./DataTable";
import { LtvLadder } from "./LtvLadder";
import { RegimePill } from "./RegimePill";
import { useNow } from "./useLive";
import { ProvMark } from "@/components/ui/ProvMark";

/** The Board's leading rows, as the Home page shows them (V2-06 section 7). */
export function BoardPreview({ rows }: { rows: BoardRow[] }): React.ReactElement {
  const now = useNow(1000);
  const columns: Column<BoardRow>[] = [
    { key: "asset", head: "Asset", cell: (r) => <><Link href={`/asset/${r.symbol}`} className="dt-tick plain">{r.symbol}</Link><span className="dt-under">{r.underlying.symbol} · {r.underlying.market}</span></> },
    { key: "regime", head: "Regime", cell: (r) => <RegimePill regime={r.regime.value} size="sm" /> },
    { key: "mark", head: "Credit Mark", align: "right", cell: (r) => <>{price(r.creditMark.value) ?? "Not yet posted"}<ProvMark label={r.creditMark.label} source={r.creditMark.source ?? "KerbTerms 196"} observedAt={r.creditMark.observedAt ?? null} {...(r.creditMark.tx ? { href: r.creditMark.tx, hrefLabel: "Posted transaction" } : {})} /></> },
    { key: "c1", head: "C(1%)", align: "right", cell: (r) => <>{usd(r.executableDepth1.value) ?? "Not yet posted"}<ProvMark label={r.executableDepth1.label} source="Tick-walk of the X Layer pool, posted in the terms" observedAt={r.executableDepth1.observedAt ?? null} /></> },
    { key: "terms", head: "Terms", cell: (r) => <LtvLadder compact carry={r.carryLTV.value} session={r.sessionMaxLTV.value} lt={r.lt?.value ?? null} label={r.symbol} /> },
    { key: "ceiling", head: "Debt ceiling", align: "right", cell: (r) => <>{usd(r.debtCeiling.value) ?? "Not yet posted"}<ProvMark label={r.debtCeiling.label} source="KerbTerms 196" observedAt={r.debtCeiling.observedAt ?? null} /></> },
    { key: "next", head: "Next", align: "right", cell: (r) => r.next ? <span suppressHydrationWarning>{TRANSITION_SHORT[r.next.type] ?? r.next.type} {now === null ? "" : `in ${countdown(Date.parse(r.next.at), now)}`}</span> : "Reading the clock" },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(r) => r.symbol} href={(r) => `/asset/${r.symbol}`} label="The Board, leading assets" minWidth={900} />;
}
