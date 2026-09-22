"use client";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { MarketClocks } from "@/components/kerb/MarketClocks";
import { NavLinks } from "./NavLinks";
import { ThemeChoices } from "./ThemeMenu";
import { WalletButton } from "./WalletButton";

export function MobileMenu(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const close = (): void => setOpen(false);
  return (
    <>
      <button type="button" className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
      <Drawer open={open} onClose={close} label="Menu">
        <NavLinks className="drawer-nav" onNavigate={close} />
        <div className="drawer-section"><span className="t-label">Wallet</span><div className="mt-3"><WalletButton /></div></div>
        <div className="drawer-section"><span className="t-label">Markets</span><div className="mt-3"><MarketClocks /></div></div>
        <div className="drawer-section"><span className="t-label">Theme</span><div className="mt-3"><ThemeChoices /></div></div>
      </Drawer>
    </>
  );
}
