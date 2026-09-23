import Link from "@/components/ui/Link";
import { Mark } from "@/components/ui/Mark";
import { MarketClocks } from "@/components/kerb/MarketClocks";
import { ArrowUpRight } from "lucide-react";

const COLS: { label: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  { label: "Product", links: [{ href: "/board", label: "Board" }, { href: "/credit", label: "Credit" }, { href: "/account", label: "Your account" }, { href: "/research", label: "Research" }] },
  { label: "Protocol", links: [{ href: "/methodology", label: "Methodology" }, { href: "/proof#contracts", label: "Contracts" }, { href: "/proof", label: "Proof" }, { href: "/changelog", label: "Changelog" }] },
  { label: "Developers", links: [{ href: "/docs", label: "Docs" }, { href: "/developers", label: "SDK" }, { href: "/developers#agents", label: "Agents" }, { href: "/developers#rest", label: "REST" }, { href: "https://github.com/Franlinozz/Kerb", label: "GitHub", external: true }] },
  // Studio: the operator confirmed @xyndicatepro (22 Sep). Kerb has no X handle yet.
  { label: "Studio", links: [{ href: "https://github.com/Franlinozz/Kerb", label: "Xyndicate Labs", external: true }, { href: "https://x.com/xyndicatepro", label: "@xyndicatepro on X", external: true }] },
];

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="Kerb home"><Mark />Kerb</Link>
            <p className="ink-2">Credit terms for tokenized stocks that follow the market&apos;s clock: how much, for how long, and what happens at the close.</p>
          </div>
          <div className="footer-cta">
            <Link href="/credit" className="btn btn-primary">Try Credit on testnet</Link>
            <Link href="/methodology" className="btn">Read the standard</Link>
          </div>
        </div>
        <nav className="footer-cols" aria-label="Footer">
          {COLS.map((c) => (
            <div key={c.label}>
              <span className="t-label">{c.label}</span>
              {c.links.map((l) => l.external
                ? <a key={l.label} href={l.href} target="_blank" rel="noreferrer">{l.label}<ArrowUpRight size={13} aria-hidden="true" /></a>
                : <Link key={l.label} href={l.href}>{l.label}</Link>)}
            </div>
          ))}
        </nav>
        <div className="footer-clocks"><MarketClocks layout="row" /></div>
        <div className="footer-bottom">
          <p className="footer-stand">Risk plane on X Layer mainnet. Credit plane on X Layer testnet with mirror collateral. Unaudited. Not investment advice.</p>
          <p className="footer-legal">© 2026 Xyndicate Labs · Built for OKX Dev Day 2026</p>
        </div>
      </div>
      <div className="footer-giant" aria-hidden="true"><span>Kerb</span></div>
    </footer>
  );
}
