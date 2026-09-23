/**
 * The Kerb whitepaper (V3 audit, operator request): the problem, the design, the standard, the
 * contracts, the consumers, the evidence and the limits, in one document. Every figure is dated;
 * live figures are linked rather than copied.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { ScrollSpy } from "@/components/kerb/ScrollSpy";

export const metadata: Metadata = { title: "Whitepaper", description: "Kerb: credit on the market's clock. The market-time risk layer for tokenized stocks on X Layer, its standard, contracts, consumers, evidence and limits." };

const SECTIONS = [
  { id: "abstract", label: "Abstract" }, { id: "problem", label: "The problem" }, { id: "principle", label: "The principle" }, { id: "measure", label: "Measurement" },
  { id: "terms", label: "The terms" }, { id: "covenant", label: "The covenant" }, { id: "attest", label: "Attestation" }, { id: "consumers", label: "Consumers" },
  { id: "evidence", label: "Evidence" }, { id: "limits", label: "Limits" }, { id: "next", label: "What comes next" },
];

export default function WhitepaperPage(): React.ReactElement {
  return (
    <div className="whitepaper">
      <header className="page-head">
        <span className="t-label">Whitepaper · version 1.0 · 23 Sep 2026 · Xyndicate Labs</span>
        <h1>Credit on the market&rsquo;s clock.</h1>
        <p className="lede">Kerb, the market-time risk layer for tokenized stocks on X Layer. <a href="/kerb-whitepaper.pdf" download>Download as PDF</a>.</p>
      </header>
      <div className="method-grid">
        <aside className="method-toc"><ScrollSpy items={SECTIONS} /></aside>
        <div className="method-body prose">
          <section id="abstract" className="method-section"><h2>Abstract</h2>
            <p>Tokenized stocks trade around the clock; the markets behind them do not. When New York or Hong Kong is shut, no new reference price arrives and the onchain pool becomes the only exit. A lender that sizes credit against a price, and not against that exit, lends more than it could liquidate at exactly the moments it would need to.</p>
            <p>Kerb measures the exit that is really there in X Layer pools, and how long a loan must survive before the next deep market, and publishes both as signed credit terms on X Layer mainnet every few minutes. Every term recomputes from its published inputs. Kerb Credit, a reference market on X Layer testnet, lends against those terms with a cure covenant at Last Call. Any contract can read them through KerbQuote; any agent can buy a decision-ready answer over x402; any developer can read them over a public API.</p>
          </section>
          <section id="problem" className="method-section"><h2>The problem</h2>
            <p>Three clocks run under every tokenized stock. The underlying exchange keeps its own calendar, with lunch breaks, holidays and early closes. Reference prices follow that calendar. Onchain liquidity follows neither: it moves with liquidity providers, incentives and the time of day. Kerb&rsquo;s first Market-Time Report measured 35,130 readings over a closed weekend on X Layer: seven of ten asset pools lost in-range liquidity, the largest by 49%.</p>
            <p>A collateral value that ignores this is precise and wrong. The question a lender must answer is not only what the collateral is worth, but whether it could be sold, and how long the loan must hold before it could.</p>
          </section>
          <section id="principle" className="method-section"><h2>The principle</h2>
            <p><strong>Never lend more than you can liquidate.</strong> Every design choice follows from it: measure the exit rather than assume it; tie each loan&rsquo;s margin to the horizon it must survive; never move the liquidation line under an open loan; and let anyone check every number.</p>
          </section>
          <section id="measure" className="method-section"><h2>Measurement</h2>
            <h3>Clock</h3><p>Each asset follows its underlying market&rsquo;s calendar, resolved identically off chain and on chain in KerbClock. A regime machine names the state of each asset with a strict resolution order: Halted, Stale, Corporate action, Reference closed, Pre-transition, Recovery, Thin, Normal, Deep.</p>
            <h3>Depth</h3><p>Every minute the collector reads each pool&rsquo;s price, in-range liquidity and initialised ticks. The engine walks the Uniswap V3 pool tick by tick in the direction of a sale and finds C(i), the largest sale that moves the price at most i. C(1%) is cross-checked against the OKX DEX aggregator quote at the same notionals; when they diverge beyond tolerance the smaller wins.</p>
            <h3>Mark</h3><p>The Credit Mark is the lower of the reference median and the pool price along the whole path to the loan asset, less a haircut set by the regime. It is conservative by construction and is not a mid-market price.</p>
          </section>
          <section id="terms" className="method-section"><h2>The terms (KTS 0.2)</h2>
            <p>The Kerb Terms Standard turns measurements into two loan-to-value limits and a debt ceiling. Under version 0.2, live since 21 Sep 2026, each mode&rsquo;s margin below the fixed liquidation line (LT) is tied to the horizon it must survive:</p>
            <div className="formula">{"carryMargin   = max(floorCarry,   k · v · g(H_next_deep) + s)\nsessionMargin = max(floorSession, k · v · g(H_cure)      + s)\ncarryLTV      = LT − carryMargin\nsessionMaxLTV = LT − sessionMargin\ndebtCeiling   = kCeiling · C(1%)"}</div>
            <p>Here g(H) is the 99th-percentile price gap over the horizon H from daily closes, v a recent-volatility scaler, k a stress multiplier and s the measured exit cost at the reference liquidation size. Before a long closure, Carry tightens because its horizon grows; Session Max, which only has to reach the next Last Call, does not. Across the 21 Sep New York close KOx Carry stepped from 55.60% to 51.57% for exactly that reason, and the attribution engine says so for every change.</p>
          </section>
          <section id="covenant" className="method-section"><h2>The covenant</h2>
            <p>A Carry loan needs no attention. A Session Max loan borrows more now and accepts a covenant: when Last Call opens, before the market weakens, the position must come back to its Carry target. If the owner does not act, anyone may cure it, repaying only the difference for a small bonus in collateral, while liquidity is still there. The liquidation line never moves; sessions move only how much may be borrowed and when a cure is due.</p>
          </section>
          <section id="attest" className="method-section"><h2>Attestation and reproducibility</h2>
            <p>The attester signs each report (EIP-712) and posts it to KerbTerms with the keccak256 of its complete input bundle. KerbTerms enforces guardrails the attester cannot loosen: bounded LTVs, a fixed liquidation line per asset, tighten-fast and loosen-slow steps with a cooldown, and a maximum report age after which terms are unusable. Every Kerb transaction carries the ERC-8021 Builder Code kt0hl6xyhlx8xmt.</p>
            <p>Anyone can fetch a bundle by its hash and recompute the terms with one command; <Link href="/proof">Proof</Link> does it live on the latest post.</p>
          </section>
          <section id="consumers" className="method-section"><h2>Consumers</h2>
            <ul>
              <li><strong>Kerb Credit</strong>, the reference market on X Layer testnet with mirror collateral: Carry or Session Max, Last Call, a public cure table, and a standing demo position every cycle.</li>
              <li><strong>Contracts</strong>, through KerbQuote on X Layer mainnet (max borrow, cure deadline and usability in one view call, valued exactly as Kerb Credit values collateral) and KerbMarkFeed (the Credit Mark behind a Chainlink-shaped feed that fails closed).</li>
              <li><strong>Agents</strong>, through Kerb Credit Check and Kerb Exit Check: one cent in USDT0 per call over x402 on X Layer, a deterministic answer with the transaction and inputs hash; and a free MCP server.</li>
              <li><strong>Developers</strong>, through a public API with no key, an SDK and an open hourly dataset.</li>
            </ul>
          </section>
          <section id="evidence" className="method-section"><h2>Evidence</h2>
            <p>The full credit lifecycle (deposit, Session Max borrow, Last Call, a stranger&rsquo;s cure, repay, withdraw) has run in real browsers on the live site with fresh wallets; the first paid agent call settled on X Layer mainnet on 23 Sep; KerbQuote and ten feeds are deployed and verified on mainnet; every deployment is a Sourcify exact match. Live counts, contracts and the latest recompute are on <Link href="/proof">Proof</Link>; the research is on <Link href="/research">Research</Link>.</p>
          </section>
          <section id="limits" className="method-section"><h2>Limits</h2>
            <p>Kerb is unaudited. One attester signs the terms. The reference price is issuer data with an independent check, not a verified oracle report. Credit runs on testnet with mirror collateral because the production tokens are restricted in some jurisdictions and real lending needs an audit first. Input bundles are served by the Kerb API since the free pinning quota ran out on 21 Sep. See the <Link href="/legal/risk">risk disclosure</Link>.</p>
          </section>
          <section id="next" className="method-section"><h2>What comes next</h2>
            <ol><li>A verified oracle reference (Chainlink Data Streams) as rung 1 for the Mark.</li><li>Several attesters with a threshold, and an audit.</li><li>Curator integrations that set supply caps from measured depth.</li><li>Real collateral, where the law and the audit allow.</li></ol>
          </section>
        </div>
      </div>
    </div>
  );
}
