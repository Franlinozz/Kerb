"use client";
import dynamic from "next/dynamic";

/** The header's wallet control loads after the page is interactive; a sized placeholder holds its place. */
const Island = dynamic(() => import("./WalletIsland"), {
  ssr: false,
  loading: () => <span className="wallet-placeholder" aria-hidden="true" />,
});

export function LazyWallet({ compact = false }: { compact?: boolean }): React.ReactElement {
  return <Island compact={compact} />;
}
