"use client";
import { WalletLayer } from "@/components/WalletLayer";
import { WalletButton } from "./WalletButton";

export default function WalletIsland({ compact = false, openOnLoad = false }: { compact?: boolean; openOnLoad?: boolean }): React.ReactElement {
  return <WalletLayer><WalletButton compact={compact} openOnLoad={openOnLoad} /></WalletLayer>;
}
