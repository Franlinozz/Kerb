"use client";

/**
 * Wallet wiring for the testnet credit plane.
 *
 * Injected connectors only: no WalletConnect project id to obtain, nothing phones home, and the
 * page works with any browser wallet the visitor already has. The credit market is on X Layer
 * testnet, so that is the only chain configured; being on the wrong one is a state the UI shows
 * rather than a thing it silently papers over.
 */
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" } },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [xLayerTestnet],
  connectors: [injected()],
  transports: { [xLayerTestnet.id]: http("https://testrpc.xlayer.tech") },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
