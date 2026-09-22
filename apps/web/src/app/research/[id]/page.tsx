/**
 * A Market-Time Report (V2-09, V2-DESIGN-SYSTEM.md section 11.5). Everything is the published
 * report file as served by /v1/market-time/:id; the gap positions come from the same observation
 * store through /v1/market-time/:id/gaps. The report's own figures are never recomputed here.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ErrorState } from "@/components/ui/ErrorState";
import { DivergingBars } from "@/components/kerb/DivergingBars";
import { PageRail } from "@/components/kerb/PageRail";
import { WindowStrip } from "@/components/kerb/WindowStrip";
import { explorerAddress, getClock, getMarketTimeGaps, getMarketTimeReport, PUBLIC_API } from "@/lib/api";
import { group, shortHash, usd, usdFull, utcStamp } from "@/lib/format";
import { headline } from "@/lib/research";

export const revalidate = 300;
/** Rendered on first request, then served from the cache and revalidated; unknown ids still 404. */
export function generateStaticParams(): never[] { return []; }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = /^[0-9]{1,4}$/.test(id) ? await getMarketTimeReport(Number(id)) : null;
  return { title: `Market-Time Report #${id}`, description: r?.ok ? r.data.title : "A Market-Time Report" };
}

/** In-range liquidity L is a raw uint128; shown in units of 1e18, labelled as protocol units. */
const liq = (raw: string): string => {
  const v = BigInt(raw);
  return group(`${v / 10n ** 18n}.${(v % 10n ** 18n).toString().padStart(18, "0").slice(0, 3)}`);
};
const pctText = (v: string | null): string => (v === null ? "Not measured" : `${v.startsWith("-") || /^0(\.0+)?$/.test(v) ? "" : "+"}${v}%`);

/** A change bar for a table cell: one shared ±scale per column, oxide falls, moss rises. */
function ChangeBar({ v, max }: { v: string | null; max: number }): React.ReactElement {
  if (v === null) return <span className="ink-3">Not measured</span>;
  const n = Number(v), w = Math.min(50, (Math.abs(n) / max) * 50);
  return (
    <span className="cbar">
      <span className="cbar-track" aria-hidden="true"><span className="dbar-zero" /><span className={`dbar-fill ${n < 0 ? "is-fall" : "is-rise"}`} style={n < 0 ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }} /></span>
      <span className="mono">{pctText(v)}</span>
    </span>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }): Promise<React.ReactElement> {
  const { id } = await params;
  if (!/^[0-9]{1,4}$/.test(id)) notFound();
  const report = await getMarketTimeReport(Number(id));
  if (!report.ok) {
    if (report.status === 404) notFound();
    return <><h1>Market-Time Report #{id}</h1><ErrorState source="The report" /></>;
  }
  const r = report.data;
  const fromMs = Date.parse(r.window.from), toMs = Date.parse(r.window.to);
  const [ny, hk, gaps] = await Promise.all([
    getClock("KOx", 196, { fromMs, toMs }), getClock("HKEXCx", 196, { fromMs, toMs }), getMarketTimeGaps(r.id),
  ]);
  const assets = r.pools.filter((p) => p.role === "asset");
  const routes = r.pools.filter((p) => p.role === "route");
  const campaignMax = r.campaign ? Math.max(1, ...r.campaign.rows.flatMap((c) => [c.c1ChangePct, c.c3ChangePct, c.markChangePct, c.ceilingChangePct]).filter((x): x is string => x !== null).map((x) => Math.abs(Number(x)))) : 1;

  return (
    <article className="report">
      <header className="report-head">
        <span className="t-label">Market-Time Report #{r.id} · generated {utcStamp(r.generatedAt)}</span>
        <h1 className="t-serif-xl report-title">{r.title}</h1>
        {r.window.partial ? <p className="report-partial t-small">Partial: the record reaches {utcStamp(r.window.to)} of a planned {r.window.plannedTo ? utcStamp(r.window.plannedTo) : "longer window"}. This report is regenerated as it fills.</p> : null}
        <p className="ink-2">{utcStamp(r.window.from)} to {utcStamp(r.window.to)} · {r.window.hours} h · {group(String(r.window.observations))} readings across {r.window.pools} pools · largest hole {r.window.largestGap ?? "none"}</p>
        <div className="rs-nums">
          {headline(r).map((h) => <div key={h.label}><span className="t-num-xl">{h.value}</span><span className="t-small ink-2">{h.label}</span></div>)}
        </div>
      </header>
      <PageRail subject={{ kind: "lanes" }} />

      <section className="section">
        <h2>Liquidity change by pool</h2>
        <p className="t-small ink-2">In-range liquidity at the last reading of the window against the first. The asset pools first, then the route legs a sale passes through on its way to USDG.</p>
        <DivergingBars caption="Change in in-range liquidity by asset pool" rows={assets.map((p) => ({ key: p.pool, label: p.symbol ?? shortHash(p.pool), value: p.changePct, ...(p.symbol ? { href: `/asset/${p.symbol}` } : {}) }))} />
        {routes.length ? (
          <>
            <h3 className="t-label mt-5">Route legs</h3>
            <DivergingBars caption="Change in in-range liquidity by route leg" rows={routes.map((p) => ({ key: p.pool, label: `Route leg ${shortHash(p.pool)}`, value: p.changePct }))} />
          </>
        ) : null}
      </section>

      <section className="section">
        <h2>Window against the sessions</h2>
        <WindowStrip fromMs={fromMs} toMs={toMs} lanes={[{ name: "New York", clock: ny.ok ? ny.data : null }, { name: "Hong Kong", clock: hk.ok ? hk.data : null }]} gaps={gaps.ok ? gaps.data.gaps : null} />
        {!r.window.underlyingOpenDuringWindow ? <p className="t-small ink-2 mt-3">Neither underlying market held a regular session inside this window, so this report cannot compare open against closed. It says so rather than implying it.</p> : null}
      </section>

      {r.campaign ? (
        <section className="section">
          <h2>Before and after the campaign end</h2>
          <p className="t-small ink-2">Two full engine captures, {utcStamp(r.campaign.before.capturedAt)} and {utcStamp(r.campaign.after.capturedAt)}. {r.campaign.summary.statement}</p>
          <div className="scroll-x">
            <table className="ptable report-table">
              <thead><tr><th>Asset</th><th>Regime</th><th className="num">C(1%) before</th><th className="num">C(1%) after</th><th>C(1%)</th><th>C(3%)</th><th>Credit Mark</th><th>Debt ceiling</th></tr></thead>
              <tbody>
                {r.campaign.rows.map((c) => (
                  <tr key={c.symbol}>
                    <td data-label="Asset"><Link href={`/asset/${c.symbol}`}>{c.symbol}</Link></td>
                    <td data-label="Regime" className="ink-2">{c.regimeChanged ? `${c.regimeBefore} to ${c.regimeAfter}` : c.regimeBefore ?? "Not recorded"}</td>
                    <td data-label="C(1%) before" className="num mono">{usd(c.c1Before) ?? "Not measured"}</td>
                    <td data-label="C(1%) after" className="num mono">{usd(c.c1After) ?? "Not measured"}</td>
                    <td data-label="C(1%)"><ChangeBar v={c.c1ChangePct} max={campaignMax} /></td>
                    <td data-label="C(3%)"><ChangeBar v={c.c3ChangePct} max={campaignMax} /></td>
                    <td data-label="Credit Mark"><ChangeBar v={c.markChangePct} max={campaignMax} /></td>
                    <td data-label="Debt ceiling"><ChangeBar v={c.ceilingChangePct} max={campaignMax} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {r.snapshots && r.snapshots.length ? (
        <section className="section">
          <h2>Executable depth at every capture</h2>
          <p className="t-small ink-2">C(1%) in USDG: the largest sale that moves the price at most 1%, by walking the pool&apos;s ticks, at each capture{r.window.cliff ? `, around ${utcStamp(r.window.cliff)}` : ""}.</p>
          <div className="scroll-x">
            <table className="ptable report-table">
              <thead><tr><th>Asset</th>{r.snapshots.map((sn) => <th key={sn.capturedAt} className="num">{sn.capturedAt.slice(11, 16)} UTC<span className="t-small ink-3"> {sn.label}</span></th>)}</tr></thead>
              <tbody>
                {[...new Set(r.snapshots.flatMap((sn) => sn.assets.map((a) => a.symbol)))].map((sym) => (
                  <tr key={sym}>
                    <td data-label="Asset">{sym}</td>
                    {r.snapshots!.map((sn) => { const a = sn.assets.find((x) => x.symbol === sym); return <td key={sn.capturedAt} data-label={`${sn.capturedAt.slice(11, 16)} UTC`} className="num mono">{a && !a.error ? usd(a.c1 ?? null) ?? "Not measured" : "Not captured"}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {r.sessionVsClosed && r.sessionVsClosed.some((x) => x.regularReadings > 0) ? (
        <section className="section">
          <h2>Open against closed</h2>
          <p className="t-small ink-2">How far in-range liquidity moved from one reading to the next, on average, while the underlying market was in its regular session and while it was shut. Basis points; never measured across a hole in the record.</p>
          <div className="scroll-x">
            <table className="ptable report-table">
              <thead><tr><th>Asset</th><th>Market</th><th className="num">Open, bp per reading</th><th className="num">Readings</th><th className="num">Closed, bp per reading</th><th className="num">Readings</th></tr></thead>
              <tbody>
                {r.sessionVsClosed.map((x) => (
                  <tr key={x.symbol}>
                    <td data-label="Asset">{x.symbol}</td><td data-label="Market" className="ink-2">{x.market}</td>
                    <td data-label="Open" className="num mono">{x.meanAbsMoveBpRegular ?? "No session"}</td><td data-label="Readings" className="num mono">{group(String(x.regularReadings))}</td>
                    <td data-label="Closed" className="num mono">{x.meanAbsMoveBpClosed ?? "Not closed"}</td><td data-label="Readings" className="num mono">{group(String(x.closedReadings))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2>Findings</h2>
        <ol className="findings" role="list">
          {r.findings.map((f) => <li key={f.claim}><p className="t-serif finding-claim">{f.claim}</p><p className="t-small ink-2">{f.evidence}</p></li>)}
        </ol>
      </section>

      <section className="section">
        <h2>What this report does not show</h2>
        <ul className="report-limits">{r.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="t-small ink-3 mt-3">{r.method}</p>
      </section>

      <section className="section">
        <h2>Sources</h2>
        <dl className="proof-dl">
          {r.sources.map((s) => <div key={s.source}><dt className="mono">{s.source}</dt><dd className="ink-2">{group(String(s.observations))} observations, {utcStamp(s.firstAt)} to {utcStamp(s.lastAt)}</dd></div>)}
        </dl>
      </section>

      <section className="section">
        <h2>Appendix: pool by pool</h2>
        <p className="t-small ink-3">In-range liquidity L, protocol units (the pool&apos;s uint128 divided by 10<sup>18</sup>). L is not dollars; C(1%) is the dollar measure.</p>
        <div className="scroll-x">
          <table className="ptable report-table">
            <thead><tr><th>Pool</th><th className="num">L at start</th><th className="num">L at end</th><th className="num">Change</th><th className="num">L low</th><th className="num">L high</th><th className="num">Readings</th><th>Address</th></tr></thead>
            <tbody>
              {[...assets, ...routes].map((p) => (
                <tr key={p.pool}>
                  <td data-label="Pool">{p.symbol ?? "Route leg"}</td>
                  <td data-label="L at start" className="num mono">{liq(p.liquidityAtStart)}</td>
                  <td data-label="L at end" className="num mono">{liq(p.liquidityAtEnd)}</td>
                  <td data-label="Change" className="num mono">{pctText(p.changePct)}</td>
                  <td data-label="L low" className="num mono">{liq(p.liquidityMin)}</td>
                  <td data-label="L high" className="num mono">{liq(p.liquidityMax)}</td>
                  <td data-label="Readings" className="num mono">{group(String(p.observations))}</td>
                  <td data-label="Address"><a className="mono" href={explorerAddress(p.pool, 196)} target="_blank" rel="noreferrer">{shortHash(p.pool)}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {r.appendix ? (
        <section className="section">
          <h2>Appendix: executable depth in dollars <span className="t-label ink-3">· {r.appendix.label}</span></h2>
          <p className="t-small ink-2">{r.appendix.what}</p>
          <DivergingBars caption="Change in C(1%) across the window by asset" rows={r.appendix.rows.map((x) => ({ key: x.symbol, label: x.symbol, value: x.changePct, href: `/asset/${x.symbol}` }))} />
          <div className="scroll-x mt-4">
            <table className="ptable report-table">
              <thead><tr><th>Asset</th><th className="num">C(1%) near start, USDG</th><th>At</th><th className="num">C(1%) at end, USDG</th><th>At</th><th className="num">Change</th></tr></thead>
              <tbody>
                {r.appendix.rows.map((x) => (
                  <tr key={x.symbol}>
                    <td data-label="Asset">{x.symbol}</td>
                    <td data-label="C(1%) near start" className="num mono">{usdFull(x.c1AtStart) ?? "Not computable"}</td>
                    <td data-label="At" className="ink-3">{x.startAt ? utcStamp(x.startAt) : "n/a"}</td>
                    <td data-label="C(1%) at end" className="num mono">{usdFull(x.c1AtEnd) ?? "Not computable"}</td>
                    <td data-label="At" className="ink-3">{x.endAt ? utcStamp(x.endAt) : "n/a"}</td>
                    <td data-label="Change" className="num mono">{pctText(x.changePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock variants={[{ lang: "shell", code: r.appendix.reproduce }]} />
        </section>
      ) : null}

      <section className="section">
        <h2>Reproduce it</h2>
        <p className="t-small ink-2">{r.reproduce}</p>
        <CodeBlock variants={[{ lang: "shell", code: "pnpm --filter @kerb/engine market-time-report" }]} />
        <p className="mt-4"><a className="btn btn-sm" href={`${PUBLIC_API}/v1/market-time/${r.id}`} target="_blank" rel="noreferrer">Download the report JSON</a> <Link href="/proof" className="t-small">The live row counts behind it</Link></p>
      </section>
    </article>
  );
}
