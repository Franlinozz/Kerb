import { WalletLayer } from "@/components/WalletLayer";

/** Credit acts on chain, so its whole subtree carries the wallet layer. */
export default function CreditLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <WalletLayer>{children}</WalletLayer>;
}
