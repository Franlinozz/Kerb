"use client";

/**
 * Connect, and be honest about the chain.
 *
 * The credit market is on X Layer testnet. A visitor on any other chain is told so plainly and
 * offered the switch, rather than being shown numbers that would not be the ones they transact against.
 */
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { xLayerTestnet } from "@/lib/wagmi";

/** The header wallet control lives in components/shell/WalletButton.tsx. */
export { WalletButton as ConnectButton } from "./shell/WalletButton";

/**
 * Shown wherever an action needs the right chain.
 *
 * `quiet` renders nothing at all when there is no wallet, so a page with several action panels
 * says "connect a wallet" once at the top instead of repeating it beside every panel.
 */
export function ChainGuard({ children, quiet = false }: { children: React.ReactNode; quiet?: boolean }): React.ReactElement | null {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) {
    if (quiet) return null;
    return (
      <div className="callout">
        Connect a wallet to supply, borrow, repay or cure. Everything on this page is readable without one.
      </div>
    );
  }
  if (chainId !== xLayerTestnet.id) {
    return (
      <div className="callout callout-warn" role="alert">
        <strong>Wrong network.</strong> Kerb Credit runs on X Layer testnet (chain {xLayerTestnet.id}). Switch
        before acting, so you are transacting against the numbers shown here.{" "}
        <button
          type="button"
          className="theme-toggle"
          style={{ marginLeft: 6 }}
          disabled={isPending}
          onClick={() => switchChain({ chainId: xLayerTestnet.id })}
        >
          {isPending ? "Switching…" : "Switch network"}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
