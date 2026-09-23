import { WalletLayer } from "@/components/WalletLayer";

/** Account acts on chain, so its whole subtree carries the wallet layer. */
export default function AccountLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <WalletLayer>{children}</WalletLayer>;
}
