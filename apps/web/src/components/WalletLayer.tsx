"use client";

/**
 * The wallet layer. Every WagmiProvider in the app wraps the same config, and wagmi keeps its
 * state in that config, so the header's wallet control and the Credit page see one connection.
 */
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

export function WalletLayer({ children }: { children: React.ReactNode }): React.ReactElement {
  return <WagmiProvider config={wagmiConfig} reconnectOnMount>{children}</WagmiProvider>;
}
