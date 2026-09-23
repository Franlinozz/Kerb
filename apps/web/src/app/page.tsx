/**
 * Home (V2-06, V2-DESIGN-SYSTEM.md section 11.1): the editorial front page. Server-rendered and
 * revalidated every 15 s; the rails, clocks and the Tape refresh on the client. Every section
 * stands alone: a source that fails shows its own ErrorState and the page still renders.
 */
import Link from "@/components/ui/Link";
import { Suspense } from "react";
import { ArtPlate } from "@/components/ui/ArtPlate";
import { mobileSrcSet, srcSet } from "@/lib/art";
import { AddressChip } from "@/components/ui/AddressChip";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Kpi } from "@/components/ui/Kpi";
import { ProvMark } from "@/components/ui/ProvMark";
import { SectionHead } from "@/components/ui/SectionHead";
import { BoardPreview } from "@/components/kerb/BoardPreview";
import { LtvLadder } from "@/components/kerb/LtvLadder";
import { MarketClocks } from "@/components/kerb/MarketClocks";
import { REGIME_WORD } from "@/components/kerb/RegimePill";
import { LanesRail } from "@/components/kerb/SessionRail";
import { Tape } from "@/components/kerb/Tape";
import { getBoard, getClock, getProof, getReport, getStats, getTape, type BoardRow } from "@/lib/api";
import { BUILDER_CODE } from "@/lib/builderCode";
import { byDecimalDesc, group, price, shift, shortHash, round, usd, usdFull, ltv } from "@/lib/format";
import { dayHm, railWindow, utcHm, localHm, transitionWord } from "@/lib/time";
import { KIND_WORD } from "@/lib/sessionWords";

export const revalidate = 15;

const OKLINK = "https://www.oklink.com/xlayer";

/** Borrowing power for $10,000 of collateral at an LTV: exact, on the string. */
const powerAt = (l: string | null): string | null => (l === null ? null : round(shift(l, 4), 2));

function Callout({ style, label, value, side }: { style: React.CSSProperties; label: string; value: string; side: "left" | "right" }): React.ReactElement {
  return (
    <div className={`hero-callout hero-callout-${side}`} style={style}>
      {side === "right" ? <i aria-hidden="true" /> : null}
      <span className="t-label">{label}<br /><b>{value}</b></span>
      {side === "left" ? <i aria-hidden="true" /> : null}
    </div>
  );
}

export default async function Home(): Promise<React.ReactElement> {
  const w = railWindow(Date.now());
  const [board, stats, tape, ny, hk, proof] = await Promise.all([getBoard(), getStats(), getTape(40), getClock("KOx", 196, w), getClock("HKEXCx", 196, w), getProof()]);
  const rows: BoardRow[] = board.ok ? [...board.data.rows].sort(byDecimalDesc((r) => r.debtCeiling.value)) : [];
  const lead = rows[0];
  const hkLead = rows.find((r) => r.underlying.market === "XHKG" && r !== lead);
  const report = lead ? await getReport(lead.symbol) : null;
  const mainnetPosts = stats.ok ? stats.data.postsByChain.find((p) => p.chainId === 196)?.count ?? null : null;
  const deployments = proof.ok ? proof.data.onchain.deployments.filter((d) => d.chainId === 196) : [];
  const tests = proof.ok ? proof.data.build.tests : null;

  return (
    <div className="home">
      {/* ---------------------------------------------------------------- hero */}
      <section className="hero construct" aria-labelledby="hero-title">
        <div className="construct-grid" aria-hidden="true" />
        <span className="cross hero-cross-tl" aria-hidden="true" /><span className="cross hero-cross-tr" aria-hidden="true" />
        <span className="cross hero-cross-bl" aria-hidden="true" /><span className="cross hero-cross-br" aria-hidden="true" />
        {/* The hero is the Largest Contentful Paint. Its <img> is lazy until the theme is known, so
            the preload scanner cannot find it: preload the Night variant (the default) here, the
            phone crop and the desktop set under their own media queries. */}
        <link rel="preload" as="image" type="image/avif" fetchPriority="high" media="(max-width: 760px)" imageSrcSet={mobileSrcSet("p1-kerbstone-night", "avif") ?? undefined} imageSizes="100vw" />
        <link rel="preload" as="image" type="image/avif" fetchPriority="high" media="(min-width: 761px)" imageSrcSet={srcSet("p1-kerbstone-night", "avif")} imageSizes="62vw" />
        <div className="hero-art" aria-hidden="false">
          <ArtPlate id="p1-kerbstone-night" sizes="(max-width: 760px) 100vw, 62vw" priority mask="hero" className="hero-plate" />
          <ArtPlate id="p1-kerbstone-day" sizes="(max-width: 760px) 100vw, 62vw" priority mask="hero" className="hero-plate" />
          {/* The painted theme is known only in the browser: promote that variant to eager right here,
              before layout, so the hero is the first thing fetched and the other variant never is. */}
          <script dangerouslySetInnerHTML={{ __html: "(function(){try{var t=document.documentElement.getAttribute('data-theme')||'night';var i=document.querySelector('.hero-art .art-'+t+' img');if(i){i.loading='eager';i.fetchPriority='high';}}catch(e){}})();" }} />
          {lead ? <Callout side="left" style={{ left: "17%", top: "30%" }} label={`${lead.symbol} · ${lead.regime.value ? REGIME_WORD[lead.regime.value] : "Not yet posted"}`} value={`C(1%) ${usd(lead.executableDepth1.value) ?? "not yet posted"}`} /> : null}
          {hkLead ? <Callout side="left" style={{ left: "24%", bottom: "7%" }} label={`${hkLead.symbol} · ${hkLead.regime.value ? REGIME_WORD[hkLead.regime.value] : "Not yet posted"}`} value={`C(1%) ${usd(hkLead.executableDepth1.value) ?? "not yet posted"}`} /> : null}
        </div>
        <div className="hero-copy">
          <div className="t-label hero-stack">Tokenized equities<br />Executable liquidity<br />Market time<br />X Layer 196<span className="rule" aria-hidden="true" /></div>
          <h1 id="hero-title" className="t-display-xl hero-title">
            <span className="hero-line">Credit on the</span>
            <span className="hero-line t-olive">market&rsquo;s clock.</span>
          </h1>
          <p className="t-body-l ink-2 hero-lede">Tokenized stocks trade around the clock. Liquidation conditions don&rsquo;t. Kerb measures the exit in real X Layer pools, then lends against it.</p>
          <div className="row hero-actions">
            <ButtonLink href="/board" variant="primary">Open the Board</ButtonLink>
            <ButtonLink href="/credit">Borrow on testnet</ButtonLink>
          </div>
          <div className="hero-clocks-m show-sm"><MarketClocks compact /></div>
          <div className="t-label ink-3 hero-creed">Never lend more than you can liquidate.</div>
        </div>
        <div className="hero-clocks hide-sm">
          <MarketClocks align="right" />
        </div>
        <nav className="hero-crumbs t-label ink-3 hide-sm" aria-label="Sections">
          <Link href="/board">Board</Link> / <Link href="/credit">Credit</Link> / <Link href="/research">Research</Link> / <Link href="/proof">Proof</Link>
        </nav>
      </section>

      <Suspense><div className="home-tape"><Tape initial={tape.ok ? tape.data : null} /></div></Suspense>

      {/* ---------------------------------------------------------------- hours */}
      <section className="home-section">
        <SectionHead label="Session rail · two markets · one clock" annotation={`${utcHm(Date.now())} UTC`} title="Every asset keeps its own hours."
          lede="New York and Hong Kong open, break and close on their own calendars. The tokens never stop trading. Kerb tracks the difference, live." />
        <Suspense>{ny.ok && hk.ok ? <LanesRail initial={{ ny: ny.data, hk: hk.data }} /> : <ErrorState source="The Clock API" />}</Suspense>
      </section>

      {/* ---------------------------------------------------------------- measured */}
      <section className="home-section">
        <SectionHead label="The record so far" annotation={stats.ok ? `${stats.data.assets} assets · ${stats.data.markets} markets` : undefined} title="Measured, not modelled." />
        {stats.ok ? (
          <div className="kpi-row">
            <Kpi size="xl" label="Pool observations stored" value={group(String(stats.data.obsPoolRows))} prov="Observed" source="obs_pool_state, append-only, one row per pool per minute" href="/proof" />
            <Kpi size="xl" label="Terms posted on X Layer mainnet" value={mainnetPosts === null ? null : group(String(mainnetPosts))} prov="Verified" source="TermsPosted events on KerbTerms, chain 196" href="/proof" />
            {stats.data.latestReport ? (
              <div className="kpi">
                <span className="t-label">Market-Time Report #{stats.data.latestReport.id} · largest fall</span>
                <span className="kpi-value"><span className="t-num-xl">{stats.data.latestReport.figure ?? "Not measured"}</span><ProvMark label="Observed" source={`Market-Time Report #${stats.data.latestReport.id}, from the observation store`} href={`/research/${stats.data.latestReport.id}`} hrefLabel="Read the report" /></span>
                <span className="kpi-delta">{stats.data.latestReport.headline} <Link href={`/research/${stats.data.latestReport.id}`}>Read it</Link></span>
              </div>
            ) : null}
          </div>
        ) : <ErrorState source="The stats endpoint" />}
      </section>

      {/* ---------------------------------------------------------------- how a term is made */}
      <section className="home-section band-forest">
        <div className="band-inner">
          <div className="band-copy">
            <span className="t-label">KTS {lead?.kts ?? "0.2"} · {lead?.symbol ?? "lead asset"} · five layers</span>
            <h2>How a term is made.</h2>
            <p>Five layers, each measured or computed from the one below, each published in an input bundle anyone can fetch and recompute.</p>
            <Link className="btn btn-sm band-btn" href="/methodology">Read the methodology</Link>
          </div>
          {report?.ok && lead ? (
            <ol className="layers" role="list">
              <li><span className="t-label">Clock</span><p>{(() => { const c = lead.underlying.market === "XHKG" ? hk : ny; return c.ok ? `${lead.underlying.market}: ${KIND_WORD[c.data.clock.session.kind].toLowerCase()} now.` : `${lead.underlying.market}: the clock is being read.`; })()} {lead.next ? `${transitionWord(lead.next.type)} at ${utcHm(Date.parse(lead.next.at))} UTC.` : ""}</p></li>
              <li><span className="t-label">Depth</span><p>C(1%) {usd(report.data.depth.C_1)} from a tick-walk of pool <span className="mono">{shortHash(report.data.depth.venues[0]?.pools[0] ?? lead.pool.address, 6, 4)}</span>, cross-checked against OKX DEX quotes.</p></li>
              <li><span className="t-label">Mark</span><p>Credit Mark {price(report.data.mark.creditMark)}: the lower of the reference median and the pool price, after a {round(shift(report.data.mark.haircut, 2), 2)}% regime haircut.</p></li>
              <li><span className="t-label">Terms</span><p>Carry {ltv(report.data.capacity.carryLTV)}, Session Max {ltv(report.data.capacity.sessionMaxLTV)}, liquidation {ltv(report.data.capacity.LT)} fixed; debt ceiling {usd(report.data.capacity.debtCeiling)}.</p></li>
              <li><span className="t-label">Credit</span><p>Kerb Credit lends against those terms on X Layer testnet, with a cure covenant that opens at Last Call.</p></li>
            </ol>
          ) : <div className="layers"><ErrorState source="The report for the lead asset" /></div>}
        </div>
      </section>

      {/* ---------------------------------------------------------------- survive */}
      <section className="home-section">
        <SectionHead label={lead ? `KTS ${lead.kts ?? "0.1"} · ${lead.symbol} · ${lead.underlying.market}` : "Carry and Session Max"} annotation="for $10,000 of collateral" title="How long should your loan survive without you?" />
        {lead ? (
          <>
            <div className="modes">
              <div className="mode-card">
                <span className="t-label">Carry</span>
                <span className="t-num-xl">{usdFull(powerAt(lead.carryLTV.value)) ?? "Not yet posted"}</span>
                <p className="ink-2">Sized to survive until {lead.margins ? `${dayHm(Date.parse(lead.margins.carry.horizonEndsAt))} UTC` : "the next deep market"} without you. No cure events.</p>
              </div>
              <div className="mode-card mode-card-on">
                <span className="t-label">Session Max</span>
                <span className="t-num-xl">{usdFull(powerAt(lead.sessionMaxLTV.value)) ?? "Not yet posted"}</span>
                <p className="ink-2">More now, with a promise: cure back to Carry {lead.cure ? `by ${utcHm(Date.parse(lead.cure.closesAt))} UTC (${localHm(Date.parse(lead.cure.closesAt), lead.market?.tz ?? "UTC")})` : "before the session weakens"}, while liquidity is deep.</p>
              </div>
            </div>
            <div className="mt-6"><LtvLadder carry={lead.carryLTV.value} session={lead.sessionMaxLTV.value} lt={lead.lt?.value ?? null} kts={lead.kts ?? null} margins={lead.margins ?? null} /></div>
            <div className="row mt-5"><ButtonLink href="/credit" variant="primary">Try it on testnet</ButtonLink><span className="t-small ink-3">Computed from the posted terms for {lead.symbol}. Borrowing power is LTV times $10,000 of collateral at the Credit Mark.</span></div>
          </>
        ) : <ErrorState source="The Board" />}
      </section>

      {/* ---------------------------------------------------------------- board */}
      <section className="home-section">
        <SectionHead label={`The Board · X Layer 196 · ${rows.length} assets`} annotation={<Link href="/board">All {rows.length} assets</Link>} title="What each stock can safely support, right now." />
        <Suspense>{rows.length ? <BoardPreview rows={rows.slice(0, 5)} /> : <ErrorState source="The Board" />}</Suspense>
      </section>

      {/* ---------------------------------------------------------------- verify */}
      <section className="home-section band-forest band-verify">
        <div className="band-inner band-inner-single">
          <span className="t-label">Proof · X Layer mainnet 196</span>
          <h2 className="t-h1">Verify everything.</h2>
          <p>Every term is signed, posted on chain with the hash of its inputs, and recomputes from those published inputs with one command.</p>
          <div className="row mt-5">
            {deployments.map((d) => <span key={d.key} className="band-chip"><span className="t-label">{d.contract}</span><AddressChip value={d.address} href={`${OKLINK}/address/${d.address}`} label={d.contract} /></span>)}
            <span className="band-chip"><span className="t-label">Builder Code</span><span className="chip">{BUILDER_CODE}</span></span>
            {tests ? <span className="band-chip"><span className="t-label">Tests, measured {tests.finishedAt.slice(0, 10)}</span><span className="chip">{tests.typescript.passed} TS · {tests.solidity.passed} Sol</span></span> : null}
          </div>
          <div className="row mt-6"><Link className="btn band-btn-primary" href="/proof">Open the proof</Link></div>
        </div>
      </section>
    </div>
  );
}
