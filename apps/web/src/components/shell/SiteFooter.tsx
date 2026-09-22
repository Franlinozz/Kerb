import Link from "@/components/ui/Link";
import { MarketClocks } from "@/components/kerb/MarketClocks";

const COLS: { label: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  { label: "Product", links: [{ href: "/board", label: "Board" }, { href: "/credit", label: "Credit" }, { href: "/research", label: "Research" }] },
  { label: "Protocol", links: [{ href: "/methodology", label: "Methodology" }, { href: "/proof#contracts", label: "Contracts" }, { href: "/proof", label: "Proof" }] },
  { label: "Developers", links: [{ href: "/developers", label: "SDK" }, { href: "/developers#rest", label: "REST" }, { href: "https://github.com/Franlinozz/Kerb", label: "GitHub", external: true }] },
  // Studio links wait on the operator: no handle is published until it is confirmed.
  { label: "Studio", links: [{ href: "https://github.com/Franlinozz/Kerb", label: "Xyndicate Labs", external: true }, { href: "https://x.com/xyndicatepro", label: "@xyndicatepro on X", external: true }] },
];

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-cols">
          {COLS.map((c) => (
            <div key={c.label}>
              <span className="t-label">{c.label}</span>
              {c.links.map((l) => l.external
                ? <a key={l.label} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                : <Link key={l.label} href={l.href}>{l.label}</Link>)}
            </div>
          ))}
        </div>
        <div className="footer-clocks"><MarketClocks layout="row" /></div>
        <p className="footer-stand">Risk plane on X Layer mainnet. Credit plane on X Layer testnet with mirror collateral. Unaudited. Not investment advice.</p>
        <div className="footer-giant" aria-hidden="true">Kerb</div>
      </div>
    </footer>
  );
}
