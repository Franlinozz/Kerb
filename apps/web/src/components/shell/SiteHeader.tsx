import Link from "next/link";
import { Mark } from "@/components/ui/Mark";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { StatusPill } from "./StatusPill";
import { ThemeMenu } from "./ThemeMenu";
import { WalletButton } from "./WalletButton";

export function SiteHeader(): React.ReactElement {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Link href="/" className="brand" aria-label="Kerb home"><Mark />Kerb</Link>
        <NavLinks className="main-nav" />
        <div className="header-tools">
          <StatusPill />
          <span className="hide-sm"><WalletButton /></span>
          <span className="show-sm"><WalletButton compact /></span>
          <ThemeMenu />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
