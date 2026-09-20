"use client";

/**
 * Connect, and be honest about the chain.
 *
 * The credit market is on X Layer testnet. A visitor on any other chain is told so plainly and
 * offered the switch, rather than being shown numbers that would not be the ones they transact against.
 */
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { xLayerTestnet } from "@/lib/wagmi";
import { shortHash } from "@/lib/format";

export function ConnectButton(): React.ReactElement {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];

  if (isConnected && address) {
    return (
      <span className="wallet">
        <span className="mono dim">{shortHash(address, 6, 4)}</span>
        <button type="button" className="theme-toggle" onClick={() => disconnect()}>
          Disconnect
        </button>
      </span>
    );
  }

  return (
    <span className="wallet">
      <button
        type="button"
        className="theme-toggle"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
      >
        {isPending ? "Connecting…" : injected ? "Connect wallet" : "No wallet found"}
      </button>
      {error ? <span className="faint">{error.message.slice(0, 80)}</span> : null}
    </span>
  );
}

/** Shown wherever an action needs the right chain. */
export function ChainGuard({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) {
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
