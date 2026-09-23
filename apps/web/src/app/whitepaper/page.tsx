/**
 * The Kerb whitepaper (V3 audit): a paper, not a page of paragraphs. Title block, abstract, live
 * key figures, a diagram of the pipeline, the standard with its parameters as they are live, a
 * worked example from the record, the guardrails, the consumers, limits and references.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { ScrollSpy } from "@/components/kerb/ScrollSpy";
import { getParams, getProof, getStats } from "@/lib/api";
import { group } from "@/lib/format";

export const metadata: Metadata = { title: "Whitepaper", description: "Kerb: credit on the market's clock. The market-time risk layer for tokenized stocks on X Layer: the problem, the standard, the contracts, the consumers, the evidence and the limits." };
export const revalidate = 300;

const SECTIONS = [
  { id: "abstract", label: "Abstract" }, { id: "problem", label: "1. The problem" }, { id: "design", label: "2. Design" }, { id: "measure", label: "3. Measurement" },
  { id: "standard", label: "4. The standard" }, { id: "example", label: "5. A worked example" }, { id: "covenant", label: "6. The covenant" },
  { id: "guardrails", label: "7. Guardrails" }, { id: "consumers", label: "8. Consumers" }, { id: "evidence", label: "9. Evidence" },
  { id: "limits", label: "10. Limits" }, { id: "next", label: "11. What comes next" }, { id: "refs", label: "References" },
];

function Pipeline(): React.ReactElement {
  const stages = [["Clock", "market calendars"], ["Depth", "tick-walk C(1%)"], ["Mark", "conservative price"], ["Terms", "KTS 0.2, signed"]];
  const out = ["Kerb Credit", "KerbQuote", "Agents (x402)", "API and SDK"];
  return (
    <figure className="wp-fig">
      <svg viewBox="0 0 860 210" role="img" aria-label="Kerb pipeline: Clock, Depth, Mark and Terms feed four consumers">
        {stages.map(([t, s], i) => (
          <g key={t} transform={`translate(${i * 150},60)`}>
            <rect width="126" height="64" rx="2" className="wp-box" />
            <text x="63" y="28" textAnchor="middle" className="wp-t">{t}</text>
            <text x="63" y="47" textAnchor="middle" className="wp-s">{s}</text>
            {i < 3 ? <path d={`M126 32 H150`} className="wp-arrow" markerEnd="url(#wp-ah)" /> : null}
          </g>
        ))}
        <path d="M576 92 H616" className="wp-arrow" />
        {out.map((t, i) => (
          <g key={t} transform={`translate(640,${6 + i * 50})`}>
            <path d={`M-24 86 L-24 ${86 - (86 - 20 - 0)} `} className="wp-none" />
            <rect width="210" height="40" rx="2" className="wp-box wp-out" />
            <text x="105" y="25" textAnchor="middle" className="wp-t2">{t}</text>
          </g>
        ))}
        {out.map((t, i) => <path key={t} d={`M616 92 C628 92 628 ${26 + i * 50} 640 ${26 + i * 50}`} className="wp-arrow" markerEnd="url(#wp-ah)" />)}
        <defs><marker id="wp-ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" className="wp-head" /></marker></defs>
      </svg>
      <figcaption>Figure 1. Measurements become terms on X Layer mainnet; four kinds of consumer read the same terms.</figcaption>
    </figure>
  );
}

export default async function WhitepaperPage(): Promise<React.ReactElement> {
  const [stats, proof, params] = await Promise.all([getStats(), getProof(), getParams()]);
  const posts = stats.ok ? stats.data.postsByChain.find((p) => p.chainId === 196)?.count ?? null : null;
  const deployments = proof.ok ? proof.data.onchain.deployments.length : null;
  const cap = params.ok ? (params.data as unknown as { capacityDefaults?: Record<string, string>; asymmetry?: Record<string, string | number>; paramsVersion?: string }) : null;
  const c = cap?.capacityDefaults ?? {};
  const pct = (x?: string): string => (x ? `${(Number(x) * 100).toFixed(0)}%` : "not read");
  return (
    <div className="whitepaper">
      <header className="wp-title">
        <span className="t-label">Whitepaper · version 1.0 · 23 September 2026</span>
        <h1>Kerb: credit on the market&rsquo;s clock.</h1>
        <p className="wp-sub">The market-time risk layer for tokenized stocks on X Layer.</p>
        <dl className="wp-meta">
          <div><dt className="t-label">Authors</dt><dd>Xyndicate Labs</dd></div>
          <div><dt className="t-label">Standard</dt><dd>KTS 0.2, params {cap?.paramsVersion ?? "not read"}</dd></div>
          <div><dt className="t-label">Source</dt><dd><a href="https://github.com/Franlinozz/Kerb" target="_blank" rel="noreferrer">github.com/Franlinozz/Kerb</a></dd></div>
          <div><dt className="t-label">Formats</dt><dd><a href="/kerb-whitepaper.pdf" download>PDF</a></dd></div>
        </dl>
      </header>

      <div className="method-grid">
        <aside className="method-toc"><ScrollSpy items={SECTIONS} /></aside>
        <article className="method-body wp-body">
          <section id="abstract" className="wp-abstract">
            <span className="t-label">Abstract</span>
            <p>Tokenized stocks trade around the clock; the markets behind them do not. When New York or Hong Kong is shut, no new reference price arrives and the onchain pool becomes the only exit. A lender that sizes credit against a price rather than against that exit lends more than it could liquidate at exactly the moments it would need to. Kerb measures the exit that is really there in X Layer pools, and how long a loan must survive before the next deep market, and publishes both as signed credit terms on X Layer mainnet every few minutes. Every term recomputes from its published inputs. A reference credit market, any contract, any agent and any developer read the same terms.</p>
          </section>

          <dl className="wp-figures">
            <div><dt className="t-label">Terms posted on mainnet</dt><dd>{posts === null ? "Not read" : group(String(posts))}</dd></div>
            <div><dt className="t-label">Pool readings stored</dt><dd>{stats.ok ? group(String(stats.data.obsPoolRows)) : "Not read"}</dd></div>
            <div><dt className="t-label">Assets · markets</dt><dd>{stats.ok ? `${stats.data.assets} · ${stats.data.markets}` : "Not read"}</dd></div>
            <div><dt className="t-label">Contracts, Sourcify exact</dt><dd>{deployments ?? "Not read"}</dd></div>
          </dl>
          <p className="t-small ink-3">Live figures, read when this page was rendered. <Link href="/proof">Proof</Link> checks them.</p>

          <section id="problem" className="method-section"><h2>1. The problem</h2>
            <p>Three clocks run under every tokenized stock. The exchange keeps its own calendar, with lunch breaks, holidays and early closes. Reference prices follow that calendar. Onchain liquidity follows neither: it moves with liquidity providers, incentives and the hour. Kerb&rsquo;s first Market-Time Report measured 35,130 readings over one closed weekend on X Layer: seven of ten asset pools lost in-range liquidity, the largest by 49%.</p>
            <p>A collateral value that ignores this is precise and wrong. The questions a lender must answer are whether the collateral could be sold, and how long the loan must hold before it could.</p>
          </section>

          <section id="design" className="method-section"><h2>2. Design</h2>
            <blockquote className="wp-quote">Never lend more than you can liquidate.</blockquote>
            <p>Every choice follows from that sentence: measure the exit rather than assume it; tie each loan&rsquo;s margin to the horizon it must survive; never move the liquidation line under an open loan; let anyone check every number; keep models out of anything that produces a number.</p>
            <Pipeline />
          </section>

          <section id="measure" className="method-section"><h2>3. Measurement</h2>
            <h3>3.1 Clock</h3><p>Each asset follows its underlying market&rsquo;s calendar, resolved identically off chain and on chain in KerbClock. A regime machine names the state of each asset in a strict order: Halted, Stale, Corporate action, Reference closed, Pre-transition, Recovery, Thin, Normal, Deep. The first rule that holds wins.</p>
            <h3>3.2 Depth</h3><p>Every minute the collector reads each pool&rsquo;s price, in-range liquidity and initialised ticks. The engine walks the Uniswap V3 pool tick by tick in the direction of a sale and finds C(i), the largest sale that moves the price at most i. C(1%) is cross-checked against the OKX DEX aggregator at the same notionals; when the two diverge beyond tolerance, the smaller wins.</p>
            <h3>3.3 Mark</h3><p>The Credit Mark is the lower of the reference median and the pool price along the whole path to the loan asset, less a haircut set by the regime. It is conservative by construction; it is not a mid-market price.</p>
          </section>

          <section id="standard" className="method-section"><h2>4. The standard (KTS 0.2)</h2>
            <p>The Kerb Terms Standard turns measurements into two loan-to-value limits and two debt limits. Each mode&rsquo;s margin below the fixed liquidation threshold LT is tied to the horizon it must survive:</p>
            <div className="formula">{"carryMargin    = max(floorCarry,   k · v · g(H_next_deep) + s)\nsessionMargin  = max(floorSession, k · v · g(H_cure)      + s)\ncarryLTV       = LT − carryMargin\nsessionMaxLTV  = LT − sessionMargin\ndebtCeiling    = kCeiling · C(1%)\nmaxPositionDebt = min(capAbs, capShare · C(1%))"}</div>
            <p>g(H) is the 99th-percentile price gap over a horizon of H hours from five years of daily closes; v is a recent-volatility scaler; s is the measured exit cost at the reference liquidation size. Before a long closure, Carry tightens because its horizon grows, while Session Max, which only has to reach the next Last Call, does not.</p>
            <table className="ptable wp-table">
              <caption className="sr-only">KTS 0.2 parameters as live</caption>
              <thead><tr><th>Parameter</th><th>Live value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td>k</td><td className="mono">{c["stressMultiplier"] ?? "not read"}</td><td>Stress multiplier on the horizon gap</td></tr>
                <tr><td>floorCarry, floorSession</td><td className="mono">{pct(c["minCarryMargin"])}, {pct(c["minSessionMargin"])}</td><td>Smallest margin each mode may keep</td></tr>
                <tr><td>kCeiling</td><td className="mono">{c["k"] ?? "not read"}</td><td>Debt ceiling as a multiple of C(1%)</td></tr>
                <tr><td>capAbs, capShare</td><td className="mono">{c["positionCapAbs"] ? `$${group(c["positionCapAbs"])}` : "not read"}, {pct(c["positionCapShare"])}</td><td>Largest single position</td></tr>
                <tr><td>Reference liquidation size</td><td className="mono">{c["referenceLiquidationSize"] ? `$${group(c["referenceLiquidationSize"])}` : "not read"}</td><td>Size at which exit cost s is measured</td></tr>
                <tr><td>Loosen step, cooldown</td><td className="mono">{cap?.asymmetry ? `${pct(String(cap.asymmetry["maxLoosenStep"]))}, ${Number(cap.asymmetry["recoveryCooldownSec"]) / 60} min` : "not read"}</td><td>How fast terms may loosen</td></tr>
              </tbody>
            </table>
          </section>

          <section id="example" className="method-section"><h2>5. A worked example</h2>
            <p>At the New York close on 21 September 2026 the horizon KOx&rsquo;s Carry must survive grew from 17 h 31 m to 41 h 26 m, spanning the night and the next session&rsquo;s gap. The stressed gap over that horizon rose from 3.63% to 5.41%.</p>
            <table className="ptable wp-table">
              <thead><tr><th>KOx</th><th className="num">Before 20:00 UTC</th><th className="num">After</th><th>Cause</th></tr></thead>
              <tbody>
                <tr><td>Carry</td><td className="num mono">55.60%</td><td className="num mono">51.57%</td><td>Horizon −4.11 pts, loosening cap +0.08, exit cost 0.00</td></tr>
                <tr><td>Session Max</td><td className="num mono">61.20%</td><td className="num mono">54.47%</td><td>Margin left its floor as the cure horizon grew</td></tr>
              </tbody>
            </table>
            <p>The causes sum to the posted move exactly. Across 2,186 attributed changes in the record, the unexplained residual is zero. Every asset page shows its own changes with their causes.</p>
          </section>

          <section id="covenant" className="method-section"><h2>6. The covenant</h2>
            <p>A Carry loan needs no attention. A Session Max loan borrows more now and accepts a covenant: when Last Call opens, before the market weakens, the position must come back to its Carry target. If the owner does not act, anyone may cure it, repaying only the difference for a small bonus in collateral, while liquidity is still there. The liquidation line never moves; sessions move only how much may be borrowed and when a cure is due.</p>
          </section>

          <section id="guardrails" className="method-section"><h2>7. Attestation and guardrails</h2>
            <p>The attester signs each report (EIP-712) and posts it to KerbTerms with the keccak256 of its complete input bundle; every Kerb transaction carries the ERC-8021 Builder Code kt0hl6xyhlx8xmt. KerbTerms enforces what the attester cannot change: bounded LTVs, a fixed liquidation line per asset, tightening at once and loosening in steps after a cooldown, and a maximum report age after which terms are unusable. Anyone can fetch a bundle by its hash and recompute the terms with one command.</p>
          </section>

          <section id="consumers" className="method-section"><h2>8. Consumers</h2>
            <table className="ptable wp-table">
              <thead><tr><th>Consumer</th><th>How it reads Kerb Terms</th><th>Where</th></tr></thead>
              <tbody>
                <tr><td>Kerb Credit</td><td>Carry or Session Max, Last Call, a public cure table, a standing demo position every cycle</td><td>X Layer testnet</td></tr>
                <tr><td>Contracts</td><td>KerbQuote: max borrow, cure deadline, usability in one view call. KerbMarkFeed: the Credit Mark as a Chainlink-shaped feed that fails closed</td><td>X Layer mainnet</td></tr>
                <tr><td>Agents</td><td>Kerb Credit Check and Exit Check, one cent in USDT0 per call over x402; a free MCP server</td><td>X Layer mainnet</td></tr>
                <tr><td>Developers</td><td>A public API with no key, an SDK and an open hourly dataset</td><td>api.usekerb.xyz</td></tr>
              </tbody>
            </table>
          </section>

          <section id="evidence" className="method-section"><h2>9. Evidence</h2>
            <ul>
              <li>The full credit lifecycle (deposit, Session Max borrow, Last Call, a stranger&rsquo;s cure, repay, withdraw) has run in real browsers on the live site with fresh wallets.</li>
              <li>The first paid agent call settled in USDT0 on X Layer mainnet on 23 September 2026.</li>
              <li>KerbQuote and ten Credit Mark feeds are deployed on mainnet; their valuation equals Kerb Credit&rsquo;s to the wei, in fuzz tests and live.</li>
              <li>Every deployment is a Sourcify exact match; the latest term is recomputed live on <Link href="/proof">Proof</Link>.</li>
            </ul>
          </section>

          <section id="limits" className="method-section"><h2>10. Limits</h2>
            <p>Kerb is unaudited. One attester signs the terms. The reference price is issuer data with an independent check, not a verified oracle report. Credit runs on testnet with mirror collateral: the production tokens are restricted in some jurisdictions, and lending real money needs an audit first. Input bundles are served by the Kerb API since the free pinning quota ran out on 21 September. See the <Link href="/legal/risk">risk disclosure</Link>.</p>
          </section>

          <section id="next" className="method-section"><h2>11. What comes next</h2>
            <ol><li>A verified oracle reference (Chainlink Data Streams) as the first rung for the Mark.</li><li>Several attesters with a threshold, and an audit.</li><li>Curator integrations that set supply caps from measured depth.</li><li>Real collateral, where the law and the audit allow.</li></ol>
          </section>

          <section id="refs" className="method-section"><h2>References</h2>
            <ol className="wp-refs">
              <li>Kerb Terms Standard 0.1 and the 0.2 amendment: <a href="https://github.com/Franlinozz/Kerb/blob/main/docs/KTS-0.1.md">docs/KTS-0.1.md</a>, <a href="https://github.com/Franlinozz/Kerb/blob/main/docs/v2/KTS-0.2.md">docs/v2/KTS-0.2.md</a>.</li>
              <li>Market-Time Report #1: <Link href="/research/1">usekerb.xyz/research/1</Link>.</li>
              <li>API reference with captured responses: <a href="https://github.com/Franlinozz/Kerb/blob/main/docs/API.md">docs/API.md</a>.</li>
              <li>Contracts, posts and the live recompute: <Link href="/proof">usekerb.xyz/proof</Link>.</li>
            </ol>
          </section>
        </article>
      </div>
    </div>
  );
}
