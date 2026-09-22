"use client";
import { WalletLayer } from "@/components/WalletLayer";
import { WalletButton } from "./WalletButton";

export default function WalletIsland({ compact = false }: { compact?: boolean }): React.ReactElement {
  return <WalletLayer><WalletButton compact={compact} /></WalletLayer>;
}
