import Link from "@/components/ui/Link";
import { Mark } from "@/components/ui/Mark";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { StatusPill } from "./StatusPill";
import { ThemeMenu } from "./ThemeMenu";
import { LazyWallet } from "./LazyWallet";

export function SiteHeader(): React.ReactElement {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Link href="/" className="brand" aria-label="Kerb home"><Mark />Kerb</Link>
        <NavLinks className="main-nav" />
        <div className="header-tools">
          <StatusPill />
          <span className="hide-sm"><LazyWallet /></span>
          <span className="show-sm"><LazyWallet compact /></span>
          <ThemeMenu />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
