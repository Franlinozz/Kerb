import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/Theme";
import { Providers } from "@/components/Providers";
import { ConnectButton } from "@/components/Wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kerb", template: "%s · Kerb" },
  description: "The market-time risk layer for tokenized securities on X Layer. Never lend more than you can liquidate.",
  metadataBase: new URL("https://usekerb.xyz"),
};

/** Paint the stored theme before first paint so neither theme ever flashes the other. */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('kerb-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

const NAV = [
  { href: "/board", label: "Board" },
  { href: "/market", label: "Market" },
  { href: "/proof", label: "Proof" },
];

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <Providers>
        <header className="site-head">
          <div className="wrap site-head-inner">
            <Link href="/" className="brand" aria-label="Kerb home">
              Kerb
            </Link>
            <nav aria-label="Main">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <ConnectButton />
            <ThemeToggle />
          </div>
        </header>
        <main className="wrap site-main">{children}</main>
        <footer className="site-foot">
          <div className="wrap">
            <p className="faint">
              Kerb observes market time, executable depth and source quality, and turns them into reproducible
              onchain credit terms. Never lend more than you can liquidate.
            </p>
            <p className="faint">
              Risk plane live on X Layer mainnet. Credit plane runs on testnet with mirror collateral.{" "}
              <Link href="/proof">See the proof</Link>.
            </p>
          </div>
        </footer>
        </Providers>
      </body>
    </html>
  );
}
