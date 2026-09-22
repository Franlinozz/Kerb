"use client";
import dynamic from "next/dynamic";
import { Wallet as WalletIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The header's wallet control. The wallet stack (wagmi, viem) is the heaviest script on the site,
 * and most visitors only read: it loads at once for someone who connected before, on the first
 * pointer or focus on the button, or when the browser is idle a few seconds after load. Until then
 * the button is real and already works: pressing it loads the island and opens the wallet sheet.
 */
const Island = dynamic(() => import("./WalletIsland"), { ssr: false, loading: () => null });

function connectedBefore(): boolean {
  try { return Boolean(localStorage.getItem("wagmi.recentConnectorId")) || /"connections":\{"__type":"Map","value":\[\[/.test(localStorage.getItem("wagmi.store") ?? ""); } catch { return false; }
}

export function LazyWallet({ compact = false }: { compact?: boolean }): React.ReactElement {
  const [load, setLoad] = useState(false);
  const [openOnLoad, setOpenOnLoad] = useState(false);
  useEffect(() => {
    if (connectedBefore()) { setLoad(true); return; }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const t = setTimeout(() => {
      if (w.requestIdleCallback) w.requestIdleCallback(() => setLoad(true), { timeout: 4000 }); else setLoad(true);
    }, 5000);
    return () => clearTimeout(t);
  }, []);
  if (load) return <Island compact={compact} openOnLoad={openOnLoad} />;
  const warm = (): void => setLoad(true);
  const press = (): void => { setOpenOnLoad(true); setLoad(true); };
  return compact
    ? <button type="button" className="icon-btn" aria-label="Connect a wallet" onPointerEnter={warm} onFocus={warm} onClick={press}><WalletIcon /></button>
    : <button type="button" className="btn btn-sm" onPointerEnter={warm} onFocus={warm} onClick={press}>Connect</button>;
}
