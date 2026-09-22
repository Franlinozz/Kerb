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

const fetchIsland = (): Promise<unknown> => import("./WalletIsland");

export function LazyWallet({ compact = false }: { compact?: boolean }): React.ReactElement {
  // `ready` flips only once the island's code is in the browser, so the placeholder never
  // disappears under the pointer: a click on it is always caught, and then opens the sheet.
  const [ready, setReady] = useState(false);
  const [pressed, setPressed] = useState(false);
  const warm = (): void => { void fetchIsland().then(() => setReady(true)); };
  useEffect(() => {
    if (connectedBefore()) { warm(); return; }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const t = setTimeout(() => { if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 4000 }); else warm(); }, 5000);
    return () => clearTimeout(t);
  }, []);
  if (ready) return <Island compact={compact} openOnLoad={pressed} />;
  const press = (): void => { setPressed(true); warm(); };
  return compact
    ? <button type="button" className="icon-btn" aria-label="Connect a wallet" onPointerEnter={warm} onFocus={warm} onClick={press}><WalletIcon /></button>
    : <button type="button" className="btn btn-sm" onPointerEnter={warm} onFocus={warm} onClick={press}>Connect</button>;
}
