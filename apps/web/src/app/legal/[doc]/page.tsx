/**
 * Terms, privacy and risk (V3 audit): each a real document with a plain-language summary, numbered
 * sections, a contents rail and a switcher between the three. Specific to what Kerb does: testnet
 * credit, a mainnet risk plane, no custody, no tracking.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import { ScrollSpy } from "@/components/kerb/ScrollSpy";

const EFFECTIVE = "23 September 2026";
type Section = { id: string; title: string; body: (string | string[])[] };
type Doc = { title: string; short: string; lede: string; summary: string[]; sections: Section[] };

const DOCS: Record<string, Doc> = {
  terms: {
    title: "Terms of use", short: "Terms",
    lede: "The rules for using usekerb.xyz, the Kerb API, the agent endpoints and the Kerb contracts.",
    summary: ["Kerb is a hackathon build by Xyndicate Labs, open source under the MIT licence.", "Kerb Credit uses test tokens with no value. Kerb offers no lending of real assets.", "Nothing here is advice. Kerb Terms describe measured risk.", "Kerb never holds your assets; your wallet signs everything.", "Paid agent calls cost one cent and are charged only when they answer."],
    sections: [
      { id: "who", title: "Who runs Kerb", body: ["Kerb is built and operated by Xyndicate Labs for OKX Dev Day 2026. The source code is public at github.com/Franlinozz/Kerb under the MIT licence; the licence governs the code, these terms govern the hosted service."] },
      { id: "service", title: "What the service is", body: ["Kerb consists of:", ["a measurement and attestation system that posts credit terms for tokenized stocks on X Layer mainnet;", "Kerb Credit, a reference credit market on X Layer testnet that uses mirror collateral and a test loan asset (mUSDG);", "read-only contracts on X Layer mainnet (KerbQuote and KerbMarkFeed);", "a public read API, a free MCP server, and paid agent endpoints."], "Test tokens have no value and cannot be redeemed for anything. Kerb does not offer lending, borrowing or custody of real assets on any mainnet."] },
      { id: "advice", title: "No advice", body: ["Kerb Terms, reports, sentences and figures describe measured risk at a moment in time. They are not investment, financial, legal or tax advice, and not a recommendation to buy, sell, hold, borrow or lend anything. Decide for yourself, and seek advice where you need it."] },
      { id: "custody", title: "No custody", body: ["Kerb never holds your assets or your keys. Every transaction is proposed by the page and signed by your own wallet. The mainnet contracts hold no funds and have no owner who can move funds. The testnet market's parameters are set by its admin and are shown on Proof."] },
      { id: "paid", title: "Paid agent calls", body: ["Kerb Credit Check and Kerb Exit Check cost USD 0.01 per call in USDT0, settled on X Layer through the x402 protocol and the OKX facilitator. A call is charged only when it answers successfully: a malformed request is refused before any payment is requested, and a failed answer is never settled. Settled payments are final and are recorded as public evidence."] },
      { id: "use", title: "Your responsibilities", body: ["Use Kerb lawfully where you are. Tokenized stocks are restricted in some jurisdictions; Kerb does not help anyone acquire them or work around such restrictions. Keep your keys safe. Do not attack, overload or scrape the service beyond its published rate limits (60 paid calls and 60 MCP calls a minute per address)."] },
      { id: "warranty", title: "No warranty, limited liability", body: ["Kerb is provided as is and as available, unaudited and without warranty of any kind. Figures can be wrong, late or unavailable; where Kerb knows, the site says so. To the fullest extent the law allows, Xyndicate Labs is not liable for any loss arising from using Kerb or relying on its terms."] },
      { id: "changes", title: "Changes", body: ["These terms may change. The effective date above says when they last did, and the repository keeps every version."] },
    ],
  },
  privacy: {
    title: "Privacy", short: "Privacy",
    lede: "Kerb has no accounts and does not track visitors. This is everything it touches.",
    summary: ["No accounts, no tracking cookies, no analytics beacons.", "Your theme choice and tour progress stay in your own browser.", "Kerb's servers do not keep a list of wallets that connect.", "Paid agent calls are recorded as public evidence: payer, amount, transaction."],
    sections: [
      { id: "browser", title: "What stays in your browser", body: ["Two small preferences, saved by your own browser: your theme (Night, Day or Market time) and whether you have seen the guided tour. Clearing site data removes them. Nothing else is written."] },
      { id: "wallet", title: "Wallets", body: ["Connecting a wallet shares its public address with the page running in your browser, so the page can read your balances and positions from X Layer. Kerb's servers do not receive or store a list of connected addresses. The account page reads the same public data anyone can read on OKLink."] },
      { id: "servers", title: "What the servers see", body: ["Like any web server, the Kerb web and API servers receive the IP address, time and path of each request. These are used to serve the page and to enforce rate limits, and are kept only in short-lived operational logs, never sold or shared."] },
      { id: "chain", title: "Public blockchains", body: ["Transactions you send are public on X Layer by design and cannot be erased by anyone. Kerb only reads what the chain already shows."] },
      { id: "agents", title: "Paid agent calls", body: ["For each settled x402 call Kerb records the payer address, the amount, the settlement transaction, the time, and a hash of the answer it returned. These records are evidence that the service was paid for and delivered; the payment itself is already public on chain."] },
      { id: "contact", title: "Contact", body: ["Questions about privacy: open an issue at github.com/Franlinozz/Kerb."] },
    ],
  },
  risk: {
    title: "Risk disclosure", short: "Risk",
    lede: "Read this before relying on any Kerb figure. Kerb is built to be honest about its limits; these are them.",
    summary: ["No contract has been audited.", "One attester signs the terms, inside guardrails it cannot loosen.", "Figures can be wrong or minutes old; the site shows their age.", "Kerb Credit runs on testnet with tokens that have no value.", "A tokenized stock is not the stock, and its exit can vanish when its market is shut."],
    sections: [
      { id: "audit", title: "Unaudited contracts", body: ["No Kerb contract has been audited. They are covered by unit, fuzz, invariant and mainnet fork tests and a dispositioned static analysis (SECURITY.md in the repository). That is not an audit, and it does not rule out a defect."] },
      { id: "attester", title: "A single attester", body: ["Terms are signed by one attester key. KerbTerms enforces guardrails the attester cannot loosen: bounded loan-to-value limits, a fixed liquidation line per asset, tightening that takes effect at once and loosening in small steps after a cooldown, and a maximum report age after which terms become unusable. A faulty or compromised attester could still post terms that are tighter than warranted, or stop posting."] },
      { id: "data", title: "Data can be wrong or late", body: ["The reference price is issuer data checked against an independent public source, not a verified oracle report. Pool readings describe one moment: depth can change within minutes, as it did in the BRK.Bx pool on 23 September 2026. Terms are posted every few minutes, so a figure can be minutes old; every live figure shows its age."] },
      { id: "testnet", title: "Testnet credit", body: ["Kerb Credit runs on X Layer testnet with mirror collateral and mUSDG, a test loan asset. Its outcomes demonstrate the mechanism. They say nothing about returns, losses or liquidations on real assets."] },
      { id: "tokens", title: "Tokenized stocks", body: ["A tokenized stock is a token that tracks a share; it is not the share. When the underlying market is shut no new reference price arrives, and the onchain pool may be the only exit, sometimes a thin one. Some tokenized stocks are restricted in some jurisdictions."] },
      { id: "agents", title: "Agents and contracts", body: ["An agent or contract that reads Kerb receives a computed figure at one moment. Before acting it should check that the terms are usable, how old they are, and the inputs hash, and treat no answer as a guarantee."] },
    ],
  },
};

export function generateStaticParams(): { doc: string }[] { return Object.keys(DOCS).map((doc) => ({ doc })); }
export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const d = DOCS[(await params).doc];
  return d ? { title: d.title, description: d.lede } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }): Promise<React.ReactElement> {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <div className="legal">
      <header className="page-head doc-head">
        <span className="t-label">Legal · effective {EFFECTIVE}</span>
        <h1>{d.title}.</h1>
        <p className="lede">{d.lede}</p>
        <nav className="legal-switch" aria-label="Legal documents">
          {Object.entries(DOCS).map(([k, v]) => <Link key={k} href={`/legal/${k}`} className="legal-tab" aria-current={k === doc ? "page" : undefined}>{v.title}</Link>)}
        </nav>
      </header>
      <div className="method-grid">
        <aside className="method-toc"><ScrollSpy items={[{ id: "short", label: "In short" }, ...d.sections.map((s) => ({ id: s.id, label: s.title }))]} /></aside>
        <article className="method-body legal-body">
          <section id="short" className="legal-short">
            <span className="t-label">In short</span>
            <ul>{d.summary.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
          {d.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal-sec">
              <h2><span className="legal-num mono">{String(i + 1).padStart(2, "0")}</span>{s.title}</h2>
              {s.body.map((b, j) => Array.isArray(b) ? <ul key={j}>{b.map((x) => <li key={x}>{x}</li>)}</ul> : <p key={j}>{b}</p>)}
            </section>
          ))}
          <p className="t-small ink-3 legal-foot">Effective {EFFECTIVE}. Questions: <a href="https://github.com/Franlinozz/Kerb/issues" target="_blank" rel="noreferrer">open an issue</a>. See also the <Link href="/faq">FAQ</Link>.</p>
        </article>
      </div>
    </div>
  );
}
