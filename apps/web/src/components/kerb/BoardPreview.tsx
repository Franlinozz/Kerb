/**
 * The Board's leading rows, as the Home page shows them (V2-06 section 7). Server-rendered: five
 * rows that never sort do not need the client table, only the live countdown per row does.
 */
import Link from "@/components/ui/Link";
import type { BoardRow } from "@/lib/api";
import { price, usd } from "@/lib/format";
import { TRANSITION_SHORT } from "@/lib/time";
import { Countdown } from "./Countdown";
import { LtvLadder } from "./LtvLadder";
import { RegimePill } from "./RegimePill";
import { ProvMark } from "@/components/ui/ProvMark";

export function BoardPreview({ rows }: { rows: BoardRow[] }): React.ReactElement {
  return (
    <>
    <div className="dt-wrap hide-sm">
      <table className="dt dt-static" aria-label="The Board, leading assets" style={{ minWidth: 900 }}>
        <thead><tr><th>Asset</th><th>Regime</th><th className="num">Credit Mark</th><th className="num">C(1%)</th><th>Terms</th><th className="num">Debt ceiling</th><th className="num">Next</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="dt-link">
              <td><Link href={`/asset/${r.symbol}`} className="dt-tick plain dt-stretch">{r.symbol}</Link><span className="dt-under">{r.underlying.symbol} · {r.underlying.market}</span></td>
              <td><RegimePill regime={r.regime.value} size="sm" /></td>
              <td className="num">{price(r.creditMark.value) ?? "Not yet posted"}<ProvMark label={r.creditMark.label} source={r.creditMark.source ?? "KerbTerms 196"} observedAt={r.creditMark.observedAt ?? null} {...(r.creditMark.tx ? { href: r.creditMark.tx, hrefLabel: "Posted transaction" } : {})} /></td>
              <td className="num">{usd(r.executableDepth1.value) ?? "Not yet posted"}<ProvMark label={r.executableDepth1.label} source="Tick-walk of the X Layer pool, posted in the terms" observedAt={r.executableDepth1.observedAt ?? null} /></td>
              <td><LtvLadder compact carry={r.carryLTV.value} session={r.sessionMaxLTV.value} lt={r.lt?.value ?? null} label={r.symbol} /></td>
              <td className="num">{usd(r.debtCeiling.value) ?? "Not yet posted"}<ProvMark label={r.debtCeiling.label} source="KerbTerms 196" observedAt={r.debtCeiling.observedAt ?? null} /></td>
              <td className="num">{r.next ? <>{TRANSITION_SHORT[r.next.type] ?? r.next.type} in <Countdown to={r.next.at} due="now" /></> : "Reading the clock"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="board-cards show-sm" role="list">
      {rows.map((r) => (
        <li key={r.symbol}>
          <Link href={`/asset/${r.symbol}`} className="board-card plain">
            <span className="row between"><span className="dt-tick">{r.symbol}</span><RegimePill regime={r.regime.value} size="sm" /></span>
            <span className="dt-under">{r.underlying.symbol} · {r.underlying.market}</span>
            <span className="mt-3" style={{ display: "block" }}><LtvLadder compact carry={r.carryLTV.value} session={r.sessionMaxLTV.value} lt={r.lt?.value ?? null} label={r.symbol} /></span>
            <span className="board-card-grid">
              <span><span className="t-label">C(1%)</span>{usd(r.executableDepth1.value) ?? "Not yet posted"}</span>
              <span><span className="t-label">Ceiling</span>{usd(r.debtCeiling.value) ?? "Not yet posted"}</span>
              <span><span className="t-label">Next</span>{r.next ? <>{TRANSITION_SHORT[r.next.type] ?? r.next.type} in <Countdown to={r.next.at} due="now" /></> : "Reading"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
    </>
  );
}
