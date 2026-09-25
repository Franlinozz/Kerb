import Link from "@/components/ui/Link";
import { Mark } from "@/components/ui/Mark";
import { Wordmark } from "@/components/ui/Wordmark";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { StatusPill } from "./StatusPill";
import { ThemeMenu } from "./ThemeMenu";
import { LazyWallet } from "./LazyWallet";
import { HeaderScroll } from "./HeaderScroll";

export function SiteHeader(): React.ReactElement {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Link href="/" className="brand" aria-label="Kerb home"><Mark /><Wordmark /></Link>
        <NavLinks className="main-nav" pill />
        <div className="header-tools">
          <StatusPill />
          <span className="hide-sm"><LazyWallet /></span>
          <span className="show-sm"><LazyWallet compact /></span>
          <ThemeMenu />
          <MobileMenu />
        </div>
      </div>
      <HeaderScroll />
    </header>
  );
}
