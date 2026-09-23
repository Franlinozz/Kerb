/**
 * Terms, privacy and risk (V3 audit, operator request). Plain, specific to what Kerb actually does,
 * and consistent with the rest of the site: testnet credit, mainnet risk plane, no custody.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";

const UPDATED = "23 Sep 2026";
type Doc = { title: string; lede: string; sections: [string, string[]][] };
const DOCS: Record<string, Doc> = {
  terms: {
    title: "Terms of use",
    lede: "The rules for using usekerb.xyz, the Kerb API and the Kerb contracts. Short, because Kerb is a hackathon build and holds nothing of yours.",
    sections: [
      ["Who runs Kerb", ["Kerb is built by Xyndicate Labs for OKX Dev Day 2026. The source is public at github.com/Franlinozz/Kerb under the licence in the repository."]],
      ["What Kerb is", ["A risk layer that measures tokenized-stock pools on X Layer and publishes credit terms, a reference credit market (Kerb Credit) on X Layer testnet, read-only contracts on X Layer mainnet, a public API and paid agent endpoints.", "Kerb Credit uses test tokens with no value. Kerb offers no lending of real assets on any mainnet."]],
      ["No advice", ["Kerb Terms describe measured risk. Nothing on the site, in the API or in the contracts is investment, financial, legal or tax advice, or a recommendation to buy, sell, borrow or lend anything."]],
      ["No custody", ["Kerb never holds your assets. Every transaction is signed by your own wallet. The mainnet contracts hold no funds and have no owner who can move anything."]],
      ["Paid agent calls", ["Kerb Credit Check and Kerb Exit Check cost one cent in USDT0 per call, settled on X Layer through x402. A call is charged only when it answers successfully; a failed or invalid request is never settled. Settled payments are final."]],
      ["Your responsibilities", ["Use Kerb lawfully where you are. Tokenized stocks are restricted in some jurisdictions; Kerb does not help anyone acquire them or route around such restrictions. Keep your keys safe. Do not attack, overload or scrape the service beyond its published rate limits."]],
      ["No warranty", ["Kerb is provided as is, unaudited, without warranty of any kind. Numbers can be wrong, late or unavailable; the site says so when it knows. To the extent the law allows, Xyndicate Labs is not liable for losses from using Kerb or relying on its terms."]],
      ["Changes", ["These terms may change; the date above says when they last did. The repository keeps every version."]],
    ],
  },
  privacy: {
    title: "Privacy",
    lede: "Kerb has no accounts and does not track visitors. Here is exactly what it touches.",
    sections: [
      ["What the site stores", ["Your theme choice, in your own browser. Nothing else: no accounts, no tracking cookies, no analytics beacons, no fingerprinting."]],
      ["Wallets", ["Connecting a wallet shares your public address with the page in your browser so it can read your balances from X Layer. Kerb's servers do not keep a list of connected addresses."]],
      ["What the API sees", ["Like any web server, the Kerb API and web servers see the IP address and request of each call, used for rate limiting and kept only in short-lived operational logs."]],
      ["Public blockchains", ["Transactions you send are public on X Layer by design. The account page shows what the chain already shows about an address; anyone can read the same data on OKLink."]],
      ["Paid agent calls", ["For each settled x402 call Kerb records the payer address, the amount, the settlement transaction and a hash of the answer, as evidence. These are public on chain already."]],
      ["Contact", ["Questions: open an issue at github.com/Franlinozz/Kerb."]],
    ],
  },
  risk: {
    title: "Risk disclosure",
    lede: "Read this before relying on any Kerb number. Kerb is built to be honest about its limits; these are them.",
    sections: [
      ["Unaudited", ["No contract has been audited. They are tested (unit, fuzz, invariant and fork tests) and statically analysed, which is not the same thing."]],
      ["One attester", ["Terms are signed by a single attester key inside onchain guardrails it cannot loosen: bounded LTVs, a fixed liquidation line, tighten-fast and loosen-slow steps. A compromised or faulty attester could still post tighter or stale terms; contracts refuse terms older than their maximum age."]],
      ["Data can be wrong", ["The reference price is issuer data checked against an independent source, not a verified oracle report. Pool readings reflect one moment; depth can change in minutes, as it did in the BRK.Bx pool on 23 Sep. Terms can be minutes old; the site shows how old."]],
      ["Testnet credit", ["Kerb Credit runs on X Layer testnet with mirror collateral and a test loan asset. Its outcomes demonstrate the mechanism; they say nothing about returns or losses on real assets."]],
      ["Tokenized stocks", ["A tokenized stock is not the stock. Its liquidity on X Layer can vanish when the underlying market is shut, and some are restricted in some jurisdictions."]],
      ["Agents", ["An agent that pays for a Kerb answer receives a computed figure at one moment. It should check usable, the age, and the inputs hash before acting, and never treat an answer as a guarantee."]],
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
      <header className="page-head">
        <span className="t-label">Legal · last updated {UPDATED}</span>
        <h1>{d.title}.</h1>
        <p className="lede">{d.lede}</p>
        <nav className="legal-nav" aria-label="Legal pages">
          {Object.entries(DOCS).map(([k, v]) => <Link key={k} href={`/legal/${k}`} className="chip-filter" aria-current={k === doc ? "page" : undefined}>{v.title}</Link>)}
        </nav>
      </header>
      <div className="prose">
        {d.sections.map(([h, ps]) => <section key={h}><h2>{h}</h2>{ps.map((p) => <p key={p.slice(0, 32)}>{p}</p>)}</section>)}
      </div>
    </div>
  );
}
