/**
 * Docs (V3, operator request): how to use Kerb end to end, as a borrower, a lender, a developer, a
 * contract and an agent. Concepts link to Methodology for the rules; every address is read from
 * the live deployment list, never typed by hand.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ScrollSpy } from "@/components/kerb/ScrollSpy";
import { FaqBrowser } from "@/components/kerb/FaqBrowser";
import { TourLink } from "@/components/shell/Tour";
import { FAQ } from "@/lib/faq";
import { getProof, PUBLIC_API } from "@/lib/api";
import { shortHash } from "@/lib/format";

export const metadata: Metadata = { title: "Docs", description: "How to use Kerb: the concepts, borrowing and curing on Kerb Credit, reading Kerb Terms over REST, from a contract with KerbQuote, and from an agent over x402 or MCP." };
export const revalidate = 300;

const SECTIONS = [
  { id: "overview", label: "Overview" }, { id: "concepts", label: "Concepts" }, { id: "borrow", label: "Borrow and cure" },
  { id: "rest", label: "REST and SDK" }, { id: "contracts", label: "From a contract" }, { id: "agents", label: "From an agent" },
  { id: "verify", label: "Verify a number" }, { id: "addresses", label: "Addresses" }, { id: "limits", label: "Limits" }, { id: "glossary", label: "Glossary" }, { id: "faq", label: "FAQ" },
];

const CONCEPTS: [string, string][] = [
  ["Clock", "Each tokenized stock follows its underlying market's calendar: NYSE, Nasdaq, NYSE Arca or HKEX with its lunch break, holidays included. KerbClock resolves the same calendar on chain."],
  ["Regime", "The market-time state of an asset right now: Deep, Normal, Thin, Pre-transition, Reference closed, Recovery, Corporate action, Halted or Stale. The first rule that holds wins."],
  ["C(1%)", "Executable depth: the largest sale the real X Layer pool absorbs while moving the price at most 1%, found by walking the Uniswap V3 pool tick by tick and cross-checked against the OKX DEX quote. The smaller wins."],
  ["Credit Mark", "A conservative price per token: the lower of the reference median and the pool price along the whole path to USDG, less a haircut set by the regime. Not a mid-market price."],
  ["Carry", "The LTV a loan may carry unattended until the next deep session. Its margin below the fixed liquidation line grows with how long it must survive (KTS 0.2)."],
  ["Session Max", "More borrowing now, with a promise: at Last Call the position returns to its Carry target. Its margin only has to reach the cure deadline."],
  ["Last Call and cure", "A window before the market weakens. A Session Max position above its Carry target must be cured back to it; after the owner, anyone may cure it for a small bonus in collateral, and only the difference is repaid."],
  ["Liquidation threshold", "Fixed per asset at listing and timelocked. Sessions move borrowing capacity and the covenant, never the line under a live borrower."],
  ["Debt ceiling", "Market-wide debt capacity, a multiple of measured C(1%). It tightens at once when depth falls and loosens in small steps after a cooldown."],
];

export default async function DocsPage(): Promise<React.ReactElement> {
  const proof = await getProof();
  const deps = proof.ok ? proof.data.onchain.deployments : [];
  const addr = (chainId: number, contract: string): { address: string; explorer: string } | null => {
    const d = deps.find((x) => x.chainId === chainId && x.contract === contract);
    return d ? { address: d.address, explorer: d.explorer } : null;
  };
  const quote = addr(196, "KerbQuote");
  const rows: [string, string, { address: string; explorer: string } | null][] = [
    ["KerbTerms", "X Layer mainnet", addr(196, "KerbTerms")], ["KerbClock", "X Layer mainnet", addr(196, "KerbClock")],
    ["KerbQuote", "X Layer mainnet", quote], ["KerbMarkFeedFactory", "X Layer mainnet", addr(196, "KerbMarkFeedFactory")],
    ["KerbCredit", "X Layer testnet", addr(1952, "KerbCredit")], ["KerbClockDemo", "X Layer testnet", addr(1952, "KerbClockDemo")],
  ];

  return (
    <div className="docs">
      <header className="page-head">
        <span className="t-label">Docs · Kerb Terms and its consumers</span>
        <h1>How to use Kerb.</h1>
        <p className="lede">Kerb measures how much of a tokenized-stock position could really be sold in X Layer pools and how long a loan must survive before the next deep market, and posts both as credit terms on X Layer mainnet every few minutes. Here is how to use them: as a borrower, from code, from a contract, and from an agent.</p>
        <div className="row mt-5" style={{ gap: 10 }}><TourLink className="btn btn-primary">Take the 60-second tour</TourLink><Link className="btn" href="/whitepaper">Read the whitepaper</Link></div>
      </header>
      <div className="method-grid">
        <aside className="method-toc"><ScrollSpy items={SECTIONS} /></aside>
        <div className="method-body">
          <section id="overview" className="method-section">
            <h2>Overview</h2>
            <p>One set of terms, four consumers. <Link href="/credit">Kerb Credit</Link> is the reference market that lends against them on testnet. Agents buy a decision-ready credit check for one cent over x402. Any X Layer contract reads them in one call through KerbQuote. Developers read them over REST with no key, or through the SDK and the MCP server.</p>
            <p>The rules behind every number are the Kerb Terms Standard, on <Link href="/methodology">Methodology</Link>. The evidence for every claim is on <Link href="/proof">Proof</Link>.</p>
          </section>

          <section id="concepts" className="method-section">
            <h2>Concepts</h2>
            <dl className="docs-concepts">{CONCEPTS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd className="ink-2">{d}</dd></div>)}</dl>
          </section>

          <section id="borrow" className="method-section">
            <h2>Borrow and cure on Kerb Credit</h2>
            <ol className="docs-steps">
              <li>Open <Link href="/credit">Credit</Link> and connect a browser wallet; the page adds X Layer testnet (1952).</li>
              <li>Get test OKB for gas from the <a href="https://www.okx.com/xlayer/faucet" target="_blank" rel="noreferrer">X Layer faucet</a>, then mint mirror collateral and mUSDG with the buttons in Get set up.</li>
              <li>Deposit, choose Carry or Session Max, and borrow. The page shows why each limit is what it is.</li>
              <li>The demo clock runs a trading week every hour. When its Last Call opens, a Session Max position above its Carry target appears in Curable now. Repay the difference, or let anyone cure it. You can ask the page to notify you, or follow your address on Telegram with <a href="https://t.me/KerbAlertsBot" target="_blank" rel="noreferrer">@KerbAlertsBot</a> (send /watch and your address).</li>
              <li>Follow everything on <Link href="/account">Your account</Link>: holdings, positions, and each borrow, repay and cure.</li>
            </ol>
            <p className="t-small ink-3">A standing demo position opens every cycle, so there is always something to cure at a demo Last Call, even on your first visit.</p>
          </section>

          <section id="rest" className="method-section">
            <h2>REST and SDK</h2>
            <p>Public, no key, CORS open. Values are decimal strings with their scale and a provenance label.</p>
            <CodeBlock variants={[{ lang: "shell", code: `curl -s "${PUBLIC_API}/v1/terms/196/HKEXCx" | jq '{usable, carryLTV, sessionMaxLTV, debtCeiling}'
curl -s "${PUBLIC_API}/v1/terms/196/HKEXCx/why"      # why these terms, with their numbers
curl -s "${PUBLIC_API}/v1/exit/196/HKEXCx"           # tick-walk against the OKX DEX quote` }]} />
            <p>Every endpoint, with a real captured response, is in <a href="https://github.com/Franlinozz/Kerb/blob/main/docs/API.md" target="_blank" rel="noreferrer">docs/API.md</a>. The TypeScript SDK and live examples are on <Link href="/developers">Developers</Link>.</p>
          </section>

          <section id="contracts" className="method-section">
            <h2>From a contract</h2>
            <p>KerbQuote reads the posted terms and the clock and returns max borrow, cure deadline and usability in one view call, valuing collateral exactly as Kerb Credit does. It holds nothing and has no owner.</p>
            <CodeBlock variants={[{ lang: "solidity", code: `KerbQuote.Quote memory q = KerbQuote(${quote?.address ?? "KERB_QUOTE"}).quoteToken(TOKEN, amount, KerbQuote.Mode.Carry);
require(q.usable, "Kerb: terms not usable");
require(debt <= q.maxBorrow, "Kerb: above Carry capacity");` }]} />
            <p>KerbMarkFeed exposes each asset's Credit Mark behind a Chainlink-shaped latestRoundData with 8 decimals, and reverts whenever the terms are not usable. <Link href="/developers#solidity">Live read and the feed addresses</Link>.</p>
          </section>

          <section id="agents" className="method-section">
            <h2>From an agent</h2>
            <p>Kerb Credit Check answers how much can be borrowed against a tokenized stock, and until when, for one cent in USDT0 over x402 on X Layer mainnet. Call it without payment to receive a 402 with the requirements; any x402 client signs and retries. Kerb Exit Check prices a sale of any size on the measured pool curve.</p>
            <CodeBlock variants={[{ lang: "shell", code: `curl -i -X POST ${PUBLIC_API}/agents/credit-check -H 'content-type: application/json' \\
  -d '{"asset":"HKEXCx","amount":"100","mode":"session_max"}'` }, { lang: "mcp", code: `{ "mcpServers": { "kerb": { "type": "http", "url": "${PUBLIC_API}/mcp" } } }` }]} />
            <p className="t-small ink-3">No model is anywhere in the path: the agent buys a computed answer with the transaction and inputs hash that recompute it.</p>
          </section>

          <section id="verify" className="method-section">
            <h2>Verify a number</h2>
            <p>Every post carries the keccak256 of its complete input bundle. Fetch the bundle, check its hash, and recompute the terms:</p>
            <CodeBlock variants={[{ lang: "shell", code: "git clone https://github.com/Franlinozz/Kerb && cd Kerb && pnpm install\npnpm --filter @kerb/engine kerb verify <inputsHash>" }]} />
          </section>

          <section id="addresses" className="method-section">
            <h2>Addresses</h2>
            <dl className="dev-endpoints">
              {rows.map(([name, net, a]) => <div key={name}><dt>{name} <span className="t-small ink-3">· {net}</span></dt><dd>{a ? <a className="mono" href={a.explorer} target="_blank" rel="noreferrer">{shortHash(a.address, 8, 6)}</a> : "Not read"}</dd></div>)}
            </dl>
            <p className="t-small ink-3">All of them, with Sourcify links: <Link href="/proof#contracts">Proof, Contracts</Link>.</p>
          </section>

          <section id="limits" className="method-section">
            <h2>Limits</h2>
            <p>Unaudited. The credit plane runs on testnet with mirror collateral; the risk plane is on mainnet and holds no user funds. One attester signs the terms, inside onchain guardrails it cannot loosen. The reference price is issuer data with an independent check, not Chainlink, until credentials exist. <Link href="/proof#limitations">Every limit and its rung</Link>.</p>
          </section>

          <section id="glossary" className="method-section">
            <h2>Glossary</h2>
            <dl className="docs-concepts">
              {[["KTS", "The Kerb Terms Standard: the formula, now version 0.2."], ["Input bundle", "Every observation a post was computed from, canonicalised and hashed; the hash is on chain."], ["Mirror collateral", "Testnet tokens that track a mainnet asset's terms, so credit can be shown without production assets."], ["mUSDG", "The testnet loan asset, a labelled stand-in for USDG."], ["Builder Code", "An ERC-8021 suffix on every Kerb transaction: kt0hl6xyhlx8xmt."], ["x402", "HTTP 402 payments: the server answers with requirements, the client pays and retries."]].map(([t, d]) => <div key={t}><dt>{t}</dt><dd className="ink-2">{d}</dd></div>)}
            </dl>
          </section>

          <section id="faq" className="method-section">
            <h2>FAQ</h2>
            <p>The questions people ask most, answered with the page that shows each answer. <Link href="/faq">Open the FAQ on its own page</Link>.</p>
            <FaqBrowser groups={FAQ} />
          </section>
        </div>
      </div>
    </div>
  );
}
