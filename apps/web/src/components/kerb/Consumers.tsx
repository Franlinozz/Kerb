/**
 * "One term, four consumers" (V3-07, docs/v3/V3-POSITIONING.md section 2). Each card states what
 * reads Kerb Terms and one evidence line fetched live: a card whose evidence cannot be fetched shows
 * its line without a number, never a placeholder.
 */
import Link from "@/components/ui/Link";
import { ProvMark } from "@/components/ui/ProvMark";
import type { AgentStats, Proof, PositionsFeed } from "@/lib/api";
import { shortHash } from "@/lib/format";

type Deployment = Proof["onchain"]["deployments"][number];
const ago = (iso: string): string => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m` : s < 86_400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86_400)}d`;
};
const LISTING: Record<AgentStats["listingStatus"], string> = { unregistered: "not listed on OKX.AI", registered: "registered on OKX.AI", under_review: "registered on OKX.AI, listing under review", listed: "listed on OKX.AI" };

export function Consumers({ positions, agents, deployments, endpoints }: { positions: PositionsFeed | null; agents: AgentStats | null; deployments: Deployment[]; endpoints: number }): React.ReactElement {
  const act = (positions as (PositionsFeed & { activity?: { borrows: number; cures: number; lastCureAt?: string | null } }) | null)?.activity;
  const paid = agents?.paidCalls.find((p) => p.network === "eip155:196") ?? null;
  const testPaid = agents?.paidCalls.find((p) => p.network === "eip155:1952") ?? null;
  const quoteMain = deployments.find((d) => d.chainId === 196 && d.contract === "KerbQuote");
  const quoteTest = deployments.find((d) => d.chainId === 1952 && d.contract === "KerbQuote");
  const quote = quoteMain ?? quoteTest;
  const cards: { title: string; line: string; href: string; evidence: React.ReactNode }[] = [
    {
      title: "Kerb Credit", href: "/credit",
      line: "The reference market: borrow at Carry or Session Max against mirror collateral on X Layer testnet.",
      evidence: act ? <>{act.borrows.toLocaleString("en-US")} borrows · {act.cures.toLocaleString("en-US")} cures{act.lastCureAt ? `, the last ${ago(act.lastCureAt)} ago` : ""} <ProvMark label="Verified" source="Borrowed and Cured events of KerbCredit on X Layer testnet 1952" /></> : "Borrow and cure events are read from KerbCredit on chain.",
    },
    {
      title: "Agents", href: "/developers#agents",
      line: "Pay one cent in USDT0 on X Layer for a credit check, through x402. No model in the path.",
      evidence: agents ? <>{paid ? `${paid.count} paid ${paid.count === 1 ? "call" : "calls"} settled on X Layer mainnet` : testPaid ? `${testPaid.count} paid ${testPaid.count === 1 ? "call" : "calls"} settled on X Layer testnet` : `x402 live on ${agents.live.network === "eip155:196" ? "X Layer mainnet" : "X Layer testnet"}, no settled mainnet call yet`} · {LISTING[agents.listingStatus]} <ProvMark label="Observed" source="Settled x402 calls recorded by kerb-agents" observedAt={agents.generatedAt} /></> : "Paid credit and exit checks over x402 on X Layer.",
    },
    {
      title: "Contracts", href: "/developers#solidity",
      line: quoteMain ? "Call KerbQuote on X Layer mainnet: max borrow and cure deadline in one read." : "Call KerbQuote on X Layer: max borrow and cure deadline in one read.",
      evidence: quote ? <><a className="mono" href={quote.explorer} target="_blank" rel="noreferrer">{shortHash(quote.address, 6, 4)}</a> · {quote.chainId === 196 ? "mainnet" : "testnet, mainnet pending"} · {quote.verification ?? "verification pending"}</> : "KerbQuote reads the posted terms in one call.",
    },
    {
      title: "Developers", href: "/developers",
      line: "REST, SDK and MCP. Public terms need no key.",
      evidence: <>{endpoints} endpoints · MCP at <span className="mono">api.usekerb.xyz/mcp</span></>,
    },
  ];
  return (
    <ul className="consumers" role="list">
      {cards.map((c) => (
        <li key={c.title}>
          <Link href={c.href} className="consumer-title">{c.title}</Link>
          <p className="ink-2">{c.line}</p>
          <p className="t-small ink-3 consumer-evidence">{c.evidence}</p>
        </li>
      ))}
    </ul>
  );
}
