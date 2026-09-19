import { createPublicClient, defineChain, fallback, http, type Address, type Hex, type PublicClient } from "viem";

export const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/xlayer" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export type KerbChainId = 196 | 1952;
export const CHAINS = { 196: xLayer, 1952: xLayerTestnet } as const;

export function chainById(id: number): typeof xLayer | typeof xLayerTestnet {
  if (id === 196) return xLayer;
  if (id === 1952) return xLayerTestnet;
  throw new Error(`unsupported chain ${id}`);
}

function rpcUrls(id: KerbChainId): string[] {
  const env = id === 196 ? process.env["KERB_RPC_MAINNET"] : process.env["KERB_RPC_TESTNET"];
  const base = chainById(id).rpcUrls.default.http[0] as string;
  const urls = (env ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!urls.includes(base)) urls.push(base);
  return urls;
}

const clients = new Map<number, PublicClient>();

export function publicClient(id: KerbChainId): PublicClient {
  let c = clients.get(id);
  if (!c) {
    c = createPublicClient({
      chain: chainById(id),
      transport: fallback(rpcUrls(id).map((u) => http(u, { timeout: 20_000, retryCount: 2 }))),
      batch: { multicall: false },
    }) as PublicClient;
    clients.set(id, c);
  }
  return c;
}

export function explorerBase(id: number): string {
  return chainById(id).blockExplorers.default.url;
}
export const explorerAddress = (id: number, a: Address): string => `${explorerBase(id)}/address/${a}`;
export const explorerToken = (id: number, a: Address): string => `${explorerBase(id)}/token/${a}`;
export const explorerTx = (id: number, h: Hex): string => `${explorerBase(id)}/tx/${h}`;
export const explorerBlock = (id: number, n: bigint | number): string => `${explorerBase(id)}/block/${n}`;
