"use client";
import { ExternalLink, LogOut, UserRound, Wallet as WalletIcon } from "lucide-react";
import Link from "@/components/ui/Link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AddressChip } from "@/components/ui/AddressChip";
import { mapTxError, mapWalletError } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { xLayerTestnet } from "@/lib/wagmi";
import { shortHash } from "@/lib/format";

const EXPLORER = "https://www.oklink.com/x-layer-testnet";

/** EIP-6963 discovered wallets first (OKX Wallet at the top), the generic injected one last. */
function ordered(connectors: readonly Connector[]): Connector[] {
  // One entry per wallet: an EIP-6963 wallet can be announced more than once (two wallet layers
  // share one config), and its connector id is its rdns, so keep the first of each id.
  const seen = new Set<string>();
  const discovered = connectors.filter((c) => c.id !== "injected" && !seen.has(c.id) && seen.add(c.id) !== undefined);
  const generic = connectors.filter((c) => c.id === "injected");
  const okxFirst = [...discovered].sort((a, b) => Number(/okx/i.test(b.name)) - Number(/okx/i.test(a.name)));
  return [...okxFirst, ...(discovered.length ? [] : generic)];
}

export function WalletSheet({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const { connectAsync, connectors, isPending } = useConnect();
  const [hasInjected, setHasInjected] = useState(true);
  useEffect(() => { setHasInjected(typeof window !== "undefined" && "ethereum" in window); }, [open]);
  const list = ordered(connectors).filter((c) => c.id !== "injected" || hasInjected);
  const connect = async (c: Connector): Promise<void> => {
    try {
      await connectAsync({ connector: c, chainId: xLayerTestnet.id });
      onClose();
      toast({ tone: "success", title: "Wallet connected", body: `${c.name} on X Layer testnet.` });
    } catch (err) {
      const m = mapWalletError(err);
      toast({ tone: m.kind === "cancelled" ? "info" : "error", title: m.title, body: m.kind === "cancelled" ? undefined : m.message, ttl: m.kind === "cancelled" ? 3000 : null });
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Connect a wallet" footer="Kerb Credit runs on X Layer testnet (chain 1952). We will ask your wallet to add it.">
      {list.length === 0 ? (
        <div>
          <p className="ink-2">No browser wallet found. Install one, then come back to this page.</p>
          <div className="row mt-4">
            <a className="btn btn-sm" href="https://www.okx.com/web3" target="_blank" rel="noreferrer">OKX Wallet <ExternalLink size={14} /></a>
            <a className="btn btn-sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask <ExternalLink size={14} /></a>
          </div>
        </div>
      ) : (
        <div className="wallet-list">
          {list.map((c) => (
            <button key={c.uid} type="button" className="wallet-option" disabled={isPending} onClick={() => void connect(c)}>
              {c.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.icon} alt="" />
              ) : <span className="wallet-glyph"><WalletIcon size={16} /></span>}
              {c.id === "injected" ? "Browser wallet" : c.name}
              {/okx/i.test(c.name) ? <span className="hint">Recommended on X Layer</span> : null}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function WalletButton({ compact = false, openOnLoad = false }: { compact?: boolean; openOnLoad?: boolean }): React.ReactElement {
  // The wallet's own chain: useChainId() only ever returns a configured chain, so it cannot see a
  // wallet sitting on another network.
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  // Opened at once when the visitor pressed Connect before the wallet stack had loaded.
  const [sheet, setSheet] = useState(openOnLoad);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent): void => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [menu]);

  if (!isConnected || !address) {
    return (
      <>
        {compact ? (
          <button type="button" className="icon-btn" aria-label="Connect a wallet" onClick={() => setSheet(true)}><WalletIcon /></button>
        ) : <Button size="sm" onClick={() => setSheet(true)}>Connect</Button>}
        <WalletSheet open={sheet} onClose={() => setSheet(false)} />
      </>
    );
  }
  const onChain = chainId === xLayerTestnet.id;
  return (
    <div className="wallet-menu" ref={ref}>
      <button type="button" className="net-badge" data-ok={onChain} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        <span className="status-dot" aria-hidden="true" style={onChain ? undefined : { background: "var(--brass)" }} />
        {compact ? shortHash(address, 4, 3) : <>{shortHash(address, 6, 4)} · {onChain ? "X Layer testnet" : "Wrong network"}</>}
      </button>
      {menu ? (
        <div className="popover" role="menu" style={{ minWidth: 260 }}>
          <div style={{ padding: "8px 10px" }}><AddressChip value={address} href={`${EXPLORER}/address/${address}`} label="address" /></div>
          {!onChain ? (
            <button type="button" role="menuitem" disabled={switching} onClick={async () => {
              try { await switchChainAsync({ chainId: xLayerTestnet.id }); } catch (err) { const m = mapTxError(err); toast({ tone: "warn", title: m.kind === "cancelled" ? "Network switch cancelled" : "Could not switch network", body: m.kind === "cancelled" ? undefined : "Add X Layer testnet (1952) in your wallet, then try again." }); }
            }}>Switch to X Layer testnet</button>
          ) : null}
          <Link role="menuitem" className="menu-link" href="/account" onClick={() => setMenu(false)}><UserRound />Your account</Link>
          <button type="button" role="menuitem" onClick={() => { disconnect(); setMenu(false); }}><LogOut />Disconnect</button>
        </div>
      ) : null}
    </div>
  );
}
