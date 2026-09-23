/**
 * Asset (V2-07, V2-DESIGN-SYSTEM.md section 11.3): the risk of one asset, explained. Hero, KPI
 * band, the LTV ladder with its margin line, the full rail, then tabs: Overview, Liquidity, Mark,
 * Terms history, Onchain. An unknown symbol is the not-found page.
 */
import { LiveRoot } from "@/components/kerb/LiveRoot";
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import { AddressChip } from "@/components/ui/AddressChip";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ErrorState } from "@/components/ui/ErrorState";
import { Kpi } from "@/components/ui/Kpi";
import { HashTabs } from "@/components/kerb/HashTabs";
import { ImpactChart } from "@/components/kerb/ImpactChart";
import { LtvLadder } from "@/components/kerb/LtvLadder";
import { MarketClocks } from "@/components/kerb/MarketClocks";
import { MarkWaterfall } from "@/components/kerb/MarkWaterfall";
import { REGIME_MEANING, RegimePill } from "@/components/kerb/RegimePill";
import { AssetRail } from "@/components/kerb/SessionRail";
import { TermsHistory } from "@/components/kerb/TermsHistory";
import { explorerAddress, explorerTx, getBoard, getClock, getReport, getTerms, PUBLIC_API } from "@/lib/api";
import { ltv, price, round, scale, shortHash, usd } from "@/lib/format";
import { instrument } from "@/lib/instruments";
import { dayHm, localHm, railWindow, transitionWord, utcHm } from "@/lib/time";

export const revalidate = 15;
/** Rendered on first request, then served from the cache and revalidated; unknown ids still 404. */
export function generateStaticParams(): never[] { return []; }

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  const s = decodeURIComponent(symbol);
  return { title: s, description: `${s} (${instrument(s).name}) on Kerb: its market clock, executable depth, Credit Mark and the credit terms posted on X Layer.` };
}

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }): Promise<React.ReactElement> {
  const { symbol: raw } = await params;
  const wanted = decodeURIComponent(raw);
  const board = await getBoard();
  const row = board.ok ? board.data.rows.find((r) => r.symbol.toLowerCase() === wanted.toLowerCase()) : undefined;
  if (board.ok && !row) notFound();
  const symbol = row?.symbol ?? wanted;
  const [clock, terms, report] = await Promise.all([getClock(symbol, 196, railWindow(Date.now())), getTerms(symbol, 196, 72), getReport(symbol)]);
  const inst = instrument(symbol);
  const tz = row?.market?.tz ?? (clock.ok ? clock.data.timezone : "UTC");
  const home = row?.underlying.market === "XHKG" ? "XHKG" : "XNYS";
  const mainVenue = report.ok ? report.data.depth.venues[0] : undefined;
  const cc = report.ok && report.data.depth.crosscheck && "quoted" in report.data.depth.crosscheck ? report.data.depth.crosscheck : null;

  const overview = (
    <div className="asset-overview">
      <div className="prose">
        {row && clock.ok ? (
          <p className="t-body-l">
            {symbol} is a token that tracks {inst.name} ({inst.code} on {row.underlying.market}). Its market is {clock.data.clock.session.kind === "REGULAR" ? "open" : "not in its regular session"} right now.{" "}
            A <b>Carry</b> loan can draw up to <b>{ltv(row.carryLTV.value)}</b> of the collateral&rsquo;s value and is sized to survive until {row.margins ? `${dayHm(Date.parse(row.margins.carry.horizonEndsAt))} UTC (${localHm(Date.parse(row.margins.carry.horizonEndsAt), tz)})` : "the next deep market"} with no action from you.{" "}
            A <b>Session Max</b> loan can draw <b>{ltv(row.sessionMaxLTV.value)}</b>, on the promise that it is brought back to Carry when Last Call opens{row.cure ? ` at ${dayHm(Date.parse(row.cure.opensAt))} UTC (${localHm(Date.parse(row.cure.opensAt), tz)})` : ""}.{" "}
            Either way the liquidation line stays at <b>{ltv(row.lt?.value ?? null) ?? "its listed level"}</b>: sessions move what you can borrow, never the line.
          </p>
        ) : <ErrorState source="The clock or the Board" />}
      </div>
      <dl className="facts">
        <div><dt className="t-label">Instrument</dt><dd>{inst.name} · {inst.code}</dd></div>
        <div><dt className="t-label">Market</dt><dd>{row?.market?.city ?? ""} · {row?.underlying.market}</dd></div>
        <div><dt className="t-label">Pool</dt><dd>{row ? <AddressChip value={row.pool.address} href={row.pool.explorer} label="pool" /> : null}</dd></div>
        <div><dt className="t-label">Quoted in</dt><dd>{row?.pool.quote}</dd></div>
        {clock.ok ? <>
          <div><dt className="t-label">Next transition</dt><dd>{transitionWord(clock.data.clock.nextTransition.type)} · {utcHm(Date.parse(clock.data.clock.nextTransition.at))} UTC · {localHm(Date.parse(clock.data.clock.nextTransition.at), tz)}</dd></div>
          <div><dt className="t-label">Next Last Call</dt><dd>{utcHm(Date.parse(clock.data.clock.cureWindow.opensAt))} to {utcHm(Date.parse(clock.data.clock.cureWindow.closesAt))} UTC{clock.data.clock.cureWindow.open ? " · open now" : ""}</dd></div>
          <div><dt className="t-label">Calendar</dt><dd>{clock.data.clock.calendarVersion}</dd></div>
        </> : null}
      </dl>
    </div>
  );

  const liquidity = report.ok ? (
    <div>
      {mainVenue ? <ImpactChart venue={mainVenue} crosscheck={cc ? { quoted: cc.quoted, source: cc.source } : null} /> : <p>No venue could be walked.</p>}
      <div className="dt-wrap mt-5">
        <table className="dt" style={{ minWidth: 640 }}>
          <thead><tr><th>Venue</th><th className="num">C(0.5%)</th><th className="num">C(1%)</th><th className="num">C(3%)</th><th className="num">Mid</th></tr></thead>
          <tbody>
            {report.data.depth.venues.map((v) => (
              <tr key={v.pools.join()}><td>{v.path.join(" to ")} <span className="mono ink-3">{v.pools.map((p) => shortHash(p, 6, 4)).join(" · ")}</span></td>
                <td className="num">{usd(v.C_0_5.notional)}</td><td className="num">{usd(v.C_1.notional)}</td><td className="num">{usd(v.C_3.notional)}</td><td className="num">{price(v.midPrice)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="t-small ink-2 mt-4">
        Aggregate C(1%) used: <b>{usd(report.data.depth.C_1)}</b>.{" "}
        {report.data.depth.crosscheck && "quoted" in report.data.depth.crosscheck
          ? <>Cross-checked against {report.data.depth.crosscheck.source}: the aggregator implies {usd(report.data.depth.crosscheck.quoted)}{report.data.depth.crosscheck.flag ? ", more than the tolerance away, so the smaller figure is used." : ", inside the tolerance."}</>
          : report.data.depth.crosscheck && "reason" in report.data.depth.crosscheck ? <>The aggregator cross-check was not available: {report.data.depth.crosscheck.reason}.</> : null}
      </p>
      {report.data.depth.excluded.length ? (
        <div className="mt-5"><span className="t-label">Excluded venues</span>
          <ul className="plain-list">{report.data.depth.excluded.map((e) => <li key={e.pools.join()}>{e.path.join(" to ")} <span className="mono ink-3">{e.pools.map((p) => shortHash(p, 6, 4)).join(", ")}</span>: {e.reason}</li>)}</ul>
        </div>
      ) : null}
    </div>
  ) : <ErrorState source="The report for this asset" />;

  const mark = report.ok ? <MarkWaterfall mark={report.data.mark} regime={report.data.regime} /> : <ErrorState source="The report for this asset" />;
  const history = terms.ok ? <TermsHistory history={terms.data.history} symbol={symbol} /> : <ErrorState source="Terms history" />;
  const onchain = terms.ok ? (
    <dl className="facts">
      <div><dt className="t-label">Latest post</dt><dd><a href={explorerTx(terms.data.tx)} target="_blank" rel="noreferrer" className="mono">{shortHash(terms.data.tx, 10, 8)}</a> · {terms.data.observedAt.slice(0, 16).replace("T", " ")} UTC · {terms.data.usable ? "usable for new risk" : "not usable for new risk (stale or halted)"}</dd></div>
      <div><dt className="t-label">KerbTerms</dt><dd>{terms.data.contracts.terms ? <AddressChip value={terms.data.contracts.terms} href={explorerAddress(terms.data.contracts.terms)} label="KerbTerms" /> : "Not recorded"}</dd></div>
      <div><dt className="t-label">Input bundle</dt><dd><AddressChip value={terms.data.inputsHash} {...(terms.data.bundle.url ? { href: `${PUBLIC_API}${terms.data.bundle.url}` } : {})} label="inputs hash" /></dd></div>
      <div><dt className="t-label">Where the inputs are</dt><dd>{terms.data.bundle.servedByApi ? "Served by the Kerb API under its own inputsHash. " : ""}{terms.data.bundle.pinned && terms.data.bundle.ipfsUrl ? <>Also on IPFS: <a href={terms.data.bundle.ipfsUrl} target="_blank" rel="noreferrer">{shortHash(terms.data.bundle.cid ?? "", 10, 6)}</a>.</> : "Not on IPFS: posts after K-43 resolve through the API; earlier posts have a documented IPFS gap caused by the pinning quota."}</dd></div>
      <div className="facts-wide"><dt className="t-label">Recompute it yourself</dt><dd><CodeBlock variants={[{ lang: "shell", code: terms.data.bundle.verifyCommand }]} /></dd></div>
    </dl>
  ) : <ErrorState source="Terms" />;

  return (
    <LiveRoot className="asset" asOf={board.ok ? board.data.generatedAt : null}>
      <header className="asset-hero">
        <div>
          <span className="t-label">{row?.underlying.market} · {inst.code} · X Layer 196</span>
          <h1 className="t-display mt-3">{symbol}</h1>
          <p className="t-body-l ink-2 mt-3 asset-sub">{inst.name}{row ? <><span className="ink-3"> · Uniswap V3 pool in {row.pool.quote}, {round(scale(String(row.pool.fee), 4), 2)}% fee · </span><AddressChip value={row.pool.address} href={row.pool.explorer} label="pool" /></> : null}</p>
        </div>
        <div className="asset-hero-side">
          <RegimePill regime={row?.regime.value ?? null} />
          {row?.regime.value ? <p className="t-small ink-2">{REGIME_MEANING[row.regime.value]}</p> : null}
          <MarketClocks only={home} compact />
        </div>
      </header>

      {row ? (
        <div className="kpi-band asset-kpis">
          <Kpi size="xl" label="Credit Mark" value={price(row.creditMark.value)} prov={row.creditMark.label} source={row.creditMark.source ?? "KerbTerms 196"} observedAt={row.creditMark.observedAt ?? null} {...(row.creditMark.tx ? { href: row.creditMark.tx } : {})} />
          <Kpi label="Carry" value={ltv(row.carryLTV.value)} prov={row.carryLTV.label} source="KerbTerms 196" observedAt={row.carryLTV.observedAt ?? null} />
          <Kpi label="Session Max" value={ltv(row.sessionMaxLTV.value)} prov={row.sessionMaxLTV.label} source="KerbTerms 196" observedAt={row.sessionMaxLTV.observedAt ?? null} />
          <Kpi label="Liquidation · fixed" value={ltv(row.lt?.value ?? null)} prov="Verified" source="KerbTerms guardrails, set at listing, timelocked" />
          <Kpi label="C(1%)" value={usd(row.executableDepth1.value)} prov={row.executableDepth1.label} source="Tick-walk of the X Layer pool, posted in the terms" observedAt={row.executableDepth1.observedAt ?? null} />
          <Kpi label="Debt ceiling" value={usd(row.debtCeiling.value)} prov={row.debtCeiling.label} source="KerbTerms 196" observedAt={row.debtCeiling.observedAt ?? null} />
        </div>
      ) : null}

      {row ? <div className="mt-6"><LtvLadder carry={row.carryLTV.value} session={row.sessionMaxLTV.value} lt={row.lt?.value ?? null} kts={row.kts ?? null} margins={row.margins ?? null} /></div> : null}
      <div className="mt-6">{clock.ok ? <AssetRail symbol={symbol} initial={clock.data} regime={row?.regime.value ?? null} tz={tz} /> : <ErrorState source="The Clock" />}</div>

      <div className="section-tight">
        <HashTabs label={`${symbol} detail`} tabs={[
          { id: "overview", label: "Overview", content: overview },
          { id: "liquidity", label: "Liquidity", content: liquidity },
          { id: "mark", label: "Mark", content: mark },
          { id: "history", label: "Terms history", content: history },
          { id: "onchain", label: "Onchain", content: onchain },
        ]} />
      </div>
      <p className="t-small ink-3 mt-6"><Link href="/board">Back to the Board</Link></p>
    </LiveRoot>
  );
}
